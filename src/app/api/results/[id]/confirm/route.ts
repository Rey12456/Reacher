import { createClient } from "@/lib/supabase/server";
import { writeDrafts } from "@/lib/drafts";
import { describeFacts } from "@/lib/pipeline";
import { track } from "@/lib/track";
import type { Ask, Fact, Label, Profile } from "@/lib/types";

export const maxDuration = 30;

// The user checked the profile and confirms an unconfirmed fact: promote it and rewrite the drafts with it.
export async function POST(request: Request, ctx: RouteContext<"/api/results/[id]/confirm">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { fact } = (await request.json().catch(() => ({}))) as { fact?: Fact };
  const { data: row } = await supabase
    .from("search_results")
    .select("id, label, verified, possible, reason, ask_used, contact:contacts(name, title), search:searches(company, role, ask)")
    .eq("id", id)
    .maybeSingle();
  if (!row || !fact) return Response.json({ error: "Not found" }, { status: 404 });

  const possible = (row.possible as Fact[]).filter((f) => !(f.type === fact.type && f.value === fact.value));
  if (possible.length === (row.possible as Fact[]).length) return Response.json({ error: "Fact not found" }, { status: 400 });
  const verified = [...(row.verified as Fact[]), fact];

  const { data: profile } = await supabase.from("profiles").select("name, summary").eq("user_id", user.id).single<Pick<Profile, "name" | "summary">>();
  const contact = row.contact as unknown as { name: string; title: string | null };
  const search = row.search as unknown as { company: string; role: string; ask: Ask };

  try {
    const drafts = await writeDrafts({
      profile: profile ?? { name: null, summary: null },
      person: { name: contact.name, title: contact.title ?? "", label: row.label as Label },
      company: search.company,
      role: search.role,
      ask: search.ask,
      verified,
    });
    const parts: string[] = [];
    if ((row.verified as Fact[]).length) parts.push(`Shared ${describeFacts(row.verified as Fact[])}`);
    parts.push(`You confirmed ${describeFacts([fact])}`);
    if (possible.length) parts.push(`Possibly shared ${describeFacts(possible)}, check their profile`);
    parts.push(String(row.reason).split(" · ").at(-1)!); // the role label part
    const reason = parts.join(" · ");
    const { data: updated } = await supabase
      .from("search_results")
      .update({
        verified,
        possible,
        reason,
        ask_used: drafts.ask,
        note_ai: drafts.note,
        message_ai: drafts.message,
        note_text: drafts.note,
        message_text: drafts.message,
        model: drafts.model,
      })
      .eq("id", id)
      .select("id, verified, possible, reason, ask_used, note_text, message_text")
      .single();
    await track(user.id, "fact_confirmed", { type: fact.type });
    return Response.json(updated);
  } catch {
    return Response.json({ error: "Couldn't rewrite the drafts. Try again." }, { status: 502 });
  }
}

import { createClient } from "@/lib/supabase/server";
import { draftSource } from "@/lib/drafts";
import { track } from "@/lib/track";
import { STATUSES, type Status } from "@/lib/types";

// Changes a contact's status. Marking "sent" also records what was sent and how much of it was the AI's.
export async function PATCH(request: Request, ctx: RouteContext<"/api/contacts/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const status = body.status as Status;
  if (!STATUSES.some((s) => s.value === status)) return Response.json({ error: "Bad status" }, { status: 400 });

  const { data: contact } = await supabase.from("contacts").select("id, status, sent_at").eq("id", id).maybeSingle();
  if (!contact) return Response.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status, status_updated_at: now };
  const props: Record<string, string | number | boolean | null> = { from: contact.status, to: status, via: String(body.via ?? "table") };

  if (status === "sent" && typeof body.resultId === "string") {
    const { data: result } = await supabase
      .from("search_results")
      .select("note_ai, message_ai, note_text, message_text, model")
      .eq("id", body.resultId)
      .eq("contact_id", id)
      .maybeSingle();
    if (result) {
      const noteSource = draftSource(result.note_ai ?? "", result.note_text ?? "");
      const messageSource = draftSource(result.message_ai ?? "", result.message_text ?? "");
      // The overall source is the more user-driven of the two drafts.
      const order = ["ai_unchanged", "ai_edited", "user_written"] as const;
      const source = order[Math.max(order.indexOf(noteSource), order.indexOf(messageSource))];
      Object.assign(update, {
        final_note: result.note_text,
        final_message: result.message_text,
        draft_source: source,
        draft_model: result.model,
      });
      Object.assign(props, { draft_source: source, note_source: noteSource, message_source: messageSource });
    }
  }
  if (status === "sent" && !contact.sent_at) update.sent_at = now;
  if (status === "not_sent") update.sent_at = null;

  const { data: updated } = await supabase.from("contacts").update(update).eq("id", id).select("id, status, sent_at").single();
  await track(user.id, "status_changed", props);
  return Response.json(updated);
}

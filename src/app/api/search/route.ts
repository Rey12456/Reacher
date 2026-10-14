import { createAdminClient, createClient } from "@/lib/supabase/server";
import { searchGoogle } from "@/lib/serper";
import { buildQueries, collectCandidates, rank } from "@/lib/pipeline";
import { labelCandidates } from "@/lib/labels";
import { writeDrafts } from "@/lib/drafts";
import { track } from "@/lib/track";
import type { Ask, Profile } from "@/lib/types";

export const maxDuration = 60;

const ASKS: Ask[] = ["chat", "advice", "referral"];
const DRAFT_CONCURRENCY = 3;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

// Streams newline-delimited JSON: progress steps, each contact as its drafts finish, then done.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const company = String(body.company ?? "").trim().slice(0, 100);
  const role = String(body.role ?? "").trim().slice(0, 100);
  const ask: Ask = ASKS.includes(body.ask) ? body.ask : "chat";
  if (!company || !role) return Response.json({ error: "Company and role are required" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle<Profile>();
  if (!profile) return Response.json({ error: "Set up your profile first" }, { status: 400 });

  // Same company+role within 24 hours: reuse the saved result instead of spending queries.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { data: recent } = await supabase
    .from("searches")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "done")
    .ilike("company", escapeLike(company))
    .ilike("role", escapeLike(role))
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    await track(user.id, "search_cached_reused");
    return Response.json({ cached: true, searchId: recent.id });
  }

  // Global daily cap protects the shared Serper quota against bugs and loops.
  const admin = createAdminClient();
  const cap = Number(process.env.GLOBAL_DAILY_SEARCH_CAP ?? 30);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("searches")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today.toISOString());
  if ((count ?? 0) >= cap) {
    await track(user.id, "search_capped");
    return Response.json({ error: "Reacher has hit its daily search limit. Try again tomorrow." }, { status: 429 });
  }

  const { data: search, error } = await supabase
    .from("searches")
    .insert({ user_id: user.id, company, role, ask })
    .select("id")
    .single();
  if (error || !search) return Response.json({ error: "Could not start search" }, { status: 500 });

  const started = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        send({ type: "started", searchId: search.id });

        const planned = buildQueries(profile, company, role);
        send({ type: "progress", step: `Searching for people at ${company}`, pct: 20 });
        let freshQueries = 0;
        const settled = await Promise.allSettled(
          planned.map(async ({ fact, q }) => {
            const { hits, cached } = await searchGoogle(q);
            if (!cached) freshQueries++;
            return { fact, hits };
          }),
        );
        const results = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
        if (!results.length) throw new Error("Google search is unavailable right now. Try again shortly.");

        const { candidates } = collectCandidates(results, company);
        send({ type: "progress", step: `Checking ${candidates.length} profiles`, pct: 45 });
        const labels = await labelCandidates(candidates, role);
        const ranked = rank(candidates, labels);

        if (!ranked.length) {
          send({ type: "progress", step: "No matching people found", pct: 100 });
        } else {
          send({ type: "progress", step: `Writing drafts for ${ranked.length} people`, pct: 55, total: ranked.length });
        }

        let next = 0;
        let finished = 0;
        const worker = async () => {
          while (next < ranked.length) {
            const index = next++;
            const p = ranked[index];
            let drafts: { note: string; message: string; ask: Ask; model: string | null };
            try {
              drafts = await writeDrafts({ profile, person: p, company, role, ask, verified: p.verified });
            } catch {
              drafts = { note: "", message: "", ask, model: null }; // the user can still write their own
            }

            const { data: contact } = await supabase
              .from("contacts")
              .upsert(
                {
                  user_id: user.id,
                  linkedin_url: p.url,
                  name: p.name,
                  title: p.title,
                  company,
                  location: p.location ?? null,
                  education: p.education ?? null,
                },
                { onConflict: "user_id,linkedin_url" },
              )
              .select("id, linkedin_url, name, title, location, status, sent_at")
              .single();
            if (!contact) continue;

            const { data: row } = await supabase
              .from("search_results")
              .insert({
                search_id: search.id,
                contact_id: contact.id,
                rank: index + 1,
                score: p.score,
                label: p.label,
                reason: p.reason,
                verified: p.verified,
                possible: p.possible,
                ask_used: drafts.ask,
                note_ai: drafts.note,
                message_ai: drafts.message,
                note_text: drafts.note,
                message_text: drafts.message,
                model: drafts.model,
              })
              .select("id, rank, label, reason, verified, possible, ask_used, note_text, message_text")
              .single();
            finished++;
            if (row) send({ type: "contact", result: { ...row, contact } });
            send({ type: "progress", step: `Wrote drafts for ${finished} of ${ranked.length}`, pct: 55 + Math.round((finished / ranked.length) * 45) });
          }
        };
        await Promise.all(Array.from({ length: DRAFT_CONCURRENCY }, worker));

        await supabase.from("searches").update({ status: "done", queries_used: freshQueries }).eq("id", search.id);
        await track(user.id, "search_completed", {
          results: ranked.length,
          with_verified: ranked.filter((r) => r.verified.length).length,
          possible_only: ranked.filter((r) => !r.verified.length && r.possible.length).length,
          no_connection: ranked.filter((r) => !r.verified.length && !r.possible.length).length,
          candidates: candidates.length,
          queries: planned.length,
          fresh_queries: freshQueries,
          ask,
          duration_ms: Date.now() - started,
        });
        send({ type: "done", searchId: search.id });
      } catch (err) {
        await supabase.from("searches").update({ status: "failed" }).eq("id", search.id);
        await track(user.id, "search_failed", { stage: "pipeline" });
        send({ type: "error", message: err instanceof Error ? err.message : "Search failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

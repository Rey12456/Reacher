import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Fact } from "@/lib/types";

// The "is this worth developing?" thresholds, agreed before launch.
export const THRESHOLDS = { retention: 0.5, action: 0.5, accept: 0.3, reply: 0.1 };

type Funnel = { sent: number; accepted: number; replied: number };

const weekKey = (iso: string) => {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};
const rate = (n: number, d: number) => (d ? n / d : null);

export async function getMetrics() {
  const admin = createAdminClient();
  const [{ data: searches }, { data: results }, { data: contacts }, { count: users }, { data: events }] = await Promise.all([
    admin.from("searches").select("id, user_id, status, created_at").limit(10_000),
    admin.from("search_results").select("search_id, contact_id, verified, possible, created_at").order("created_at").limit(50_000),
    admin.from("contacts").select("id, user_id, status, sent_at, draft_source").limit(50_000),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).not("consented_at", "is", null),
    admin.from("events").select("type").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(100_000),
  ]);

  const done = (searches ?? []).filter((s) => s.status === "done");
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));
  const resultsBySearch = new Map<string, typeof results>();
  for (const r of results ?? []) resultsBySearch.set(r.search_id, [...(resultsBySearch.get(r.search_id) ?? []), r]);

  // Retention: searchers who came back in a later week.
  const weeksByUser = new Map<string, Set<string>>();
  for (const s of done) {
    const set = weeksByUser.get(s.user_id) ?? new Set();
    set.add(weekKey(s.created_at));
    weeksByUser.set(s.user_id, set);
  }
  const searchers = weeksByUser.size;
  const returning = [...weeksByUser.values()].filter((w) => w.size >= 2).length;

  // Action: searches where at least one result was contacted.
  const withSent = done.filter((s) => (resultsBySearch.get(s.id) ?? []).some((r) => contactById.get(r.contact_id)?.sent_at)).length;

  // Outcome funnel over everyone ever marked sent.
  const funnel = (list: typeof contacts): Funnel => {
    const sent = (list ?? []).filter((c) => c.sent_at);
    return {
      sent: sent.length,
      accepted: sent.filter((c) => c.status === "accepted" || c.status === "replied").length,
      replied: sent.filter((c) => c.status === "replied").length,
    };
  };
  const overall = funnel(contacts);

  // Data quality: how often a search found a verified connection.
  const withResults = done.filter((s) => resultsBySearch.get(s.id)?.length);
  const withVerified = withResults.filter((s) => resultsBySearch.get(s.id)!.some((r) => (r.verified as Fact[]).length)).length;
  const allResults = withResults.flatMap((s) => resultsBySearch.get(s.id)!);

  // Do drafts and connection strength actually change outcomes?
  const bySource = Object.fromEntries(
    (["ai_unchanged", "ai_edited", "user_written"] as const).map((src) => [
      src,
      funnel((contacts ?? []).filter((c) => c.draft_source === src)),
    ]),
  );
  const latestResult = new Map<string, { verified: Fact[]; possible: Fact[] }>();
  for (const r of results ?? []) latestResult.set(r.contact_id, { verified: r.verified as Fact[], possible: r.possible as Fact[] });
  const strengthOf = (id: string) => {
    const r = latestResult.get(id);
    return r?.verified.length ? "verified" : r?.possible.length ? "possible_only" : "none";
  };
  const byConnection = Object.fromEntries(
    (["verified", "possible_only", "none"] as const).map((k) => [k, funnel((contacts ?? []).filter((c) => strengthOf(c.id) === k))]),
  );

  const eventCounts: Record<string, number> = {};
  for (const e of events ?? []) eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1;

  return {
    users: users ?? 0,
    searchers,
    searches: done.length,
    headline: {
      retention: { value: rate(returning, searchers), n: searchers, threshold: THRESHOLDS.retention },
      action: { value: rate(withSent, done.length), n: done.length, threshold: THRESHOLDS.action },
      accept: { value: rate(overall.accepted, overall.sent), n: overall.sent, threshold: THRESHOLDS.accept },
      reply: { value: rate(overall.replied, overall.sent), n: overall.sent, threshold: THRESHOLDS.reply },
    },
    quality: {
      searchesWithVerified: rate(withVerified, withResults.length),
      avgResults: rate(allResults.length, withResults.length),
      avgVerified: rate(allResults.filter((r) => (r.verified as Fact[]).length).length, withResults.length),
    },
    overall,
    bySource,
    byConnection,
    eventCounts,
  };
}

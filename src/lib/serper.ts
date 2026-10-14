import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export type SearchHit = { title: string; link: string; snippet: string };

const CACHE_DAYS = 30;

// Google results via Serper, cached per query for all users so repeated lookups cost nothing.
export async function searchGoogle(query: string): Promise<{ hits: SearchHit[]; cached: boolean }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data: cached } = await admin
    .from("serper_cache")
    .select("results")
    .eq("query", query)
    .gte("fetched_at", since)
    .maybeSingle();
  if (cached) return { hits: cached.results as SearchHit[], cached: true };

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY! },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) throw new Error(`Search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const organic: SearchHit[] = ((await res.json()).organic ?? []).map((o: SearchHit) => ({
    title: o.title ?? "",
    link: o.link ?? "",
    snippet: o.snippet ?? "",
  }));
  await admin.from("serper_cache").upsert({ query, results: organic, fetched_at: new Date().toISOString() });
  return { hits: organic, cached: false };
}

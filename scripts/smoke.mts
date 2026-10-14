// End-to-end check of the real pipeline code against live Groq + Serper, without Supabase.
// Usage: npx tsx --conditions=react-server --env-file=.env.local scripts/smoke.mts "Stripe" "Software Engineer"
// Costs ~8 Serper queries and ~5 Groq calls.

import { extractProfile } from "@/lib/resume";
import { buildQueries, collectCandidates, rank } from "@/lib/pipeline";
import { labelCandidates } from "@/lib/labels";
import { writeDrafts } from "@/lib/drafts";
import { NOTE_LIMIT } from "@/lib/types";
import type { SearchHit } from "@/lib/serper";

const [company = "Stripe", role = "Software Engineer"] = process.argv.slice(2);

// Fictional resume for testing.
const RESUME = `Jordan Rivera
New York, NY · jordan@example.com
EDUCATION
Carnegie Mellon University, B.S. Computer Science, 2019-2023
EXPERIENCE
Squarespace, Software Engineer, New York, 2023-present
- Built billing services in Java and TypeScript; cut checkout latency 30%.
Acme Analytics (client: Pfizer), Software Engineering Intern, Summer 2022
- Data pipelines in Python.
SKILLS: TypeScript, Java, Python, Postgres, AWS`;

async function google(q: string): Promise<SearchHit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY! },
    body: JSON.stringify({ q, num: 10 }),
  });
  return (await res.json()).organic ?? [];
}

const t0 = Date.now();
const profile = await extractProfile(RESUME);
console.log("EXTRACTED PROFILE", JSON.stringify(profile, null, 2));

const planned = buildQueries(profile, company, role);
console.log(`\nQUERIES (${planned.length})`, planned.map((p) => p.q));
const results = await Promise.all(planned.map(async ({ fact, q }) => ({ fact, hits: await google(q) })));
const { candidates, dropped } = collectCandidates(results, company);
const labels = await labelCandidates(candidates, role);
const ranked = rank(candidates, labels);
console.log(`\n${candidates.length} candidates, ${dropped} dropped; labels:`, Object.fromEntries([...labels.values()].reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map())));

for (const p of ranked) console.log(`#${p.label.padEnd(9)} ${p.name} | ${p.title} | ${p.reason}`);

for (const p of ranked.slice(0, 3)) {
  const d = await writeDrafts({ profile, person: p, company, role, ask: "referral", verified: p.verified });
  console.log(`\n--- ${p.name} (ask used: ${d.ask}; verified: ${p.verified.map((f) => f.value).join(", ") || "none"})`);
  console.log(`NOTE (${d.note.length}/${NOTE_LIMIT}${d.note.length > NOTE_LIMIT ? " OVER" : ""}): ${d.note}`);
  console.log(`MESSAGE: ${d.message}`);
}
console.log(`\nTotal ${((Date.now() - t0) / 1000).toFixed(1)}s`);

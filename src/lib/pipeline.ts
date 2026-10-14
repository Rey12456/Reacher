// Pure search-pipeline logic: query building, snippet parsing, fact verification, ranking.
// No I/O here, so it can be tested directly.
import type { Fact, FactType, Label, Profile } from "@/lib/types";
import type { SearchHit } from "@/lib/serper";

export const MAX_QUERIES = 8;
export const MAX_RESULTS = 10;

export type PlannedQuery = { fact: Fact | null; q: string };

export type Candidate = {
  url: string;
  name: string;
  title: string;
  company: string;
  location?: string;
  education?: string;
  verified: Fact[];
  possible: Fact[];
};

export type Ranked = Candidate & { label: Label; score: number; reason: string };

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// One query per shared fact (schools first, the strongest signal), then a plain role query.
export function buildQueries(profile: Pick<Profile, "schools" | "employers" | "city">, company: string, role: string) {
  const base = `site:linkedin.com/in "${company}" "${role}"`;
  const facts: Fact[] = [
    ...profile.schools.slice(0, 3).map((s) => ({ type: "school" as const, value: s.name })),
    ...profile.employers
      .filter((e) => norm(e.name) !== norm(company))
      .slice(0, 3)
      .map((e) => ({ type: "employer" as const, value: e.name })),
    // "New York, NY" -> "New York": snippets say "New York" or "New York City Metropolitan Area".
    ...(profile.city ? [{ type: "city" as const, value: profile.city.split(",")[0].trim() }] : []),
  ].filter((f) => f.value?.trim());
  const planned: PlannedQuery[] = facts.slice(0, MAX_QUERIES - 1).map((fact) => ({ fact, q: `${base} "${fact.value}"` }));
  planned.push({ fact: null, q: base });
  return planned;
}

// "Mai Sha - Software Engineer at Stripe" -> { name, title, company }
export function parseHeadline(title: string) {
  const m = title.match(/^(.+?) [-–] (.+?) (?:at|@) (.+?)(?: [-–|·].*)?$/i);
  return m ? { name: m[1].trim(), title: m[2].trim(), company: m[3].trim() } : null;
}

// Structured snippet fields, e.g. "Education: Yale University · Location: Brooklyn".
export function snippetField(snippet: string, label: string) {
  return snippet.match(new RegExp(`${label}: ([^·]+)`))?.[1].trim();
}

// True when the headline's company is the one searched ("Visa" matches "Visa Inc", not "VisaHQ").
export function isCurrentlyAt(headlineCompany: string, company: string) {
  const h = norm(headlineCompany);
  const c = norm(company);
  return h === c || h.startsWith(c + " ");
}

// Verified = the fact sits in the snippet's structured field. Possible = it only appears in free text.
export function classifyFact(fact: Fact, hit: SearchHit): "verified" | "possible" | null {
  const structured: Record<FactType, string | undefined> = {
    school: snippetField(hit.snippet, "Education"),
    city: snippetField(hit.snippet, "Location"),
    employer: snippetField(hit.snippet, "Experience"),
  };
  const value = norm(fact.value);
  const field = structured[fact.type];
  if (field && norm(field).includes(value)) return "verified";
  if (norm(`${hit.title} ${hit.snippet}`).includes(value)) return "possible";
  return null;
}

export function collectCandidates(results: { fact: Fact | null; hits: SearchHit[] }[], company: string) {
  const people = new Map<string, Candidate>();
  let dropped = 0;
  for (const { fact, hits } of results) {
    for (const hit of hits) {
      const head = parseHeadline(hit.title);
      if (!head || !hit.link.includes("linkedin.com/in/") || !isCurrentlyAt(head.company, company)) {
        dropped++;
        continue;
      }
      const url = hit.link.split("?")[0];
      const p = people.get(url) ?? { url, ...head, verified: [], possible: [] };
      p.education ??= snippetField(hit.snippet, "Education");
      p.location ??= snippetField(hit.snippet, "Location");
      if (fact) {
        const kind = classifyFact(fact, hit);
        const known = [...p.verified, ...p.possible].some((f) => f.type === fact.type && f.value === fact.value);
        if (kind === "verified") {
          p.possible = p.possible.filter((f) => !(f.type === fact.type && f.value === fact.value));
          if (!p.verified.some((f) => f.type === fact.type && f.value === fact.value)) p.verified.push(fact);
        } else if (kind === "possible" && !known) {
          p.possible.push(fact);
        }
      }
      people.set(url, p);
    }
  }
  return { candidates: [...people.values()], dropped };
}

const WEIGHT: Record<FactType, number> = { school: 3, employer: 2, city: 1 };
const FACT_NAME: Record<FactType, string> = { school: "school", employer: "past employer", city: "city" };

export function describeFacts(facts: Fact[]) {
  return facts.map((f) => `${FACT_NAME[f.type]} (${f.value})`).join(", ");
}

// Verified connections dominate; unconfirmed ones only break ties; peers/managers beat recruiters.
export function rank(candidates: Candidate[], labels: Map<string, Label | "irrelevant">): Ranked[] {
  const scored = candidates
    .map((c) => {
      const label = labels.get(c.url) ?? "peer";
      if (label === "irrelevant") return null;
      const verified = c.verified.reduce((s, f) => s + WEIGHT[f.type], 0);
      const possible = c.possible.reduce((s, f) => s + WEIGHT[f.type], 0);
      const score = verified * 10 + possible + (label === "recruiter" ? 0 : 0.5);
      return { ...c, label, score, reason: "" };
    })
    .filter((c): c is Ranked => c !== null)
    .sort((a, b) => b.score - a.score);

  const out: Ranked[] = [];
  let recruiters = 0;
  for (const c of scored) {
    if (c.label === "recruiter" && recruiters++ >= 1) continue;
    out.push({ ...c, reason: buildReason(c) });
    if (out.length === MAX_RESULTS) break;
  }
  return out;
}

function buildReason(c: Omit<Ranked, "reason">) {
  const parts: string[] = [];
  if (c.verified.length) parts.push(`Shared ${describeFacts(c.verified)}`);
  if (c.possible.length) parts.push(`Possibly shared ${describeFacts(c.possible)}, check their profile`);
  if (!parts.length) parts.push("No shared connection found");
  parts.push(c.label === "manager" ? "Likely senior to the role" : c.label === "recruiter" ? "Recruiter" : "Works in the role");
  return parts.join(" · ");
}

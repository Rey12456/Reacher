import "server-only";
import { completeJSON, MODELS } from "@/lib/llm";
import type { Candidate } from "@/lib/pipeline";
import type { Label } from "@/lib/types";

type LabelResult = { items: { i: number; label: Label | "irrelevant" }[] };

// Asks the fast model to tag each title relative to the target role. Falls back to keywords if the call fails.
export async function labelCandidates(candidates: Candidate[], role: string) {
  const labels = new Map<string, Label | "irrelevant">();
  if (!candidates.length) return labels;
  try {
    const list = candidates.map((c, i) => `${i}. ${c.title}`).join("\n");
    const out = await completeJSON<LabelResult>(MODELS.fast, [
      {
        role: "system",
        content:
          'You classify job titles relative to a target role. For each title return a label: "peer" (does the target role or a close variant, including abbreviations like SWE/SDE), "manager" (more senior people on the same kind of team who might hire for the role: manager, lead, director, head), "recruiter" (recruiting/talent acquisition), or "irrelevant" (unrelated function). Interns count as "peer". Reply as JSON: {"items":[{"i":0,"label":"peer"}]}.',
      },
      { role: "user", content: `Target role: ${role}\nTitles:\n${list}` },
    ]);
    for (const { i, label } of out.items ?? []) {
      if (candidates[i]) labels.set(candidates[i].url, label);
    }
  } catch {
    // keyword fallback below
  }
  for (const c of candidates) {
    if (labels.has(c.url)) continue;
    labels.set(
      c.url,
      /recruit|talent/i.test(c.title) ? "recruiter" : /manager|director|head|lead|vp|chief/i.test(c.title) ? "manager" : "peer",
    );
  }
  return labels;
}

import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { completeJSON, MODELS } from "@/lib/llm";
import type { Employer, School } from "@/lib/types";

export type ExtractedProfile = {
  name: string | null;
  schools: School[];
  employers: Employer[];
  city: string | null;
  summary: string | null;
};

// Text from the PDF in memory; the file itself is never stored.
export async function pdfToText(bytes: ArrayBuffer) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function extractProfile(resumeText: string): Promise<ExtractedProfile> {
  const out = await completeJSON<Partial<ExtractedProfile>>(MODELS.fast, [
    {
      role: "system",
      content: `Extract facts from a resume. Use names exactly as written, with no abbreviations expanded or invented.
Return JSON: {"name": string|null, "schools": [{"name","degree","years"}], "employers": [{"name","title","years"}], "city": string|null, "summary": string|null}.
- schools: universities/colleges only (no high schools, bootcamps or online courses).
- employers: organizations the person worked at, most recent first; exclude clients, projects and schools.
- city: current city if stated, else null.
- summary: 2-3 plain sentences on what they do and have done, for writing outreach messages. Write it without any pronouns or the person's name (e.g. "Software engineer in New York focused on billing systems…"); never guess gender.`,
    },
    { role: "user", content: resumeText.slice(0, 15_000) },
  ]);
  return {
    name: out.name ?? null,
    schools: (out.schools ?? []).filter((s) => s?.name),
    employers: (out.employers ?? []).filter((e) => e?.name),
    city: out.city ?? null,
    summary: out.summary ?? null,
  };
}

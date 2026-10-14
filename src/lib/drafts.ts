import "server-only";
import { completeJSON, MODELS } from "@/lib/llm";
import { describeFacts } from "@/lib/pipeline";
import { NOTE_LIMIT, type Ask, type Fact, type Label, type Profile } from "@/lib/types";

export type DraftInput = {
  profile: Pick<Profile, "name" | "summary">;
  person: { name: string; title: string; label: Label };
  company: string;
  role: string;
  ask: Ask;
  verified: Fact[];
};

// A referral is only a fair ask when there's a strong verified tie.
export function effectiveAsk(ask: Ask, verified: Fact[]): Ask {
  if (ask !== "referral") return ask;
  return verified.some((f) => f.type === "school" || f.type === "employer") ? "referral" : "chat";
}

const ASK_TEXT: Record<Ask, (role: string, company: string) => string> = {
  chat: () => "a 30-minute chat about their work and team",
  advice: (role, company) => `brief advice on landing a ${role} role at ${company}`,
  referral: (role) => `whether they'd be open to referring them for a ${role} opening, after a short chat`,
};

export async function writeDrafts(input: DraftInput) {
  const ask = effectiveAsk(input.ask, input.verified);
  const facts = input.verified.length ? describeFacts(input.verified) : "NONE";
  const prompt = `Sender: ${input.profile.name ?? "the sender"}. About the sender: ${input.profile.summary ?? "job seeker"}.
Recipient: ${input.person.name}, ${input.person.title} at ${input.company} (${input.person.label}).
Sender is targeting: ${input.role} at ${input.company}.
Verified shared facts (the ONLY connection you may mention): ${facts}.
The ask: ${ASK_TEXT[ask](input.role, input.company)}.

Write two drafts:
1. "note": a LinkedIn connection request note, at most ${NOTE_LIMIT} characters including spaces. Greet them by first name (keep multi-part given names like "Myung Soo" whole; fix all-lowercase names).
2. "message": a first message to send after they accept, 60-120 words, warm and specific, ending with the ask and signed with the sender's first name.
Rules:
- Never invent or imply any connection, shared history or fact beyond the verified list. If the list is NONE, mention no connection at all.
- Never claim knowledge of the recipient's own work, team, projects or impact, and never praise it. You only know their name and title.
- Never claim the sender has been following, admiring or reading anything. Only use what "About the sender" says.
- Write the role and company in full (no abbreviations like "SE" or "SWE"). School abbreviations in common use (e.g. CMU) are fine.
- Plain, direct, human. No flattery, no clichés, no emojis.
Reply as JSON: {"note":"...","message":"..."}`;

  let out = await completeJSON<{ note: string; message: string }>(MODELS.writer, [{ role: "user", content: prompt }]);
  if (out.note.length > NOTE_LIMIT) {
    out = await completeJSON<{ note: string; message: string }>(MODELS.writer, [
      { role: "user", content: prompt },
      { role: "user", content: `Your note was ${out.note.length} characters. Rewrite so the note is under ${NOTE_LIMIT - 20} characters.` },
    ]);
  }
  return { note: trimNote(out.note.trim()), message: out.message.trim(), ask, model: MODELS.writer };
}

// Last resort: cut at the final sentence boundary that fits.
function trimNote(note: string) {
  if (note.length <= NOTE_LIMIT) return note;
  const cut = note.slice(0, NOTE_LIMIT);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > 80 ? cut.slice(0, end + 1) : cut.slice(0, NOTE_LIMIT - 1).trimEnd() + "…";
}

// How much of the AI text survived in what the user actually sent.
export function draftSource(ai: string, sent: string): "ai_unchanged" | "ai_edited" | "user_written" {
  const a = ai.trim();
  const s = sent.trim();
  if (a === s) return "ai_unchanged";
  const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9']+/g) ?? []);
  const aw = words(a);
  const sw = words(s);
  const shared = [...sw].filter((w) => aw.has(w)).length;
  return sw.size && shared / sw.size >= 0.5 ? "ai_edited" : "user_written";
}

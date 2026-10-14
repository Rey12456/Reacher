import { createClient } from "@/lib/supabase/server";
import { extractProfile, pdfToText } from "@/lib/resume";
import { track } from "@/lib/track";

export const maxDuration = 60;

// Accepts a PDF upload or pasted text, extracts the profile and saves it. The PDF is never stored.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  let text = String(form.get("text") ?? "");
  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > 4 * 1024 * 1024) return Response.json({ error: "PDF must be under 4 MB" }, { status: 400 });
      text = await pdfToText(await file.arrayBuffer());
    }
  } catch {
    return Response.json({ error: "Couldn't read that PDF. Try pasting the text instead." }, { status: 400 });
  }
  text = text.trim();
  if (text.length < 100) return Response.json({ error: "That resume looks empty. Try pasting the text." }, { status: 400 });

  try {
    const extracted = await extractProfile(text);
    await supabase.from("profiles").upsert({
      user_id: user.id,
      ...extracted,
      resume_text: text,
      updated_at: new Date().toISOString(),
    });
    await track(user.id, "resume_extracted", {
      source: file instanceof File && file.size > 0 ? "pdf" : "text",
      schools: extracted.schools.length,
      employers: extracted.employers.length,
      has_city: !!extracted.city,
    });
    return Response.json(extracted);
  } catch {
    return Response.json({ error: "Extraction failed. Try again, or fill the form in by hand." }, { status: 502 });
  }
}

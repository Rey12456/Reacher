import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";

// Client-side interactions worth counting. Only these names, with enum/count props, are accepted.
const ALLOWED = new Set(["profile_link_opened", "note_copied", "message_copied", "nudge_shown"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { type, props } = await request.json().catch(() => ({}));
  if (!ALLOWED.has(type)) return Response.json({ error: "Unknown event" }, { status: 400 });
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 30)) clean[k] = v;
  }
  await track(user.id, type, clean);
  return Response.json({ ok: true });
}

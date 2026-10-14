import { createClient } from "@/lib/supabase/server";

// Saves the user's edits to a result's drafts (called on blur).
export async function PATCH(request: Request, ctx: RouteContext<"/api/results/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const update: Record<string, string> = {};
  if (typeof body.note_text === "string") update.note_text = body.note_text.slice(0, 2000);
  if (typeof body.message_text === "string") update.message_text = body.message_text.slice(0, 5000);
  if (!Object.keys(update).length) return Response.json({ error: "Nothing to update" }, { status: 400 });

  // Row level security limits this to the signed-in user's own results.
  const { error, count } = await supabase.from("search_results").update(update, { count: "exact" }).eq("id", id);
  if (error || !count) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

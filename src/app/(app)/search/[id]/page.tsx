import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { ResultRow } from "@/lib/types";
import { ResultsView } from "@/components/results-view";

export default async function SearchPage(props: PageProps<"/search/[id]">) {
  const { id } = await props.params;
  const { cached } = await props.searchParams;
  const { supabase } = await requireProfile();

  const { data: search } = await supabase.from("searches").select("id, company, role, ask, status, created_at").eq("id", id).maybeSingle();
  if (!search) notFound();

  const { data } = await supabase
    .from("search_results")
    .select(
      "id, rank, label, reason, verified, possible, ask_used, note_text, message_text, contact:contacts(id, linkedin_url, name, title, location, status, sent_at)",
    )
    .eq("search_id", id)
    .order("rank");
  const rows = (data ?? []) as unknown as ResultRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-2xl font-bold">
          {search.role} at {search.company}
        </h1>
        <span className="lbl sm:ml-auto">
          {rows.length} people · asked for {{ chat: "a 30-min chat", advice: "advice", referral: "a referral" }[search.ask as string] ?? "a chat"} ·{" "}
          {new Date(search.created_at).toLocaleDateString()}
        </span>
      </div>
      {cached && (
        <p className="panel px-3 py-2 text-sm text-stone-700">You ran this search in the last 24 hours, so here are those results again.</p>
      )}
      {search.status === "failed" && <p className="text-sm text-red-700">This search failed partway; results may be incomplete.</p>}
      {rows.length === 0 && <p className="text-[15px] text-stone-600">No people found for this search.</p>}
      <ResultsView rows={rows} />
    </div>
  );
}

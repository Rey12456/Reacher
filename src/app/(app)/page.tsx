import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { SearchForm } from "./search-form";
import { Nudges } from "./nudges";

type Supabase = Awaited<ReturnType<typeof requireProfile>>["supabase"];

// Contacts still marked "sent" a week later, plus recent searches.
function loadHome(supabase: Supabase) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  return Promise.all([
    supabase
      .from("contacts")
      .select("id, name, title, company, linkedin_url, sent_at")
      .eq("status", "sent")
      .lt("sent_at", weekAgo)
      .order("sent_at")
      .limit(20),
    supabase
      .from("searches")
      .select("id, company, role, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
}

export default async function HomePage() {
  const { supabase } = await requireProfile();
  const [{ data: stale }, { data: searches }] = await loadHome(supabase);

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <h1 className="text-2xl font-bold">Who should you reach out to?</h1>
        <SearchForm />
      </section>

      {!!stale?.length && <Nudges contacts={stale} />}

      {!!searches?.length && (
        <section className="space-y-3">
          <h2 className="lbl">Recent searches</h2>
          <ul className="panel divide-y divide-stone-200 text-[15px]">
            {searches.map((s) => (
              <li key={s.id}>
                <Link href={`/search/${s.id}`} className="flex justify-between gap-4 px-5 py-4 hover:bg-stone-50">
                  <span>
                    {s.role} at <strong className="font-semibold">{s.company}</strong>
                    {s.status === "failed" && <span className="ml-2 text-red-700">failed</span>}
                  </span>
                  <span className="font-mono text-sm text-stone-600">{new Date(s.created_at).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

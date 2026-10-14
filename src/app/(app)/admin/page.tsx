import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { getMetrics } from "@/lib/metrics";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const num = (v: number | null) => (v === null ? "—" : v.toFixed(1));

const HEADLINES = {
  retention: { title: "Come back", help: "Searchers who searched again in a later week" },
  action: { title: "Act on results", help: "Searches where at least one person was marked sent" },
  accept: { title: "Accepted", help: "Of people marked sent, how many accepted (or replied)" },
  reply: { title: "Replied", help: "Of people marked sent, how many replied" },
} as const;

const MIN_SAMPLE = 10;

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!isAdmin(user.email)) notFound();
  const m = await getMetrics();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Is Reacher worth developing?</h1>
        <p className="mt-1 text-[15px] text-stone-600">
          {m.users} users · {m.searchers} have searched · {m.searches} completed searches. Thresholds were set before
          launch; a miss is a real &ldquo;no&rdquo;.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(HEADLINES) as (keyof typeof HEADLINES)[]).map((k) => {
          const h = m.headline[k];
          const early = h.n < MIN_SAMPLE;
          const pass = h.value !== null && h.value >= h.threshold;
          return (
            <div key={k} className="card">
              <div className="lbl">{HEADLINES[k].title}</div>
              <div className="mt-1 font-mono text-3xl font-medium">{pct(h.value)}</div>
              <div className="mt-1 text-sm text-stone-600">
                target ≥ {pct(h.threshold)} · n = {h.n}
              </div>
              <div
                className={`mt-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                  early ? "bg-stone-100 text-stone-600" : pass ? "bg-ok/15 text-ok" : "bg-red-100 text-red-800"
                }`}
              >
                {early ? "Too early to call" : pass ? "Meets target" : "Below target"}
              </div>
              <p className="mt-2 text-sm text-stone-600">{HEADLINES[k].help}</p>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="lbl">Result quality</h2>
        <div className="card grid gap-2 text-sm sm:grid-cols-3">
          <div>
            Searches with ≥1 verified connection: <strong>{pct(m.quality.searchesWithVerified)}</strong>
          </div>
          <div>
            Avg results per search: <strong>{num(m.quality.avgResults)}</strong>
          </div>
          <div>
            Avg verified per search: <strong>{num(m.quality.avgVerified)}</strong>
          </div>
        </div>
      </section>

      <FunnelTable
        title="Outcomes by draft source"
        rows={[
          ["AI draft, unchanged", m.bySource.ai_unchanged],
          ["AI draft, edited", m.bySource.ai_edited],
          ["User-written", m.bySource.user_written],
        ]}
      />
      <FunnelTable
        title="Outcomes by connection strength"
        rows={[
          ["Verified shared fact", m.byConnection.verified],
          ["Unconfirmed only", m.byConnection.possible_only],
          ["No connection", m.byConnection.none],
        ]}
      />

      <section className="space-y-2">
        <h2 className="lbl">Events, last 30 days</h2>
        <div className="card grid gap-1 text-sm sm:grid-cols-3">
          {Object.entries(m.eventCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="flex justify-between gap-4">
                <span className="text-stone-600">{type}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function FunnelTable({ title, rows }: { title: string; rows: [string, { sent: number; accepted: number; replied: number }][] }) {
  return (
    <section className="space-y-2">
      <h2 className="lbl">{title}</h2>
      <table className="panel w-full text-[15px]">
        <thead className="text-left text-stone-500">
          <tr>
            <th className="px-5 py-3" />
            <th className="lbl px-5 py-3 font-normal">Sent</th>
            <th className="lbl px-5 py-3 font-normal">Accepted</th>
            <th className="lbl px-5 py-3 font-normal">Replied</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map(([label, f]) => (
            <tr key={label}>
              <td className="px-5 py-3">{label}</td>
              <td className="px-5 py-3">{f.sent}</td>
              <td className="px-5 py-3">
                {f.accepted} <span className="text-stone-500">({pct(f.sent ? f.accepted / f.sent : null)})</span>
              </td>
              <td className="px-5 py-3">
                {f.replied} <span className="text-stone-500">({pct(f.sent ? f.replied / f.sent : null)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

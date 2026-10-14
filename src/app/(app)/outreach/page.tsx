import { requireProfile } from "@/lib/auth";
import { StatusSelect } from "@/components/status-select";
import type { Status } from "@/lib/types";

export default async function OutreachPage() {
  const { supabase } = await requireProfile();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, title, company, linkedin_url, status, sent_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const sent = contacts?.filter((c) => c.sent_at).length ?? 0;
  const replied = contacts?.filter((c) => c.status === "replied").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My outreach</h1>
        <p className="lbl mt-1">
          {contacts?.length ?? 0} people · {sent} contacted · {replied} replied
        </p>
      </div>
      {!contacts?.length ? (
        <p className="text-sm text-stone-600">No contacts yet. Run a search from the home page.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead className="border-b border-stone-200 text-left">
              <tr>
                <th className="lbl px-5 py-3.5 font-normal">Person</th>
                <th className="lbl px-5 py-3.5 font-normal">Company</th>
                <th className="lbl px-5 py-3.5 font-normal">Sent</th>
                <th className="lbl px-5 py-3.5 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3.5">
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                      {c.name}
                    </a>
                    <div className="text-stone-500">{c.title}</div>
                  </td>
                  <td className="px-5 py-3.5">{c.company}</td>
                  <td className="px-5 py-3.5 text-stone-500">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3.5">
                    <StatusSelect contactId={c.id} initial={c.status as Status} via="outreach" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

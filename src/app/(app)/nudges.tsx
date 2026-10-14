"use client";

import { useEffect, useState } from "react";
import type { Status } from "@/lib/types";
import { logEvent, setStatus } from "@/components/client-api";

type Stale = { id: string; name: string; title: string | null; company: string | null; linkedin_url: string; sent_at: string | null };

const ACTIONS: { status: Status; label: string }[] = [
  { status: "accepted", label: "Accepted" },
  { status: "replied", label: "Replied" },
  { status: "no_response", label: "No response" },
];

// Contacts marked "sent" over a week ago: one click to record what happened.
export function Nudges({ contacts }: { contacts: Stale[] }) {
  const [pending, setPending] = useState(contacts);
  useEffect(() => logEvent("nudge_shown", { count: contacts.length }), [contacts.length]);
  if (!pending.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="lbl">Any news? Sent over a week ago</h2>
      <ul className="panel divide-y divide-stone-200 text-[15px]">
        {pending.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
              {c.name}
            </a>
            <span className="text-stone-600">
              {c.title} · {c.company}
            </span>
            <span className="ml-auto flex gap-1.5">
              {ACTIONS.map((a) => (
                <button
                  key={a.status}
                  className="btn-secondary"
                  onClick={async () => {
                    setPending((p) => p.filter((x) => x.id !== c.id));
                    try {
                      await setStatus(c.id, a.status, { via: "nudge" });
                    } catch {
                      setPending((p) => [...p, c]);
                    }
                  }}
                >
                  {a.label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

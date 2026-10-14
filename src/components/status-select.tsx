"use client";

import { useState } from "react";
import { STATUSES, type Status } from "@/lib/types";
import { setStatus } from "./client-api";

// Dot colors double as the legend on the results list. Orange is the one accent, so it means "in flight".
export const STATUS_DOT: Record<Status, string> = {
  not_sent: "bg-stone-200",
  sent: "bg-signal",
  accepted: "bg-stone-900",
  replied: "bg-ok",
  no_response: "bg-stone-400",
};

// Standalone status control for lists outside a search (e.g. Outreach).
export function StatusSelect({ contactId, initial, via }: { contactId: string; initial: Status; via: string }) {
  const [status, setLocal] = useState(initial);
  const [error, setError] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <i className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
      <select
        aria-label="Status"
        className={`min-h-8 rounded-md border bg-white px-2 text-sm ${error ? "border-red-500" : "border-stone-200"}`}
        value={status}
        onChange={async (e) => {
          const next = e.target.value as Status;
          const prev = status;
          setLocal(next);
          try {
            await setStatus(contactId, next, { via });
            setError(false);
          } catch {
            setLocal(prev);
            setError(true);
          }
        }}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </span>
  );
}

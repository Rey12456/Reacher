import type { Status } from "@/lib/types";

export function logEvent(type: string, props: Record<string, string | number | boolean> = {}) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, props }),
    keepalive: true,
  }).catch(() => {});
}

export async function setStatus(contactId: string, status: Status, opts: { resultId?: string; via?: string } = {}) {
  const res = await fetch(`/api/contacts/${contactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, ...opts }),
  });
  if (!res.ok) throw new Error("Couldn't update status");
  return (await res.json()) as { id: string; status: Status; sent_at: string | null };
}

export async function saveDrafts(resultId: string, drafts: { note_text?: string; message_text?: string }) {
  await fetch(`/api/results/${resultId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(drafts),
  });
}

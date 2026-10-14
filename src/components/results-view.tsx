"use client";

import { useState } from "react";
import { NOTE_LIMIT, STATUSES, type Fact, type ResultRow, type Status } from "@/lib/types";
import { logEvent, saveDrafts, setStatus } from "./client-api";
import { STATUS_DOT } from "./status-select";

type Patch = Partial<Pick<ResultRow, "verified" | "possible" | "reason" | "ask_used" | "note_text" | "message_text">> & { status?: Status };

// What the list column shows for "shared": the strongest verified fact, else unconfirmed, else none.
function sharedSummary(r: ResultRow) {
  const order = ["school", "employer", "city"] as const;
  const top = order.find((t) => r.verified.some((f) => f.type === t));
  if (top) return { text: { school: "School", employer: "Employer", city: "City" }[top], tone: "ok" as const };
  if (r.possible.length) return { text: "Unconfirmed", tone: "muted" as const };
  return { text: "None", tone: "muted" as const };
}

export function ResultsView({ rows }: { rows: ResultRow[] }) {
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  const [picked, setPicked] = useState<string | null>(null);

  const merged = rows.map((r) => {
    const p = patches[r.id] ?? {};
    const { status, ...rest } = p;
    return { ...r, ...rest, contact: { ...r.contact, status: status ?? r.contact.status } } as ResultRow;
  });
  const selected = merged.find((r) => r.id === picked) ?? merged[0];
  if (!selected) return null;

  const patch = (id: string, p: Patch) => setPatches((all) => ({ ...all, [id]: { ...all[id], ...p } }));

  return (
    <div className="panel grid overflow-hidden lg:grid-cols-[minmax(360px,0.8fr)_1.2fr]">
      <div className="border-b border-stone-200 lg:border-r lg:border-b-0">
        <div className="grid grid-cols-[32px_1fr_110px_14px] items-center gap-3 border-b border-stone-200 px-6 py-3">
          <span className="lbl">#</span>
          <span className="lbl">Person</span>
          <span className="lbl">Shared</span>
          <span />
        </div>
        <ul role="listbox" aria-label="People, ranked">
          {merged.map((r) => {
            const shared = sharedSummary(r);
            const isSelected = r.id === selected.id;
            return (
              <li key={r.id} role="option" aria-selected={isSelected}>
                <button
                  onClick={() => setPicked(r.id)}
                  className={`grid w-full grid-cols-[32px_1fr_110px_14px] items-center gap-3 border-b border-stone-200 px-6 py-4 text-left hover:bg-stone-50 ${isSelected ? "bg-stone-100" : ""}`}
                >
                  <span className="font-mono text-sm text-stone-600">{String(r.rank).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <b className="block truncate text-base font-semibold">{r.contact.name}</b>
                    <span className="mt-0.5 block truncate text-sm text-stone-500">{r.contact.title}</span>
                  </span>
                  <span className={`text-sm ${shared.tone === "ok" ? "text-stone-900" : "text-stone-500"}`}>{shared.text}</span>
                  <span
                    className={`size-2 rounded-full ${STATUS_DOT[r.contact.status]}`}
                    role="img"
                    aria-label={STATUSES.find((s) => s.value === r.contact.status)?.label}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1 px-6 py-4 text-sm text-stone-500">
          <Key dot={STATUS_DOT.sent} text="Sent" />
          <Key dot={STATUS_DOT.accepted} text="Accepted" />
          <Key dot={STATUS_DOT.replied} text="Replied" />
        </p>
      </div>

      <Detail key={selected.id} row={selected} onPatch={(p) => patch(selected.id, p)} />
    </div>
  );
}

function Key({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`size-2 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

const FACT_NAME = { school: "School", employer: "Past employer", city: "City" };
const LABEL_NAME = { peer: "Peer", manager: "Manager", recruiter: "Recruiter" };

function Detail({ row, onPatch }: { row: ResultRow; onPatch: (p: Patch) => void }) {
  const c = row.contact;
  const [note, setNote] = useState(row.note_text ?? "");
  const [message, setMessage] = useState(row.message_text ?? "");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<"note" | "message" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = c.status;

  async function changeStatus(next: Status) {
    const prev = status;
    onPatch({ status: next });
    try {
      // Make sure the text recorded as "sent" is what's on screen.
      if (next === "sent") await saveDrafts(row.id, { note_text: note, message_text: message });
      await setStatus(c.id, next, { resultId: row.id, via: "results" });
      setError(null);
    } catch {
      onPatch({ status: prev });
      setError("Couldn't update the status.");
    }
  }

  async function confirmFact(fact: Fact) {
    setConfirming(fact.value);
    const res = await fetch(`/api/results/${row.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact }),
    });
    setConfirming(null);
    if (!res.ok) return setError((await res.json()).error ?? "Couldn't confirm.");
    const updated = await res.json();
    onPatch(updated);
    setNote(updated.note_text ?? "");
    setMessage(updated.message_text ?? "");
    setError(null);
  }

  async function copy(text: string, kind: "note" | "message") {
    await navigator.clipboard.writeText(text);
    logEvent(kind === "note" ? "note_copied" : "message_copied", { label: row.label });
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="grid content-start gap-7 p-7 lg:p-9" aria-label={`Details for ${c.name}`}>
      <div className="flex items-start gap-3">
        <span className="lbl pt-1.5">{String(row.rank).padStart(2, "0")}</span>
        <div className="min-w-0">
          <a
            href={c.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xl font-bold tracking-tight hover:underline"
            onClick={() => logEvent("profile_link_opened", { label: row.label })}
          >
            {c.name} ↗
          </a>
          <p className="mt-1 text-[15px] text-stone-500">
            {c.title}
            {c.location ? ` · ${c.location}` : ""} · {LABEL_NAME[row.label]}
          </p>
        </div>
        <select
          aria-label="Status"
          className="ml-auto min-h-11 rounded-md border border-stone-200 bg-white px-3 text-[15px]"
          value={status}
          onChange={(e) => changeStatus(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <dl className="grid grid-cols-[130px_1fr] border-t border-stone-200 text-[15px] leading-relaxed [&>*]:border-b [&>*]:border-stone-200 [&>*]:py-3.5">
        <dt className="lbl pt-1.5">Why</dt>
        <dd>
          {row.verified.length > 0 ? (
            <>
              {row.verified.map((f) => `${FACT_NAME[f.type]} · ${f.value}`).join(" · ")}
              <span className="text-stone-500"> · {row.label === "manager" ? "likely senior to the role" : row.label === "recruiter" ? "recruiter" : "works in the role"}</span>
            </>
          ) : (
            <span className="text-stone-600">No verified shared connection · {row.label === "recruiter" ? "recruiter" : "works in the role"}</span>
          )}
        </dd>
        {row.possible.map((f) => (
          <Unconfirmed key={f.type + f.value} fact={f} busy={confirming === f.value} disabled={!!confirming} onConfirm={() => confirmFact(f)} />
        ))}
      </dl>

      <Draft
        label="Connection note"
        counter={
          <span className={`lbl ${note.length > NOTE_LIMIT ? "!text-red-700" : ""}`}>
            {note.length} / {NOTE_LIMIT}
          </span>
        }
        value={note}
        rows={4}
        onChange={setNote}
        onBlur={() => saveDrafts(row.id, { note_text: note })}
        placeholder="Write your own note"
        actions={
          <>
            <button className="btn" disabled={!note} onClick={() => copy(note, "note")}>
              {copied === "note" ? "Copied" : "Copy note"}
            </button>
            {status === "not_sent" && (
              <button className="btn-secondary" onClick={() => changeStatus("sent")}>
                Mark sent
              </button>
            )}
          </>
        }
      />
      <Draft
        label="After they accept"
        value={message}
        rows={8}
        onChange={setMessage}
        onBlur={() => saveDrafts(row.id, { message_text: message })}
        placeholder="Write your own message"
        actions={
          <button className="btn-secondary" disabled={!message} onClick={() => copy(message, "message")}>
            {copied === "message" ? "Copied" : "Copy message"}
          </button>
        }
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function Unconfirmed({ fact, busy, disabled, onConfirm }: { fact: Fact; busy: boolean; disabled: boolean; onConfirm: () => void }) {
  return (
    <>
      <dt className="lbl pt-2.5">Unconfirmed</dt>
      <dd className="flex flex-wrap items-center gap-2 text-stone-600">
        {FACT_NAME[fact.type]} · {fact.value}
        <button className="btn-secondary !min-h-9 !px-3 !py-1" disabled={disabled} onClick={onConfirm}>
          {busy ? "Rewriting drafts…" : "Confirm"}
        </button>
        <span className="w-full text-sm text-stone-500">Check their profile first. It stays out of the drafts until you confirm.</span>
      </dd>
    </>
  );
}

function Draft(props: {
  label: string;
  counter?: React.ReactNode;
  value: string;
  rows: number;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
  actions: React.ReactNode;
}) {
  const id = `draft-${props.label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <div className="flex justify-between">
        <label htmlFor={id} className="lbl">
          {props.label}
        </label>
        {props.counter}
      </div>
      <textarea
        id={id}
        className="input mt-2 !text-base leading-relaxed"
        rows={props.rows}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
      />
      <div className="mt-3 flex gap-3">{props.actions}</div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Employer, Profile, School } from "@/lib/types";
import { deleteAccount, saveProfile } from "./actions";

type Form = { name: string; city: string; summary: string; schools: School[]; employers: Employer[] };

const fromProfile = (p: Partial<Profile>): Form => ({
  name: p.name ?? "",
  city: p.city ?? "",
  summary: p.summary ?? "",
  schools: p.schools ?? [],
  employers: p.employers ?? [],
});

export function ProfileEditor({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(fromProfile(initial));
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"extract" | "save" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasProfile = form.schools.length > 0 || form.employers.length > 0 || !!form.city;

  async function extract(file: File | null) {
    setBusy("extract");
    setMessage(null);
    const body = new FormData();
    if (file) body.set("file", file);
    else body.set("text", pasted);
    const res = await fetch("/api/resume", { method: "POST", body });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setMessage({ kind: "error", text: json.error });
    setForm(fromProfile(json));
    setPasted("");
    setMessage({ kind: "ok", text: "Extracted and saved. Check everything below, fix anything wrong, then save." });
  }

  async function save() {
    setBusy("save");
    const res = await saveProfile(form);
    setBusy(null);
    if (res.error) return setMessage({ kind: "error", text: res.error });
    setMessage({ kind: "ok", text: "Saved." });
    router.push("/");
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-8">
      <section className="card space-y-6">
        <h2 className="font-semibold">{hasProfile ? "Replace from a new resume" : "Start from your resume"}</h2>
        <label className="block text-sm">
          <span className="lbl">Upload a PDF</span>
          <input
            type="file"
            accept="application/pdf"
            disabled={!!busy}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-white"
            onChange={(e) => e.target.files?.[0] && extract(e.target.files[0])}
          />
        </label>
        <div className="text-sm">
          <span className="lbl">…or paste the text</span>
          <textarea className="input mt-1 h-28" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <button className="btn-secondary mt-2" disabled={!!busy || pasted.trim().length < 100} onClick={() => extract(null)}>
            Extract from text
          </button>
        </div>
        {busy === "extract" && <p className="text-sm text-stone-700">Reading your resume…</p>}
        <p className="text-sm text-stone-600">The file is read once and not stored.</p>
      </section>

      {message && (
        <p className={`text-sm ${message.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>{message.text}</p>
      )}

      <section className="card space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="lbl">Your name</span>
            <input className="input mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="lbl">Current city</span>
            <input className="input mt-1" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. New York" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="lbl">About you (used to personalise drafts)</span>
          <textarea className="input mt-1 h-20" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </label>

        <ListEditor
          title="Schools"
          items={form.schools}
          fields={[
            { key: "name", placeholder: "University name, as on LinkedIn" },
            { key: "degree", placeholder: "Degree" },
            { key: "years", placeholder: "Years" },
          ]}
          onChange={(v) => set("schools", v)}
        />
        <ListEditor
          title="Past and current employers"
          items={form.employers}
          fields={[
            { key: "name", placeholder: "Company" },
            { key: "title", placeholder: "Your title" },
            { key: "years", placeholder: "Years" },
          ]}
          onChange={(v) => set("employers", v)}
        />

        <button className="btn" disabled={!!busy || !(form.schools.length || form.employers.length || form.city)} onClick={save}>
          {busy === "save" ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="card space-y-2 border-red-200">
        <h2 className="font-semibold">Delete account</h2>
        <p className="text-sm text-stone-600">Removes your profile, searches, contacts and drafts. This can&apos;t be undone.</p>
        {confirmDelete ? (
          <div className="flex gap-2">
            <form action={deleteAccount}>
              <button className="btn bg-red-700 hover:bg-red-800">Yes, delete everything</button>
            </form>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn-secondary text-red-700" onClick={() => setConfirmDelete(true)}>
            Delete my account and data
          </button>
        )}
      </section>
    </div>
  );
}

function ListEditor<T extends Record<string, string | undefined>>({
  title,
  items,
  fields,
  onChange,
}: {
  title: string;
  items: T[];
  fields: { key: keyof T & string; placeholder: string }[];
  onChange: (items: T[]) => void;
}) {
  return (
    <div className="space-y-3 text-[15px]">
      <div className="lbl">{title}</div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-3">
          {fields.map((f, j) => (
            <input
              key={f.key}
              className={`input ${j === 0 ? "flex-[2]" : "flex-1"}`}
              placeholder={f.placeholder}
              value={item[f.key] ?? ""}
              onChange={(e) => onChange(items.map((it, k) => (k === i ? { ...it, [f.key]: e.target.value } : it)))}
            />
          ))}
          <button className="btn-secondary" aria-label="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button className="btn-secondary !mt-5" onClick={() => onChange([...items, { name: "" } as unknown as T])}>
        + Add
      </button>
    </div>
  );
}

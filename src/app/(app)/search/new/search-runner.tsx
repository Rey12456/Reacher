"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResultRow } from "@/lib/types";
import { ResultsView } from "@/components/results-view";
import { ProgressBar } from "./progress-bar";

type StreamEvent =
  | { type: "started"; searchId: string }
  | { type: "progress"; step: string; pct: number }
  | { type: "contact"; result: ResultRow }
  | { type: "done"; searchId: string }
  | { type: "error"; message: string };

export function SearchRunner({ company, role, ask }: { company: string; role: string; ask: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [step, setStep] = useState("Starting search");
  const [pct, setPct] = useState(0);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return; // React dev mode runs effects twice; only search once
    started.current = true;

    (async () => {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, ask }),
      });
      if (!res.headers.get("content-type")?.includes("ndjson")) {
        const json = await res.json().catch(() => ({}));
        if (json.cached) return router.replace(`/search/${json.searchId}?cached=1`);
        return setError(json.error ?? "Search failed");
      }

      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "progress") {
            setStep(event.step);
            setPct(event.pct);
          } else if (event.type === "contact") {
            setRows((r) => [...r, event.result].sort((a, b) => a.rank - b.rank));
          } else if (event.type === "done") {
            setDone(true);
            setPct(100);
            // Keep this page (no reload) but give it the saved search's URL.
            window.history.replaceState(null, "", `/search/${event.searchId}`);
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    })().catch(() => setError("Lost connection to the search. Check Recent searches on the home page."));
  }, [company, role, ask, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-2xl font-bold">
          {role} at {company}
        </h1>
        {(done || rows.length > 0) && <span className="lbl sm:ml-auto">{rows.length} people</span>}
      </div>
      {!done && !error && <ProgressBar pct={pct} step={step} />}
      {error && (
        <p role="alert" className="panel border-red-300 px-3 py-2 text-[15px] text-red-800">
          {error}
        </p>
      )}
      {done && rows.length === 0 && (
        <p className="text-[15px] text-stone-600">
          No one at {company} turned up for this role. Try a broader role title (e.g. &ldquo;Engineer&rdquo; instead of
          &ldquo;Backend Engineer II&rdquo;).
        </p>
      )}
      {done && rows.length > 0 && rows.every((r) => !r.verified.length) && (
        <p className="panel px-3 py-2 text-[15px] text-stone-700">
          Little verified overlap with you at this company. These are the most relevant people for the role.
        </p>
      )}
      <ResultsView rows={rows} />
    </div>
  );
}

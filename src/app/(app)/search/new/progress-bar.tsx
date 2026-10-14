"use client";

import { useEffect, useState } from "react";

const HEAD_START = 12; // the bar opens partly filled so the wait feels shorter

// Shows real pipeline milestones, creeping slowly between them so it never looks stuck.
// The creep stops short of the next milestone, so it never claims progress that hasn't happened.
export function ProgressBar({ pct, step }: { pct: number; step: string }) {
  const target = Math.max(HEAD_START, pct);
  const [shown, setShown] = useState(HEAD_START);

  useEffect(() => {
    const ceiling = Math.min(target + 8, 96);
    const id = setInterval(() => setShown((s) => (s < target ? target : Math.min(s + 0.4, ceiling))), 400);
    return () => clearInterval(id);
  }, [target]);

  const width = Math.max(shown, target);
  return (
    <div className="space-y-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)} aria-label="Search progress">
      <div className="h-1 overflow-hidden bg-stone-200">
        <div className="h-full bg-stone-900 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${width}%` }} />
      </div>
      <p className="lbl">{step}…</p>
    </div>
  );
}

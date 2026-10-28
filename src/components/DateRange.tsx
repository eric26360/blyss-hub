"use client";

// Day / Week / Month / Custom period picker shared by the performance pages.

import { useMemo, useState } from "react";
import { addDays, dateInTz, formatDay } from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { weekStartOf } from "@/lib/weekly-plans";

export type RangeMode = "day" | "week" | "month" | "custom";

const MODES: { key: RangeMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom" },
];

function monthRange(anchor: string) {
  const from = anchor.slice(0, 8) + "01";
  const next = new Date(from + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

function shiftMonth(anchor: string, n: number) {
  const d = new Date(anchor.slice(0, 8) + "01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function rangeLabel(mode: RangeMode, from: string, to: string) {
  if (mode === "day") return formatDay(from);
  if (mode === "month")
    return new Date(from + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  return `${formatDay(from)} – ${formatDay(to)}`;
}

export function useDateRange(initial: RangeMode = "week") {
  const { user } = useSession();
  const today = dateInTz(user?.timezone ?? "America/New_York");
  const [mode, setMode] = useState<RangeMode>(initial);
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });

  const { from, to } = useMemo(() => {
    if (mode === "day") return { from: anchor, to: anchor };
    if (mode === "week") {
      const start = weekStartOf(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    if (mode === "month") return monthRange(anchor);
    return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
  }, [mode, anchor, custom]);

  const step = (n: number) => {
    if (mode === "day") setAnchor(addDays(anchor, n));
    if (mode === "week") setAnchor(addDays(anchor, 7 * n));
    if (mode === "month") setAnchor(shiftMonth(anchor, n));
  };

  return { today, mode, setMode, setAnchor, custom, setCustom, from, to, step };
}

export function DateRangeControls({ range }: { range: ReturnType<typeof useDateRange> }) {
  const { today, mode, setMode, setAnchor, custom, setCustom, from, to, step } = range;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-stone-300 overflow-hidden">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3 py-1.5 text-sm ${mode === m.key ? "bg-stone-900 text-white" : "bg-white hover:bg-stone-50"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "custom" ? (
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={custom.from} max={today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1" />
          <span className="text-stone-400">to</span>
          <input type="date" value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1" />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => step(-1)} className="rounded-lg border border-stone-300 px-2 py-1 hover:bg-stone-50" aria-label="Previous">←</button>
          <span className="font-medium min-w-40 text-center">{rangeLabel(mode, from, to)}</span>
          <button onClick={() => step(1)} disabled={to >= today} className="rounded-lg border border-stone-300 px-2 py-1 hover:bg-stone-50 disabled:opacity-40" aria-label="Next">→</button>
          {from > today || to < today ? (
            <button onClick={() => setAnchor(today)} className="text-xs text-brand hover:underline">Today</button>
          ) : null}
        </div>
      )}
    </div>
  );
}

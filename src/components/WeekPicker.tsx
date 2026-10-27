"use client";

import { addDays } from "@/lib/checkins";
import { formatWeek, weekStartOf } from "@/lib/weekly-plans";

// ‹ Week of Oct 27 › with "This week" / "Next week" hints.
export function WeekPicker({ week, today, onChange }: { week: string; today: string; onChange: (week: string) => void }) {
  const thisWeek = weekStartOf(today);
  const hint = week === thisWeek ? "This week" : week === addDays(thisWeek, 7) ? "Next week" : week === addDays(thisWeek, -7) ? "Last week" : null;
  const btn = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn} onClick={() => onChange(addDays(week, -7))} aria-label="Previous week">
        ‹
      </button>
      <span className="text-sm font-medium min-w-36 text-center">
        {formatWeek(week)}
        {hint && <span className="block text-xs font-normal text-stone-500">{hint}</span>}
      </span>
      <button type="button" className={btn} onClick={() => onChange(addDays(week, 7))} aria-label="Next week">
        ›
      </button>
      {week !== thisWeek && (
        <button type="button" className="text-xs text-brand hover:underline ml-1" onClick={() => onChange(thisWeek)}>
          Go to this week
        </button>
      )}
    </div>
  );
}

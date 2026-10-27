// Owner Calendar: private tasks for the owners, coloured by when they're due.
// Today = red, rest of this week = yellow, rest of this month = green.

import { addDays } from "./checkins";
import { weekStartOf } from "./weekly-plans";

export type OwnerCategory = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  archived: boolean;
};

export type OwnerTask = {
  id: string;
  title: string;
  notes: string | null;
  category_id: string | null;
  due_date: string;
  due_time: string | null; // "HH:MM:SS"
  created_by: string | null;
  assignee_id: string | null; // null = both owners
  status: "todo" | "done";
  completed_at: string | null;
  created_at: string;
};

export type Band = "today" | "week" | "month" | "other";

/** Which colour band a calendar day falls in, relative to today. */
export function dayBand(day: string, today: string): Band {
  if (day === today) return "today";
  const week = weekStartOf(today);
  if (day >= week && day < addDays(week, 7)) return "week";
  if (day.slice(0, 7) === today.slice(0, 7)) return "month";
  return "other";
}

/** Which list an open task belongs in. Overdue counts as Today. */
export function taskBand(task: OwnerTask, today: string): Band | "overdue" {
  if (task.status === "todo" && task.due_date < today) return "overdue";
  return dayBand(task.due_date, today);
}

export const BAND_CELL: Record<Band, string> = {
  today: "bg-rose-50 ring-2 ring-inset ring-rose-400",
  week: "bg-yellow-50",
  month: "bg-emerald-50",
  other: "bg-white",
};

export const BAND_CHIP: Record<Band | "overdue" | "done", string> = {
  today: "bg-rose-100 text-rose-800 border-rose-300",
  overdue: "bg-rose-100 text-rose-800 border-rose-400",
  week: "bg-yellow-100 text-yellow-900 border-yellow-300",
  month: "bg-emerald-100 text-emerald-800 border-emerald-300",
  other: "bg-stone-100 text-stone-700 border-stone-200",
  done: "bg-stone-50 text-stone-400 border-stone-200 line-through",
};

export function chipClass(task: OwnerTask, today: string) {
  return BAND_CHIP[task.status === "done" ? "done" : taskBand(task, today)];
}

/** The Monday-to-Sunday weeks that cover a month ("YYYY-MM"). */
export function monthGrid(month: string): string[][] {
  const first = month + "-01";
  const start = weekStartOf(first);
  const weeks: string[][] = [];
  for (let w = start; w.slice(0, 7) <= month; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  }
  return weeks;
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function formatMonth(month: string) {
  return new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
}

/** "14:30:00" → "2:30 PM" */
export function formatClock(time: string | null) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function byDateThenTime(a: OwnerTask, b: OwnerTask) {
  return a.due_date.localeCompare(b.due_date) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99");
}

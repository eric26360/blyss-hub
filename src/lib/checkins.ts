// Check-in questions plus the date/time rules for "today", on time, and missing.
// Everything is worked out in each employee's own timezone.

export type CheckinKind = "morning" | "evening";

export type Question = {
  id: string;
  label: string;
  type: "text" | "number" | "yesno";
  required?: boolean;
  hint?: string;
};

export const MORNING_QUESTIONS: Question[] = [
  { id: "priorities", label: "What are your main priorities today?", type: "text", required: true },
  { id: "tasks", label: "What specific tasks or creative projects will you complete today?", type: "text", required: true },
  { id: "planned_count", label: "How many creatives or briefs do you plan to complete today?", type: "number", required: true },
  { id: "blockers", label: "Are there any blockers preventing you from completing your work?", type: "text" },
  { id: "needs", label: "Do you need anything from management or another team member?", type: "text" },
];

export const EVENING_QUESTIONS: Question[] = [
  { id: "accomplished", label: "What did you accomplish today?", type: "text", required: true, hint: "Include links to completed work where you can." },
  { id: "completed_tasks", label: "Which tasks or creative projects did you complete?", type: "text", required: true },
  { id: "completed_count", label: "How many creatives or briefs did you complete?", type: "number", required: true },
  { id: "did_all", label: "Did you complete everything you planned during your morning check-in?", type: "yesno", required: true },
  { id: "why_not", label: "If not, what prevented you from completing your planned work?", type: "text" },
  { id: "issues", label: "Are there any issues or blockers management should know about?", type: "text" },
];

export const QUESTIONS: Record<CheckinKind, Question[]> = {
  morning: MORNING_QUESTIONS,
  evening: EVENING_QUESTIONS,
};

// The numeric question saved into the checkins.creative_count column.
export const COUNT_QUESTION: Record<CheckinKind, string> = {
  morning: "planned_count",
  evening: "completed_count",
};

export type Checkin = {
  id: string;
  profile_id: string;
  kind: CheckinKind;
  day: string; // YYYY-MM-DD
  answers: Record<string, string>;
  creative_count: number | null;
  submitted_at: string;
  on_time: boolean;
  updated_at: string | null;
};

export type Deadlines = { morning: string; evening: string }; // "HH:MM"

export const DEFAULT_DEADLINES: Deadlines = { morning: "09:30", evening: "18:00" };
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // 0 = Sunday … 6 = Saturday

/** Calendar date (YYYY-MM-DD) in the given timezone. */
export function dateInTz(tz: string, at: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Clock time (HH:MM, 24h) in the given timezone. */
export function timeInTz(tz: string, at: Date = new Date()) {
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return t;
}

export function formatTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatDay(day: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

export function weekday(day: string) {
  return new Date(day + "T12:00:00Z").getUTCDay();
}

export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Was this submission (at `at`) on or before the deadline, in the employee's timezone? */
export function isOnTime(kind: CheckinKind, day: string, tz: string, deadlines: Deadlines, at: Date = new Date()) {
  const submittedDay = dateInTz(tz, at);
  if (submittedDay !== day) return submittedDay < day;
  return timeInTz(tz, at) <= deadlines[kind];
}

/** Has the deadline for this check-in passed yet, in the employee's timezone? */
export function isPastDeadline(kind: CheckinKind, day: string, tz: string, deadlines: Deadlines, now: Date = new Date()) {
  const today = dateInTz(tz, now);
  if (day !== today) return day < today;
  return timeInTz(tz, now) > deadlines[kind];
}

export type CheckinStatus = "completed" | "late" | "missing" | "pending" | "day_off" | "not_working";

export const STATUS_LABEL: Record<CheckinStatus, string> = {
  completed: "Completed",
  late: "Late",
  missing: "Missing",
  pending: "Pending",
  day_off: "Day Off",
  not_working: "Non-working day",
};

export function checkinStatus(opts: {
  checkin: Checkin | undefined;
  kind: CheckinKind;
  day: string;
  tz: string;
  deadlines: Deadlines;
  workingDays: number[];
  dayOff: boolean;
  now?: Date;
}): CheckinStatus {
  const { checkin, kind, day, tz, deadlines, workingDays, dayOff, now } = opts;
  if (checkin) return checkin.on_time ? "completed" : "late";
  if (dayOff) return "day_off";
  if (!workingDays.includes(weekday(day))) return "not_working";
  return isPastDeadline(kind, day, tz, deadlines, now) ? "missing" : "pending";
}

/** "2 of 3 planned completed — 67%" (self-reported, from the two check-ins). */
export function plannedVsActual(planned: number | null | undefined, completed: number | null | undefined) {
  if (planned == null || completed == null) return null;
  const pct = planned > 0 ? Math.round((completed / planned) * 100) : null;
  return { planned, completed, pct, text: `${completed} of ${planned} planned completed${pct != null ? ` — ${pct}%` : ""}` };
}

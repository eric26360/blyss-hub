// Weekly plans: what each strategist will complete and focus on, plus a
// Monday–Friday plan. Weeks start on Monday; dates are worked out in each
// employee's own timezone (on-time and locking are decided by the database).

import { addDays, dateInTz, formatDay, weekday } from "./checkins";

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type DayKey = (typeof DAYS)[number];

export const DAY_LABEL: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export type PlanFields = { goals: string; focus: string } & Record<DayKey, string>;

export const PLAN_FIELDS: (keyof PlanFields)[] = ["goals", "focus", ...DAYS];

export const EMPTY_PLAN: PlanFields = {
  goals: "",
  focus: "",
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
};

export type WeeklyPlan = PlanFields & {
  id: string;
  profile_id: string;
  week_start: string; // Monday, YYYY-MM-DD
  submitted_at: string;
  on_time: boolean;
  updated_at: string | null;
};

export type WeeklyPlanEdit = { id: string; plan_id: string; previous: PlanFields & { saved_at: string }; edited_at: string };

/** Monday of the week containing `day`. */
export function weekStartOf(day: string) {
  return addDays(day, -((weekday(day) + 6) % 7));
}

/** The week people should be planning: next week from Friday on, otherwise this week. */
export function planningWeek(tz: string, now: Date = new Date()) {
  const today = dateInTz(tz, now);
  const thisWeek = weekStartOf(today);
  return [0, 5, 6].includes(weekday(today)) ? addDays(thisWeek, 7) : thisWeek;
}

/** A week is locked once its Sunday has passed. */
export function isWeekEnded(weekStart: string, tz: string, now: Date = new Date()) {
  return dateInTz(tz, now) >= addDays(weekStart, 7);
}

/** Has the week started yet (Monday 00:00 in their timezone)? */
export function hasWeekStarted(weekStart: string, tz: string, now: Date = new Date()) {
  return dateInTz(tz, now) >= weekStart;
}

export function formatWeek(weekStart: string) {
  return `Week of ${formatDay(weekStart)}`;
}

export type PlanStatus = "completed" | "late" | "missing" | "pending";

export function planStatus(plan: WeeklyPlan | undefined, weekStart: string, tz: string, now?: Date): PlanStatus {
  if (plan) return plan.on_time ? "completed" : "late";
  return hasWeekStarted(weekStart, tz, now) ? "missing" : "pending";
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  completed: "Completed",
  late: "Late",
  missing: "Missing",
  pending: "Pending",
};

/** Postgres/PostgREST "table doesn't exist" — the 0004 database update hasn't been run yet. */
export function isMissingTable(error: { code?: string } | null | undefined) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205");
}

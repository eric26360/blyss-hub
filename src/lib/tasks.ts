// Tasks: assigned by an owner or written by the person, for a day or a week.
// ClickUp tasks are merged into the same list but come from ClickUp.

export type TaskScope = "day" | "week";
export type TaskStatus = "todo" | "done";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  assignee_id: string;
  created_by: string | null;
  source: "assigned" | "self";
  scope: TaskScope;
  due_date: string | null;
  week_start: string | null;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
};

export type ClickUpTask = {
  id: string;
  title: string;
  status: string;
  done: boolean;
  dueDate: string | null; // YYYY-MM-DD
  assigneeId: string | null; // website profile id, once ClickUp users are matched
  url: string;
};

/** One row on the Tasks page, from either source. */
export type TaskItem =
  | { kind: "hub"; task: Task }
  | { kind: "clickup"; task: ClickUpTask };

export const CLICKUP_CONNECTED = false;

/** ClickUp tasks for the given people. Not connected yet, so nothing comes back. */
export async function fetchClickUpTasks(): Promise<ClickUpTask[]> {
  return [];
}

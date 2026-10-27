"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { WeekPicker } from "@/components/WeekPicker";
import { addDays, dateInTz, formatDay } from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import {
  CLICKUP_CONNECTED,
  fetchClickUpTasks,
  type ClickUpTask,
  type Task,
  type TaskItem,
  type TaskScope,
} from "@/lib/tasks";
import { useTeam } from "@/lib/use-team";
import { formatWeek, isMissingTable, weekStartOf } from "@/lib/weekly-plans";

type Tab = "today" | "week" | "overdue" | "done";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Done" },
];

export default function TasksPage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { team, nameOf } = useTeam();
  const isOwner = user?.role === "owner";
  const today = dateInTz(user?.timezone ?? "America/New_York");
  const thisWeek = weekStartOf(today);

  const [tab, setTab] = useState<Tab>("today");
  const [person, setPerson] = useState(""); // owners: filter by person ("" = everyone)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clickup, setClickup] = useState<ClickUpTask[]>([]);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    // Everything still open, plus what was finished in the last 60 days.
    const since = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(`status.eq.todo,completed_at.gte.${since}`)
      .order("created_at", { ascending: false });
    if (isMissingTable(error)) return setNotReady(true);
    if (error) return setError(error.message);
    setTasks((data as Task[]) ?? []);
    setClickup(await fetchClickUpTasks());
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const isOverdue = (t: Task) =>
    t.status === "todo" &&
    ((t.scope === "day" && t.due_date! < today) || (t.scope === "week" && addDays(t.week_start!, 7) <= today));

  const mine = (assigneeId: string | null) => (isOwner ? !person || assigneeId === person : assigneeId === user?.id);

  const items: TaskItem[] = [
    ...tasks
      .filter((t) => mine(t.assignee_id))
      .filter((t) => {
        if (tab === "done") return t.status === "done";
        if (tab === "overdue") return isOverdue(t);
        if (tab === "today") return t.scope === "day" && t.due_date === today;
        return (
          (t.scope === "week" && t.week_start === thisWeek) ||
          (t.scope === "day" && t.due_date! >= thisWeek && t.due_date! < addDays(thisWeek, 7))
        );
      })
      .map((task) => ({ kind: "hub" as const, task })),
    ...clickup
      .filter((t) => mine(t.assigneeId))
      .filter((t) => {
        if (tab === "done") return t.done;
        if (t.done) return false;
        if (tab === "overdue") return !!t.dueDate && t.dueDate < today;
        if (tab === "today") return t.dueDate === today;
        return !!t.dueDate && t.dueDate >= thisWeek && t.dueDate < addDays(thisWeek, 7);
      })
      .map((task) => ({ kind: "clickup" as const, task })),
  ];

  const counts = {
    today: tasks.filter((t) => mine(t.assignee_id) && t.status === "todo" && t.scope === "day" && t.due_date === today).length,
    overdue: tasks.filter((t) => mine(t.assignee_id) && isOverdue(t)).length,
  };

  const toggle = async (t: Task) => {
    setError(null);
    const { error } = await supabase
      .from("tasks")
      .update({ status: t.status === "done" ? "todo" : "done" })
      .eq("id", t.id);
    if (error) setError(error.message);
    load();
  };

  const remove = async (t: Task) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) setError(error.message);
    load();
  };

  const rename = async (t: Task, title: string, notes: string) => {
    const { error } = await supabase.from("tasks").update({ title, notes: notes || null }).eq("id", t.id);
    if (error) setError(error.message);
    load();
  };

  return (
    <Guard page="tasks">
      <PageHeader
        title="Tasks"
        subtitle={isOwner ? "Everything the team is working on: tasks you assign, tasks people write, and ClickUp." : "Your tasks: ones you write, ones you're given, and ClickUp."}
      />

      {notReady ? (
        <Card className="text-sm text-stone-600">
          Tasks aren&apos;t switched on yet. An owner needs to run the <code>0005_tasks.sql</code> database update in Supabase.
        </Card>
      ) : (
        <>
          {user && (
            <AddTask
              isOwner={isOwner}
              selfId={user.id}
              team={team.filter((m) => m.active)}
              today={today}
              thisWeek={thisWeek}
              onAdded={load}
              onError={setError}
            />
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-sm border ${
                    tab === t.key ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 bg-white"
                  }`}
                >
                  {t.label}
                  {t.key === "today" && counts.today > 0 && <span className="ml-1 opacity-70">{counts.today}</span>}
                  {t.key === "overdue" && counts.overdue > 0 && (
                    <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 text-xs">{counts.overdue}</span>
                  )}
                </button>
              ))}
            </div>
            {isOwner && (
              <select value={person} onChange={(e) => setPerson(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white">
                <option value="">Everyone</option>
                {team.filter((m) => m.active).map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

          <Card className="!p-0">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-500">
                {tab === "overdue" ? "Nothing overdue. 🎉" : tab === "done" ? "Nothing finished yet." : "No tasks here yet."}
              </p>
            ) : (
              <ul>
                {items.map((item) =>
                  item.kind === "clickup" ? (
                    <ClickUpRow key={"cu-" + item.task.id} task={item.task} showWho={isOwner} nameOf={nameOf} />
                  ) : (
                    <TaskRow
                      key={item.task.id}
                      task={item.task}
                      today={today}
                      overdue={isOverdue(item.task)}
                      showWho={isOwner}
                      nameOf={nameOf}
                      canEdit={isOwner || item.task.source === "self"}
                      onToggle={() => toggle(item.task)}
                      onDelete={() => remove(item.task)}
                      onRename={(title, notes) => rename(item.task, title, notes)}
                    />
                  ),
                )}
              </ul>
            )}
          </Card>

          {!CLICKUP_CONNECTED && (
            <p className="text-xs text-stone-500 mt-3">
              <span className="inline-block rounded bg-purple-100 text-purple-700 px-1.5 py-0.5 font-medium mr-1">ClickUp</span>
              ClickUp isn&apos;t connected yet. Once it is, ClickUp tasks show up in this list highlighted in purple.
            </p>
          )}
        </>
      )}
    </Guard>
  );
}

function dueLabel(t: Task, today: string) {
  if (t.scope === "week") return formatWeek(t.week_start!);
  if (t.due_date === today) return "Today";
  if (t.due_date === addDays(today, 1)) return "Tomorrow";
  return formatDay(t.due_date!);
}

function TaskRow({
  task,
  today,
  overdue,
  showWho,
  nameOf,
  canEdit,
  onToggle,
  onDelete,
  onRename,
}: {
  task: Task;
  today: string;
  overdue: boolean;
  showWho: boolean;
  nameOf: (id: string | null) => string;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string, notes: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const done = task.status === "done";

  return (
    <li className="flex items-start gap-3 border-b border-stone-100 last:border-0 p-4">
      <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 h-4 w-4 accent-stone-900" aria-label={`Mark "${task.title}" done`} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              onRename(title.trim(), notes.trim());
              setEditing(false);
            }}
            className="space-y-2"
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-1 text-sm" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="w-full rounded-lg border border-stone-300 px-2 py-1 text-sm" />
            <div className="flex gap-2 text-xs">
              <button type="submit" className="rounded-lg bg-stone-900 text-white px-3 py-1">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="text-stone-500 hover:underline">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <p className={`text-sm font-medium ${done ? "line-through text-stone-400" : ""}`}>{task.title}</p>
            {task.notes && <p className="text-xs text-stone-500 mt-0.5 whitespace-pre-wrap">{task.notes}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-stone-500">
              <span className={overdue ? "text-rose-600 font-medium" : ""}>{overdue ? "Overdue · " : ""}{dueLabel(task, today)}</span>
              {showWho && <span>👤 {nameOf(task.assignee_id)}</span>}
              {task.source === "assigned" ? (
                <span className="rounded bg-sky-100 text-sky-700 px-1.5 py-0.5">From {nameOf(task.created_by)}</span>
              ) : (
                <span className="rounded bg-stone-100 text-stone-600 px-1.5 py-0.5">Self</span>
              )}
              {canEdit && (
                <>
                  <button onClick={() => setEditing(true)} className="text-brand hover:underline">Edit</button>
                  <button onClick={onDelete} className="text-stone-400 hover:text-rose-600 hover:underline">Delete</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function ClickUpRow({ task, showWho, nameOf }: { task: ClickUpTask; showWho: boolean; nameOf: (id: string | null) => string }) {
  return (
    <li className="flex items-start gap-3 border-b border-purple-100 last:border-0 p-4 bg-purple-50 border-l-4 border-l-purple-500">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.done ? "line-through text-stone-400" : ""}`}>{task.title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-stone-500">
          <span className="rounded bg-purple-600 text-white px-1.5 py-0.5 font-medium">ClickUp</span>
          <span>{task.status}</span>
          {task.dueDate && <span>{formatDay(task.dueDate)}</span>}
          {showWho && <span>👤 {nameOf(task.assigneeId)}</span>}
          <a href={task.url} target="_blank" rel="noreferrer" className="text-purple-700 hover:underline">
            Open in ClickUp ↗
          </a>
        </div>
      </div>
    </li>
  );
}

function AddTask({
  isOwner,
  selfId,
  team,
  today,
  thisWeek,
  onAdded,
  onError,
}: {
  isOwner: boolean;
  selfId: string;
  team: { id: string; full_name: string; email: string }[];
  today: string;
  thisWeek: string;
  onAdded: () => void;
  onError: (msg: string | null) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<TaskScope>("day");
  const [day, setDay] = useState(today);
  const [week, setWeek] = useState(thisWeek);
  const [assignee, setAssignee] = useState(selfId);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    onError(null);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      notes: notes.trim() || null,
      assignee_id: isOwner ? assignee : selfId,
      scope,
      due_date: scope === "day" ? day : null,
      week_start: scope === "week" ? week : null,
    });
    setBusy(false);
    if (error) return onError(error.message);
    setTitle("");
    setNotes("");
    onAdded();
  };

  return (
    <Card className="mb-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isOwner ? "Add a task…" : "What do you need to get done?"}
            className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
            aria-label="Task"
          />
          {isOwner && (
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white" aria-label="Assign to">
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.id === selfId ? "Me" : m.full_name || m.email}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex rounded-xl border border-stone-300 overflow-hidden">
            {(["day", "week"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 ${scope === s ? "bg-stone-900 text-white" : "bg-white hover:bg-stone-50"}`}
              >
                {s === "day" ? "For a day" : "For a week"}
              </button>
            ))}
          </div>
          {scope === "day" ? (
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1" aria-label="Due date" />
          ) : (
            <WeekPicker week={week} today={today} onChange={setWeek} />
          )}
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 min-w-40 rounded-lg border border-stone-300 px-2 py-1"
            aria-label="Notes"
          />
          <button type="submit" disabled={busy || !title.trim()} className="rounded-xl bg-stone-900 text-white px-4 py-1.5 font-medium disabled:opacity-50">
            {busy ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </Card>
  );
}

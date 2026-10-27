"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { dateInTz, formatDay } from "@/lib/checkins";
import {
  BAND_CELL,
  byDateThenTime,
  chipClass,
  dayBand,
  formatClock,
  formatMonth,
  monthGrid,
  shiftMonth,
  taskBand,
  type OwnerCategory,
  type OwnerTask,
} from "@/lib/owner-calendar";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { useTeam } from "@/lib/use-team";
import { isMissingTable } from "@/lib/weekly-plans";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// What the add/edit form is working on: a new task for a date, or an existing task.
type Editing = { kind: "new"; date: string } | { kind: "edit"; task: OwnerTask } | null;

export default function OwnerCalendarPage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { team, nameOf } = useTeam();
  const owners = team.filter((m) => m.role === "owner" && m.active);
  const today = dateInTz(user?.timezone ?? "America/New_York");

  const [month, setMonth] = useState(today.slice(0, 7));
  const [tasks, setTasks] = useState<OwnerTask[]>([]);
  const [categories, setCategories] = useState<OwnerCategory[]>([]);
  const [category, setCategory] = useState(""); // filter ("" = all)
  const [editing, setEditing] = useState<Editing>(null);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      supabase.from("owner_tasks").select("*").order("due_date"),
      supabase.from("owner_task_categories").select("*").order("sort_order").order("name"),
    ]);
    if (isMissingTable(t.error) || isMissingTable(c.error)) return setNotReady(true);
    if (t.error || c.error) return setError((t.error ?? c.error)!.message);
    setTasks((t.data as OwnerTask[]) ?? []);
    setCategories((c.data as OwnerCategory[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const visible = tasks.filter((t) => !category || t.category_id === category).sort(byDateThenTime);
  const open = visible.filter((t) => t.status === "todo");

  const lists = {
    today: open.filter((t) => ["today", "overdue"].includes(taskBand(t, today))),
    week: open.filter((t) => taskBand(t, today) === "week"),
    month: open.filter((t) => taskBand(t, today) === "month"),
  };

  const toggle = async (t: OwnerTask) => {
    setError(null);
    const { error } = await supabase
      .from("owner_tasks")
      .update({ status: t.status === "done" ? "todo" : "done" })
      .eq("id", t.id);
    if (error) setError(error.message);
    load();
  };

  return (
    <Guard page="owner_calendar">
      <PageHeader title="Owner Calendar" subtitle="Private to Eric and Kaelam. Nobody else on the team can see this page." />

      {notReady ? (
        <Card className="text-sm text-stone-600">
          The Owner Calendar isn&apos;t switched on yet. An owner needs to run the <code>0006_owner_calendar.sql</code> database update in Supabase.
        </Card>
      ) : (
        <>
          {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <TaskList title="Today" dot="bg-rose-500" tasks={lists.today} today={today} catName={catName} onOpen={(task) => setEditing({ kind: "edit", task })} onToggle={toggle} />
            <TaskList title="This week" dot="bg-yellow-400" tasks={lists.week} today={today} catName={catName} onOpen={(task) => setEditing({ kind: "edit", task })} onToggle={toggle} />
            <TaskList title="This month" dot="bg-emerald-500" tasks={lists.month} today={today} catName={catName} onOpen={(task) => setEditing({ kind: "edit", task })} onToggle={toggle} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button type="button" className={NAV_BTN} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
            <span className="text-lg font-semibold min-w-40 text-center">{formatMonth(month)}</span>
            <button type="button" className={NAV_BTN} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
            <button type="button" className={NAV_BTN} onClick={() => setMonth(today.slice(0, 7))}>Today</button>
            <div className="flex-1" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white" aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.filter((c) => !c.archived).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setEditing({ kind: "new", date: today })} className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium">
              + Add task
            </button>
          </div>

          <Legend />

          <MonthGrid month={month} today={today} tasks={visible} onDay={(date) => setEditing({ kind: "new", date })} onTask={(task) => setEditing({ kind: "edit", task })} />
          <Agenda month={month} today={today} tasks={visible} catName={catName} onDay={(date) => setEditing({ kind: "new", date })} onTask={(task) => setEditing({ kind: "edit", task })} />

          <ManageCategories categories={categories} onChanged={load} onError={setError} />

          {editing && (
            <TaskForm
              editing={editing}
              categories={categories}
              owners={owners.map((o) => ({ id: o.id, name: nameOf(o.id) }))}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                load();
              }}
              onCategoriesChanged={load}
            />
          )}
        </>
      )}
    </Guard>
  );
}

const NAV_BTN = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50";

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-4 text-xs text-stone-600 mb-3">
      {item("bg-rose-100 border-rose-400", "Today")}
      {item("bg-yellow-100 border-yellow-300", "This week")}
      {item("bg-emerald-100 border-emerald-300", "This month")}
      {item("bg-stone-50 border-stone-200", "Done")}
    </div>
  );
}

function TaskChip({ task, today, onClick }: { task: OwnerTask; today: string; onClick: () => void }) {
  const overdue = task.status === "todo" && task.due_date < today;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full truncate rounded-md border px-1.5 py-0.5 text-left text-xs ${chipClass(task, today)}`}
      title={task.title}
    >
      {overdue && <span className="font-semibold">Overdue · </span>}
      {task.due_time && <span className="opacity-70">{formatClock(task.due_time)} </span>}
      {task.title}
    </button>
  );
}

function TaskList({
  title,
  dot,
  tasks,
  today,
  catName,
  onOpen,
  onToggle,
}: {
  title: string;
  dot: string;
  tasks: OwnerTask[];
  today: string;
  catName: (id: string | null) => string | undefined;
  onOpen: (t: OwnerTask) => void;
  onToggle: (t: OwnerTask) => void;
}) {
  return (
    <Card>
      <h2 className="font-medium mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title}
        <span className="text-stone-400 text-sm">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.due_date < today;
            return (
              <li key={t.id} className="flex items-start gap-2">
                <input type="checkbox" checked={false} onChange={() => onToggle(t)} className="mt-1 h-4 w-4 accent-stone-900" aria-label={`Mark "${t.title}" done`} />
                <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm truncate">{t.title}</span>
                  <span className={`block text-xs ${overdue ? "text-rose-600 font-medium" : "text-stone-500"}`}>
                    {overdue ? "Overdue · " : ""}
                    {formatDay(t.due_date)}
                    {t.due_time ? ` · ${formatClock(t.due_time)}` : ""}
                    {catName(t.category_id) ? ` · ${catName(t.category_id)}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function MonthGrid({
  month,
  today,
  tasks,
  onDay,
  onTask,
}: {
  month: string;
  today: string;
  tasks: OwnerTask[];
  onDay: (date: string) => void;
  onTask: (t: OwnerTask) => void;
}) {
  const weeks = monthGrid(month);
  return (
    <div className="hidden md:block rounded-2xl border border-stone-200 overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-xs font-medium text-stone-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2">{d}</div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-stone-100 last:border-0">
          {week.map((day) => {
            const inMonth = day.slice(0, 7) === month;
            const dayTasks = tasks.filter((t) => t.due_date === day);
            const band = dayBand(day, today);
            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                onClick={() => onDay(day)}
                onKeyDown={(e) => e.key === "Enter" && onDay(day)}
                className={`min-h-28 border-r border-stone-100 last:border-0 p-1.5 cursor-pointer hover:brightness-95 ${BAND_CELL[band]} ${inMonth || band !== "other" ? "" : "opacity-50"}`}
                aria-label={`Add a task on ${formatDay(day)}`}
              >
                <div className={`text-xs mb-1 ${day === today ? "font-bold text-rose-700" : "text-stone-500"}`}>{Number(day.slice(8))}</div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 4).map((t) => (
                    <TaskChip key={t.id} task={t} today={today} onClick={() => onTask(t)} />
                  ))}
                  {dayTasks.length > 4 && <div className="text-xs text-stone-500">+{dayTasks.length - 4} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Phone layout: the month as a list of days that have tasks (plus today).
function Agenda({
  month,
  today,
  tasks,
  catName,
  onDay,
  onTask,
}: {
  month: string;
  today: string;
  tasks: OwnerTask[];
  catName: (id: string | null) => string | undefined;
  onDay: (date: string) => void;
  onTask: (t: OwnerTask) => void;
}) {
  const days = monthGrid(month)
    .flat()
    .filter((d) => (d.slice(0, 7) === month || dayBand(d, today) === "week") && (d === today || tasks.some((t) => t.due_date === d)));
  return (
    <div className="md:hidden space-y-2">
      {days.length === 0 && <Card className="text-sm text-stone-500 text-center">No tasks this month.</Card>}
      {days.map((day) => (
        <div key={day} className={`rounded-xl border border-stone-200 p-3 ${BAND_CELL[dayBand(day, today)]}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${day === today ? "text-rose-700" : ""}`}>
              {formatDay(day)}
              {day === today && " · Today"}
            </span>
            <button type="button" onClick={() => onDay(day)} className="text-xs text-brand">+ Add</button>
          </div>
          <div className="space-y-1">
            {tasks.filter((t) => t.due_date === day).map((t) => (
              <div key={t.id}>
                <TaskChip task={t} today={today} onClick={() => onTask(t)} />
                {catName(t.category_id) && <span className="text-[11px] text-stone-500 ml-1">{catName(t.category_id)}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const NEW_CATEGORY = "__new__";

function TaskForm({
  editing,
  categories,
  owners,
  onClose,
  onSaved,
  onCategoriesChanged,
}: {
  editing: NonNullable<Editing>;
  categories: OwnerCategory[];
  owners: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onCategoriesChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const existing = editing.kind === "edit" ? editing.task : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.due_date ?? (editing.kind === "new" ? editing.date : ""));
  const [time, setTime] = useState(existing?.due_time?.slice(0, 5) ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [assignee, setAssignee] = useState(existing?.assignee_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("owner_task_categories")
      .insert({ name, sort_order: categories.length + 1 })
      .select()
      .single();
    if (error) return setError(error.code === "23505" ? `"${name}" already exists.` : error.message);
    setCategoryId(data.id);
    setNewCategory("");
    onCategoriesChanged();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryId === NEW_CATEGORY) return setError("Add the new category first, or pick one from the list.");
    setBusy(true);
    setError(null);
    const row = {
      title: title.trim(),
      due_date: date,
      due_time: time || null,
      notes: notes.trim() || null,
      category_id: categoryId || null,
      assignee_id: assignee || null,
    };
    const { error } = existing
      ? await supabase.from("owner_tasks").update(row).eq("id", existing.id)
      : await supabase.from("owner_tasks").insert(row);
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
  };

  const setStatus = async (status: "todo" | "done") => {
    if (!existing) return;
    const { error } = await supabase.from("owner_tasks").update({ status }).eq("id", existing.id);
    if (error) return setError(error.message);
    onSaved();
  };

  const remove = async () => {
    if (!existing || !confirm(`Delete "${existing.title}"?`)) return;
    const { error } = await supabase.from("owner_tasks").delete().eq("id", existing.id);
    if (error) return setError(error.message);
    onSaved();
  };

  const field = "w-full rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{existing ? "Edit task" : "New task"}</h2>

        <label className="block text-sm font-medium mb-1" htmlFor="oc-title">Task</label>
        <input id="oc-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={field + " mb-3"} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="oc-date">Date</label>
            <input id="oc-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="oc-time">Time (optional)</label>
            <input id="oc-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </div>
        </div>

        <label className="block text-sm font-medium mb-1" htmlFor="oc-category">What it&apos;s for</label>
        <select id="oc-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field + " mb-2"}>
          <option value="">— No category —</option>
          {categories.filter((c) => !c.archived || c.id === categoryId).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value={NEW_CATEGORY}>+ Add category…</option>
        </select>
        {categoryId === NEW_CATEGORY && (
          <div className="flex gap-2 mb-3">
            <input
              autoFocus
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              placeholder="e.g. Finance"
              className={field}
              aria-label="New category name"
            />
            <button type="button" onClick={addCategory} className="rounded-xl border border-stone-300 px-3 text-sm whitespace-nowrap">Add</button>
          </div>
        )}

        <label className="block text-sm font-medium mb-1 mt-1" htmlFor="oc-for">For</label>
        <select id="oc-for" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field + " mb-3"}>
          <option value="">Both</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-1" htmlFor="oc-notes">Notes</label>
        <textarea id="oc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={field + " mb-4"} />

        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? "Saving…" : existing ? "Save" : "Add task"}
          </button>
          {existing && (
            <button type="button" onClick={() => setStatus(existing.status === "done" ? "todo" : "done")} className="rounded-xl border border-stone-300 px-4 py-2 text-sm">
              {existing.status === "done" ? "Mark not done" : "Mark done"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-stone-600">Cancel</button>
          {existing && (
            <button type="button" onClick={remove} className="ml-auto rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">Delete</button>
          )}
        </div>
      </form>
    </div>
  );
}

function ManageCategories({
  categories,
  onChanged,
  onError,
}: {
  categories: OwnerCategory[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [names, setNames] = useState<Record<string, string>>({});

  const update = async (c: OwnerCategory, patch: Partial<OwnerCategory>) => {
    const { error } = await supabase.from("owner_task_categories").update(patch).eq("id", c.id);
    if (error) onError(error.code === "23505" ? "A category with that name already exists." : error.message);
    onChanged();
  };

  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-sm text-stone-600">Manage categories</summary>
      <Card className="mt-2">
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <input
                value={names[c.id] ?? c.name}
                onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
                className={`flex-1 min-w-32 rounded-lg border border-stone-300 px-2 py-1 text-sm ${c.archived ? "text-stone-400" : ""}`}
                aria-label={`Rename ${c.name}`}
              />
              {names[c.id] !== undefined && names[c.id].trim() && names[c.id] !== c.name && (
                <button type="button" onClick={() => update(c, { name: names[c.id].trim() })} className="text-xs text-brand">Save</button>
              )}
              <button type="button" onClick={() => update(c, { archived: !c.archived })} className="text-xs text-stone-600 hover:underline">
                {c.archived ? "Restore" : "Archive"}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-500 mt-3">
          Archived categories disappear from the dropdown but stay on old tasks. Add new ones from the task form.
        </p>
      </Card>
    </details>
  );
}


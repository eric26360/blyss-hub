"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckinAnswers } from "@/components/CheckinAnswers";
import { ExpandableRow } from "@/components/ExpandableRow";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { Badge } from "@/lib/format";
import {
  STATUS_LABEL,
  addDays,
  checkinStatus,
  dateInTz,
  formatDay,
  formatTime,
  plannedVsActual,
  weekday,
  type Checkin,
  type CheckinKind,
  type CheckinStatus,
} from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { useCheckinSettings } from "@/lib/use-checkin-settings";

type Employee = { id: string; full_name: string; department: string; timezone: string; created_at: string };
type View = "day" | "week" | "month";
type StatusFilter = "all" | "completed" | "late" | "missing" | "pending";

type Row = {
  employee: Employee;
  day: string;
  morning?: Checkin;
  evening?: Checkin;
  status: Record<CheckinKind, CheckinStatus>;
};

function rangeFor(view: View, anchor: string): [string, string] {
  if (view === "day") return [anchor, anchor];
  if (view === "week") {
    const start = addDays(anchor, -((weekday(anchor) + 6) % 7)); // Monday
    return [start, addDays(start, 6)];
  }
  const start = anchor.slice(0, 8) + "01";
  const next = new Date(start + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  return [start, addDays(next.toISOString().slice(0, 10), -1)];
}

const submitted = (s: CheckinStatus) => s === "completed" || s === "late";

export default function TeamCheckinsPage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { deadlines, workingDays, loaded: settingsLoaded } = useCheckinSettings();
  const today = dateInTz(user?.timezone ?? "America/New_York");

  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(today);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | CheckinKind>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [daysOff, setDaysOff] = useState<Set<string>>(new Set());
  const [editCounts, setEditCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [start, end] = rangeFor(view, anchor);

  useEffect(() => {
    if (!user || user.role !== "owner") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [emp, ci, off] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, department, timezone, created_at")
          .eq("requires_checkins", true)
          .eq("active", true)
          .order("full_name"),
        supabase.from("checkins").select("*").gte("day", start).lte("day", end),
        supabase.from("days_off").select("profile_id, day").eq("approved", true).gte("day", start).lte("day", end),
      ]);
      const rows = (ci.data as Checkin[]) ?? [];
      const edits = rows.length
        ? await supabase.from("checkin_edits").select("checkin_id").in("checkin_id", rows.map((c) => c.id))
        : { data: [] };
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const e of edits.data ?? []) counts[e.checkin_id] = (counts[e.checkin_id] ?? 0) + 1;
      setEmployees(emp.data ?? []);
      setCheckins(rows);
      setDaysOff(new Set((off.data ?? []).map((d) => `${d.profile_id}|${d.day}`)));
      setEditCounts(counts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user, start, end]);

  const departments = [...new Set(employees.map((e) => e.department))];

  // Every employee × every day in range, skipping non-working days with nothing submitted.
  const allRows: Row[] = useMemo(() => {
    const rows: Row[] = [];
    for (let day = end; day >= start; day = addDays(day, -1)) {
      for (const employee of employees) {
        // Nothing is expected before the account existed or after today.
        if (day > dateInTz(employee.timezone) || day < dateInTz(employee.timezone, new Date(employee.created_at))) continue;
        const morning = checkins.find((c) => c.profile_id === employee.id && c.day === day && c.kind === "morning");
        const evening = checkins.find((c) => c.profile_id === employee.id && c.day === day && c.kind === "evening");
        const dayOff = daysOff.has(`${employee.id}|${day}`);
        const status = {
          morning: checkinStatus({ checkin: morning, kind: "morning", day, tz: employee.timezone, deadlines, workingDays, dayOff }),
          evening: checkinStatus({ checkin: evening, kind: "evening", day, tz: employee.timezone, deadlines, workingDays, dayOff }),
        };
        if (status.morning === "not_working" && status.evening === "not_working") continue;
        rows.push({ employee, day, morning, evening, status });
      }
    }
    return rows;
  }, [start, end, employees, checkins, daysOff, deadlines, workingDays]);

  const scoped = allRows.filter(
    (r) => (employeeFilter === "all" || r.employee.id === employeeFilter) && (deptFilter === "all" || r.employee.department === deptFilter),
  );

  const matchesStatus = (s: CheckinStatus) =>
    statusFilter === "all" ||
    (statusFilter === "completed" ? submitted(s) : s === statusFilter);
  const kinds: CheckinKind[] = kindFilter === "all" ? ["morning", "evening"] : [kindFilter];
  const visible = scoped.filter((r) => kinds.some((k) => matchesStatus(r.status[k])));

  const expectedOf = (k: CheckinKind) => scoped.filter((r) => !["day_off", "not_working"].includes(r.status[k])).length;
  const count = (k: CheckinKind, pred: (s: CheckinStatus) => boolean) => scoped.filter((r) => pred(r.status[k])).length;
  const stats: { label: string; value: number; tone?: string }[] = [
    { label: view === "day" ? "Expected to check in" : "Expected (person-days)", value: expectedOf("morning") },
    { label: "Morning completed", value: count("morning", submitted), tone: "text-emerald-600" },
    { label: "Morning missing", value: count("morning", (s) => s === "missing"), tone: "text-rose-600" },
    { label: "Evening completed", value: count("evening", submitted), tone: "text-emerald-600" },
    { label: "Evening missing", value: count("evening", (s) => s === "missing"), tone: "text-rose-600" },
    { label: "Late", value: count("morning", (s) => s === "late") + count("evening", (s) => s === "late"), tone: "text-amber-600" },
  ];

  const shift = (dir: 1 | -1) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else {
      const d = new Date(anchor.slice(0, 8) + "15T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + dir);
      setAnchor(d.toISOString().slice(0, 10));
    }
  };

  const rangeLabel =
    view === "day"
      ? formatDay(start)
      : view === "week"
        ? `${formatDay(start)} – ${formatDay(end)}`
        : new Date(start + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

  const select = "rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm";

  const statusCell = (c: Checkin | undefined, s: CheckinStatus, tz: string, k: CheckinKind) => (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <Badge label={STATUS_LABEL[s]} />
      {c && <span className="text-stone-500">{formatTime(c.submitted_at, tz)}</span>}
      {c && editCounts[c.id] ? <span className="text-xs text-stone-400" title={`${k} answers edited`}>edited ×{editCounts[c.id]}</span> : null}
    </span>
  );

  return (
    <Guard page="team_checkins">
      <PageHeader title="Team Check-Ins" subtitle={`Morning deadline ${deadlines.morning}, evening ${deadlines.evening}, in each person's own timezone.`} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-xl border border-stone-300 bg-white overflow-hidden">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm capitalize ${view === v ? "bg-stone-900 text-white" : ""}`}>
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => shift(-1)} className={select} aria-label="Previous">←</button>
        <input type="date" value={anchor} max={today} onChange={(e) => e.target.value && setAnchor(e.target.value)} className={select} />
        <button onClick={() => shift(1)} disabled={end >= today} className={`${select} disabled:opacity-40`} aria-label="Next">→</button>
        <span className="text-sm font-medium ml-1">{rangeLabel}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <select aria-label="Employee" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={select}>
          <option value="all">All employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select aria-label="Department" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={select}>
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select aria-label="Check-in" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className={select}>
          <option value="all">Morning & evening</option>
          <option value="morning">Morning only</option>
          <option value="evening">Evening only</option>
        </select>
        <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={select}>
          <option value="all">Any status</option>
          <option value="completed">Completed</option>
          <option value="late">Late</option>
          <option value="missing">Missing</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="!p-4">
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.tone ?? ""}`}>{loading || !settingsLoaded ? "…" : s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3">Employee</th>
              {view !== "day" && <th className="p-3">Date</th>}
              {kinds.includes("morning") && <th className="p-3">Morning</th>}
              {kinds.includes("evening") && <th className="p-3">Evening</th>}
              <th className="p-3">Planned vs. done <span className="font-normal">(self-reported)</span></th>
            </tr>
          </thead>
          <tbody>
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-stone-500">No check-ins match these filters.</td>
              </tr>
            )}
            {visible.map((r) => {
              const key = `${r.employee.id}|${r.day}`;
              const cmp = plannedVsActual(r.morning?.creative_count, r.evening?.creative_count);
              const cols = 3 + (view !== "day" ? 1 : 0) + (kinds.length - 1);
              return (
                <ExpandableRow
                  key={key}
                  open={open === key}
                  onToggle={() => setOpen(open === key ? null : key)}
                  colSpan={cols}
                  detail={
                    r.morning || r.evening ? (
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="font-medium mb-2">Morning commitments</p>
                          {r.morning ? <CheckinAnswers checkin={r.morning} /> : <p className="text-stone-500">Not submitted.</p>}
                        </div>
                        <div>
                          <p className="font-medium mb-2">Evening accomplishments</p>
                          {r.evening ? <CheckinAnswers checkin={r.evening} /> : <p className="text-stone-500">Not submitted.</p>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-stone-500">Nothing submitted for this day.</p>
                    )
                  }
                >
                  <td className="p-3 font-medium whitespace-nowrap">
                    {r.employee.full_name} <span className="text-stone-400 font-normal">{open === key ? "▾" : "▸"}</span>
                  </td>
                  {view !== "day" && <td className="p-3 whitespace-nowrap">{formatDay(r.day)}</td>}
                  {kinds.includes("morning") && <td className="p-3">{statusCell(r.morning, r.status.morning, r.employee.timezone, "morning")}</td>}
                  {kinds.includes("evening") && <td className="p-3">{statusCell(r.evening, r.status.evening, r.employee.timezone, "evening")}</td>}
                  <td className="p-3 text-stone-600 whitespace-nowrap">{cmp ? cmp.text : "—"}</td>
                </ExpandableRow>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-400 mt-3">
        Missing-check-in alerts and reminders aren&apos;t sent automatically yet — this page shows who&apos;s missing.
      </p>
    </Guard>
  );
}

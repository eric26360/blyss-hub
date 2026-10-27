"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { PlanView } from "@/components/PlanView";
import { WeekPicker } from "@/components/WeekPicker";
import { addDays, dateInTz, formatDay, formatTime } from "@/lib/checkins";
import { Badge } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { useTeam } from "@/lib/use-team";
import {
  PLAN_STATUS_LABEL,
  isMissingTable,
  planStatus,
  planningWeek,
  weekStartOf,
  type PlanStatus,
  type WeeklyPlan,
} from "@/lib/weekly-plans";

type Employee = { id: string; full_name: string; timezone: string; created_at: string };

export default function TeamWeeklyPlansPage() {
  return (
    <Suspense>
      <TeamWeeklyPlans />
    </Suspense>
  );
}

function TeamWeeklyPlans() {
  const { user } = useSession();
  const { nameOf } = useTeam();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const tz = user?.timezone ?? "America/New_York";
  const today = dateInTz(tz);

  const paramWeek = params.get("week");
  const week = paramWeek && /^\d{4}-\d{2}-\d{2}$/.test(paramWeek) ? weekStartOf(paramWeek) : planningWeek(tz);
  const setWeek = (w: string) => router.replace(`/team-weekly-plans?week=${w}`);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [editCounts, setEditCounts] = useState<Record<string, number>>({});
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "owner") return;
    let cancelled = false;
    (async () => {
      const [emp, wp] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, timezone, created_at")
          .eq("requires_weekly_plan", true)
          .eq("active", true)
          .order("full_name"),
        supabase.from("weekly_plans").select("*").eq("week_start", week),
      ]);
      if (cancelled) return;
      if (isMissingTable(wp.error) || emp.error?.code === "42703" || emp.error?.code === "PGRST204") {
        setNotReady(true);
        setLoadedWeek(week);
        return;
      }
      const rows = (wp.data as WeeklyPlan[]) ?? [];
      const edits = rows.length
        ? await supabase.from("weekly_plan_edits").select("plan_id").in("plan_id", rows.map((p) => p.id))
        : { data: [] };
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const e of edits.data ?? []) counts[e.plan_id] = (counts[e.plan_id] ?? 0) + 1;
      setEmployees((emp.data as Employee[]) ?? []);
      setPlans(rows);
      setEditCounts(counts);
      setLoadedWeek(week);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user, week]);

  const loaded = loadedWeek === week;

  // Everyone expected to write a plan, plus anyone who wrote one but is no longer required to.
  const rows = useMemo(() => {
    const weekEnd = addDays(week, 6);
    const expected = employees.filter((e) => dateInTz(e.timezone, new Date(e.created_at)) <= weekEnd);
    const extra = plans
      .filter((p) => !expected.some((e) => e.id === p.profile_id))
      .map((p) => ({ id: p.profile_id, full_name: "", timezone: tz, created_at: p.submitted_at }));
    return [...expected, ...extra].map((employee) => {
      const plan = plans.find((p) => p.profile_id === employee.id);
      return { employee, plan, status: planStatus(plan, week, employee.timezone) as PlanStatus };
    });
  }, [employees, plans, week, tz]);

  const count = (s: PlanStatus) => rows.filter((r) => r.status === s).length;
  const order: Record<PlanStatus, number> = { missing: 0, pending: 1, late: 2, completed: 3 };
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status] || a.employee.full_name.localeCompare(b.employee.full_name));

  return (
    <Guard page="team_weekly_plans">
      <PageHeader title="Team Weekly Plans" subtitle="What each strategist plans to complete, focus on, and do each day this week." />

      {notReady ? (
        <Card>
          <p className="text-sm text-stone-600">
            Weekly plans aren&apos;t switched on yet. Run <code>0004_weekly_plans.sql</code> in the Supabase SQL editor.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <WeekPicker week={week} today={today} onChange={setWeek} />
          </div>

          {loaded && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Expected", value: rows.length },
                  { label: "Submitted", value: count("completed") + count("late") },
                  { label: "Missing", value: count("missing"), warn: count("missing") > 0 },
                  { label: "Late", value: count("late") },
                ].map((s) => (
                  <Card key={s.label}>
                    <p className="text-xs text-stone-500">{s.label}</p>
                    <p className={`text-2xl font-semibold mt-1 ${s.warn ? "text-rose-600" : ""}`}>{s.value}</p>
                  </Card>
                ))}
              </div>

              {rows.length === 0 && <p className="text-sm text-stone-500">Nobody is set up to write a weekly plan.</p>}

              <div className="space-y-4">
                {sorted.map(({ employee, plan, status }) => (
                  <Card key={employee.id} className={status === "missing" ? "border-rose-300 bg-rose-50/40" : ""}>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <p className={`font-medium ${status === "missing" ? "text-rose-700" : ""}`}>{employee.full_name || nameOf(employee.id)}</p>
                      <Badge label={PLAN_STATUS_LABEL[status]} />
                      {plan && (
                        <span className="text-xs text-stone-500">
                          Submitted {formatDay(dateInTz(employee.timezone, new Date(plan.submitted_at)))},{" "}
                          {formatTime(plan.submitted_at, employee.timezone)}
                          {editCounts[plan.id] ? ` · edited ×${editCounts[plan.id]}` : ""}
                        </span>
                      )}
                    </div>
                    {plan ? (
                      <PlanView plan={plan} />
                    ) : (
                      <p className="text-sm text-stone-500">
                        {status === "missing" ? "No plan written yet." : `Not due yet — due before ${formatDay(week)}.`}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Guard>
  );
}

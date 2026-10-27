"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { PlanView } from "@/components/PlanView";
import { WeekPicker } from "@/components/WeekPicker";
import { dateInTz, formatDay, formatTime } from "@/lib/checkins";
import { Badge } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import {
  DAYS,
  DAY_LABEL,
  EMPTY_PLAN,
  PLAN_FIELDS,
  PLAN_STATUS_LABEL,
  formatWeek,
  isMissingTable,
  isWeekEnded,
  planStatus,
  planningWeek,
  weekStartOf,
  type PlanFields,
  type WeeklyPlan,
  type WeeklyPlanEdit,
} from "@/lib/weekly-plans";

export default function WeeklyPlanPage() {
  return (
    <Suspense>
      <WeeklyPlanInner />
    </Suspense>
  );
}

function WeeklyPlanInner() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const tz = user?.timezone ?? "America/New_York";
  const today = dateInTz(tz);

  const paramWeek = params.get("week");
  const week = paramWeek && /^\d{4}-\d{2}-\d{2}$/.test(paramWeek) ? weekStartOf(paramWeek) : planningWeek(tz);
  const setWeek = (w: string) => router.replace(`/weekly-plan?week=${w}`);

  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [plan, setPlan] = useState<WeeklyPlan | undefined>();
  const [edits, setEdits] = useState<WeeklyPlanEdit[]>([]);
  // Which week the data on screen belongs to, so the form never shows another week's plan.
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("weekly_plans")
      .select("*")
      .eq("profile_id", user.id)
      .order("week_start", { ascending: false })
      .limit(26);
    if (isMissingTable(error)) {
      setNotReady(true);
      setLoadedWeek(week);
      return;
    }
    setPlans((data as WeeklyPlan[]) ?? []);
    const { data: one } = await supabase
      .from("weekly_plans")
      .select("*")
      .eq("profile_id", user.id)
      .eq("week_start", week)
      .maybeSingle();
    const current = (one as WeeklyPlan | null) ?? undefined;
    setPlan(current);
    if (current) {
      const { data: e } = await supabase
        .from("weekly_plan_edits")
        .select("*")
        .eq("plan_id", current.id)
        .order("edited_at", { ascending: false });
      setEdits((e as WeeklyPlanEdit[]) ?? []);
    } else {
      setEdits([]);
    }
    setLoadedWeek(week);
  }, [supabase, user, week]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const loaded = loadedWeek === week;
  const ended = isWeekEnded(week, tz);
  const status = planStatus(plan, week, tz);

  return (
    <Guard page="weekly_plan">
      <PageHeader
        title="Weekly Plan"
        subtitle="Before each week starts, write what you'll complete, what you'll focus on, and your plan for each day."
      />

      {notReady ? (
        <Card>
          <p className="text-sm text-stone-600">Weekly plans aren&apos;t switched on yet. An owner needs to run the latest database update.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <WeekPicker week={week} today={today} onChange={setWeek} />
            {loaded && (
              <div className="flex items-center gap-2 text-sm">
                <Badge label={PLAN_STATUS_LABEL[status]} />
                <span className="text-stone-500">
                  {plan
                    ? `Submitted ${formatDay(dateInTz(tz, new Date(plan.submitted_at)))}, ${formatTime(plan.submitted_at, tz)}${plan.updated_at ? " · edited" : ""}`
                    : `Due before ${formatDay(week)}`}
                </span>
              </div>
            )}
          </div>

          {loaded &&
            (ended ? (
              <Card>
                <p className="text-xs text-stone-500 mb-4">This week has ended, so its plan is locked.</p>
                {plan ? <PlanView plan={plan} /> : <p className="text-sm text-stone-500">No plan was written for this week.</p>}
              </Card>
            ) : (
              <PlanForm key={week} week={week} plan={plan} userId={user.id} onSaved={load} />
            ))}

          {loaded && edits.length > 0 && <EditHistory edits={edits} tz={tz} />}

          <h2 className="font-medium mt-10 mb-3">My plans</h2>
          {plans.length === 0 ? (
            <p className="text-sm text-stone-500">No weekly plans yet.</p>
          ) : (
            <Card className="!p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="p-3">Week</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">What I&apos;ll complete</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setWeek(p.week_start)}
                      className={`border-b border-stone-100 last:border-0 cursor-pointer hover:bg-stone-50 ${p.week_start === week ? "bg-orange-50" : ""}`}
                    >
                      <td className="p-3 whitespace-nowrap">{formatWeek(p.week_start)}</td>
                      <td className="p-3"><Badge label={p.on_time ? "Completed" : "Late"} /></td>
                      <td className="p-3 text-stone-600 max-w-md truncate">{p.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </Guard>
  );
}

const FIELD_LABEL: Record<"goals" | "focus", string> = {
  goals: "What are you going to complete this week?",
  focus: "What are you going to focus on?",
};

function PlanForm({
  week,
  plan,
  userId,
  onSaved,
}: {
  week: string;
  plan: WeeklyPlan | undefined;
  userId: string;
  onSaved: () => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [fields, setFields] = useState<PlanFields>(() =>
    plan ? (Object.fromEntries(PLAN_FIELDS.map((f) => [f, plan[f] ?? ""])) as PlanFields) : EMPTY_PLAN,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const set = (f: keyof PlanFields, v: string) => setFields((x) => ({ ...x, [f]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    const clean = Object.fromEntries(PLAN_FIELDS.map((f) => [f, fields[f].trim()])) as PlanFields;
    const empty = PLAN_FIELDS.find((f) => !clean[f]);
    if (empty) {
      setError(`Please fill in: ${empty in DAY_LABEL ? DAY_LABEL[empty as keyof typeof DAY_LABEL] : FIELD_LABEL[empty as "goals" | "focus"]}`);
      return;
    }
    setSaving(true);
    const { error } = plan
      ? await supabase.from("weekly_plans").update(clean).eq("id", plan.id)
      : await supabase.from("weekly_plans").insert({ profile_id: userId, week_start: week, ...clean });
    setSaving(false);
    if (error) {
      setError(error.code === "23505" ? "You already have a plan for this week. Reload the page to edit it." : error.message);
      return;
    }
    setSavedMsg(plan ? "Changes saved. Your previous version is kept in the edit history." : "Weekly plan submitted. You can keep editing it until the week ends.");
    await onSaved();
  };

  const area = (f: keyof PlanFields, label: string, rows = 3) => (
    <div key={f}>
      <label htmlFor={`plan-${f}`} className="block text-sm font-medium mb-1">
        {label} <span className="text-brand">*</span>
      </label>
      <textarea
        id={`plan-${f}`}
        rows={rows}
        value={fields[f]}
        onChange={(e) => set(f, e.target.value)}
        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          {area("goals", FIELD_LABEL.goals, 4)}
          {area("focus", FIELD_LABEL.focus, 4)}
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Your plan for each day</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {DAYS.map((d) => area(d, DAY_LABEL[d], 6))}
          </div>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {savedMsg && <p className="text-sm text-emerald-700">{savedMsg}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : plan ? "Save changes" : "Submit weekly plan"}
        </button>
      </form>
    </Card>
  );
}

function EditHistory({ edits, tz }: { edits: WeeklyPlanEdit[]; tz: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <h2 className="font-medium mb-1">Edit history</h2>
      <p className="text-xs text-stone-500 mb-3">Each edit keeps the version it replaced.</p>
      <div className="space-y-2">
        {edits.map((e) => (
          <Card key={e.id} className="!p-3">
            <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="w-full text-left text-sm flex justify-between">
              <span>
                Edited {formatDay(dateInTz(tz, new Date(e.edited_at)))}, {formatTime(e.edited_at, tz)}
              </span>
              <span className="text-brand text-xs">{open === e.id ? "Hide" : "Show previous version"}</span>
            </button>
            {open === e.id && (
              <div className="mt-3">
                <PlanView plan={e.previous} />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

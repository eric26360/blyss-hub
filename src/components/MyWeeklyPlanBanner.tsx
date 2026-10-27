"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDay } from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { formatWeek, hasWeekStarted, planningWeek } from "@/lib/weekly-plans";

// Reminds the signed-in person when the plan for this/next week isn't written yet.
export function MyWeeklyPlanBanner() {
  const { user } = useSession();
  const [missing, setMissing] = useState(false);
  const tz = user?.timezone ?? "America/New_York";
  const week = planningWeek(tz);

  useEffect(() => {
    if (!user?.requiresWeeklyPlan) return;
    createClient()
      .from("weekly_plans")
      .select("id")
      .eq("profile_id", user.id)
      .eq("week_start", week)
      .maybeSingle()
      .then(({ data, error }) => setMissing(!error && !data));
  }, [user, week]);

  if (!user?.requiresWeeklyPlan || !missing) return null;

  const overdue = hasWeekStarted(week, tz);

  return (
    <div
      className={`mb-6 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        overdue ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div>
        <p className={`font-medium ${overdue ? "text-rose-800" : "text-amber-900"}`}>
          {overdue ? "Your weekly plan is overdue" : "Write your plan for next week"}
        </p>
        <p className="text-sm text-stone-600">
          {formatWeek(week)} — {overdue ? "it was due before Monday." : `due before ${formatDay(week)}.`}
        </p>
      </div>
      <Link href={`/weekly-plan?week=${week}`} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium text-center">
        Write weekly plan
      </Link>
    </div>
  );
}

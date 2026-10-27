"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { MyBudget } from "@/components/MyBudget";
import { MyCheckinStatus } from "@/components/MyCheckinStatus";
import { MyWeeklyPlanBanner } from "@/components/MyWeeklyPlanBanner";
import { parseAdName } from "@/lib/ad-naming";
import { addDays, dateInTz } from "@/lib/checkins";
import { DATA_IS_SAMPLE, fetchCreativeDays, totalsByCreative, type CreativeTotals } from "@/lib/creative-performance";
import { money } from "@/lib/format";
import { canAccess } from "@/lib/roles";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/tasks";
import { weekStartOf } from "@/lib/weekly-plans";

export default function OverviewPage() {
  const { user } = useSession();

  return (
    <Guard page="overview">
      <PageHeader title={`Hi ${user?.name} 👋`} subtitle="Here's what's happening at Blyss." />
      <MyWeeklyPlanBanner />
      <MyCheckinStatus />
      <MyBudget />
      <div className="grid lg:grid-cols-2 gap-4">
        {user && canAccess(user, "top_creatives") && <TopCreativesCard tz={user.timezone} />}
        <MyTasksCard />
      </div>
    </Guard>
  );
}

// This week's top 3 creatives by spend.
function TopCreativesCard({ tz }: { tz: string }) {
  const [top, setTop] = useState<CreativeTotals[]>([]);

  useEffect(() => {
    const week = weekStartOf(dateInTz(tz));
    fetchCreativeDays(week, addDays(week, 6)).then((d) =>
      setTop(totalsByCreative(d).sort((a, b) => b.spend - a.spend).slice(0, 3)),
    );
  }, [tz]);

  return (
    <Card>
      <h2 className="font-medium mb-1">Top creatives this week</h2>
      {DATA_IS_SAMPLE && <p className="text-xs text-amber-700 mb-3">Sample data until Northbeam is connected</p>}
      <ul className="space-y-3">
        {top.map((t) => {
          const p = parseAdName(t.adName);
          return (
            <li key={t.adName} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.conceptName ?? t.adName}</p>
                <p className="text-xs text-stone-500 truncate">
                  {[p.conceptId, t.strategist, t.creator && "@" + t.creator].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className="text-sm font-semibold">{money(t.spend)}</p>
            </li>
          );
        })}
      </ul>
      <Link href="/top-creatives" className="text-xs text-brand mt-4 inline-block hover:underline">
        All top creatives →
      </Link>
    </Card>
  );
}

// Open tasks due today or overdue, for the signed-in person.
function MyTasksCard() {
  const { user } = useSession();
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from("tasks")
      .select("*")
      .eq("assignee_id", user.id)
      .eq("status", "todo")
      .order("due_date", { ascending: true })
      .then(({ data, error }) => setTasks(error ? null : ((data as Task[]) ?? [])));
  }, [user]);

  if (!user) return null;
  const today = dateInTz(user.timezone);
  const thisWeek = weekStartOf(today);
  const due = (tasks ?? []).filter(
    (t) => (t.scope === "day" && t.due_date! <= today) || (t.scope === "week" && t.week_start! <= thisWeek),
  );

  return (
    <Card>
      <h2 className="font-medium mb-3">My tasks</h2>
      {tasks === null ? (
        <p className="text-sm text-stone-500">Tasks will show here once they&apos;re switched on.</p>
      ) : due.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing due right now. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {due.slice(0, 6).map((t) => {
            const overdue = t.scope === "day" ? t.due_date! < today : addDays(t.week_start!, 7) <= today;
            return (
              <li key={t.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{t.title}</span>
                <span className={`shrink-0 ${overdue ? "text-rose-600" : "text-stone-500"}`}>
                  {overdue ? "Overdue" : t.scope === "week" ? "This week" : "Today"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/tasks" className="text-xs text-brand mt-4 inline-block hover:underline">
        All tasks →
      </Link>
    </Card>
  );
}

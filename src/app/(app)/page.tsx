"use client";

import Link from "next/link";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { MyBudget } from "@/components/MyBudget";
import { MyCheckinStatus } from "@/components/MyCheckinStatus";
import { ADS, CREATIVES, TASKS, creativeById } from "@/lib/mock-data";
import { money, roas } from "@/lib/format";
import { useSession } from "@/lib/session";

export default function OverviewPage() {
  const { user } = useSession();
  const spend = ADS.reduce((s, a) => s + a.spend, 0);
  const revenue = ADS.reduce((s, a) => s + a.revenue, 0);
  const top = [...ADS].sort((a, b) => roas(b.revenue, b.spend) - roas(a.revenue, a.spend)).slice(0, 3);
  const myTasks = TASKS.filter((t) => t.assignee === user?.name && t.status !== "Done");

  const stats = [
    { label: "Spend (7d)", value: money(spend) },
    { label: "Revenue (7d)", value: money(revenue) },
    { label: "Blended ROAS", value: roas(revenue, spend).toFixed(2) + "x" },
    { label: "Live creatives", value: String(CREATIVES.filter((c) => c.status === "Live").length) },
  ];

  return (
    <Guard page="overview">
      <PageHeader title={`Hi ${user?.name} 👋`} subtitle="Here's what's happening at Blyss." />
      <MyCheckinStatus />
      <MyBudget />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className="text-2xl font-semibold mt-1">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-medium mb-3">Top creatives by ROAS</h2>
          <ul className="space-y-3">
            {top.map((a) => {
              const c = creativeById(a.creativeId)!;
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${c.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-stone-500">{a.platform}</p>
                  </div>
                  <p className="text-sm font-semibold">{roas(a.revenue, a.spend).toFixed(2)}x</p>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <h2 className="font-medium mb-3">My open tasks</h2>
          {myTasks.length === 0 ? (
            <p className="text-sm text-stone-500">Nothing assigned to you. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {myTasks.map((t) => (
                <li key={t.id} className="flex justify-between text-sm">
                  <span>{t.title}</span>
                  <span className="text-stone-500">{t.due}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/tasks" className="text-xs text-brand mt-4 inline-block hover:underline">
            All tasks →
          </Link>
        </Card>
      </div>
    </Guard>
  );
}

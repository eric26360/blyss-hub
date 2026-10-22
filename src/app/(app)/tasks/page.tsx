"use client";

import { Card, Guard, PageHeader } from "@/components/Guard";
import { TASKS, creativeById, type Task } from "@/lib/mock-data";

const COLUMNS: Task["status"][] = ["To Do", "In Progress", "Review", "Done"];

export default function TasksPage() {
  return (
    <Guard page="tasks">
      <PageHeader title="Tasks" subtitle="Your team's board. Will sync from ClickUp." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col} className="bg-stone-100 rounded-2xl p-3">
            <p className="text-sm font-medium mb-3 px-1">
              {col} <span className="text-stone-400">{TASKS.filter((t) => t.status === col).length}</span>
            </p>
            <div className="space-y-2">
              {TASKS.filter((t) => t.status === col).map((t) => {
                const c = t.creativeId ? creativeById(t.creativeId) : undefined;
                return (
                  <Card key={t.id} className="!p-3">
                    <p className="text-sm font-medium">{t.title}</p>
                    {c && <p className="text-xs text-brand mt-1">🎬 {c.name}</p>}
                    <div className="flex justify-between text-xs text-stone-500 mt-2">
                      <span>{t.assignee}</span>
                      <span>Due {t.due}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Guard>
  );
}

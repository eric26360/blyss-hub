"use client";

import { useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { ADS, CREATIVES, TASKS, type Creative } from "@/lib/mock-data";
import { Badge, money, roas } from "@/lib/format";
import { canAccess } from "@/lib/roles";
import { useSession } from "@/lib/session";

const FILTERS = ["All", "Live", "In Review", "Draft", "Paused"] as const;

export default function CreativesPage() {
  const { user } = useSession();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selected, setSelected] = useState<Creative | null>(null);
  const list = CREATIVES.filter((c) => filter === "All" || c.status === filter);

  return (
    <Guard page="creatives">
      <PageHeader title="Creatives" subtitle="Every video and image. Will sync from Air." />
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm border ${
              filter === f ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 bg-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map((c) => (
          <button key={c.id} onClick={() => setSelected(c)} className="text-left">
            <Card className="!p-0 overflow-hidden hover:border-brand transition">
              <div className={`aspect-[4/5] bg-gradient-to-br ${c.color} flex items-center justify-center text-white text-3xl`}>
                {c.type === "Video" ? "▶" : "▣"}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <Badge label={c.status} />
                  {c.roas && <span className="text-xs font-semibold">{c.roas}x</span>}
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`h-40 rounded-xl bg-gradient-to-br ${selected.color} mb-4`} />
            <h2 className="text-xl font-semibold">{selected.name}</h2>
            <p className="text-sm text-stone-500">
              {selected.type} · {selected.format} · by {selected.creator}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {selected.tags.map((t) => (
                <span key={t} className="text-xs bg-stone-100 rounded-full px-2 py-0.5">{t}</span>
              ))}
            </div>

            {user && canAccess(user, "ads") && (
              <>
                <h3 className="font-medium mt-5 mb-2">Running in ads</h3>
                {ADS.filter((a) => a.creativeId === selected.id).map((a) => (
                  <div key={a.id} className="flex justify-between text-sm py-1">
                    <span>{a.platform} · {a.name}</span>
                    <span>{money(a.spend)} · {roas(a.revenue, a.spend).toFixed(2)}x</span>
                  </div>
                ))}
                {!ADS.some((a) => a.creativeId === selected.id) && <p className="text-sm text-stone-500">Not in any ads yet.</p>}
              </>
            )}

            <h3 className="font-medium mt-5 mb-2">Related tasks</h3>
            {TASKS.filter((t) => t.creativeId === selected.id).map((t) => (
              <div key={t.id} className="flex justify-between text-sm py-1">
                <span>{t.title}</span>
                <Badge label={t.status} />
              </div>
            ))}
            {!TASKS.some((t) => t.creativeId === selected.id) && <p className="text-sm text-stone-500">No tasks.</p>}

            <button onClick={() => setSelected(null)} className="mt-6 w-full rounded-xl bg-stone-900 text-white py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </Guard>
  );
}

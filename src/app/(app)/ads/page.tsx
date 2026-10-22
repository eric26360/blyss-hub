"use client";

import { useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { ADS, creativeById, type Platform } from "@/lib/mock-data";
import { Badge, money, roas } from "@/lib/format";

const PLATFORMS: ("All" | Platform)[] = ["All", "Meta", "Google", "YouTube", "AppLovin", "Snapchat"];

export default function AdsPage() {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("All");
  const list = ADS.filter((a) => platform === "All" || a.platform === platform);

  return (
    <Guard page="ads">
      <PageHeader title="Ads" subtitle="All platforms in one table. Will sync from Northbeam." />
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`rounded-full px-3 py-1 text-sm border whitespace-nowrap ${
              platform === p ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 bg-white"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3">Ad</th>
              <th className="p-3">Platform</th>
              <th className="p-3 text-right">Spend</th>
              <th className="p-3 text-right">Revenue</th>
              <th className="p-3 text-right">ROAS</th>
              <th className="p-3 text-right">CPA</th>
              <th className="p-3 text-right">CTR</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const c = creativeById(a.creativeId)!;
              const r = roas(a.revenue, a.spend);
              return (
                <tr key={a.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded bg-gradient-to-br ${c.color} shrink-0`} />
                      <span className="whitespace-nowrap">{a.name}</span>
                    </div>
                  </td>
                  <td className="p-3">{a.platform}</td>
                  <td className="p-3 text-right">{money(a.spend)}</td>
                  <td className="p-3 text-right">{money(a.revenue)}</td>
                  <td className={`p-3 text-right font-semibold ${r >= 2.5 ? "text-emerald-600" : r < 1.5 ? "text-rose-600" : ""}`}>
                    {r.toFixed(2)}x
                  </td>
                  <td className="p-3 text-right">${a.cpa.toFixed(2)}</td>
                  <td className="p-3 text-right">{a.ctr}%</td>
                  <td className="p-3"><Badge label={a.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </Guard>
  );
}

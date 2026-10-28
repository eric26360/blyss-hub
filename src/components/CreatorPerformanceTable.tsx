"use client";

// One row per creator with rolled-up ad metrics. Clicking a row opens a
// dropdown with that creator's individual ads.

import Link from "next/link";
import { Fragment, useState } from "react";
import { Card } from "@/components/Guard";
import { parseAdName } from "@/lib/ad-naming";
import { formatDay } from "@/lib/checkins";
import type { AdType, CreativeTotals } from "@/lib/creative-performance";
import { pct, ratio, type CreatorRollup } from "@/lib/creator-performance";
import { money } from "@/lib/format";
import type { DirectoryCreator } from "@/lib/use-creator-performance";

type SortKey = "handle" | "adCount" | "spend" | "avgSpend" | "cpa" | "roas" | "ncPct" | "newVisitorPct" | "ctr" | "hookRate" | "winners";

const BASE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "adCount", label: "Ads" },
  { key: "spend", label: "Total spend" },
  { key: "avgSpend", label: "Avg spend / ad" },
  { key: "cpa", label: "CPA" },
  { key: "roas", label: "ROAS" },
  { key: "ncPct", label: "NC %" },
  { key: "newVisitorPct", label: "New visitor %" },
  { key: "ctr", label: "CTR" },
  { key: "hookRate", label: "Hook rate" },
  { key: "winners", label: "Winners" },
];

const usd = (n: number | null) => (n == null ? "—" : "$" + n.toFixed(2));

export function CreatorPerformanceTable({
  title,
  subtitle,
  rows,
  byHandle,
  winners,
  canClassify,
  onSetType,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  rows: CreatorRollup[];
  byHandle: Map<string, DirectoryCreator>;
  winners: Set<string>;
  canClassify: boolean;
  onSetType?: (adName: string, type: AdType) => void;
  emptyText: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "spend", desc: true });
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Hook rate only shows when the data source actually provides it.
  const showHook = rows.some((r) => r.hookRate !== undefined);
  const columns = BASE_COLUMNS.filter((c) => c.key !== "hookRate" || showHook);

  const sorted = [...rows].sort((a, b) => {
    if (sort.key === "handle") return sort.desc ? b.handle.localeCompare(a.handle) : a.handle.localeCompare(b.handle);
    const av = a[sort.key] ?? null;
    const bv = b[sort.key] ?? null;
    // Blank values (e.g. no orders yet) always go last.
    if (av === null) return 1;
    if (bv === null) return -1;
    return sort.desc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  const clickSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "handle" && key !== "cpa" }));

  const toggle = (h: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });

  const arrow = (k: SortKey) => (sort.key === k ? (sort.desc ? " ↓" : " ↑") : "");

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      </div>
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3 w-8">#</th>
              <th className="p-3">
                <button onClick={() => clickSort("handle")} className="hover:text-stone-900 whitespace-nowrap">Creator{arrow("handle")}</button>
              </th>
              {columns.map((c) => (
                <th key={c.key} className="p-3 text-right">
                  <button onClick={() => clickSort(c.key)} className="hover:text-stone-900 whitespace-nowrap">
                    {c.label}
                    {arrow(c.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const c = byHandle.get(r.handle);
              const isOpen = open.has(r.handle);
              return (
                <Fragment key={r.handle}>
                  <tr
                    onClick={() => toggle(r.handle)}
                    className={`border-b border-stone-100 cursor-pointer hover:bg-stone-50 ${isOpen ? "bg-stone-50" : ""}`}
                    aria-expanded={isOpen}
                  >
                    <td className="p-3 text-stone-400">{i + 1}</td>
                    <td className="p-3 min-w-44">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs text-stone-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                        <div>
                          {c ? (
                            <Link href={`/creators/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-brand">
                              {c.full_name}
                            </Link>
                          ) : (
                            <span className="font-medium">@{r.handle}</span>
                          )}
                          <p className="text-xs text-stone-500">
                            {c ? `@${r.handle}` : "Not in directory"}
                            {c?.is_top && <span className="ml-1 text-amber-600">⭐ Top</span>}
                            {c?.is_trybe && <span className="ml-1 text-violet-600">Trybe</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right">{r.adCount}</td>
                    <td className="p-3 text-right font-semibold">{money(r.spend)}</td>
                    <td className="p-3 text-right">{money(r.avgSpend)}</td>
                    <td className="p-3 text-right">{usd(r.cpa)}</td>
                    <td className={`p-3 text-right ${r.roas != null && r.roas >= 2.5 ? "text-emerald-600" : r.roas != null && r.roas < 1.5 ? "text-rose-600" : ""}`}>
                      {ratio(r.roas)}
                    </td>
                    <td className="p-3 text-right">{pct(r.ncPct)}</td>
                    <td className="p-3 text-right">{pct(r.newVisitorPct)}</td>
                    <td className="p-3 text-right">{pct(r.ctr)}</td>
                    {showHook && <td className="p-3 text-right">{pct(r.hookRate)}</td>}
                    <td className="p-3 text-right">{r.winners ? <span className="text-emerald-700 font-medium">🏆 {r.winners}</span> : "0"}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <td colSpan={columns.length + 2} className="p-0">
                        <AdList ads={r.ads} winners={winners} showHook={showHook} canClassify={canClassify} onSetType={onSetType} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="p-6 text-center text-stone-500">{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

function AdList({
  ads,
  winners,
  showHook,
  canClassify,
  onSetType,
}: {
  ads: CreativeTotals[];
  winners: Set<string>;
  showHook: boolean;
  canClassify: boolean;
  onSetType?: (adName: string, type: AdType) => void;
}) {
  const list = [...ads].sort((a, b) => b.spend - a.spend);
  return (
    <div className="px-3 py-3 md:pl-10">
      <table className="w-full text-xs bg-white rounded-xl border border-stone-200">
        <thead className="text-left text-stone-500 border-b border-stone-200">
          <tr>
            <th className="p-2">Ad</th>
            <th className="p-2">Type</th>
            <th className="p-2">Posted</th>
            <th className="p-2 text-right">Spend</th>
            <th className="p-2 text-right">CPA</th>
            <th className="p-2 text-right">ROAS</th>
            <th className="p-2 text-right">NC %</th>
            <th className="p-2 text-right">New visitor %</th>
            <th className="p-2 text-right">CTR</th>
            <th className="p-2 text-right">CPM</th>
            {showHook && <th className="p-2 text-right">Hook rate</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((a) => {
            const p = parseAdName(a.adName);
            const win = winners.has(a.adName);
            return (
              <tr key={a.adName} className={`border-b border-stone-100 last:border-0 ${win ? "bg-emerald-50/60" : ""}`}>
                <td className="p-2 min-w-56">
                  <p className="font-medium">
                    {p.conceptName ?? a.adName}
                    {win && <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5">🏆 Winner</span>}
                  </p>
                  <p className="text-stone-500 break-all" title={a.adName}>
                    {[p.conceptId, p.variation, p.product, p.angle, p.scent, a.strategist && `CS: ${a.strategist}`].filter(Boolean).join(" · ") || a.adName}
                  </p>
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  {canClassify && onSetType ? (
                    <select
                      value={a.adType}
                      onChange={(e) => onSetType(a.adName, e.target.value as AdType)}
                      className="rounded-lg border border-stone-300 px-1.5 py-1 bg-white"
                      aria-label="Whitelisted or paid"
                    >
                      <option value="whitelisted">Whitelisted</option>
                      <option value="paid">Paid</option>
                    </select>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 ${a.adType === "whitelisted" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                      {a.adType === "whitelisted" ? "Whitelisted" : "Paid"}
                    </span>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">{formatDay(a.launchDate)}</td>
                <td className="p-2 text-right font-semibold">{money(a.spend)}</td>
                <td className="p-2 text-right">{usd(a.cpa)}</td>
                <td className="p-2 text-right">{ratio(a.roas)}</td>
                <td className="p-2 text-right">{pct(a.ncPct)}</td>
                <td className="p-2 text-right">{pct(a.newVisitorPct)}</td>
                <td className="p-2 text-right">{pct(a.ctr)}</td>
                <td className="p-2 text-right">{usd(a.cpm)}</td>
                {showHook && <td className="p-2 text-right">{pct(a.hookRate)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


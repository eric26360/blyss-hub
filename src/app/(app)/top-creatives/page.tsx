"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { addDays, dateInTz, formatDay } from "@/lib/checkins";
import {
  DATA_IS_SAMPLE,
  fetchCreativeDays,
  isWinningCreative,
  totalsByCreative,
  type CreativeTotals,
} from "@/lib/creative-performance";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { weekStartOf } from "@/lib/weekly-plans";
import { DEFAULT_WINNING_RULES } from "@/lib/winning";

type Mode = "day" | "week" | "month" | "custom";
type SortKey = "adName" | "launchDate" | "spend" | "ncPct" | "cpa" | "roas";

const MODES: { key: Mode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom" },
];

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "adName", label: "Creative" },
  { key: "launchDate", label: "Date posted" },
  { key: "spend", label: "Spend", numeric: true },
  { key: "ncPct", label: "NC %", numeric: true },
  { key: "cpa", label: "CPA / cost per order", numeric: true },
  { key: "roas", label: "ROAS", numeric: true },
];

function monthRange(anchor: string) {
  const from = anchor.slice(0, 8) + "01";
  const next = new Date(from + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

function shiftMonth(anchor: string, n: number) {
  const d = new Date(anchor.slice(0, 8) + "01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function rangeLabel(mode: Mode, from: string, to: string) {
  if (mode === "day") return formatDay(from);
  if (mode === "month")
    return new Date(from + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  return `${formatDay(from)} – ${formatDay(to)}`;
}

export default function TopCreativesPage() {
  const { user } = useSession();
  const today = dateInTz(user?.timezone ?? "America/New_York");

  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const [strategist, setStrategist] = useState("");
  const [creator, setCreator] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "spend", desc: true });
  const [rows, setRows] = useState<CreativeTotals[]>([]);
  const [lifetime, setLifetime] = useState<CreativeTotals[]>([]);

  const { from, to } = useMemo(() => {
    if (mode === "day") return { from: anchor, to: anchor };
    if (mode === "week") {
      const start = weekStartOf(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    if (mode === "month") return monthRange(anchor);
    return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
  }, [mode, anchor, custom]);

  useEffect(() => {
    fetchCreativeDays(from, to).then((d) => setRows(totalsByCreative(d)));
  }, [from, to]);

  // Winners are judged on each creative's whole life, not just the selected range.
  useEffect(() => {
    fetchCreativeDays("2000-01-01", today).then((d) => setLifetime(totalsByCreative(d)));
  }, [today]);

  const winners = useMemo(() => new Set(lifetime.filter(isWinningCreative).map((t) => t.adName)), [lifetime]);

  const strategists = [...new Set(rows.map((r) => r.strategist).filter(Boolean))].sort() as string[];
  const creators = [...new Set(rows.map((r) => r.creator).filter(Boolean))].sort() as string[];

  const visible = rows
    .filter((r) => (!strategist || r.strategist === strategist) && (!creator || r.creator === creator))
    .sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // Blank values (e.g. no orders yet) always go last.
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.desc ? -cmp : cmp;
    });

  const total = visible.reduce(
    (s, r) => ({ spend: s.spend + r.spend, revenue: s.revenue + r.revenue, orders: s.orders + r.orders, nc: s.nc + r.newCustomerOrders }),
    { spend: 0, revenue: 0, orders: 0, nc: 0 },
  );

  const step = (n: number) => {
    if (mode === "day") setAnchor(addDays(anchor, n));
    if (mode === "week") setAnchor(addDays(anchor, 7 * n));
    if (mode === "month") setAnchor(shiftMonth(anchor, n));
  };

  const clickSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "adName" }));

  return (
    <Guard page="top_creatives">
      <PageHeader title="Top Creatives" subtitle="Every creative that spent in the period, ranked by spend." />

      {DATA_IS_SAMPLE && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Sample data</strong> — this page connects to Northbeam next. Numbers and ads below are made up.
        </div>
      )}

      <Card className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-stone-300 overflow-hidden">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3 py-1.5 text-sm ${mode === m.key ? "bg-stone-900 text-white" : "bg-white hover:bg-stone-50"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {mode === "custom" ? (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={custom.from} max={today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1" />
              <span className="text-stone-400">to</span>
              <input type="date" value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-1" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => step(-1)} className="rounded-lg border border-stone-300 px-2 py-1 hover:bg-stone-50" aria-label="Previous">←</button>
              <span className="font-medium min-w-40 text-center">{rangeLabel(mode, from, to)}</span>
              <button onClick={() => step(1)} disabled={to >= today} className="rounded-lg border border-stone-300 px-2 py-1 hover:bg-stone-50 disabled:opacity-40" aria-label="Next">→</button>
              {from > today || to < today ? (
                <button onClick={() => setAnchor(today)} className="text-xs text-brand hover:underline">Today</button>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select value={strategist} onChange={(e) => setStrategist(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 bg-white">
            <option value="">All strategists</option>
            {strategists.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={creator} onChange={(e) => setCreator(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 bg-white">
            <option value="">All creators</option>
            {creators.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Spend", value: money(total.spend) },
          { label: "ROAS", value: total.spend ? (total.revenue / total.spend).toFixed(2) + "x" : "—" },
          { label: "CPA", value: total.orders ? money(total.spend / total.orders) : "—" },
          { label: "NC %", value: total.orders ? Math.round((total.nc / total.orders) * 100) + "%" : "—" },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className="text-2xl font-semibold mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3 w-8">#</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`p-3 ${c.numeric ? "text-right" : ""}`}>
                  <button onClick={() => clickSort(c.key)} className="hover:text-stone-900 whitespace-nowrap">
                    {c.label}
                    {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const win = winners.has(r.adName);
              return (
                <tr key={r.adName} className={`border-b border-stone-100 last:border-0 ${win ? "bg-emerald-50/60" : ""}`}>
                  <td className="p-3 text-stone-400">{i + 1}</td>
                  <td className="p-3 min-w-72">
                    <div className="flex items-start gap-2">
                      <span className="break-all">{r.adName}</span>
                      {win && <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">🏆 Winner</span>}
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      {r.strategist ? `Strategist: ${r.strategist}` : "Strategist: —"}
                      {" · "}
                      {r.creator ? `Creator: @${r.creator}` : "No creator"}
                    </p>
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDay(r.launchDate)}</td>
                  <td className="p-3 text-right font-semibold">{money(r.spend)}</td>
                  <td className="p-3 text-right">{r.ncPct === null ? "—" : Math.round(r.ncPct) + "%"}</td>
                  <td className="p-3 text-right">{r.cpa === null ? "—" : "$" + r.cpa.toFixed(2)}</td>
                  <td className={`p-3 text-right ${r.roas >= 2.5 ? "text-emerald-600" : r.roas < 1.5 ? "text-rose-600" : ""}`}>
                    {r.roas.toFixed(2)}x
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="p-6 text-center text-stone-500">No creatives spent in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-500 mt-3">
        🏆 Winner (judged on the creative&apos;s lifetime): spend over {money(DEFAULT_WINNING_RULES.minSpend)}, CAC under{" "}
        {money(DEFAULT_WINNING_RULES.maxCac)}, new visitors over {DEFAULT_WINNING_RULES.minNewVisitorPct}%.
      </p>
    </Guard>
  );
}

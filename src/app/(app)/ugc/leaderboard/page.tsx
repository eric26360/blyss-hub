"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DateRangeControls, useDateRange } from "@/components/DateRange";
import { Avatar } from "@/components/CreatorBits";
import { TagChips, TagFilters, TagsNotReady } from "@/components/CreatorTags";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { DATA_IS_SAMPLE, type AdType } from "@/lib/creative-performance";
import {
  compact,
  needsMigration,
  normalizeHandle,
  pct,
  ratio,
  rollupByCreator,
  rollupSeeding,
  type CreatorRollup,
  type SeedingRollup,
  type SeedingSend,
} from "@/lib/creator-performance";
import { hasTagFilter, matchesTagFilter, useCreatorTags, type TagFilter } from "@/lib/creator-tags";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useCreatorPerformance, type DirectoryCreator } from "@/lib/use-creator-performance";

type Metric = "spend" | "winners" | "roas" | "cpa" | "ncPct" | "seedingViews" | "seedingRevenue";

const METRICS: { key: Metric; label: string; lowIsBetter?: boolean }[] = [
  { key: "spend", label: "Total ad spend" },
  { key: "winners", label: "Winning ads" },
  { key: "roas", label: "ROAS" },
  { key: "cpa", label: "CPA (lowest first)", lowIsBetter: true },
  { key: "ncPct", label: "NC %" },
  { key: "seedingViews", label: "Seeding views" },
  { key: "seedingRevenue", label: "Seeding code revenue" },
];

type Row = {
  key: string;
  creator?: DirectoryCreator;
  handle: string;
  perf?: CreatorRollup;
  seeding?: SeedingRollup;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function metricValue(r: Row, m: Metric): number | null {
  if (m === "seedingViews") return r.seeding ? r.seeding.views : null;
  if (m === "seedingRevenue") return r.seeding ? r.seeding.codeRevenue : null;
  if (!r.perf) return null;
  return r.perf[m] ?? null;
}

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const range = useDateRange("month");
  const { totals, winners, directory, byHandle } = useCreatorPerformance(range.from, range.to, range.today);

  const [metric, setMetric] = useState<Metric>("spend");
  const [adType, setAdType] = useState<"all" | AdType>("all");
  const [topOnly, setTopOnly] = useState(false);
  const ct = useCreatorTags();
  const [tagFilter, setTagFilter] = useState<TagFilter>({});
  const [sends, setSends] = useState<SeedingSend[]>([]);
  const [seedingReady, setSeedingReady] = useState(true);

  useEffect(() => {
    supabase
      .from("seeding_sends")
      .select("*")
      .gte("shipped_on", range.from)
      .lte("shipped_on", range.to)
      .then(({ data, error }) => {
        if (needsMigration(error)) return setSeedingReady(false);
        setSends((data as SeedingSend[]) ?? []);
      });
  }, [supabase, range.from, range.to]);

  const rows = useMemo(() => {
    const byId = new Map(directory.map((c) => [c.id, c]));
    const map = new Map<string, Row>();
    const rowFor = (creator: DirectoryCreator | undefined, handle: string) => {
      const key = creator ? creator.id : "@" + handle;
      const existing = map.get(key);
      if (existing) return existing;
      const row: Row = { key, creator, handle: creator ? normalizeHandle(creator.instagram) || normalizeHandle(creator.tiktok) || handle : handle };
      map.set(key, row);
      return row;
    };

    const ads = adType === "all" ? totals : totals.filter((t) => t.adType === adType);
    for (const p of rollupByCreator(ads, winners)) rowFor(byHandle.get(p.handle), p.handle).perf = p;
    for (const s of rollupSeeding(sends)) {
      const creator = s.creatorId ? byId.get(s.creatorId) : byHandle.get(s.handle);
      rowFor(creator, s.handle).seeding = s;
    }
    return [...map.values()];
  }, [totals, adType, winners, byHandle, directory, sends]);

  const def = METRICS.find((m) => m.key === metric)!;
  const ranked = rows
    .filter((r) => !topOnly || r.creator?.is_top)
    .filter((r) => !hasTagFilter(tagFilter) || (!!r.creator && matchesTagFilter(ct.byCreator.get(r.creator.id), tagFilter)))
    .sort((a, b) => {
      const av = metricValue(a, metric);
      const bv = metricValue(b, metric);
      if (av === null && bv === null) return (b.perf?.spend ?? 0) - (a.perf?.spend ?? 0);
      if (av === null) return 1;
      if (bv === null) return -1;
      return def.lowIsBetter ? av - bv : bv - av;
    });

  const control = "rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white";

  return (
    <Guard page="ugc_leaderboard">
      <PageHeader title="Creator Leaderboard" subtitle="Our UGC creators ranked from best to worst, by the metric you choose." />

      {DATA_IS_SAMPLE && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Sample ad data</strong> — ad numbers connect to Northbeam next. Seeding numbers are real once logged.
        </div>
      )}
      {!seedingReady && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Seeding stats aren&apos;t switched on yet. An owner needs to run the <code>0007_ugc_performance.sql</code> database update in Supabase.
        </div>
      )}

      <Card className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DateRangeControls range={range} />
        <div className="flex flex-wrap gap-2 items-center">
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className={control} aria-label="Rank by">
            {METRICS.map((m) => <option key={m.key} value={m.key}>Rank by: {m.label}</option>)}
          </select>
          <select value={adType} onChange={(e) => setAdType(e.target.value as "all" | AdType)} className={control} aria-label="Ad type">
            <option value="all">Whitelisted + paid</option>
            <option value="whitelisted">Whitelisted only</option>
            <option value="paid">Paid only</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm px-1">
            <input type="checkbox" checked={topOnly} onChange={(e) => setTopOnly(e.target.checked)} /> ⭐ Top creators only
          </label>
        </div>
      </Card>
      <div className="mb-4">
        {ct.ready ? <TagFilters ct={ct} value={tagFilter} onChange={setTagFilter} /> : ct.loaded && <TagsNotReady />}
      </div>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3 w-14">Rank</th>
              <th className="p-3">Creator</th>
              <Th label="Ad spend" active={metric === "spend"} />
              <Th label="Ads" />
              <Th label="Winners" active={metric === "winners"} />
              <Th label="ROAS" active={metric === "roas"} />
              <Th label="CPA" active={metric === "cpa"} />
              <Th label="NC %" active={metric === "ncPct"} />
              <Th label="Seeding views" active={metric === "seedingViews"} />
              <Th label="Code revenue" active={metric === "seedingRevenue"} />
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const has = metricValue(r, metric) !== null;
              return (
                <tr key={r.key} className={`border-b border-stone-100 last:border-0 ${has && i < 3 ? "bg-amber-50/50" : ""}`}>
                  <td className="p-3 text-lg">
                    {!has ? <span className="text-sm text-stone-300">—</span> : i < 3 ? MEDALS[i] : <span className="text-sm text-stone-500">{i + 1}</span>}
                  </td>
                  <td className="p-3 min-w-48">
                    <div className="flex items-center gap-2">
                      {r.creator && <Avatar creator={r.creator} />}
                      <div>
                        {r.creator ? (
                          <Link href={`/creators/${r.creator.id}`} className="font-medium hover:text-brand">{r.creator.full_name}</Link>
                        ) : (
                          <span className="font-medium">@{r.handle}</span>
                        )}
                        <p className="text-xs text-stone-500">
                          {r.creator ? (r.handle ? "@" + r.handle : "") : "Not in directory"}
                          {r.creator?.is_top && <span className="ml-1 rounded-full bg-amber-100 text-amber-800 px-1.5">⭐ Top</span>}
                          {r.creator?.is_trybe && <span className="ml-1 rounded-full bg-violet-100 text-violet-700 px-1.5">Trybe</span>}
                        </p>
                        {r.creator && <TagChips tags={ct.tagsOf(r.creator.id)} ct={ct} className="mt-1" />}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold">{r.perf ? money(r.perf.spend) : "—"}</td>
                  <td className="p-3 text-right">{r.perf?.adCount ?? "—"}</td>
                  <td className="p-3 text-right">{r.perf ? (r.perf.winners ? `🏆 ${r.perf.winners}` : "0") : "—"}</td>
                  <td className="p-3 text-right">{ratio(r.perf?.roas)}</td>
                  <td className="p-3 text-right">{r.perf?.cpa != null ? "$" + r.perf.cpa.toFixed(2) : "—"}</td>
                  <td className="p-3 text-right">{pct(r.perf?.ncPct)}</td>
                  <td className="p-3 text-right">{r.seeding ? compact(r.seeding.views) : "—"}</td>
                  <td className="p-3 text-right">{r.seeding ? money(r.seeding.codeRevenue) : "—"}</td>
                </tr>
              );
            })}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-stone-500">
                  {hasTagFilter(tagFilter)
                    ? "No creators with these tags have ads or seeding in this period."
                    : topOnly
                      ? "No ⭐ Top creators have ads or seeding in this period."
                      : "No creator ads or seeding in this period."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-500 mt-3">
        Ad numbers come from creator ads in the period (creator read from the ad name). Seeding counts sends shipped in the period.
        Creators without a value for the chosen metric are listed last, unranked. ⭐ Top is set on a creator&apos;s profile.
      </p>
    </Guard>
  );
}

function Th({ label, active }: { label: string; active?: boolean }) {
  return <th className={`p-3 text-right whitespace-nowrap ${active ? "text-stone-900" : ""}`}>{label}{active ? " ●" : ""}</th>;
}

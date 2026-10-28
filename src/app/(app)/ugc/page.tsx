"use client";

import { useMemo, useState } from "react";
import { CreatorPerformanceTable } from "@/components/CreatorPerformanceTable";
import { TagFilters, TagsNotReady } from "@/components/CreatorTags";
import { DateRangeControls, useDateRange } from "@/components/DateRange";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { TagPerformanceCard } from "@/components/TagPerformance";
import { DATA_IS_SAMPLE } from "@/lib/creative-performance";
import { normalizeHandle, pct, ratio, rollupByCreator, type CreatorRollup } from "@/lib/creator-performance";
import { hasTagFilter, matchesTagFilter, useCreatorTags, type TagFilter } from "@/lib/creator-tags";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useCreatorPerformance } from "@/lib/use-creator-performance";
import { DEFAULT_WINNING_RULES } from "@/lib/winning";

export default function CreatorPerformancePage() {
  const { user } = useSession();
  const range = useDateRange("month");
  const { totals, winners, byHandle, classificationsReady, setAdType, error } = useCreatorPerformance(range.from, range.to, range.today);

  const ct = useCreatorTags();
  const [tagFilter, setTagFilter] = useState<TagFilter>({});
  // With a tag filter on, only creators in the directory who have every chosen tag.
  const keepHandle = (handle: string) => {
    if (!hasTagFilter(tagFilter)) return true;
    const c = byHandle.get(handle);
    return !!c && matchesTagFilter(ct.byCreator.get(c.id), tagFilter);
  };
  const keep = (r: CreatorRollup) => keepHandle(r.handle);

  const whitelisted = useMemo(() => rollupByCreator(totals.filter((t) => t.adType === "whitelisted"), winners), [totals, winners]).filter(keep);
  const paid = useMemo(() => rollupByCreator(totals.filter((t) => t.adType === "paid"), winners), [totals, winners]).filter(keep);

  // Ads with a creator in the name only.
  const creatorAds = totals.filter((t) => t.creator && keepHandle(normalizeHandle(t.creator)));
  const sum = (k: "spend" | "revenue" | "orders" | "newCustomerOrders" | "visits" | "newVisits") =>
    creatorAds.reduce((s, a) => s + a[k], 0);
  const spend = sum("spend");
  const orders = sum("orders");
  const visits = sum("visits");

  const canClassify = (user?.role === "owner" || user?.role === "ugc_manager") && classificationsReady;

  return (
    <Guard page="ugc_performance">
      <PageHeader
        title="Creator Performance"
        subtitle="Every UGC creator's ads, rolled up per creator. Whitelisted ads on top, paid ads below. Click a creator to see their ads."
      />

      {DATA_IS_SAMPLE && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Sample data</strong> — this page connects to Northbeam next. Creators, ads and numbers below are made up.
        </div>
      )}
      {!classificationsReady && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Switching ads between whitelisted and paid isn&apos;t switched on yet. An owner needs to run the{" "}
          <code>0007_ugc_performance.sql</code> database update in Supabase.
        </div>
      )}

      <Card className="mb-4 space-y-3">
        <DateRangeControls range={range} />
        {ct.ready ? <TagFilters ct={ct} value={tagFilter} onChange={setTagFilter} /> : ct.loaded && <TagsNotReady />}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Creator ad spend", value: money(spend) },
          { label: "Creators", value: String(new Set([...whitelisted, ...paid].map((r) => r.handle)).size) },
          { label: "ROAS", value: spend ? ratio(sum("revenue") / spend) : "—" },
          { label: "CPA", value: orders ? money(spend / orders) : "—" },
          { label: "NC % / new visitors", value: `${orders ? pct((sum("newCustomerOrders") / orders) * 100) : "—"} / ${visits ? pct((sum("newVisits") / visits) * 100) : "—"}` },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className="text-xl font-semibold mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

      <CreatorPerformanceTable
        title="Whitelisted"
        subtitle="Ads run from the creator's own handle"
        rows={whitelisted}
        byHandle={byHandle}
        winners={winners}
        canClassify={canClassify}
        onSetType={setAdType}
        emptyText={hasTagFilter(tagFilter) ? "No whitelisted ads from creators with these tags in this period." : "No whitelisted creator ads spent in this period."}
        tags={ct}
      />
      <CreatorPerformanceTable
        title="Paid"
        subtitle="Creator content run from Blyss's ad accounts"
        rows={paid}
        byHandle={byHandle}
        winners={winners}
        canClassify={canClassify}
        onSetType={setAdType}
        emptyText={hasTagFilter(tagFilter) ? "No paid ads from creators with these tags in this period." : "No paid creator ads spent in this period."}
        tags={ct}
      />

      <TagPerformanceCard ct={ct} totals={totals} byHandle={byHandle} winners={winners} />

      <p className="text-xs text-stone-500">
        Creators are read from the ad name. A creator links to their profile when their Instagram or TikTok handle in the Creator Directory matches.
        🏆 Winner (judged on the ad&apos;s lifetime): spend over {money(DEFAULT_WINNING_RULES.minSpend)}, CAC under {money(DEFAULT_WINNING_RULES.maxCac)},
        new visitors over {DEFAULT_WINNING_RULES.minNewVisitorPct}%.
        {canClassify && " Change an ad between whitelisted and paid from the dropdown inside a creator."}
      </p>
    </Guard>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, StatusBadge } from "@/components/CreatorBits";
import { CreatorPerformanceTable } from "@/components/CreatorPerformanceTable";
import { TagChips, TagFilters } from "@/components/CreatorTags";
import { DateRangeControls, useDateRange } from "@/components/DateRange";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { formatDay } from "@/lib/checkins";
import { DATA_IS_SAMPLE } from "@/lib/creative-performance";
import {
  compact,
  needsMigration,
  normalizeHandle,
  rollupByCreator,
  rollupSeeding,
  type SeedingSend,
} from "@/lib/creator-performance";
import { hasTagFilter, matchesTagFilter, useCreatorTags, type TagFilter } from "@/lib/creator-tags";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { useCreatorPerformance } from "@/lib/use-creator-performance";

export default function TrybePage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const range = useDateRange("month");
  const { totals, winners, directory, byHandle, classificationsReady, setAdType, reload } = useCreatorPerformance(
    range.from,
    range.to,
    range.today,
  );
  const [sends, setSends] = useState<SeedingSend[]>([]);
  const [ready, setReady] = useState(true);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ct = useCreatorTags();
  const [tagFilter, setTagFilter] = useState<TagFilter>({});

  useEffect(() => {
    supabase
      .from("seeding_sends")
      .select("*")
      .gte("shipped_on", range.from)
      .lte("shipped_on", range.to)
      .then(({ data, error }) => {
        if (needsMigration(error)) return setReady(false);
        setSends((data as SeedingSend[]) ?? []);
      });
  }, [supabase, range.from, range.to]);

  const members = directory.filter((c) => c.is_trybe && matchesTagFilter(ct.byCreator.get(c.id), tagFilter));
  const memberHandles = new Set(members.flatMap((c) => [normalizeHandle(c.instagram), normalizeHandle(c.tiktok)]).filter(Boolean));
  const memberIds = new Set(members.map((c) => c.id));

  const perf = rollupByCreator(totals, winners).filter((r) => memberHandles.has(r.handle));
  const seeding = new Map(
    rollupSeeding(sends.filter((s) => (s.creator_id ? memberIds.has(s.creator_id) : memberHandles.has(normalizeHandle(s.creator_handle))))).map(
      (s) => [s.creatorId ?? byHandle.get(s.handle)?.id ?? s.key, s],
    ),
  );

  const isCurator = user?.role === "owner" || user?.role === "ugc_manager";
  // Strategists can only change creators assigned to them (the database enforces this too).
  const canChange = (c: { assigned_strategist_id: string | null }) =>
    isCurator || (user?.role === "strategist" && c.assigned_strategist_id === user.id);
  const candidates = directory.filter((c) => !c.is_trybe && c.status !== "do_not_work_with" && canChange(c));

  const setTrybe = async (id: string, on: boolean) => {
    setError(null);
    const { error } = await supabase.from("ugc_creators").update({ is_trybe: on }).eq("id", id);
    if (error) return setError(error.message);
    setAdding("");
    reload();
  };

  const control = "rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";

  return (
    <Guard page="ugc_trybe">
      <PageHeader title="Trybe Creators" subtitle="Our Trybe creator community: who's in it, how their ads perform and what seeding brought in." />

      {!ready ? (
        <Card className="text-sm text-stone-600">
          Trybe isn&apos;t switched on yet. An owner needs to run the <code>0007_ugc_performance.sql</code> database update in Supabase.
        </Card>
      ) : (
        <>
          {DATA_IS_SAMPLE && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Sample ad data</strong> — ad numbers connect to Northbeam next. Trybe members and seeding are real.
            </div>
          )}

          <Card className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <DateRangeControls range={range} />
            {candidates.length > 0 && (
              <div className="flex gap-2 w-full lg:w-auto">
                <select value={adding} onChange={(e) => setAdding(e.target.value)} className={`${control} flex-1`} aria-label="Creator to add">
                  <option value="">Add a creator to Trybe…</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
                <button onClick={() => setTrybe(adding, true)} disabled={!adding} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
                  Add
                </button>
              </div>
            )}
          </Card>

          {ct.ready && (
            <div className="mb-4">
              <TagFilters ct={ct} value={tagFilter} onChange={setTagFilter} />
            </div>
          )}
          {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

          <h2 className="text-lg font-semibold mb-2">Members ({members.length})</h2>
          <Card className="!p-0 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="p-3">Creator</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Ad spend</th>
                  <th className="p-3 text-right">Winners</th>
                  <th className="p-3 text-right">Seeding sends</th>
                  <th className="p-3 text-right">Posts</th>
                  <th className="p-3 text-right">Views</th>
                  <th className="p-3 text-right">Code revenue</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((c) => {
                  const handles = [normalizeHandle(c.instagram), normalizeHandle(c.tiktok)].filter(Boolean);
                  const p = perf.filter((r) => handles.includes(r.handle));
                  const s = seeding.get(c.id);
                  return (
                    <tr key={c.id} className="border-b border-stone-100 last:border-0">
                      <td className="p-3 min-w-48">
                        <Link href={`/creators/${c.id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                          <Avatar creator={c} />
                          <span>
                            {c.full_name}
                            {c.trybe_notes && <span className="block text-xs font-normal text-stone-500">{c.trybe_notes}</span>}
                          </span>
                        </Link>
                        <TagChips tags={ct.tagsOf(c.id)} ct={ct} className="ml-10 mt-1" />
                      </td>
                      <td className="p-3"><StatusBadge status={c.status} /></td>
                      <td className="p-3 whitespace-nowrap">{c.trybe_joined_on ? formatDay(c.trybe_joined_on) : "—"}</td>
                      <td className="p-3 text-right font-semibold">{p.length ? money(p.reduce((t, r) => t + r.spend, 0)) : "—"}</td>
                      <td className="p-3 text-right">{p.length ? p.reduce((t, r) => t + r.winners, 0) : "—"}</td>
                      <td className="p-3 text-right">{s?.sends ?? 0}</td>
                      <td className="p-3 text-right">{s?.posts ?? 0}</td>
                      <td className="p-3 text-right">{s ? compact(s.views) : "—"}</td>
                      <td className="p-3 text-right">{s ? money(s.codeRevenue) : "—"}</td>
                      <td className="p-3 text-right">
                        {canChange(c) && (
                          <button onClick={() => setTrybe(c.id, false)} className="text-xs text-stone-400 hover:text-rose-600 whitespace-nowrap">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-stone-500">
                      {hasTagFilter(tagFilter)
                        ? "No Trybe creators have these tags."
                        : "No Trybe creators yet. Add one above, or from a creator\u2019s profile."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <CreatorPerformanceTable
            title="Trybe ad performance"
            subtitle="Whitelisted and paid combined. Click a creator to see their ads."
            rows={perf}
            byHandle={byHandle}
            winners={winners}
            canClassify={isCurator && classificationsReady}
            onSetType={setAdType}
            emptyText="No Trybe creator ads spent in this period."
            tags={ct}
          />
          <p className="text-xs text-stone-500">
            Ads are matched to a Trybe creator by the Instagram or TikTok handle on their profile. Seeding counts sends shipped in the period.
          </p>
        </>
      )}
    </Guard>
  );
}

"use client";

// "Performance by tag": creator ad results grouped by one casting-tag group
// (e.g. Ethnicity → Black, White, …), so the team can see which kinds of
// creators perform best.

import { useState } from "react";
import { Card } from "@/components/Guard";
import type { CreativeTotals } from "@/lib/creative-performance";
import { normalizeHandle, pct, ratio } from "@/lib/creator-performance";
import { summarizeAds, type CreatorTags, type TagPerformance } from "@/lib/creator-tags";
import { money } from "@/lib/format";
import type { DirectoryCreator } from "@/lib/use-creator-performance";

export function TagPerformanceCard({
  ct,
  totals,
  byHandle,
  winners,
}: {
  ct: CreatorTags;
  totals: CreativeTotals[];
  byHandle: Map<string, DirectoryCreator>;
  winners: Set<string>;
}) {
  const [groupId, setGroupId] = useState("");
  const group = ct.activeGroups.find((g) => g.id === groupId) ?? ct.activeGroups[0];
  if (!ct.ready || !group) return null;

  const tagIds = new Set(ct.tagsIn(group.id, true).map((t) => t.id));
  const adsByTag = new Map<string, CreativeTotals[]>();
  const creatorsByTag = new Map<string, Set<string>>();
  const add = (key: string, ad: CreativeTotals, creatorKey: string) => {
    adsByTag.set(key, [...(adsByTag.get(key) ?? []), ad]);
    if (!creatorsByTag.has(key)) creatorsByTag.set(key, new Set());
    creatorsByTag.get(key)!.add(creatorKey);
  };

  for (const ad of totals) {
    const handle = normalizeHandle(ad.creator);
    if (!handle) continue; // not a creator ad
    const creator = byHandle.get(handle);
    const mine = creator ? [...(ct.byCreator.get(creator.id) ?? [])].filter((id) => tagIds.has(id)) : [];
    if (mine.length === 0) add("untagged", ad, creator?.id ?? handle);
    // In groups that allow several tags, an ad counts under each of its creator's tags.
    for (const tagId of mine) add(tagId, ad, creator!.id);
  }

  const rows: TagPerformance[] = ct
    .tagsIn(group.id, true)
    .filter((t) => !t.archived || adsByTag.has(t.id))
    .map((t) => summarizeAds(t.id, t.name, creatorsByTag.get(t.id)?.size ?? 0, adsByTag.get(t.id) ?? [], winners))
    .sort((a, b) => b.spend - a.spend);
  if (adsByTag.has("untagged")) {
    rows.push(summarizeAds("untagged", "Untagged", creatorsByTag.get("untagged")!.size, adsByTag.get("untagged")!, winners));
  }
  const best = rows.filter((r) => r.key !== "untagged" && r.ads > 0).sort((a, b) => b.spend - a.spend)[0];

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <h2 className="text-lg font-semibold">Performance by tag</h2>
        <select
          value={group.id}
          onChange={(e) => setGroupId(e.target.value)}
          className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white"
          aria-label="Tag group"
        >
          {ct.activeGroups.map((g) => (
            <option key={g.id} value={g.id}>By {g.name.toLowerCase()}</option>
          ))}
        </select>
      </div>
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3">{group.name}</th>
              <th className="p-3 text-right">Creators</th>
              <th className="p-3 text-right">Ads</th>
              <th className="p-3 text-right">Spend</th>
              <th className="p-3 text-right">CPA</th>
              <th className="p-3 text-right">ROAS</th>
              <th className="p-3 text-right">NC %</th>
              <th className="p-3 text-right">Winners</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-b border-stone-100 last:border-0 ${r.key === "untagged" ? "text-stone-500" : ""}`}>
                <td className="p-3 font-medium whitespace-nowrap">
                  {r.key === "untagged" ? (
                    <span className="italic font-normal">Untagged / not in directory</span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ct.groupColor.get(group.id)}`}>{r.label}</span>
                  )}
                  {best?.key === r.key && <span className="ml-2 text-xs text-emerald-700">Most spend</span>}
                </td>
                <td className="p-3 text-right">{r.creators}</td>
                <td className="p-3 text-right">{r.ads}</td>
                <td className="p-3 text-right font-semibold">{r.ads ? money(r.spend) : "—"}</td>
                <td className="p-3 text-right">{r.cpa != null ? "$" + r.cpa.toFixed(2) : "—"}</td>
                <td className="p-3 text-right">{ratio(r.roas)}</td>
                <td className="p-3 text-right">{pct(r.ncPct)}</td>
                <td className="p-3 text-right">{r.winners ? `🏆 ${r.winners}` : r.ads ? "0" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-500 mt-2">
        Whitelisted and paid ads combined, for the dates above. Creators are matched to their directory profile by Instagram or TikTok handle.
        {!group.single_choice && " A creator can have several of these tags, so their ads count under each one."}
      </p>
    </section>
  );
}

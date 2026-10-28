"use client";

// A creator's ads (all time), split into whitelisted and paid, on their profile.

import { CreatorPerformanceTable } from "@/components/CreatorPerformanceTable";
import { Card } from "@/components/Guard";
import { DATA_IS_SAMPLE } from "@/lib/creative-performance";
import { normalizeHandle, rollupByCreator } from "@/lib/creator-performance";
import { dateInTz } from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { useCreatorPerformance } from "@/lib/use-creator-performance";
import type { Creator } from "@/lib/ugc";

export function CreatorAdsCard({ creator }: { creator: Pick<Creator, "instagram" | "tiktok"> }) {
  const { user } = useSession();
  const today = dateInTz(user?.timezone ?? "America/New_York");
  const { totals, winners, byHandle, classificationsReady, setAdType } = useCreatorPerformance("2000-01-01", today, today);

  const handles = new Set([normalizeHandle(creator.instagram), normalizeHandle(creator.tiktok)].filter(Boolean));
  const mine = totals.filter((t) => handles.has(normalizeHandle(t.creator)));
  const canClassify = (user?.role === "owner" || user?.role === "ugc_manager") && classificationsReady;

  if (handles.size === 0) {
    return (
      <Card className="mb-4">
        <h2 className="font-medium mb-1">Ad performance</h2>
        <p className="text-sm text-stone-500">Add this creator&apos;s Instagram or TikTok handle so their ads can be matched by the handle in the ad name.</p>
      </Card>
    );
  }

  return (
    <div className="mb-4">
      {DATA_IS_SAMPLE && <p className="text-xs text-amber-700 mb-1">Sample ad data until Northbeam is connected</p>}
      {(["whitelisted", "paid"] as const).map((type) => (
        <CreatorPerformanceTable
          key={type}
          title={type === "whitelisted" ? "Whitelisted ads (all time)" : "Paid ads (all time)"}
          rows={rollupByCreator(mine.filter((t) => t.adType === type), winners)}
          byHandle={byHandle}
          winners={winners}
          canClassify={canClassify}
          onSetType={setAdType}
          emptyText={`No ${type} ads with this creator's handle in the name.`}
        />
      ))}
    </div>
  );
}

"use client";

// Loads everything the UGC performance pages need: ad totals for a period,
// lifetime winners, whitelisted/paid overrides and the creator directory.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCreativeDays,
  isWinningCreative,
  totalsByCreative,
  type AdType,
  type CreativeTotals,
} from "./creative-performance";
import { applyAdTypes, creatorsByHandle, needsMigration, type AdClassification } from "./creator-performance";
import type { Creator } from "./ugc";

// Directory rows; Trybe fields exist once 0007 has been run.
export type DirectoryCreator = Creator & { is_trybe?: boolean; trybe_joined_on?: string | null; trybe_notes?: string | null };

export function useCreatorPerformance(from: string, to: string, today: string) {
  const supabase = useMemo(() => createClient(), []);
  const [rawTotals, setRawTotals] = useState<CreativeTotals[]>([]);
  const [lifetime, setLifetime] = useState<CreativeTotals[]>([]);
  const [overrides, setOverrides] = useState<Map<string, AdType>>(new Map());
  const [directory, setDirectory] = useState<DirectoryCreator[]>([]);
  // False until 0007_ugc_performance.sql has been run.
  const [classificationsReady, setClassificationsReady] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreativeDays(from, to).then((d) => setRawTotals(totalsByCreative(d)));
  }, [from, to]);

  // Winners are judged on each creative's whole life, not just the selected range.
  useEffect(() => {
    fetchCreativeDays("2000-01-01", today).then((d) => setLifetime(totalsByCreative(d)));
  }, [today]);

  const loadDb = useCallback(async () => {
    const [c, d] = await Promise.all([
      supabase.from("ad_classifications").select("ad_name, ad_type"),
      supabase.from("ugc_creators").select("*").order("full_name"),
    ]);
    if (needsMigration(c.error)) setClassificationsReady(false);
    else setOverrides(new Map(((c.data as AdClassification[]) ?? []).map((r) => [r.ad_name, r.ad_type])));
    setDirectory((d.data as DirectoryCreator[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadDb();
  }, [loadDb]);

  const totals = useMemo(() => applyAdTypes(rawTotals, overrides), [rawTotals, overrides]);
  const winners = useMemo(() => new Set(lifetime.filter(isWinningCreative).map((t) => t.adName)), [lifetime]);
  const byHandle = useMemo(() => creatorsByHandle(directory), [directory]);

  const setAdType = async (adName: string, adType: AdType) => {
    setError(null);
    const { error } = await supabase.from("ad_classifications").upsert({ ad_name: adName, ad_type: adType });
    if (error) return setError(error.message);
    setOverrides((prev) => new Map(prev).set(adName, adType));
  };

  return { totals, winners, directory, byHandle, classificationsReady, setAdType, error, reload: loadDb };
}

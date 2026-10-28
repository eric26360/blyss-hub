"use client";

// Casting tags for UGC creators (ethnicity, age group, style, …).
// Mirrors supabase/migrations/0008_creator_tags.sql.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import type { CreativeTotals } from "./creative-performance";
import { needsMigration } from "./creator-performance";

export type TagGroup = { id: string; name: string; single_choice: boolean; sort_order: number; archived: boolean };
export type Tag = { id: string; group_id: string; name: string; sort_order: number; archived: boolean };
type Assignment = { creator_id: string; tag_id: string };

// Chip colours by group position, so the same group always looks the same.
const GROUP_COLORS = [
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-emerald-100 text-emerald-800",
  "bg-fuchsia-100 text-fuchsia-800",
  "bg-lime-100 text-lime-800",
  "bg-rose-100 text-rose-800",
];

const bySort = <T extends { sort_order: number; name: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name);

export function useCreatorTags() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  // False until 0008_creator_tags.sql has been run.
  const [ready, setReady] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [g, t, a] = await Promise.all([
      supabase.from("creator_tag_groups").select("*"),
      supabase.from("creator_tags").select("*"),
      supabase.from("creator_tag_assignments").select("creator_id, tag_id"),
    ]);
    if (needsMigration(g.error)) {
      setReady(false);
    } else {
      setGroups(((g.data as TagGroup[]) ?? []).sort(bySort));
      setTags(((t.data as Tag[]) ?? []).sort(bySort));
      setAssignments((a.data as Assignment[]) ?? []);
    }
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const groupColor = useMemo(() => new Map(groups.map((g, i) => [g.id, GROUP_COLORS[i % GROUP_COLORS.length]])), [groups]);

  // creator id → tag ids
  const byCreator = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!m.has(a.creator_id)) m.set(a.creator_id, new Set());
      m.get(a.creator_id)!.add(a.tag_id);
    }
    return m;
  }, [assignments]);

  /** A creator's tags, in group order then tag order. */
  const tagsOf = useCallback(
    (creatorId: string | undefined): Tag[] => {
      if (!creatorId) return [];
      const ids = byCreator.get(creatorId);
      if (!ids) return [];
      const groupOrder = new Map(groups.map((g, i) => [g.id, i]));
      const archivedGroups = new Set(groups.filter((g) => g.archived).map((g) => g.id));
      return [...ids]
        .map((id) => tagById.get(id))
        .filter((t): t is Tag => !!t && !archivedGroups.has(t.group_id))
        .sort((a, b) => (groupOrder.get(a.group_id) ?? 0) - (groupOrder.get(b.group_id) ?? 0) || bySort(a, b));
    },
    [byCreator, tagById, groups],
  );

  const activeGroups = groups.filter((g) => !g.archived);
  const tagsIn = (groupId: string, includeArchived = false) =>
    tags.filter((t) => t.group_id === groupId && (includeArchived || !t.archived));

  // Owners and UGC managers add, rename and archive tags (the database enforces this too).
  const canManage = user?.role === "owner" || user?.role === "ugc_manager";

  return { ready, loaded, canManage, groups, activeGroups, tags, tagsIn, tagById, groupColor, byCreator, tagsOf, reload: load, supabase };
}

export type CreatorTags = ReturnType<typeof useCreatorTags>;

/** Tag filter: group id → chosen tag id. A creator must have every chosen tag. */
export type TagFilter = Record<string, string>;

export function matchesTagFilter(creatorTagIds: Set<string> | undefined, filter: TagFilter) {
  const wanted = Object.values(filter).filter(Boolean);
  if (wanted.length === 0) return true;
  if (!creatorTagIds) return false;
  return wanted.every((id) => creatorTagIds.has(id));
}

export const hasTagFilter = (filter: TagFilter) => Object.values(filter).some(Boolean);

/** Make a creator's tags equal `wanted`: removes the ones no longer wanted, adds new ones. */
export async function saveCreatorTags(supabase: SupabaseClient, creatorId: string, current: Set<string>, wanted: Set<string>) {
  const remove = [...current].filter((id) => !wanted.has(id));
  const add = [...wanted].filter((id) => !current.has(id));
  if (remove.length) {
    const { error } = await supabase.from("creator_tag_assignments").delete().eq("creator_id", creatorId).in("tag_id", remove);
    if (error) return error.message;
  }
  // One at a time: in single-choice groups each insert replaces the previous tag.
  for (const tagId of add) {
    const { error } = await supabase.from("creator_tag_assignments").insert({ creator_id: creatorId, tag_id: tagId });
    if (error) return error.message;
  }
  return null;
}

// ───────────── Performance by tag ─────────────

export type TagPerformance = {
  key: string;
  label: string;
  creators: number;
  ads: number;
  spend: number;
  cpa: number | null;
  roas: number | null;
  ncPct: number | null;
  winners: number;
};

/** Totals for a set of ads, recomputed from sums (not averaged averages). */
export function summarizeAds(key: string, label: string, creators: number, ads: CreativeTotals[], winners: Set<string>): TagPerformance {
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const revenue = ads.reduce((s, a) => s + a.revenue, 0);
  const orders = ads.reduce((s, a) => s + a.orders, 0);
  const nc = ads.reduce((s, a) => s + a.newCustomerOrders, 0);
  return {
    key,
    label,
    creators,
    ads: ads.length,
    spend,
    cpa: orders ? spend / orders : null,
    roas: spend ? revenue / spend : null,
    ncPct: orders ? (nc / orders) * 100 : null,
    winners: ads.filter((a) => winners.has(a.adName)).length,
  };
}

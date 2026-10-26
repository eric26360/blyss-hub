"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, StatusBadge } from "@/components/CreatorBits";
import { CreatorForm, Dialog } from "@/components/CreatorForm";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { Stars } from "@/components/Stars";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import {
  CREATOR_STATUSES,
  CREATOR_STATUS_LABEL,
  money2,
  socialUrl,
  type Creator,
  type CreatorStats,
} from "@/lib/ugc";
import { useTeam } from "@/lib/use-team";

export default function CreatorsPage() {
  const { user } = useSession();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { team, nameOf } = useTeam();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [stats, setStats] = useState<Record<string, CreatorStats>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [strategist, setStrategist] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const load = useCallback(async () => {
    const [c, s, f] = await Promise.all([
      supabase.from("ugc_creators").select("*").order("full_name"),
      supabase.from("creator_stats").select("*"),
      supabase.from("creator_favorites").select("creator_id"),
    ]);
    setCreators((c.data as Creator[]) ?? []);
    setStats(Object.fromEntries(((s.data as CreatorStats[]) ?? []).map((x) => [x.creator_id, x])));
    setFavorites(new Set((f.data ?? []).map((x) => x.creator_id)));
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavorite = async (id: string) => {
    if (!user) return;
    const next = new Set(favorites);
    if (favorites.has(id)) {
      next.delete(id);
      await supabase.from("creator_favorites").delete().eq("creator_id", id).eq("profile_id", user.id);
    } else {
      next.add(id);
      await supabase.from("creator_favorites").insert({ creator_id: id });
    }
    setFavorites(next);
  };

  const q = search.trim().toLowerCase();
  const list = creators.filter(
    (c) =>
      (!q || [c.full_name, c.email, c.instagram, c.tiktok, c.country, c.location].some((v) => v?.toLowerCase().includes(q))) &&
      (!status || c.status === status) &&
      (!strategist || (strategist === "none" ? !c.assigned_strategist_id : c.assigned_strategist_id === strategist)) &&
      (!onlyFavorites || favorites.has(c.id)),
  );

  const strategists = team.filter((t) => t.role === "strategist");
  const select = "rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";

  return (
    <Guard page="creators">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <PageHeader title="UGC Creators" subtitle="Every creator Blyss has worked with or is talking to." />
        <button onClick={() => setAdding(true)} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium shrink-0 mb-6">
          + Add creator
        </button>
      </div>

      <Card className="mb-4 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search name, email, handle, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${select} flex-1 min-w-[200px]`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={select} aria-label="Status">
          <option value="">All statuses</option>
          {CREATOR_STATUSES.map((s) => (
            <option key={s} value={s}>{CREATOR_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={strategist} onChange={(e) => setStrategist(e.target.value)} className={select} aria-label="Strategist">
          <option value="">All strategists</option>
          {strategists.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
          ))}
          <option value="none">Unassigned</option>
        </select>
        <label className="flex items-center gap-2 text-sm px-2">
          <input type="checkbox" checked={onlyFavorites} onChange={(e) => setOnlyFavorites(e.target.checked)} />
          My favorites
        </label>
      </Card>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3 w-8" />
              <th className="p-3">Creator</th>
              <th className="p-3">Status</th>
              <th className="p-3">Socials</th>
              <th className="p-3 text-right">Rate / video</th>
              <th className="p-3">Strategist</th>
              <th className="p-3">UGC manager</th>
              <th className="p-3 text-right">Videos</th>
              <th className="p-3 text-right">Total paid</th>
              <th className="p-3">Rating</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const s = stats[c.id];
              return (
                <tr key={c.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="p-3">
                    <button
                      onClick={() => toggleFavorite(c.id)}
                      aria-label={favorites.has(c.id) ? "Remove from favorites" : "Add to favorites"}
                      className={favorites.has(c.id) ? "text-amber-400" : "text-stone-300 hover:text-amber-300"}
                    >
                      ★
                    </button>
                  </td>
                  <td className="p-3">
                    <Link href={`/creators/${c.id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                      <Avatar creator={c} />
                      <span className="whitespace-nowrap">{c.full_name}</span>
                    </Link>
                    {(c.country || c.location) && (
                      <p className="text-xs text-stone-500 ml-10">{[c.location, c.country].filter(Boolean).join(", ")}</p>
                    )}
                  </td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 whitespace-nowrap space-x-2">
                    {c.instagram && <a href={socialUrl("instagram", c.instagram)} target="_blank" rel="noreferrer" className="text-brand hover:underline">IG</a>}
                    {c.tiktok && <a href={socialUrl("tiktok", c.tiktok)} target="_blank" rel="noreferrer" className="text-brand hover:underline">TikTok</a>}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">{money2(c.negotiated_rate ?? c.standard_rate)}</td>
                  <td className="p-3 whitespace-nowrap">{nameOf(c.assigned_strategist_id)}</td>
                  <td className="p-3 whitespace-nowrap">{nameOf(c.assigned_ugc_manager_id)}</td>
                  <td className="p-3 text-right whitespace-nowrap">{s ? `${s.videos_delivered} / ${s.videos_ordered}` : "—"}</td>
                  <td className="p-3 text-right">{money2(s?.total_paid ?? 0)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {s?.avg_rating ? <><Stars value={s.avg_rating} /> <span className="text-xs text-stone-500">{s.avg_rating}</span></> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loaded && list.length === 0 && (
          <p className="p-8 text-center text-sm text-stone-500">
            {creators.length === 0 ? "No creators yet. Add your first one." : "No creators match these filters."}
          </p>
        )}
      </Card>
      <p className="text-xs text-stone-500 mt-2">Videos = delivered / ordered, across all bookings.</p>

      {adding && (
        <Dialog title="Add creator" onClose={() => setAdding(false)}>
          <CreatorForm team={team} onCancel={() => setAdding(false)} onSaved={(id) => router.push(`/creators/${id}`)} />
        </Dialog>
      )}
    </Guard>
  );
}

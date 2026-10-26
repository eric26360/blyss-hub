"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/CreatorBits";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { Stars } from "@/components/Stars";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { money2, socialUrl, type Creator, type CreatorStats } from "@/lib/ugc";

type SortKey = "rating" | "collaborations" | "paid" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rating", label: "Highest rated" },
  { key: "collaborations", label: "Most collaborations" },
  { key: "paid", label: "Most paid" },
  { key: "name", label: "Name" },
];

export default function TopCreatorsPage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [stats, setStats] = useState<Record<string, CreatorStats>>({});
  const [loaded, setLoaded] = useState(false);
  const [sort, setSort] = useState<SortKey>("rating");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState("");

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.from("ugc_creators").select("*").order("full_name"),
      supabase.from("creator_stats").select("*"),
    ]);
    setCreators((c.data as Creator[]) ?? []);
    setStats(Object.fromEntries(((s.data as CreatorStats[]) ?? []).map((x) => [x.creator_id, x])));
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const curator = user?.role === "owner" || user?.role === "ugc_manager";
  const q = search.trim().toLowerCase();
  const top = creators
    .filter((c) => c.is_top && (!q || c.full_name.toLowerCase().includes(q)))
    .sort((a, b) => {
      const sa = stats[a.id];
      const sb = stats[b.id];
      if (sort === "rating") return (sb?.avg_rating ?? 0) - (sa?.avg_rating ?? 0);
      if (sort === "collaborations") return (sb?.collaborations ?? 0) - (sa?.collaborations ?? 0);
      if (sort === "paid") return (sb?.total_paid ?? 0) - (sa?.total_paid ?? 0);
      return a.full_name.localeCompare(b.full_name);
    });
  const others = creators.filter((c) => !c.is_top && c.status !== "do_not_work_with");

  const addToTop = async () => {
    if (!adding) return;
    await supabase.from("ugc_creators").update({ is_top: true }).eq("id", adding);
    setAdding("");
    load();
  };

  const removeFromTop = async (id: string) => {
    await supabase.from("ugc_creators").update({ is_top: false }).eq("id", id);
    load();
  };

  const control = "rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";

  return (
    <Guard page="top_creators">
      <PageHeader title="Top UGC Creators" subtitle="Our best creators, hand-picked by the team." />

      <Card className="mb-4 flex flex-wrap gap-2 items-center">
        <input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${control} flex-1 min-w-[160px]`} />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={control} aria-label="Sort">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
          <option disabled>Most winning ads (needs Northbeam)</option>
          <option disabled>Most ad spend (needs Northbeam)</option>
        </select>
        {curator && (
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} className={`${control} flex-1`} aria-label="Creator to add">
              <option value="">Add a creator to the list…</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
            <button onClick={addToTop} disabled={!adding} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
              Add
            </button>
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {top.map((c) => {
          const s = stats[c.id];
          return (
            <Card key={c.id} className="flex flex-col">
              <Link href={`/creators/${c.id}`} className="flex items-center gap-3 group">
                <Avatar creator={c} size={16} />
                <div>
                  <p className="font-semibold group-hover:text-brand">{c.full_name}</p>
                  <p className="text-xs text-stone-500">{[c.location, c.country].filter(Boolean).join(", ")}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Stars value={s?.avg_rating} />
                    <span className="text-xs text-stone-500">{s?.avg_rating ? s.avg_rating : "Not rated"}</span>
                  </div>
                </div>
              </Link>
              <div className="flex gap-3 text-sm mt-3">
                {c.instagram && <a href={socialUrl("instagram", c.instagram)} target="_blank" rel="noreferrer" className="text-brand hover:underline">Instagram</a>}
                {c.tiktok && <a href={socialUrl("tiktok", c.tiktok)} target="_blank" rel="noreferrer" className="text-brand hover:underline">TikTok</a>}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm mt-4">
                <Fact label="Avg video rate" value={money2(c.negotiated_rate ?? c.standard_rate)} />
                <Fact label="Collaborations" value={String(s?.collaborations ?? 0)} />
                <Fact label="Winning ads" value="—" muted />
                <Fact label="Ad spend" value="—" muted />
              </dl>
              {c.top_reason && <p className="text-sm text-stone-600 mt-3 italic">&ldquo;{c.top_reason}&rdquo;</p>}
              {curator && (
                <button onClick={() => removeFromTop(c.id)} className="mt-auto pt-4 text-xs text-stone-400 hover:text-rose-600 self-start">
                  Remove from Top list
                </button>
              )}
            </Card>
          );
        })}
      </div>
      {loaded && top.length === 0 && (
        <Card className="text-center text-sm text-stone-500">
          {curator ? "No top creators yet. Add one above, or from a creator's profile." : "No top creators picked yet."}
        </Card>
      )}
      <p className="text-xs text-stone-500 mt-4">Winning ads and ad spend per creator will fill in once Northbeam is connected.</p>
    </Guard>
  );
}

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`font-medium ${muted ? "text-stone-300" : ""}`}>{value}</dd>
    </div>
  );
}

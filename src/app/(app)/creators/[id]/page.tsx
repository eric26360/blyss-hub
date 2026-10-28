"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, StatusBadge } from "@/components/CreatorBits";
import { CreatorAdsCard } from "@/components/CreatorAdsCard";
import { CreatorForm, Dialog } from "@/components/CreatorForm";
import { CreatorTagsCard, TagChips } from "@/components/CreatorTags";
import { Card, Guard } from "@/components/Guard";
import { Stars } from "@/components/Stars";
import { useCreatorTags } from "@/lib/creator-tags";
import { Badge } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import {
  APPROVAL_LABEL,
  EXPENSE_LABEL,
  RATING_CRITERIA,
  money2,
  socialUrl,
  type CreatorStats,
  type Expense,
  type Rating,
  type RatingKey,
} from "@/lib/ugc";
import type { DirectoryCreator } from "@/lib/use-creator-performance";
import { useTeam } from "@/lib/use-team";

type RateRow = {
  id: string;
  standard_rate: number | null;
  negotiated_rate: number | null;
  package_rate: number | null;
  whitelisting_rate: number | null;
  changed_by: string | null;
  changed_at: string;
};
type Note = { id: string; author_id: string; body: string; created_at: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function CreatorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { team, nameOf } = useTeam();
  const ct = useCreatorTags();

  const [creator, setCreator] = useState<DirectoryCreator | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [c, s, r, e, rt, n, f] = await Promise.all([
      supabase.from("ugc_creators").select("*").eq("id", id).maybeSingle(),
      supabase.from("creator_stats").select("*").eq("creator_id", id).maybeSingle(),
      supabase.from("creator_rate_history").select("*").eq("creator_id", id).order("changed_at", { ascending: false }),
      supabase.from("ugc_expenses").select("*").eq("creator_id", id).order("expense_date", { ascending: false }),
      supabase.from("creator_ratings").select("*").eq("creator_id", id),
      supabase.from("creator_notes").select("*").eq("creator_id", id).order("created_at", { ascending: false }),
      supabase.from("creator_favorites").select("creator_id").eq("creator_id", id),
    ]);
    setCreator(c.data as DirectoryCreator | null);
    setStats(s.data as CreatorStats | null);
    setRates((r.data as RateRow[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setRatings((rt.data as Rating[]) ?? []);
    setNotes((n.data as Note[]) ?? []);
    setFavorite((f.data ?? []).length > 0);
    setLoaded(true);
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const curator = user.role === "owner" || user.role === "ugc_manager";
  const canEdit = !!creator && (curator || (user.role === "strategist" && creator.assigned_strategist_id === user.id));

  const toggleFavorite = async () => {
    if (favorite) await supabase.from("creator_favorites").delete().eq("creator_id", id).eq("profile_id", user.id);
    else await supabase.from("creator_favorites").insert({ creator_id: id });
    setFavorite(!favorite);
  };

  const toggleTop = async () => {
    if (!creator) return;
    let reason = creator.top_reason;
    if (!creator.is_top) {
      reason = window.prompt("Why is this creator one of our best? (optional)", creator.top_reason ?? "") ?? null;
    }
    await supabase.from("ugc_creators").update({ is_top: !creator.is_top, top_reason: reason }).eq("id", id);
    load();
  };

  // Trybe fields exist once 0007 has been run.
  const trybeReady = !!creator && "is_trybe" in creator;
  const toggleTrybe = async () => {
    if (!creator) return;
    const { error } = await supabase.from("ugc_creators").update({ is_trybe: !creator.is_trybe }).eq("id", id);
    if (error) window.alert(error.message);
    load();
  };

  return (
    <Guard page="creators">
      <Link href="/creators" className="text-sm text-brand hover:underline">← Creator Directory</Link>
      {loaded && !creator && <Card className="mt-4 text-center text-stone-500">Creator not found.</Card>}
      {creator && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4 mb-6">
            <Avatar creator={creator} size={16} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{creator.full_name}</h1>
                <StatusBadge status={creator.status} />
                {creator.is_top && <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">★ Top creator</span>}
                {creator.is_trybe && (
                  <span className="text-xs rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 font-medium">
                    Trybe{creator.trybe_joined_on ? ` since ${fmtDate(creator.trybe_joined_on + "T12:00:00")}` : ""}
                  </span>
                )}
              </div>
              <TagChips tags={ct.tagsOf(creator.id)} ct={ct} className="mt-1.5" />
              <p className="text-sm text-stone-500 mt-1">
                {[creator.location, creator.country].filter(Boolean).join(", ") || "Location not set"} · Strategist: {nameOf(creator.assigned_strategist_id)} · UGC manager: {nameOf(creator.assigned_ugc_manager_id)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={toggleFavorite} className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
                <span className={favorite ? "text-amber-400" : "text-stone-300"}>★</span> {favorite ? "Favorited" : "Favorite"}
              </button>
              {curator && (
                <button onClick={toggleTop} className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
                  {creator.is_top ? "Remove from Top list" : "Add to Top list"}
                </button>
              )}
              {trybeReady && canEdit && (
                <button onClick={toggleTrybe} className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
                  {creator.is_trybe ? "Remove from Trybe" : "Add to Trybe"}
                </button>
              )}
              {canEdit && (
                <button onClick={() => setEditing(true)} className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium">
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Stat label="Lifetime paid" value={money2(stats?.total_paid ?? 0)} />
            <Stat label="Committed (unpaid)" value={money2(stats?.total_committed ?? 0)} />
            <Stat label="Videos delivered / ordered" value={`${stats?.videos_delivered ?? 0} / ${stats?.videos_ordered ?? 0}`} />
            <Stat label="Collaborations" value={String(stats?.collaborations ?? 0)} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <Card>
              <h2 className="font-medium mb-3">Contact</h2>
              <Info label="Email" value={creator.email && <a href={`mailto:${creator.email}`} className="text-brand hover:underline">{creator.email}</a>} />
              <Info label="Phone" value={creator.phone} />
              <Info label="Location" value={[creator.location, creator.country].filter(Boolean).join(", ")} />
              <h2 className="font-medium mt-4 mb-3">Socials</h2>
              <Info label="Instagram" value={creator.instagram && <a href={socialUrl("instagram", creator.instagram)} target="_blank" rel="noreferrer" className="text-brand hover:underline break-all">{creator.instagram}</a>} />
              <Info label="TikTok" value={creator.tiktok && <a href={socialUrl("tiktok", creator.tiktok)} target="_blank" rel="noreferrer" className="text-brand hover:underline break-all">{creator.tiktok}</a>} />
              {creator.other_socials?.split("\n").filter((l) => l.trim()).map((l) => (
                <Info key={l} label="Other" value={/^https?:\/\//.test(l.trim()) ? <a href={l.trim()} target="_blank" rel="noreferrer" className="text-brand hover:underline break-all">{l.trim()}</a> : l} />
              ))}
            </Card>
            <Card>
              <h2 className="font-medium mb-3">Pricing</h2>
              <Info label="Standard rate / video" value={money2(creator.standard_rate)} />
              <Info label="Negotiated rate / video" value={money2(creator.negotiated_rate)} />
              <Info label="Package rate" value={creator.package_rate != null ? `${money2(creator.package_rate)}${creator.package_details ? ` — ${creator.package_details}` : ""}` : null} />
              <Info label="Whitelisting rate" value={money2(creator.whitelisting_rate)} />
              <Info label="Usage rights" value={creator.usage_rights} />
              {creator.internal_notes && (
                <>
                  <h2 className="font-medium mt-4 mb-2">Internal notes</h2>
                  <p className="text-sm text-stone-600 whitespace-pre-wrap">{creator.internal_notes}</p>
                </>
              )}
              {creator.is_top && creator.top_reason && (
                <>
                  <h2 className="font-medium mt-4 mb-2">Why they&apos;re a top creator</h2>
                  <p className="text-sm text-stone-600 whitespace-pre-wrap">{creator.top_reason}</p>
                </>
              )}
            </Card>
            <RatingsCard creatorId={id} ratings={ratings} myId={user.id} nameOf={nameOf} onSaved={load} />
          </div>

          <CreatorTagsCard ct={ct} creatorId={creator.id} canEdit={canEdit} />

          <Card className="mb-4 !p-0 overflow-x-auto">
            <div className="p-5 pb-2">
              <h2 className="font-medium">Collaborations</h2>
              {user.role === "strategist" && <p className="text-xs text-stone-500">Showing bookings on your budget. Totals above include everyone&apos;s.</p>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">Strategist</th>
                  <th className="p-3 text-right">Videos</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-stone-100 last:border-0">
                    <td className="p-3 whitespace-nowrap">{fmtDate(e.expense_date + "T12:00:00")}</td>
                    <td className="p-3">{e.project}</td>
                    <td className="p-3">{nameOf(e.strategist_id)}</td>
                    <td className="p-3 text-right">{e.videos_delivered} / {e.video_count}</td>
                    <td className="p-3 text-right">{money2(e.amount)}</td>
                    <td className="p-3 whitespace-nowrap space-x-1">
                      <Badge label={EXPENSE_LABEL[e.status]} />
                      {APPROVAL_LABEL[e.approval] && <Badge label={APPROVAL_LABEL[e.approval]!} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && <p className="p-5 pt-2 text-sm text-stone-500">No bookings yet. Record one from UGC Budgets.</p>}
          </Card>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <NotesCard creatorId={id} notes={notes} myId={user.id} isOwner={user.role === "owner"} nameOf={nameOf} onSaved={load} />
            <Card>
              <h2 className="font-medium mb-3">Rate history</h2>
              {rates.length === 0 ? (
                <p className="text-sm text-stone-500">No rates recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {rates.map((r) => (
                    <li key={r.id} className="flex justify-between gap-3 border-b border-stone-100 last:border-0 pb-2">
                      <span className="text-stone-500 whitespace-nowrap">{fmtDate(r.changed_at)}</span>
                      <span className="text-right">
                        Std {money2(r.standard_rate)} · Neg {money2(r.negotiated_rate)} · Pkg {money2(r.package_rate)} · WL {money2(r.whitelisting_rate)}
                        <span className="block text-xs text-stone-400">by {nameOf(r.changed_by)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <h2 className="text-lg font-semibold mb-2">Ad performance</h2>
          <CreatorAdsCard creator={creator} />

          {editing && (
            <Dialog title={`Edit ${creator.full_name}`} onClose={() => setEditing(false)}>
              <CreatorForm
                creator={creator}
                team={team}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  load();
                  ct.reload();
                }}
              />
            </Dialog>
          )}
        </>
      )}
    </Guard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1">
      <span className="text-stone-500 shrink-0">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function RatingsCard({
  creatorId,
  ratings,
  myId,
  nameOf,
  onSaved,
}: {
  creatorId: string;
  ratings: Rating[];
  myId: string;
  nameOf: (id: string) => string;
  onSaved: () => void;
}) {
  const mine = ratings.find((r) => r.rater_id === myId);
  const [draft, setDraft] = useState<Partial<Record<RatingKey, number | null>>>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avg = (key: RatingKey) => {
    const vals = ratings.map((r) => r[key]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const start = () => {
    setDraft(Object.fromEntries(RATING_CRITERIA.map((c) => [c.id, mine?.[c.id] ?? null])));
    setEditing(true);
  };

  const save = async () => {
    const { error } = await createClient()
      .from("creator_ratings")
      .upsert({ creator_id: creatorId, rater_id: myId, ...draft, updated_at: new Date().toISOString() });
    if (error) return setError(error.message);
    setEditing(false);
    onSaved();
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-medium">Ratings</h2>
        <span className="text-xs text-stone-500">{ratings.length} rating{ratings.length === 1 ? "" : "s"}</span>
      </div>
      {editing ? (
        <div className="space-y-1">
          {RATING_CRITERIA.map((c) => (
            <div key={c.id} className="flex justify-between items-center text-sm">
              <span className="text-stone-600">{c.label}</span>
              <Stars label={c.label} value={draft[c.id]} onChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))} />
            </div>
          ))}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="rounded-xl bg-stone-900 text-white px-3 py-1.5 text-sm">Save rating</button>
            <button onClick={() => setEditing(false)} className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {RATING_CRITERIA.map((c) => {
              const a = avg(c.id);
              return (
                <div key={c.id} className="flex justify-between items-center text-sm">
                  <span className="text-stone-600">{c.label}</span>
                  <span className="flex items-center gap-2">
                    <Stars value={a} />
                    <span className="text-xs text-stone-500 w-6 text-right">{a ? a.toFixed(1) : "—"}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={start} className="mt-3 text-sm text-brand hover:underline">
            {mine ? "Edit my rating" : "Rate this creator"}
          </button>
          {ratings.length > 0 && (
            <p className="text-xs text-stone-400 mt-2">Rated by {ratings.map((r) => nameOf(r.rater_id)).join(", ")}</p>
          )}
        </>
      )}
    </Card>
  );
}

function NotesCard({
  creatorId,
  notes,
  myId,
  isOwner,
  nameOf,
  onSaved,
}: {
  creatorId: string;
  notes: Note[];
  myId: string;
  isOwner: boolean;
  nameOf: (id: string) => string;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    const { error } = await supabase.from("creator_notes").insert({ creator_id: creatorId, body: body.trim() });
    if (error) return setError(error.message);
    setBody("");
    onSaved();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this note?")) return;
    const { error } = await supabase.from("creator_notes").delete().eq("id", id);
    if (error) setError(error.message);
    onSaved();
  };

  return (
    <Card>
      <h2 className="font-medium mb-3">Team notes</h2>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Feedback, how the shoot went, tips…"
          className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-stone-900 text-white px-3 py-2 text-sm">Add</button>
      </form>
      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
      {notes.length === 0 && <p className="text-sm text-stone-500">No notes yet.</p>}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {nameOf(n.author_id)} · {fmtDate(n.created_at)}
              {(n.author_id === myId || isOwner) && (
                <button onClick={() => remove(n.id)} className="ml-2 text-rose-500 hover:underline">Delete</button>
              )}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

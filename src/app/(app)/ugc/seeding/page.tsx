"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/CreatorForm";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { addDays, dateInTz, formatDay } from "@/lib/checkins";
import {
  SEEDING_STATUSES,
  SEEDING_STATUS_LABEL,
  compact,
  needsMigration,
  pct,
  rollupSeeding,
  seedingStatusColor,
  sendCost,
  type SeedingRollup,
  type SeedingSend,
  type SeedingStatus,
} from "@/lib/creator-performance";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import type { Creator } from "@/lib/ugc";

const PRODUCTS = ["Mop Soap", "Mist Spray", "Mop Head Replacement"];
const SCENTS = ["Royalty", "Heartbreaker", "Brazilian Waves", "Baja", "Sunwashed Linen", "Imported Mahogany"];
const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Other"];

type RollupKey = "sends" | "posts" | "views" | "codeRevenue" | "cost";

export default function SeedingPage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const today = dateInTz(user?.timezone ?? "America/New_York");

  const [sends, setSends] = useState<SeedingSend[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SeedingSend | "new" | null>(null);

  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState(addDays(today, -89));
  const [to, setTo] = useState(today);
  const [rollupSort, setRollupSort] = useState<{ key: RollupKey; desc: boolean }>({ key: "views", desc: true });

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from("seeding_sends").select("*").order("shipped_on", { ascending: false }),
      supabase.from("ugc_creators").select("*").order("full_name"),
    ]);
    if (needsMigration(s.error)) return setNotReady(true);
    if (s.error) setError(s.error.message);
    setSends((s.data as SeedingSend[]) ?? []);
    setCreators((c.data as Creator[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const creatorName = (s: SeedingSend) => creators.find((c) => c.id === s.creator_id)?.full_name ?? (s.creator_handle ? "@" + s.creator_handle : "—");

  const visible = sends.filter(
    (s) => (!status || s.status === status) && (!product || s.product === product) && s.shipped_on >= from && s.shipped_on <= to,
  );

  const totalCost = visible.reduce((t, s) => t + sendCost(s), 0);
  const views = visible.reduce((t, s) => t + (s.views ?? 0), 0);
  const posts = visible.filter((s) => s.status === "posted").length;
  // Post rate only counts sends that have had time to arrive (not still "shipped").
  const settled = visible.filter((s) => s.status !== "shipped").length;
  const codeRevenue = visible.reduce((t, s) => t + Number(s.code_revenue ?? 0), 0);

  const rollup = rollupSeeding(visible).sort((a, b) => {
    const d = (a[rollupSort.key] as number) - (b[rollupSort.key] as number);
    return rollupSort.desc ? -d : d;
  });

  const canEdit = (s: SeedingSend) => user?.role === "owner" || user?.role === "ugc_manager" || s.created_by === user?.id;
  const products = [...new Set([...PRODUCTS, ...sends.map((s) => s.product)])];
  const control = "rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white";

  return (
    <Guard page="ugc_seeding">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <PageHeader title="Product Seeding" subtitle="Free product sent to creators, and what came back: posts, views and code sales." />
        {!notReady && (
          <button onClick={() => setEditing("new")} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium shrink-0 mb-6">
            + Log a send
          </button>
        )}
      </div>

      {notReady ? (
        <Card className="text-sm text-stone-600">
          Product seeding isn&apos;t switched on yet. An owner needs to run the <code>0007_ugc_performance.sql</code> database update in Supabase.
        </Card>
      ) : (
        <>
          <Card className="mb-4 flex flex-wrap gap-2 items-center text-sm">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={control} aria-label="Status">
              <option value="">All statuses</option>
              {SEEDING_STATUSES.map((s) => <option key={s} value={s}>{SEEDING_STATUS_LABEL[s]}</option>)}
            </select>
            <select value={product} onChange={(e) => setProduct(e.target.value)} className={control} aria-label="Product">
              <option value="">All products</option>
              {products.map((p) => <option key={p}>{p}</option>)}
            </select>
            <span className="text-stone-500 ml-1">Shipped</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={control} aria-label="Shipped from" />
            <span className="text-stone-400">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={control} aria-label="Shipped to" />
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: "Sends", value: String(visible.length) },
              { label: "Post rate", value: settled ? pct((posts / settled) * 100) : "—", hint: `${posts} posted` },
              { label: "Total cost", value: money(totalCost) },
              { label: "Views", value: compact(views) },
              { label: "Cost per 1k views", value: views ? "$" + ((totalCost / views) * 1000).toFixed(2) : "—" },
              { label: "Code revenue", value: money(codeRevenue) },
            ].map((s) => (
              <Card key={s.label}>
                <p className="text-xs text-stone-500">{s.label}</p>
                <p className="text-xl font-semibold mt-1">{s.value}</p>
                {s.hint && <p className="text-xs text-stone-400">{s.hint}</p>}
              </Card>
            ))}
          </div>

          {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

          <h2 className="text-lg font-semibold mb-2">Sends</h2>
          <Card className="!p-0 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="p-3">Shipped</th>
                  <th className="p-3">Creator</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Post</th>
                  <th className="p-3 text-right">Views</th>
                  <th className="p-3 text-right">Engagement</th>
                  <th className="p-3">Code</th>
                  <th className="p-3 text-right">Code revenue</th>
                  <th className="p-3 text-right">Cost</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100 last:border-0">
                    <td className="p-3 whitespace-nowrap">{formatDay(s.shipped_on)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {s.creator_id ? (
                        <Link href={`/creators/${s.creator_id}`} className="font-medium hover:text-brand">{creatorName(s)}</Link>
                      ) : (
                        <span className="font-medium">{creatorName(s)}</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.product}
                      <span className="block text-xs text-stone-500">{[s.scent, s.quantity > 1 ? `×${s.quantity}` : null].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${seedingStatusColor[s.status]}`}>
                        {SEEDING_STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.post_url ? (
                        <a href={s.post_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{s.platform ?? "View"}</a>
                      ) : (
                        <span className="text-stone-400">{s.platform ?? "—"}</span>
                      )}
                      {s.posted_on && <span className="block text-xs text-stone-500">{formatDay(s.posted_on)}</span>}
                    </td>
                    <td className="p-3 text-right">{s.views != null ? compact(s.views) : "—"}</td>
                    <td className="p-3 text-right whitespace-nowrap text-xs text-stone-600">
                      {s.likes != null || s.comments != null || s.shares != null
                        ? `♥ ${compact(s.likes ?? 0)} · 💬 ${compact(s.comments ?? 0)} · ↗ ${compact(s.shares ?? 0)}`
                        : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.discount_code ?? "—"}
                      {s.code_orders != null && <span className="block text-xs text-stone-500">{s.code_orders} orders</span>}
                    </td>
                    <td className="p-3 text-right">{s.code_revenue != null ? money(Number(s.code_revenue)) : "—"}</td>
                    <td className="p-3 text-right">{money(sendCost(s))}</td>
                    <td className="p-3 text-right">
                      {canEdit(s) && (
                        <button onClick={() => setEditing(s)} className="text-xs text-brand hover:underline">Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-stone-500">
                      {sends.length === 0 ? "No sends logged yet. Log your first one." : "No sends match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <h2 className="text-lg font-semibold mb-2">By creator</h2>
          <RollupTable rows={rollup} sort={rollupSort} setSort={setRollupSort} nameOf={(r) => creators.find((c) => c.id === r.creatorId)?.full_name ?? "@" + r.handle} />
        </>
      )}

      {editing && (
        <Dialog title={editing === "new" ? "Log a send" : "Edit send"} onClose={() => setEditing(null)}>
          <SendForm
            send={editing === "new" ? undefined : editing}
            creators={creators}
            today={today}
            canDelete={editing !== "new" && canEdit(editing)}
            onDone={() => {
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        </Dialog>
      )}
    </Guard>
  );
}

function RollupTable({
  rows,
  sort,
  setSort,
  nameOf,
}: {
  rows: SeedingRollup[];
  sort: { key: RollupKey; desc: boolean };
  setSort: (s: { key: RollupKey; desc: boolean }) => void;
  nameOf: (r: SeedingRollup) => string;
}) {
  const cols: { key: RollupKey; label: string }[] = [
    { key: "sends", label: "Sends" },
    { key: "posts", label: "Posts" },
    { key: "views", label: "Views" },
    { key: "codeRevenue", label: "Code revenue" },
    { key: "cost", label: "Cost" },
  ];
  return (
    <Card className="!p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-stone-500 border-b border-stone-200">
          <tr>
            <th className="p-3">Creator</th>
            {cols.map((c) => (
              <th key={c.key} className="p-3 text-right">
                <button
                  onClick={() => setSort(sort.key === c.key ? { key: c.key, desc: !sort.desc } : { key: c.key, desc: true })}
                  className="hover:text-stone-900 whitespace-nowrap"
                >
                  {c.label}
                  {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-stone-100 last:border-0">
              <td className="p-3 font-medium whitespace-nowrap">
                {r.creatorId ? <Link href={`/creators/${r.creatorId}`} className="hover:text-brand">{nameOf(r)}</Link> : nameOf(r)}
              </td>
              <td className="p-3 text-right">{r.sends}</td>
              <td className="p-3 text-right">{r.posts}</td>
              <td className="p-3 text-right">{compact(r.views)}</td>
              <td className="p-3 text-right">{money(r.codeRevenue)}</td>
              <td className="p-3 text-right">{money(r.cost)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-stone-500">Nothing to show for these filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

type FormValues = Partial<Omit<SeedingSend, "id" | "created_by" | "created_at">>;

const NUMBER_FIELDS = new Set(["quantity", "product_cost", "shipping_cost", "views", "likes", "comments", "shares", "code_orders", "code_revenue"]);

function SendForm({
  send,
  creators,
  today,
  canDelete,
  onDone,
  onCancel,
}: {
  send?: SeedingSend;
  creators: Creator[];
  today: string;
  canDelete: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(
    send ?? { product: "Mop Soap", quantity: 1, product_cost: 0, shipping_cost: 0, shipped_on: today, status: "shipped" },
  );
  const [inDirectory, setInDirectory] = useState(send ? !!send.creator_id : true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormValues, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v === "" ? null : NUMBER_FIELDS.has(key) ? Number(v) : v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: FormValues = { ...values };
    delete (payload as Partial<SeedingSend>).id;
    delete (payload as Partial<SeedingSend>).created_by;
    delete (payload as Partial<SeedingSend>).created_at;
    delete (payload as Record<string, unknown>).updated_at;
    if (inDirectory) payload.creator_handle = null;
    else payload.creator_id = null;
    if (payload.product_cost == null) payload.product_cost = 0;
    if (payload.shipping_cost == null) payload.shipping_cost = 0;
    const supabase = createClient();
    const { error } = send
      ? await supabase.from("seeding_sends").update(payload).eq("id", send.id)
      : await supabase.from("seeding_sends").insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    onDone();
  };

  const remove = async () => {
    if (!send || !confirm("Delete this send?")) return;
    const { error } = await createClient().from("seeding_sends").delete().eq("id", send.id);
    if (error) return setError(error.message);
    onDone();
  };

  const input = "w-full rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";
  const field = (key: keyof FormValues, label: string, type = "text", extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="block text-sm text-stone-600 mb-1">{label}</span>
      <input
        type={type}
        value={(values[key] as string | number | null | undefined) ?? ""}
        onChange={(e) => set(key, e.target.value)}
        className={input}
        {...(type === "number" ? { min: 0 } : {})}
        {...extra}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Creator &amp; product</h3>
        <div className="flex gap-4 text-sm mb-3">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={inDirectory} onChange={() => setInDirectory(true)} /> In the directory
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!inDirectory} onChange={() => setInDirectory(false)} /> Not in the directory
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {inDirectory ? (
            <label className="block">
              <span className="block text-sm text-stone-600 mb-1">Creator</span>
              <select required value={values.creator_id ?? ""} onChange={(e) => set("creator_id", e.target.value)} className={input}>
                <option value="">Choose…</option>
                {creators.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </label>
          ) : (
            field("creator_handle", "Creator handle", "text", { required: true, placeholder: "@handle" })
          )}
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">Product</span>
            <input list="seeding-products" required value={values.product ?? ""} onChange={(e) => set("product", e.target.value)} className={input} />
            <datalist id="seeding-products">{PRODUCTS.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">Scent</span>
            <input list="seeding-scents" value={values.scent ?? ""} onChange={(e) => set("scent", e.target.value)} className={input} />
            <datalist id="seeding-scents">{SCENTS.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          {field("quantity", "Quantity", "number", { min: 1, required: true })}
          {field("product_cost", "Product cost ($)", "number", { step: "0.01" })}
          {field("shipping_cost", "Shipping cost ($)", "number", { step: "0.01" })}
          {field("shipped_on", "Shipped on", "date", { required: true })}
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">Status</span>
            <select value={values.status} onChange={(e) => set("status", e.target.value as SeedingStatus)} className={input}>
              {SEEDING_STATUSES.map((s) => <option key={s} value={s}>{SEEDING_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Post &amp; results</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">Platform</span>
            <select value={values.platform ?? ""} onChange={(e) => set("platform", e.target.value)} className={input}>
              <option value="">—</option>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {field("post_url", "Post link", "url", { placeholder: "https://…" })}
          {field("posted_on", "Posted on", "date")}
          {field("views", "Views", "number")}
          {field("likes", "Likes", "number")}
          {field("comments", "Comments", "number")}
          {field("shares", "Shares", "number")}
          {field("discount_code", "Discount code")}
          {field("code_orders", "Orders with code", "number")}
          {field("code_revenue", "Revenue from code ($)", "number", { step: "0.01" })}
        </div>
        <label className="block mt-3">
          <span className="block text-sm text-stone-600 mb-1">Notes</span>
          <textarea rows={2} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className={input} />
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Saving…" : send ? "Save changes" : "Log send"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-300 px-4 py-2 text-sm">Cancel</button>
        {send && canDelete && (
          <button type="button" onClick={remove} className="ml-auto text-sm text-rose-600 hover:underline">Delete</button>
        )}
      </div>
    </form>
  );
}

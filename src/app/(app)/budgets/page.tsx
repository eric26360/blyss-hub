"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BudgetBar } from "@/components/BudgetBar";
import { Dialog } from "@/components/CreatorForm";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { Badge } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import {
  APPROVAL_LABEL,
  EXPENSE_LABEL,
  currentMonth,
  emptySummary,
  expenseCounts,
  money2,
  monthLabel,
  monthStart,
  type BudgetSummary,
  type Creator,
  type Expense,
} from "@/lib/ugc";
import { useTeam } from "@/lib/use-team";

type CreatorOption = Pick<Creator, "id" | "full_name" | "standard_rate" | "negotiated_rate" | "assigned_strategist_id" | "assigned_ugc_manager_id">;

const shiftMonth = (ym: string, n: number) => {
  const d = new Date(`${ym}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

export default function BudgetsPage() {
  return (
    <Suspense>
      <Budgets />
    </Suspense>
  );
}

function Budgets() {
  const { user } = useSession();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { team, nameOf } = useTeam();
  const [month, setMonth] = useState(() => params.get("month") ?? currentMonth());
  const [summaries, setSummaries] = useState<BudgetSummary[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [strategistFilter, setStrategistFilter] = useState("");

  const load = useCallback(async () => {
    const m = monthStart(month);
    const [s, e, c] = await Promise.all([
      supabase.from("ugc_budget_summary").select("*").eq("month", m),
      supabase.from("ugc_expenses").select("*").eq("budget_month", m).order("expense_date", { ascending: false }),
      supabase.from("ugc_creators").select("id, full_name, standard_rate, negotiated_rate, assigned_strategist_id, assigned_ugc_manager_id").order("full_name"),
    ]);
    setSummaries((s.data as BudgetSummary[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setCreators((c.data as CreatorOption[]) ?? []);
    setLoaded(true);
  }, [supabase, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const isOwner = user.role === "owner";
  const seesAll = isOwner || user.role === "ugc_manager";
  const strategists = team.filter((t) => t.role === "strategist" && t.active);
  const summaryFor = (id: string) => summaries.find((s) => s.strategist_id === id) ?? emptySummary(id, monthStart(month));
  const creatorName = (id: string) => creators.find((c) => c.id === id)?.full_name ?? "—";

  const update = async (id: string, patch: Partial<Expense>) => {
    const { error } = await supabase.from("ugc_expenses").update(patch).eq("id", id);
    setNotice(error ? error.message : null);
    load();
  };

  const visibleExpenses = expenses.filter((e) => !strategistFilter || e.strategist_id === strategistFilter);
  const pending = expenses.filter((e) => e.approval === "pending" && e.status !== "cancelled");

  return (
    <Guard page="budgets">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <PageHeader
          title="UGC Budgets"
          subtitle={seesAll ? "Monthly UGC budgets and spending for every strategist." : "Your monthly UGC budget and bookings."}
        />
        <div className="flex gap-2 shrink-0 mb-6">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-xl border border-stone-300 px-3 py-2 text-sm" aria-label="Previous month">←</button>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white"
            aria-label="Month"
          />
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-xl border border-stone-300 px-3 py-2 text-sm" aria-label="Next month">→</button>
        </div>
      </div>

      {notice && <Card className="mb-4 !py-3 text-sm border-amber-300 bg-amber-50">{notice}</Card>}

      {seesAll ? (
        <TeamBudgets
          month={month}
          strategists={strategists}
          summaryFor={summaryFor}
          isOwner={isOwner}
          onSaved={load}
        />
      ) : (
        <Card className="mb-4">
          <p className="text-sm text-stone-500">{monthLabel(month)}</p>
          <p className="text-3xl font-semibold mt-1 mb-4">
            {money2(summaryFor(user.id).available)} <span className="text-base font-normal text-stone-500">available of {money2(summaryFor(user.id).budget)}</span>
          </p>
          <BudgetBar summary={summaryFor(user.id)} />
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="mb-4 border-rose-200">
          <h2 className="font-medium mb-1">Awaiting owner approval</h2>
          <p className="text-xs text-stone-500 mb-3">These bookings would go over the strategist&apos;s budget. They don&apos;t count until approved.</p>
          <ul className="space-y-2">
            {pending.map((e) => {
              const s = summaryFor(e.strategist_id);
              return (
                <li key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm border-b border-stone-100 last:border-0 pb-2">
                  <span>
                    <span className="font-medium">{money2(e.amount)}</span> · {creatorName(e.creator_id)} · {e.project}
                    <span className="block text-xs text-stone-500">
                      {nameOf(e.strategist_id)}&apos;s budget: {money2(s.available)} available
                    </span>
                  </span>
                  {isOwner ? (
                    <span className="flex gap-2">
                      <button onClick={() => update(e.id, { approval: "approved" })} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium">Approve</button>
                      <button onClick={() => update(e.id, { approval: "rejected" })} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs">Reject</button>
                    </span>
                  ) : (
                    <Badge label="Awaiting Approval" />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="!p-0 overflow-x-auto">
        <div className="p-5 pb-3 flex flex-wrap gap-2 justify-between items-center">
          <h2 className="font-medium">Bookings &amp; expenses — {monthLabel(month)}</h2>
          <div className="flex gap-2">
            {seesAll && (
              <select value={strategistFilter} onChange={(e) => setStrategistFilter(e.target.value)} className="rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white" aria-label="Strategist">
                <option value="">All strategists</option>
                {strategists.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                ))}
              </select>
            )}
            <button onClick={() => setAdding(true)} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium">+ Record booking</button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-y border-stone-200">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Creator</th>
              <th className="p-3">Project</th>
              {seesAll && <th className="p-3">Strategist</th>}
              <th className="p-3">UGC manager</th>
              <th className="p-3 text-right">Videos</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((e) => (
              <tr key={e.id} className={`border-b border-stone-100 last:border-0 ${e.status === "cancelled" || e.approval === "rejected" ? "text-stone-400" : ""}`}>
                <td className="p-3 whitespace-nowrap">{new Date(e.expense_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                <td className="p-3 whitespace-nowrap"><Link href={`/creators/${e.creator_id}`} className="hover:text-brand">{creatorName(e.creator_id)}</Link></td>
                <td className="p-3">
                  {e.project}
                  {e.notes && <span className="block text-xs text-stone-500">{e.notes}</span>}
                </td>
                {seesAll && <td className="p-3 whitespace-nowrap">{nameOf(e.strategist_id)}</td>}
                <td className="p-3 whitespace-nowrap">{nameOf(e.ugc_manager_id)}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  {e.status !== "cancelled" ? (
                    <button
                      onClick={() => {
                        const v = window.prompt(`Videos delivered (of ${e.video_count})`, String(e.videos_delivered));
                        if (v != null && v !== "" && !Number.isNaN(Number(v))) update(e.id, { videos_delivered: Math.max(0, Math.floor(Number(v))) });
                      }}
                      className="hover:text-brand underline decoration-dotted"
                      title="Update videos delivered"
                    >
                      {e.videos_delivered} / {e.video_count}
                    </button>
                  ) : (
                    `${e.videos_delivered} / ${e.video_count}`
                  )}
                </td>
                <td className="p-3 text-right">{money2(e.amount)}</td>
                <td className="p-3 whitespace-nowrap space-x-1">
                  <Badge label={EXPENSE_LABEL[e.status]} />
                  {APPROVAL_LABEL[e.approval] && <Badge label={APPROVAL_LABEL[e.approval]!} />}
                </td>
                <td className="p-3 whitespace-nowrap text-right space-x-3">
                  {e.status === "committed" && expenseCounts(e) && (
                    <button onClick={() => update(e.id, { status: "paid" })} className="text-xs text-emerald-700 hover:underline">Mark paid</button>
                  )}
                  {e.status !== "cancelled" && e.status !== "paid" && (
                    <button
                      onClick={() => window.confirm("Cancel this booking? It will stop counting against the budget.") && update(e.id, { status: "cancelled" })}
                      className="text-xs text-stone-500 hover:text-rose-600 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loaded && visibleExpenses.length === 0 && <p className="p-6 text-center text-sm text-stone-500">No bookings this month.</p>}
      </Card>
      <p className="text-xs text-stone-500 mt-2">
        Booking a creator records the price as <b>committed</b>. Marking it paid moves the same amount to <b>paid</b>, so nothing is counted twice.
      </p>

      {adding && (
        <Dialog title="Record a booking" onClose={() => setAdding(false)}>
          <ExpenseForm
            creators={creators}
            strategists={strategists}
            managers={team.filter((t) => t.role === "ugc_manager" && t.active)}
            month={month}
            onCancel={() => setAdding(false)}
            onSaved={(approval) => {
              setAdding(false);
              setNotice(
                approval === "pending"
                  ? "This booking goes over the budget, so it was sent to the owners for approval. It won't count until it's approved."
                  : null,
              );
              load();
            }}
          />
        </Dialog>
      )}
    </Guard>
  );
}

function TeamBudgets({
  month,
  strategists,
  summaryFor,
  isOwner,
  onSaved,
}: {
  month: string;
  strategists: { id: string; full_name: string; email: string }[];
  summaryFor: (id: string) => BudgetSummary;
  isOwner: boolean;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const totals = strategists.map((s) => summaryFor(s.id)).reduce(
    (t, s) => ({
      ...t,
      budget: t.budget + Number(s.budget),
      paid: t.paid + Number(s.paid),
      committed: t.committed + Number(s.committed),
      awaiting_approval: t.awaiting_approval + Number(s.awaiting_approval),
      available: t.available + Number(s.available),
    }),
    emptySummary("total", monthStart(month)),
  );

  const saveBudget = async (strategistId: string) => {
    const raw = drafts[strategistId];
    if (raw == null || raw === "" || Number.isNaN(Number(raw))) return;
    const { error } = await supabase
      .from("ugc_budgets")
      .upsert({ strategist_id: strategistId, month: monthStart(month), amount: Number(raw) }, { onConflict: "strategist_id,month" });
    setError(error ? error.message : null);
    setDrafts((d) => {
      const next = { ...d };
      delete next[strategistId];
      return next;
    });
    onSaved();
  };

  const copyLastMonth = async () => {
    const prev = monthStart(shiftMonth(month, -1));
    const { data } = await supabase.from("ugc_budgets").select("strategist_id, amount").eq("month", prev);
    const missing = (data ?? []).filter((b) => summaryFor(b.strategist_id).budget === 0);
    if (missing.length === 0) return setError("Nothing to copy: last month has no budgets, or this month is already set.");
    const { error } = await supabase
      .from("ugc_budgets")
      .upsert(missing.map((b) => ({ strategist_id: b.strategist_id, month: monthStart(month), amount: b.amount })), { onConflict: "strategist_id,month" });
    setError(error ? error.message : null);
    onSaved();
  };

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
          <h2 className="font-medium">Department total — {monthLabel(month)}</h2>
          <span className="text-sm text-stone-500">
            {money2(totals.paid + totals.committed)} of {money2(totals.budget)} used
          </span>
        </div>
        <BudgetBar summary={totals} />
      </Card>

      <Card className="mb-4 !p-0 overflow-x-auto">
        <div className="p-5 pb-3 flex flex-wrap justify-between items-center gap-2">
          <h2 className="font-medium">By strategist</h2>
          {isOwner && (
            <button onClick={copyLastMonth} className="text-sm text-brand hover:underline">Copy last month&apos;s budgets</button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-y border-stone-200">
            <tr>
              <th className="p-3">Strategist</th>
              <th className="p-3 text-right">Monthly budget</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Committed</th>
              <th className="p-3 text-right">Available</th>
              <th className="p-3 w-48">Used</th>
            </tr>
          </thead>
          <tbody>
            {strategists.map((t) => {
              const s = summaryFor(t.id);
              const draft = drafts[t.id];
              return (
                <tr key={t.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-3 font-medium whitespace-nowrap">{t.full_name || t.email}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {isOwner ? (
                      <span className="inline-flex gap-1 items-center">
                        $
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={draft ?? String(Number(s.budget))}
                          onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && saveBudget(t.id)}
                          className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-right"
                          aria-label={`${t.full_name} budget`}
                        />
                        {draft != null && (
                          <button onClick={() => saveBudget(t.id)} className="rounded-lg bg-stone-900 text-white px-2 py-1 text-xs">Save</button>
                        )}
                      </span>
                    ) : (
                      money2(s.budget)
                    )}
                  </td>
                  <td className="p-3 text-right">{money2(s.paid)}</td>
                  <td className="p-3 text-right">{money2(s.committed)}</td>
                  <td className={`p-3 text-right font-medium ${s.available < 0 ? "text-rose-600" : ""}`}>{money2(s.available)}</td>
                  <td className="p-3"><BudgetBar summary={s} size="sm" /></td>
                </tr>
              );
            })}
            <tr className="bg-stone-50 font-medium">
              <td className="p-3">Department total</td>
              <td className="p-3 text-right">{money2(totals.budget)}</td>
              <td className="p-3 text-right">{money2(totals.paid)}</td>
              <td className="p-3 text-right">{money2(totals.committed)}</td>
              <td className="p-3 text-right">{money2(totals.available)}</td>
              <td className="p-3" />
            </tr>
          </tbody>
        </table>
        {error && <p className="px-5 pb-4 text-sm text-rose-600">{error}</p>}
      </Card>
    </>
  );
}

function ExpenseForm({
  creators,
  strategists,
  managers,
  month,
  onCancel,
  onSaved,
}: {
  creators: CreatorOption[];
  strategists: { id: string; full_name: string; email: string }[];
  managers: { id: string; full_name: string; email: string }[];
  month: string;
  onCancel: () => void;
  onSaved: (approval: Expense["approval"]) => void;
}) {
  const { user } = useSession();
  const isStrategist = user?.role === "strategist";
  const thisMonth = currentMonth();
  const [form, setForm] = useState({
    creator_id: "",
    strategist_id: isStrategist ? user!.id : "",
    ugc_manager_id: "",
    project: "",
    video_count: "1",
    amount: "",
    expense_date: month === thisMonth ? new Date().toLocaleDateString("en-CA") : `${month}-01`,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Picking a creator fills in their team and suggests a price from their rate.
  const pickCreator = (id: string) => {
    const c = creators.find((x) => x.id === id);
    setForm((f) => {
      const rate = c?.negotiated_rate ?? c?.standard_rate;
      return {
        ...f,
        creator_id: id,
        strategist_id: isStrategist ? f.strategist_id : f.strategist_id || c?.assigned_strategist_id || "",
        ugc_manager_id: f.ugc_manager_id || c?.assigned_ugc_manager_id || "",
        amount: f.amount || (rate != null ? String(Number(rate) * Number(f.video_count || 1)) : ""),
      };
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient()
      .from("ugc_expenses")
      .insert({
        creator_id: form.creator_id,
        strategist_id: form.strategist_id,
        ugc_manager_id: form.ugc_manager_id || null,
        project: form.project.trim(),
        video_count: Number(form.video_count),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        notes: form.notes.trim() || null,
      })
      .select("approval")
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    onSaved(data.approval);
  };

  const input = "w-full rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";
  const label = "block text-sm text-stone-600 mb-1";

  return (
    <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
      <label className="block sm:col-span-2">
        <span className={label}>Creator</span>
        <select required value={form.creator_id} onChange={(e) => pickCreator(e.target.value)} className={input}>
          <option value="">Choose a creator…</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
        {creators.length === 0 && <span className="text-xs text-stone-500">Add the creator in the Creator Directory first.</span>}
      </label>
      <label className="block">
        <span className={label}>Whose budget (strategist)</span>
        <select required value={form.strategist_id} onChange={(e) => set("strategist_id", e.target.value)} disabled={isStrategist} className={input}>
          <option value="">Choose…</option>
          {strategists.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>UGC manager</span>
        <select value={form.ugc_manager_id} onChange={(e) => set("ugc_manager_id", e.target.value)} className={input}>
          <option value="">None</option>
          {managers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Project</span>
        <input required value={form.project} onChange={(e) => set("project", e.target.value)} placeholder="e.g. Heartbreaker UGC batch 3" className={input} />
      </label>
      <label className="block">
        <span className={label}>Number of videos</span>
        <input required type="number" min={0} value={form.video_count} onChange={(e) => set("video_count", e.target.value)} className={input} />
      </label>
      <label className="block">
        <span className={label}>Agreed price ($)</span>
        <input required type="number" min={0} step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className={input} />
      </label>
      <label className="block">
        <span className={label}>Date</span>
        <input required type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} className={input} />
        <span className="text-xs text-stone-500">Counts against that month&apos;s budget.</span>
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Notes</span>
        <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={input} />
      </label>
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Saving…" : "Record booking"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-300 px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

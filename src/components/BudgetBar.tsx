import { money2, type BudgetSummary } from "@/lib/ugc";

// Stacked bar: paid | committed | available. Shows overspend when approved spending exceeds the budget.
export function BudgetBar({ summary, size = "lg" }: { summary: BudgetSummary; size?: "lg" | "sm" }) {
  const { budget, paid, committed, available, awaiting_approval } = summary;
  const total = Math.max(budget, paid + committed, 1);
  const pct = (n: number) => `${(Math.max(n, 0) / total) * 100}%`;
  const used = budget > 0 ? Math.round(((paid + committed) / budget) * 100) : null;
  const h = size === "lg" ? "h-5" : "h-2.5";

  return (
    <div>
      <div className={`flex w-full ${h} rounded-full overflow-hidden bg-stone-100`}>
        <div className="bg-stone-800" style={{ width: pct(paid) }} title={`Paid ${money2(paid)}`} />
        <div className="bg-amber-400" style={{ width: pct(committed) }} title={`Committed ${money2(committed)}`} />
        <div className="bg-emerald-200" style={{ width: pct(available) }} title={`Available ${money2(available)}`} />
      </div>
      {size === "lg" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
          <Legend color="bg-stone-800" label="Paid" value={money2(paid)} />
          <Legend color="bg-amber-400" label="Committed" value={money2(committed)} />
          <Legend color="bg-emerald-200" label="Available" value={money2(available)} warn={available < 0} />
          {awaiting_approval > 0 && <Legend color="bg-rose-300" label="Awaiting approval" value={money2(awaiting_approval)} />}
          {used != null && <span className="text-stone-500">{used}% of {money2(budget)} used</span>}
          {budget === 0 && <span className="text-stone-500">No budget set for this month</span>}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, value, warn }: { color: string; label: string; value: string; warn?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-stone-500">{label}</span>
      <span className={`font-medium ${warn ? "text-rose-600" : ""}`}>{value}</span>
    </span>
  );
}

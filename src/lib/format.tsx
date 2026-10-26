export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const roas = (revenue: number, spend: number) => (spend ? revenue / spend : 0);

export const STATUS_COLORS: Record<string, string> = {
  Live: "bg-emerald-100 text-emerald-700",
  Active: "bg-emerald-100 text-emerald-700",
  "In Review": "bg-amber-100 text-amber-700",
  Review: "bg-amber-100 text-amber-700",
  Draft: "bg-stone-100 text-stone-600",
  "To Do": "bg-stone-100 text-stone-600",
  "In Progress": "bg-sky-100 text-sky-700",
  Paused: "bg-rose-100 text-rose-700",
  Done: "bg-emerald-100 text-emerald-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Late: "bg-amber-100 text-amber-700",
  Missing: "bg-rose-100 text-rose-700",
  Pending: "bg-yellow-50 text-yellow-700",
  "Day Off": "bg-sky-100 text-sky-700",
  "Non-working day": "bg-stone-100 text-stone-500",
};

export function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[label] ?? "bg-stone-100"}`}>
      {label}
    </span>
  );
}

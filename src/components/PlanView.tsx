import { DAYS, DAY_LABEL, type PlanFields } from "@/lib/weekly-plans";

// Read-only display of a weekly plan.
export function PlanView({ plan }: { plan: PlanFields }) {
  const block = (label: string, text: string) => (
    <div>
      <p className="text-xs font-medium text-stone-500 mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{text.trim() || <span className="text-stone-400">—</span>}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {block("What I'll complete this week", plan.goals)}
        {block("What I'll focus on", plan.focus)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {DAYS.map((d) => (
          <div key={d} className="rounded-xl bg-stone-50 border border-stone-100 p-3">
            {block(DAY_LABEL[d], plan[d])}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BudgetBar } from "@/components/BudgetBar";
import { Card } from "@/components/Guard";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { currentMonth, emptySummary, money2, monthLabel, monthStart, type BudgetSummary } from "@/lib/ugc";

// This month's UGC budget for the signed-in strategist.
export function MyBudget() {
  const { user } = useSession();
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const month = currentMonth(user?.timezone);

  useEffect(() => {
    if (user?.role !== "strategist") return;
    createClient()
      .from("ugc_budget_summary")
      .select("*")
      .eq("strategist_id", user.id)
      .eq("month", monthStart(month))
      .maybeSingle()
      .then(({ data }) => setSummary((data as BudgetSummary | null) ?? emptySummary(user.id, monthStart(month))));
  }, [user, month]);

  if (user?.role !== "strategist" || !summary) return null;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
        <p className="font-medium">UGC budget — {monthLabel(month)}</p>
        <p className="text-sm">
          <span className="font-semibold">{money2(summary.available)}</span>
          <span className="text-stone-500"> remaining of {money2(summary.budget)}</span>
        </p>
      </div>
      <BudgetBar summary={summary} />
      <Link href="/budgets" className="text-xs text-brand mt-3 inline-block hover:underline">
        View bookings →
      </Link>
    </Card>
  );
}

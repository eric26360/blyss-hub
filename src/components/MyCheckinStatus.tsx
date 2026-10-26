"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Guard";
import { Badge } from "@/lib/format";
import { STATUS_LABEL, checkinStatus, dateInTz, formatTime, type Checkin, type CheckinKind } from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { useCheckinSettings } from "@/lib/use-checkin-settings";

// Today's morning/evening check-in status for the signed-in person.
export function MyCheckinStatus() {
  const { user } = useSession();
  const { deadlines, workingDays, loaded } = useCheckinSettings();
  const [today, setToday] = useState<Checkin[] | null>(null);
  const tz = user?.timezone ?? "America/New_York";
  const day = dateInTz(tz);

  useEffect(() => {
    if (!user?.requiresCheckins) return;
    createClient()
      .from("checkins")
      .select("*")
      .eq("profile_id", user.id)
      .eq("day", day)
      .then(({ data }) => setToday((data as Checkin[]) ?? []));
  }, [user, day]);

  if (!user?.requiresCheckins || !today || !loaded) return null;

  const item = (kind: CheckinKind, label: string) => {
    const c = today.find((x) => x.kind === kind);
    const s = checkinStatus({ checkin: c, kind, day, tz, deadlines, workingDays, dayOff: false });
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-stone-500 w-24">{label}</span>
        <Badge label={STATUS_LABEL[s]} />
        <span className="text-xs text-stone-400">
          {c ? formatTime(c.submitted_at, tz) : `due ${deadlines[kind]}`}
        </span>
      </div>
    );
  };

  const allDone = today.length >= 2;

  return (
    <Card className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div className="space-y-2">
        <p className="font-medium">Today&apos;s check-ins</p>
        {item("morning", "Morning")}
        {item("evening", "End of day")}
      </div>
      <Link
        href="/checkin"
        className={`rounded-xl px-4 py-2 text-sm font-medium text-center ${allDone ? "border border-stone-300" : "bg-brand text-white"}`}
      >
        {allDone ? "View check-ins" : "Go to check-in"}
      </Link>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_DEADLINES, DEFAULT_WORKING_DAYS, type Deadlines } from "./checkins";

// Owner-configured check-in deadlines and working days from the settings table.
export function useCheckinSettings() {
  const [deadlines, setDeadlines] = useState<Deadlines>(DEFAULT_DEADLINES);
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_DAYS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    createClient()
      .from("settings")
      .select("key, value")
      .in("key", ["checkin_deadlines", "working_days"])
      .then(({ data }) => {
        for (const row of data ?? []) {
          if (row.key === "checkin_deadlines") setDeadlines({ ...DEFAULT_DEADLINES, ...row.value });
          if (row.key === "working_days") setWorkingDays(row.value);
        }
        setLoaded(true);
      });
  }, []);

  return { deadlines, workingDays, loaded };
}

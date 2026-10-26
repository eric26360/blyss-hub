"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "./roles";

export type TeamMember = { id: string; full_name: string; email: string; role: Role; active: boolean };

// Everyone on the team, for name lookups and "assign to" pickers.
export function useTeam() {
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    createClient()
      .from("profiles")
      .select("id, full_name, email, role, active")
      .order("full_name")
      .then(({ data }) => setTeam((data as TeamMember[]) ?? []));
  }, []);

  const nameOf = (id: string | null | undefined) => {
    if (!id) return "—";
    const m = team.find((t) => t.id === id);
    return m ? m.full_name || m.email : "—";
  };

  const byRole = (role: Role) => team.filter((t) => t.role === role && t.active);

  return { team, nameOf, byRole };
}

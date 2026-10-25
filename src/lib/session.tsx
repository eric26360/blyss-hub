"use client";

// Real logins through Supabase. Loads the signed-in person's profile
// (name and role) so pages can decide what to show.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "./roles";

export type User = { id: string; name: string; email: string; role: Role };

type Session = {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async (userId: string | undefined) => {
      if (!userId) {
        setUser(null);
        setReady(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, active")
        .eq("id", userId)
        .single();
      setUser(data && data.active ? { id: data.id, name: data.full_name || data.email, email: data.email, role: data.role } : null);
      setReady(true);
    };

    supabase.auth.getUser().then(({ data }) => load(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer so we don't call Supabase from inside its own callback.
      setTimeout(() => load(session?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

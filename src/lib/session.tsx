"use client";

// Mock login: remembers which fake user is "signed in".
// This gets replaced by real Supabase logins later.

import { createContext, useContext, useEffect, useState } from "react";
import { USERS, type User } from "./mock-data";

type Session = {
  user: User | null;
  ready: boolean;
  signIn: (userId: string) => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const id = localStorage.getItem("blyss-user");
      setUser(USERS.find((u) => u.id === id) ?? null);
    } catch {}
    setReady(true);
  }, []);

  const signIn = (userId: string) => {
    setUser(USERS.find((u) => u.id === userId) ?? null);
    try {
      localStorage.setItem("blyss-user", userId);
    } catch {}
  };

  const signOut = () => {
    setUser(null);
    try {
      localStorage.removeItem("blyss-user");
    } catch {}
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

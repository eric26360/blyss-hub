"use client";

import { useRouter } from "next/navigation";
import { USERS } from "@/lib/mock-data";
import { ROLE_LABELS } from "@/lib/roles";
import { useSession } from "@/lib/session";

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-2xl font-semibold">
          Blyss <span className="text-brand">Hub</span>
        </h1>
        <p className="text-sm text-stone-500 mt-1 mb-6">
          Mockup login. Pick a team member to see what their role can access.
        </p>
        <div className="space-y-2">
          {USERS.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                signIn(u.id);
                router.push("/");
              }}
              className="w-full flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3 text-left hover:border-brand hover:bg-orange-50 transition"
            >
              <span>
                <span className="block font-medium">{u.name}</span>
                <span className="block text-xs text-stone-500">{u.email}</span>
              </span>
              <span className="text-xs rounded-full bg-stone-100 px-2 py-1">
                {ROLE_LABELS[u.role]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { PAGES, ROLE_LABELS, canAccess } from "@/lib/roles";
import { useSession } from "@/lib/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!user) return null;

  const visible = PAGES.filter((p) => canAccess(user, p.key));

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-stone-200 bg-white p-4 flex md:flex-col gap-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xl font-semibold whitespace-nowrap">
            Blyss <span className="text-brand">Hub</span>
          </span>
          <NotificationBell />
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto flex-1">
          {visible.map((p) => {
            const active = pathname === p.href || (p.href !== "/" && pathname.startsWith(p.href + "/"));
            return (
              <Link
                key={p.key}
                href={p.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-orange-50 text-brand font-medium" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
          <Link
            href="/account"
            className="md:hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            My account
          </Link>
        </nav>
        <div className="hidden md:block border-t border-stone-200 pt-4 px-2">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-stone-500">{ROLE_LABELS[user.role]}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/account" className="text-xs text-brand hover:underline">
              My account
            </Link>
            <button onClick={signOut} className="text-xs text-brand hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl">{children}</main>
    </div>
  );
}

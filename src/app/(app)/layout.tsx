"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { NAV_GROUPS, PAGES, ROLE_LABELS, canAccess, type NavGroup } from "@/lib/roles";
import { useSession } from "@/lib/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Partial<Record<NavGroup, boolean>>>({});

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  // Remember which menu groups were left open (per browser).
  useEffect(() => {
    try {
      setOpenGroups(JSON.parse(localStorage.getItem("blyss-nav-groups") ?? "{}"));
    } catch {}
  }, []);

  // The active page is the longest matching link, so /ugc/seeding doesn't also light up /ugc.
  const activeHref = PAGES.map((p) => p.href)
    .filter((h) => pathname === h || (h !== "/" && pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  const activeGroup = PAGES.find((p) => p.href === activeHref)?.group;

  // Opening a page inside a group opens that group.
  useEffect(() => {
    if (activeGroup) setOpenGroups((g) => (g[activeGroup] ? g : { ...g, [activeGroup]: true }));
  }, [activeGroup]);

  if (!user) return null;

  const visible = PAGES.filter((p) => canAccess(user, p.key));

  const toggleGroup = (g: NavGroup) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [g]: !prev[g] };
      try {
        localStorage.setItem("blyss-nav-groups", JSON.stringify(next));
      } catch {}
      return next;
    });

  const link = (p: (typeof PAGES)[number], nested = false) => {
    const active = p.href === activeHref;
    return (
      <Link
        key={p.key}
        href={p.href}
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${nested ? "md:ml-3" : ""} ${
          active ? "bg-orange-50 text-brand font-medium" : "text-stone-600 hover:bg-stone-100"
        }`}
      >
        {p.label}
      </Link>
    );
  };

  // Pages in order; grouped pages render under one collapsible header where the group first appears.
  const navItems: React.ReactNode[] = [];
  const seen = new Set<NavGroup>();
  for (const p of visible) {
    if (!p.group) {
      navItems.push(link(p));
      continue;
    }
    if (seen.has(p.group)) continue;
    const g = p.group;
    seen.add(g);
    const open = !!openGroups[g];
    const items = visible.filter((x) => x.group === g);
    navItems.push(
      <div key={"group-" + g} className={`flex md:flex-col gap-1 ${open ? "md:border-l-0 border-l border-stone-200" : ""}`}>
        <button
          onClick={() => toggleGroup(g)}
          aria-expanded={open}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 ${
            activeGroup === g && !open ? "bg-orange-50 text-brand font-medium" : "text-stone-800 font-medium hover:bg-stone-100"
          }`}
        >
          {NAV_GROUPS[g]}
          <span className={`text-xs text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        </button>
        {open && items.map((x) => link(x, true))}
      </div>,
    );
  }

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
          {navItems}
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

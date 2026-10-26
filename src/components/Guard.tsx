"use client";

import { canAccess, type PageKey } from "@/lib/roles";
import { useSession } from "@/lib/session";

// Wrap a page's content so only allowed roles can see it.
export function Guard({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const { user } = useSession();
  if (!user) return null;
  if (!canAccess(user, page)) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="text-lg font-medium">No access</p>
        <p className="text-sm text-stone-500 mt-1">
          Your role doesn&apos;t include this page. Ask an admin.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white p-5 ${className}`}>{children}</div>;
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Bell with unread count; updates live when a new notification arrives.
export function NotificationBell() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notification[]) ?? []);
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, load]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((xs) => xs.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
  };

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span data-testid="unread-count" className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 z-30 md:absolute md:left-0 md:right-auto md:top-full md:mt-2 md:w-80 rounded-2xl border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <p className="font-medium text-sm">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))} className="text-xs text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-sm text-stone-500 text-center">No notifications yet.</li>}
            {items.map((n) => {
              const content = (
                <>
                  <p className={`text-sm ${n.read_at ? "text-stone-600" : "font-medium"}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-stone-500 mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-stone-400 mt-1">{timeAgo(n.created_at)}</p>
                </>
              );
              return (
                <li key={n.id} className={`border-b border-stone-100 last:border-0 ${n.read_at ? "" : "bg-orange-50/60"}`}>
                  <div className="flex gap-2 px-4 py-3">
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="flex-1"
                        onClick={() => {
                          markRead([n.id]);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex-1">{content}</div>
                    )}
                    {!n.read_at && (
                      <button type="button" onClick={() => markRead([n.id])} className="self-start text-[11px] text-brand hover:underline whitespace-nowrap">
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

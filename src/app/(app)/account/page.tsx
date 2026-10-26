"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/Guard";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/roles";
import { useSession } from "@/lib/session";

export default function AccountPage() {
  const { user } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setMessage({ ok: false, text: "Use at least 8 characters." });
    if (password !== confirm) return setMessage({ ok: false, text: "The two passwords don't match." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setPassword("");
    setConfirm("");
    setMessage({ ok: true, text: "Password changed. Use the new one next time you sign in." });
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title="My account" />
      <Card className="max-w-md mb-4">
        <p className="text-sm"><span className="text-stone-500">Name:</span> {user.name}</p>
        <p className="text-sm"><span className="text-stone-500">Email:</span> {user.email}</p>
        <p className="text-sm"><span className="text-stone-500">Role:</span> {ROLE_LABELS[user.role]}</p>
      </Card>
      <Card className="max-w-md">
        <form onSubmit={submit}>
          <h2 className="font-medium mb-4">Change password</h2>
          <label className="block text-sm font-medium mb-1" htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-stone-300 px-3 py-2 mb-4"
          />
          <label className="block text-sm font-medium mb-1" htmlFor="confirm-password">Type it again</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-stone-300 px-3 py-2 mb-4"
          />
          {message && (
            <p className={`text-sm mb-4 ${message.ok ? "text-emerald-600" : "text-rose-600"}`}>{message.text}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : "Change password"}
          </button>
        </form>
      </Card>
    </>
  );
}

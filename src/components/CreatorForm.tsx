"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session";
import { CREATOR_STATUSES, CREATOR_STATUS_LABEL, type Creator } from "@/lib/ugc";
import type { TeamMember } from "@/lib/use-team";

type Field = { key: keyof Creator; label: string; type?: "text" | "email" | "url" | "money" | "textarea"; placeholder?: string };

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "Contact",
    fields: [
      { key: "full_name", label: "Full name" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "country", label: "Country" },
      { key: "location", label: "City / location" },
      { key: "photo_url", label: "Profile photo URL", type: "url", placeholder: "https://…" },
    ],
  },
  {
    title: "Socials",
    fields: [
      { key: "instagram", label: "Instagram", placeholder: "@handle or link" },
      { key: "tiktok", label: "TikTok", placeholder: "@handle or link" },
      { key: "other_socials", label: "Other socials (one link per line)", type: "textarea" },
    ],
  },
  {
    title: "Pricing",
    fields: [
      { key: "standard_rate", label: "Standard rate per video ($)", type: "money" },
      { key: "negotiated_rate", label: "Negotiated rate per video ($)", type: "money" },
      { key: "package_rate", label: "Package rate ($)", type: "money" },
      { key: "package_details", label: "Package details", placeholder: "e.g. 5 videos + 3 hooks" },
      { key: "whitelisting_rate", label: "Whitelisting rate ($)", type: "money" },
      { key: "usage_rights", label: "Usage rights", placeholder: "e.g. 12 months paid usage" },
    ],
  },
];

const MONEY = new Set<keyof Creator>(["standard_rate", "negotiated_rate", "package_rate", "whitelisting_rate"]);

// Add or edit a creator. Strategists can only assign creators to themselves (enforced by the database).
export function CreatorForm({
  creator,
  team,
  onSaved,
  onCancel,
}: {
  creator?: Creator;
  team: TeamMember[];
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { user } = useSession();
  const isStrategist = user?.role === "strategist";
  const [values, setValues] = useState<Partial<Creator>>(
    creator ?? { status: "prospect", assigned_strategist_id: isStrategist ? user?.id : null },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Creator, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v === "" ? null : MONEY.has(key) ? Number(v) : v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { ...values };
    delete payload.id;
    delete payload.created_at;
    const supabase = createClient();
    const res = creator
      ? await supabase.from("ugc_creators").update(payload).eq("id", creator.id).select("id").single()
      : await supabase.from("ugc_creators").insert(payload).select("id").single();
    setBusy(false);
    if (res.error) return setError(res.error.message);
    onSaved(res.data.id);
  };

  const strategists = team.filter((t) => t.role === "strategist" && t.active);
  const managers = team.filter((t) => t.role === "ugc_manager" && t.active);
  const input = "w-full rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white";

  return (
    <form onSubmit={save} className="space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="font-medium mb-3">{section.title}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {section.fields.map((f) => (
              <label key={f.key} className={`block ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                <span className="block text-sm text-stone-600 mb-1">{f.label}</span>
                {f.type === "textarea" ? (
                  <textarea
                    rows={2}
                    value={(values[f.key] as string) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={input}
                  />
                ) : (
                  <input
                    type={f.type === "money" ? "number" : f.type ?? "text"}
                    min={f.type === "money" ? 0 : undefined}
                    step={f.type === "money" ? "0.01" : undefined}
                    required={f.key === "full_name"}
                    placeholder={f.placeholder}
                    value={(values[f.key] as string | number | null) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={input}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="font-medium mb-3">Status &amp; team</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">Status</span>
            <select value={values.status} onChange={(e) => set("status", e.target.value)} className={input}>
              {CREATOR_STATUSES.map((s) => (
                <option key={s} value={s}>{CREATOR_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">Creative strategist</span>
            <select
              value={values.assigned_strategist_id ?? ""}
              onChange={(e) => set("assigned_strategist_id", e.target.value)}
              disabled={isStrategist}
              className={input}
            >
              <option value="">Unassigned</option>
              {strategists.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-stone-600 mb-1">UGC manager</span>
            <select
              value={values.assigned_ugc_manager_id ?? ""}
              onChange={(e) => set("assigned_ugc_manager_id", e.target.value)}
              className={input}
            >
              <option value="">Unassigned</option>
              {managers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block mt-3">
          <span className="block text-sm text-stone-600 mb-1">Internal notes</span>
          <textarea
            rows={3}
            value={values.internal_notes ?? ""}
            onChange={(e) => set("internal_notes", e.target.value)}
            className={input}
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Saving…" : creator ? "Save changes" : "Add creator"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-300 px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Full-screen-on-mobile dialog wrapper used for creator and expense forms.
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 z-20 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-700 text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

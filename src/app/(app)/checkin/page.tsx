"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckinAnswers } from "@/components/CheckinAnswers";
import { ExpandableRow } from "@/components/ExpandableRow";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { Badge } from "@/lib/format";
import {
  COUNT_QUESTION,
  QUESTIONS,
  STATUS_LABEL,
  checkinStatus,
  dateInTz,
  formatDay,
  formatTime,
  isOnTime,
  plannedVsActual,
  type Checkin,
  type CheckinKind,
} from "@/lib/checkins";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { useCheckinSettings } from "@/lib/use-checkin-settings";

const KIND_LABEL: Record<CheckinKind, string> = { morning: "Morning", evening: "End of Day" };

export default function CheckinPage() {
  const { user } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { deadlines, workingDays } = useCheckinSettings();
  const [history, setHistory] = useState<Checkin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<CheckinKind | null>(null);

  const tz = user?.timezone ?? "America/New_York";
  const today = dateInTz(tz);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("checkins")
      .select("*")
      .eq("profile_id", user.id)
      .order("day", { ascending: false })
      .limit(120);
    setHistory((data as Checkin[]) ?? []);
    setLoaded(true);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const morning = history.find((c) => c.day === today && c.kind === "morning");
  const evening = history.find((c) => c.day === today && c.kind === "evening");

  // Open the evening form once the morning one is in.
  useEffect(() => {
    if (loaded && kind === null) setKind(morning ? "evening" : "morning");
  }, [loaded, kind, morning]);

  if (!user) return null;

  return (
    <Guard page="checkin">
      <PageHeader title="Daily Check-In" subtitle={`${formatDay(today)} · deadlines ${deadlines.morning} and ${deadlines.evening} (${tz.replace("_", " ")})`} />

      <div className="flex gap-2 mb-4">
        {(["morning", "evening"] as CheckinKind[]).map((k) => {
          const done = k === "morning" ? morning : evening;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm border ${
                kind === k ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 bg-white"
              }`}
            >
              {KIND_LABEL[k]} {done ? "✓" : ""}
            </button>
          );
        })}
      </div>

      {loaded && kind && (
        <CheckinForm
          key={kind}
          kind={kind}
          existing={kind === "morning" ? morning : evening}
          morning={morning}
          userId={user.id}
          today={today}
          onSaved={load}
          isOnTimeNow={() => isOnTime(kind, today, tz, deadlines)}
          tz={tz}
        />
      )}

      <h2 className="font-medium mt-10 mb-3">My history</h2>
      <History history={history} today={today} tz={tz} deadlines={deadlines} workingDays={workingDays} />
    </Guard>
  );
}

function CheckinForm({
  kind,
  existing,
  morning,
  userId,
  today,
  onSaved,
  isOnTimeNow,
  tz,
}: {
  tz: string;
  kind: CheckinKind;
  existing: Checkin | undefined;
  morning: Checkin | undefined;
  userId: string;
  today: string;
  onSaved: () => Promise<void>;
  isOnTimeNow: () => boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [answers, setAnswers] = useState<Record<string, string>>(existing?.answers ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const questions = QUESTIONS[kind];
  const countKey = COUNT_QUESTION[kind];
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  const comparison =
    kind === "evening"
      ? plannedVsActual(morning?.creative_count, answers[countKey] === undefined || answers[countKey] === "" ? null : Number(answers[countKey]))
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    const missing = questions.find((q) => q.required && !(answers[q.id] ?? "").trim());
    if (missing) {
      setError(`Please answer: ${missing.label}`);
      return;
    }
    const count = Number(answers[countKey]);
    if (!Number.isInteger(count) || count < 0) {
      setError("Please enter a whole number for the creatives/briefs count.");
      return;
    }
    const clean = Object.fromEntries(questions.map((q) => [q.id, (answers[q.id] ?? "").trim()]));

    setSaving(true);
    if (existing) {
      const { error } = await supabase
        .from("checkins")
        .update({ answers: clean, creative_count: count })
        .eq("id", existing.id);
      if (error) setError(error.message);
      else setSavedMsg("Changes saved. Your previous answers are kept in your edit history.");
    } else {
      const { data, error } = await supabase
        .from("checkins")
        .insert({ profile_id: userId, kind, day: today, answers: clean, creative_count: count, on_time: isOnTimeNow() })
        .select("id")
        .single();
      if (error) setError(error.code === "23505" ? "You already submitted this check-in today." : error.message);
      else {
        await supabase.from("activity_events").insert({
          actor_id: userId,
          action: `submitted their ${kind === "morning" ? "morning" : "end-of-day"} check-in`,
          subject_type: "checkin",
          subject_id: data.id,
          link: "/team-checkins",
        });
        setSavedMsg("Check-in submitted. Thanks!");
      }
    }
    setSaving(false);
    await onSaved();
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        {existing && (
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
            <Badge label={existing.on_time ? "Completed" : "Late"} />
            <span className="text-stone-500">
              Submitted {formatTime(existing.submitted_at, tz)}
              {existing.updated_at && " · edited"}
            </span>
            <span className="text-stone-500">You can still edit your answers.</span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          {questions.map((q, i) => (
            <div key={q.id}>
              <label htmlFor={q.id} className="block text-sm font-medium mb-1">
                {i + 1}. {q.label} {q.required && <span className="text-brand">*</span>}
              </label>
              {q.hint && <p className="text-xs text-stone-500 mb-1">{q.hint}</p>}
              {q.type === "text" && (
                <textarea
                  id={q.id}
                  rows={3}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              )}
              {q.type === "number" && (
                <input
                  id={q.id}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                  className="w-32 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              )}
              {q.type === "yesno" && (
                <div className="flex gap-2" id={q.id}>
                  {["yes", "no"].map((v) => (
                    <button
                      type="button"
                      key={v}
                      data-answer={v}
                      onClick={() => set(q.id, v)}
                      className={`rounded-xl border px-4 py-2 text-sm ${
                        answers[q.id] === v ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 bg-white"
                      }`}
                    >
                      {v === "yes" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {savedMsg && <p className="text-sm text-emerald-700">{savedMsg}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : existing ? "Save changes" : "Submit Check-In"}
          </button>
        </form>
      </Card>

      {kind === "evening" && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-medium mb-1">Planned vs. done</h3>
            <p className="text-xs text-stone-500 mb-3">Self-reported from your two check-ins — not verified ClickUp data.</p>
            {comparison ? (
              <>
                <p className="text-lg font-semibold">{comparison.text}</p>
                {comparison.pct != null && (
                  <div className="h-2 rounded-full bg-stone-100 mt-2 overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${Math.min(comparison.pct, 100)}%` }} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-500">
                {morning ? "Enter how many you completed to see the comparison." : "No morning check-in today to compare against."}
              </p>
            )}
          </Card>
          {morning && (
            <Card>
              <h3 className="font-medium mb-3">This morning you planned</h3>
              <CheckinAnswers checkin={morning} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function History({
  history,
  today,
  tz,
  deadlines,
  workingDays,
}: {
  history: Checkin[];
  today: string;
  tz: string;
  deadlines: { morning: string; evening: string };
  workingDays: number[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const days = [...new Set(history.map((c) => c.day))].sort().reverse();

  if (days.length === 0) return <p className="text-sm text-stone-500">No check-ins yet.</p>;

  return (
    <Card className="!p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-stone-500 border-b border-stone-200">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Morning</th>
            <th className="p-3">End of Day</th>
            <th className="p-3">Planned vs. done</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const m = history.find((c) => c.day === day && c.kind === "morning");
            const ev = history.find((c) => c.day === day && c.kind === "evening");
            const cell = (c: Checkin | undefined, k: CheckinKind) => {
              const s = checkinStatus({ checkin: c, kind: k, day, tz, deadlines, workingDays, dayOff: false });
              return (
                <span className="flex items-center gap-2">
                  <Badge label={STATUS_LABEL[s]} />
                  {c && <span className="text-stone-500">{formatTime(c.submitted_at, tz)}</span>}
                </span>
              );
            };
            const cmp = plannedVsActual(m?.creative_count, ev?.creative_count);
            return (
              <ExpandableRow key={day} open={open === day} onToggle={() => setOpen(open === day ? null : day)} colSpan={4} detail={
                <div className="grid md:grid-cols-2 gap-6">
                  {m && <div><p className="font-medium mb-2">Morning</p><CheckinAnswers checkin={m} /></div>}
                  {ev && <div><p className="font-medium mb-2">End of Day</p><CheckinAnswers checkin={ev} /></div>}
                </div>
              }>
                <td className="p-3 whitespace-nowrap">{day === today ? "Today" : formatDay(day)}</td>
                <td className="p-3">{cell(m, "morning")}</td>
                <td className="p-3">{cell(ev, "evening")}</td>
                <td className="p-3 text-stone-600">{cmp ? cmp.text : "—"}</td>
              </ExpandableRow>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

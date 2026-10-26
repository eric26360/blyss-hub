import { QUESTIONS, type Checkin } from "@/lib/checkins";

// Read-only list of a check-in's questions and answers.
export function CheckinAnswers({ checkin }: { checkin: Checkin }) {
  return (
    <dl className="space-y-3">
      {QUESTIONS[checkin.kind].map((q) => {
        const raw = checkin.answers[q.id];
        const value = q.type === "yesno" ? (raw === "yes" ? "Yes" : raw === "no" ? "No" : "") : raw;
        return (
          <div key={q.id}>
            <dt className="text-xs font-medium text-stone-500">{q.label}</dt>
            <dd className="text-sm whitespace-pre-wrap break-words">{value || <span className="text-stone-400">—</span>}</dd>
          </div>
        );
      })}
    </dl>
  );
}

"use client";

import { useState } from "react";
import { Card, Guard, PageHeader } from "@/components/Guard";
import { CREATIVES } from "@/lib/mock-data";

// Mock result. Later, AI watches the real video and fills this in.
const SAMPLE = {
  score: 82,
  hook: "Opens on a close-up of the product with the text \"I wish I found this sooner\" in the first 1.2s. Strong pattern interrupt.",
  pacing: "Avg cut every 1.8s. Slows down 0:14–0:19, so consider trimming.",
  onScreenText: ["I wish I found this sooner", "3 weeks later…", "Link in bio"],
  suggestions: [
    "Test a version with the result shot moved to the first 3s",
    "Add captions — 40% of the voiceover has no text on screen",
    "CTA appears at 0:26; try moving it to 0:20",
  ],
};

export default function AnalyzePage() {
  const videos = CREATIVES.filter((c) => c.type === "Video");
  const [pick, setPick] = useState(videos[0].id);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const run = () => {
    setState("loading");
    setTimeout(() => setState("done"), 1200);
  };

  return (
    <Guard page="analyze">
      <PageHeader title="Video Analysis" subtitle="AI breakdown of hook, pacing, and text. Demo results for now." />
      <Card className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <select
          value={pick}
          onChange={(e) => {
            setPick(e.target.value);
            setState("idle");
          }}
          className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white"
        >
          {videos.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <button onClick={run} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-medium">
          {state === "loading" ? "Analyzing…" : "Analyze video"}
        </button>
      </Card>

      {state === "done" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="text-center">
            <p className="text-xs text-stone-500">Creative score</p>
            <p className="text-5xl font-semibold text-brand mt-2">{SAMPLE.score}</p>
            <p className="text-xs text-stone-500 mt-1">vs. your top performers</p>
          </Card>
          <Card className="lg:col-span-2 space-y-3">
            <div>
              <h3 className="text-sm font-medium">Hook (first 3s)</h3>
              <p className="text-sm text-stone-600">{SAMPLE.hook}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Pacing</h3>
              <p className="text-sm text-stone-600">{SAMPLE.pacing}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">On-screen text</h3>
              <p className="text-sm text-stone-600">{SAMPLE.onScreenText.join(" · ")}</p>
            </div>
          </Card>
          <Card className="lg:col-span-3">
            <h3 className="text-sm font-medium mb-2">Suggestions</h3>
            <ul className="list-disc pl-5 text-sm text-stone-600 space-y-1">
              {SAMPLE.suggestions.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </Card>
        </div>
      )}
    </Guard>
  );
}

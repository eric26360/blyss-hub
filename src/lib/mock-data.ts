// Fake data for the mockup pages. Later this gets replaced by
// Northbeam (ads), ClickUp (tasks), and Air (creatives).

export type Platform = "Meta" | "Google" | "YouTube" | "AppLovin" | "Snapchat";

export type Creative = {
  id: string;
  name: string;
  type: "Video" | "Image";
  format: string;
  status: "Live" | "In Review" | "Draft" | "Paused";
  tags: string[];
  creator: string;
  color: string;
  roas: number | null;
  hookRate: number | null;
};

export const CREATIVES: Creative[] = [
  { id: "c1", name: "Morning Routine UGC", type: "Video", format: "9:16 · 0:28", status: "Live", tags: ["UGC", "Routine"], creator: "Sam", color: "from-orange-300 to-rose-400", roas: 3.4, hookRate: 41 },
  { id: "c2", name: "Founder Story", type: "Video", format: "4:5 · 0:45", status: "Live", tags: ["Founder", "Brand"], creator: "Sam", color: "from-amber-200 to-orange-400", roas: 2.8, hookRate: 35 },
  { id: "c3", name: "Before / After Static", type: "Image", format: "1:1", status: "Live", tags: ["Static", "Results"], creator: "Alex", color: "from-sky-200 to-indigo-400", roas: 2.1, hookRate: null },
  { id: "c4", name: "Unboxing ASMR", type: "Video", format: "9:16 · 0:19", status: "In Review", tags: ["UGC", "ASMR"], creator: "Sam", color: "from-emerald-200 to-teal-400", roas: null, hookRate: null },
  { id: "c5", name: "Reviews Carousel", type: "Image", format: "4:5", status: "Live", tags: ["Social Proof"], creator: "Alex", color: "from-fuchsia-200 to-purple-400", roas: 1.9, hookRate: null },
  { id: "c6", name: "3 Reasons Why", type: "Video", format: "9:16 · 0:32", status: "Paused", tags: ["Listicle"], creator: "Sam", color: "from-yellow-200 to-lime-400", roas: 0.9, hookRate: 22 },
  { id: "c7", name: "Holiday Gift Guide", type: "Video", format: "16:9 · 0:30", status: "Draft", tags: ["Seasonal"], creator: "Alex", color: "from-red-200 to-red-400", roas: null, hookRate: null },
  { id: "c8", name: "Creator Duet", type: "Video", format: "9:16 · 0:24", status: "Live", tags: ["UGC", "Creator"], creator: "Sam", color: "from-cyan-200 to-blue-400", roas: 3.9, hookRate: 47 },
];

export type Ad = {
  id: string;
  name: string;
  platform: Platform;
  creativeId: string;
  spend: number;
  revenue: number;
  cpa: number;
  ctr: number;
  status: "Active" | "Paused";
};

export const ADS: Ad[] = [
  { id: "a1", name: "Prospecting | Morning UGC", platform: "Meta", creativeId: "c1", spend: 12400, revenue: 42160, cpa: 28.4, ctr: 1.9, status: "Active" },
  { id: "a2", name: "Shorts | Creator Duet", platform: "YouTube", creativeId: "c8", spend: 8200, revenue: 31980, cpa: 24.1, ctr: 2.3, status: "Active" },
  { id: "a3", name: "Retargeting | Founder", platform: "Meta", creativeId: "c2", spend: 6100, revenue: 17080, cpa: 31.7, ctr: 1.4, status: "Active" },
  { id: "a4", name: "PMax | Before/After", platform: "Google", creativeId: "c3", spend: 9800, revenue: 20580, cpa: 35.2, ctr: 1.1, status: "Active" },
  { id: "a5", name: "Story | Reviews", platform: "Snapchat", creativeId: "c5", spend: 3400, revenue: 6460, cpa: 41.0, ctr: 0.8, status: "Active" },
  { id: "a6", name: "App Install | Morning UGC", platform: "AppLovin", creativeId: "c1", spend: 4700, revenue: 13630, cpa: 29.9, ctr: 1.6, status: "Active" },
  { id: "a7", name: "Prospecting | 3 Reasons", platform: "Meta", creativeId: "c6", spend: 2900, revenue: 2610, cpa: 62.3, ctr: 0.7, status: "Paused" },
];

export type Task = {
  id: string;
  title: string;
  assignee: string;
  status: "To Do" | "In Progress" | "Review" | "Done";
  due: string;
  creativeId?: string;
};

export const TASKS: Task[] = [
  { id: "t1", title: "Edit Unboxing ASMR v2", assignee: "Sam", status: "Review", due: "Oct 24", creativeId: "c4" },
  { id: "t2", title: "Write Holiday Gift Guide script", assignee: "Alex", status: "In Progress", due: "Oct 25", creativeId: "c7" },
  { id: "t3", title: "Brief 5 new UGC creators", assignee: "Jordan", status: "To Do", due: "Oct 28" },
  { id: "t4", title: "Iterate hook on 3 Reasons Why", assignee: "Sam", status: "To Do", due: "Oct 27", creativeId: "c6" },
  { id: "t5", title: "Launch Creator Duet on TikTok", assignee: "Jordan", status: "In Progress", due: "Oct 23", creativeId: "c8" },
  { id: "t6", title: "Q4 creative strategy doc", assignee: "Eric", status: "Done", due: "Oct 20" },
];

export function creativeById(id: string) {
  return CREATIVES.find((c) => c.id === id);
}

// UGC creators, ratings and budgets: types, labels and budget math.
// Mirrors supabase/migrations/0003_ugc.sql.

export type CreatorStatus =
  | "prospect"
  | "contacted"
  | "negotiating"
  | "active"
  | "awaiting_content"
  | "completed"
  | "previously_worked_with"
  | "do_not_work_with";

export const CREATOR_STATUSES: CreatorStatus[] = [
  "prospect",
  "contacted",
  "negotiating",
  "active",
  "awaiting_content",
  "completed",
  "previously_worked_with",
  "do_not_work_with",
];

export const CREATOR_STATUS_LABEL: Record<CreatorStatus, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  negotiating: "Negotiating",
  active: "Active",
  awaiting_content: "Awaiting Content",
  completed: "Completed",
  previously_worked_with: "Previously Worked With",
  do_not_work_with: "Do Not Work With",
};

export type Creator = {
  id: string;
  full_name: string;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  other_socials: string | null;
  country: string | null;
  location: string | null;
  standard_rate: number | null;
  negotiated_rate: number | null;
  package_rate: number | null;
  package_details: string | null;
  whitelisting_rate: number | null;
  usage_rights: string | null;
  assigned_strategist_id: string | null;
  assigned_ugc_manager_id: string | null;
  status: CreatorStatus;
  internal_notes: string | null;
  is_top: boolean;
  top_reason: string | null;
  created_at: string;
};

export type CreatorStats = {
  creator_id: string;
  total_paid: number;
  total_committed: number;
  videos_ordered: number;
  videos_delivered: number;
  collaborations: number;
  avg_rating: number | null;
  rating_count: number;
};

export const RATING_CRITERIA = [
  { id: "video_quality", label: "Video quality" },
  { id: "on_camera", label: "On-camera delivery" },
  { id: "reliability", label: "Reliability" },
  { id: "communication", label: "Communication" },
  { id: "pricing", label: "Pricing" },
  { id: "creative_performance", label: "Creative performance" },
] as const;

export type RatingKey = (typeof RATING_CRITERIA)[number]["id"];

export type Rating = { creator_id: string; rater_id: string; updated_at: string } & Record<RatingKey, number | null>;

export type ExpenseStatus = "committed" | "paid" | "cancelled";
export type Approval = "not_needed" | "pending" | "approved" | "rejected";

export type Expense = {
  id: string;
  creator_id: string;
  strategist_id: string;
  ugc_manager_id: string | null;
  project: string;
  video_count: number;
  videos_delivered: number;
  amount: number;
  status: ExpenseStatus;
  approval: Approval;
  expense_date: string;
  budget_month: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export const EXPENSE_LABEL: Record<ExpenseStatus, string> = {
  committed: "Committed",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const APPROVAL_LABEL: Record<Approval, string | null> = {
  not_needed: null,
  pending: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export type BudgetSummary = {
  strategist_id: string;
  month: string;
  budget: number;
  paid: number;
  committed: number;
  awaiting_approval: number;
  available: number;
};

/** Counts against the budget: committed or paid, and not waiting on / refused by an owner. */
export function expenseCounts(e: Pick<Expense, "status" | "approval">) {
  return e.status !== "cancelled" && (e.approval === "not_needed" || e.approval === "approved");
}

export function emptySummary(strategistId: string, month: string): BudgetSummary {
  return { strategist_id: strategistId, month, budget: 0, paid: 0, committed: 0, awaiting_approval: 0, available: 0 };
}

/** "2026-10" → "2026-10-01" (the database stores the first of the month). */
export const monthStart = (ym: string) => `${ym}-01`;

export function currentMonth(tz = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date());
}

export function monthLabel(ym: string) {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
}

export const money2 = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** Social handle or URL → a link. "@jane" on TikTok → https://www.tiktok.com/@jane */
export function socialUrl(kind: "instagram" | "tiktok", value: string) {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  return kind === "instagram" ? `https://www.instagram.com/${handle}` : `https://www.tiktok.com/@${handle}`;
}

export const ugcStatusColor: Record<CreatorStatus, string> = {
  prospect: "bg-stone-100 text-stone-600",
  contacted: "bg-sky-100 text-sky-700",
  negotiating: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  awaiting_content: "bg-yellow-50 text-yellow-700",
  completed: "bg-indigo-100 text-indigo-700",
  previously_worked_with: "bg-stone-100 text-stone-500",
  do_not_work_with: "bg-rose-100 text-rose-700",
};

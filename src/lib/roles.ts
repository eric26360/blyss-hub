// Who can see which page. Edit this table to change access.
// Role names match the user_role type in the database.

export type Role = "owner" | "strategist" | "ugc_manager" | "video_editor";

export type PageKey =
  | "overview"
  | "checkin"
  | "team_checkins"
  | "weekly_plan"
  | "team_weekly_plans"
  | "owner_calendar"
  | "ugc_performance"
  | "ugc_seeding"
  | "ugc_leaderboard"
  | "ugc_trybe"
  | "creators"
  | "budgets"
  | "top_creatives"
  | "tasks"
  | "team";

export type NavGroup = "ugc";

export const NAV_GROUPS: Record<NavGroup, string> = { ugc: "UGC" };

export const PAGES: { key: PageKey; label: string; href: string; group?: NavGroup }[] = [
  { key: "overview", label: "Overview", href: "/" },
  { key: "checkin", label: "Check-In", href: "/checkin" },
  { key: "team_checkins", label: "Team Check-Ins", href: "/team-checkins" },
  { key: "weekly_plan", label: "Weekly Plan", href: "/weekly-plan" },
  { key: "team_weekly_plans", label: "Team Weekly Plans", href: "/team-weekly-plans" },
  { key: "owner_calendar", label: "Owner Calendar", href: "/owner-calendar" },
  { key: "top_creatives", label: "Top Creatives", href: "/top-creatives" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "ugc_performance", label: "Creator Performance", href: "/ugc", group: "ugc" },
  { key: "ugc_seeding", label: "Product Seeding", href: "/ugc/seeding", group: "ugc" },
  { key: "ugc_leaderboard", label: "Creator Leaderboard", href: "/ugc/leaderboard", group: "ugc" },
  { key: "ugc_trybe", label: "Trybe Creators", href: "/ugc/trybe", group: "ugc" },
  { key: "creators", label: "Creator Directory", href: "/creators", group: "ugc" },
  { key: "budgets", label: "UGC Budgets", href: "/budgets", group: "ugc" },
  { key: "team", label: "Team & Access", href: "/team" },
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  strategist: "Creative Strategist",
  ugc_manager: "UGC Manager",
  video_editor: "Video Editor",
};

// "checkin" and "weekly_plan" aren't listed here: they depend on the person's
// requires_checkins / requires_weekly_plan settings rather than their role (see canAccess).
export const ROLE_ACCESS: Record<Role, PageKey[]> = {
  owner: ["overview", "team_checkins", "team_weekly_plans", "owner_calendar", "top_creatives", "tasks", "ugc_performance", "ugc_seeding", "ugc_leaderboard", "ugc_trybe", "creators", "budgets", "team"],
  strategist: ["overview", "top_creatives", "tasks", "ugc_performance", "ugc_seeding", "ugc_leaderboard", "ugc_trybe", "creators", "budgets"],
  ugc_manager: ["overview", "tasks", "ugc_performance", "ugc_seeding", "ugc_leaderboard", "ugc_trybe", "creators", "budgets"],
  video_editor: ["overview", "tasks"],
};

export function canAccess(user: { role: Role; requiresCheckins: boolean; requiresWeeklyPlan?: boolean }, page: PageKey) {
  if (page === "checkin") return user.requiresCheckins;
  if (page === "weekly_plan") return !!user.requiresWeeklyPlan;
  return ROLE_ACCESS[user.role].includes(page);
}

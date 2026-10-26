// Who can see which page. Edit this table to change access.
// Role names match the user_role type in the database.

export type Role = "owner" | "strategist" | "ugc_manager" | "video_editor";

export type PageKey =
  | "overview"
  | "checkin"
  | "team_checkins"
  | "creatives"
  | "ads"
  | "tasks"
  | "analyze"
  | "team";

export const PAGES: { key: PageKey; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/" },
  { key: "checkin", label: "Check-In", href: "/checkin" },
  { key: "team_checkins", label: "Team Check-Ins", href: "/team-checkins" },
  { key: "creatives", label: "Creatives", href: "/creatives" },
  { key: "ads", label: "Ads", href: "/ads" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "analyze", label: "Video Analysis", href: "/analyze" },
  { key: "team", label: "Team & Access", href: "/team" },
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  strategist: "Creative Strategist",
  ugc_manager: "UGC Manager",
  video_editor: "Video Editor",
};

// "checkin" isn't listed here: it depends on the person's requires_checkins
// setting rather than their role (see canAccess).
export const ROLE_ACCESS: Record<Role, PageKey[]> = {
  owner: ["overview", "team_checkins", "creatives", "ads", "tasks", "analyze", "team"],
  strategist: ["overview", "creatives", "ads", "tasks", "analyze"],
  ugc_manager: ["overview", "creatives", "tasks"],
  video_editor: ["overview", "creatives", "tasks", "analyze"],
};

export function canAccess(user: { role: Role; requiresCheckins: boolean }, page: PageKey) {
  if (page === "checkin") return user.requiresCheckins;
  return ROLE_ACCESS[user.role].includes(page);
}

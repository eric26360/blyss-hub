// Who can see which page. Edit this table to change access.
// Role names match the user_role type in the database.

export type Role = "owner" | "strategist" | "ugc_manager" | "video_editor";

export type PageKey = "overview" | "creatives" | "ads" | "tasks" | "analyze" | "team";

export const PAGES: { key: PageKey; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/" },
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

export const ROLE_ACCESS: Record<Role, PageKey[]> = {
  owner: ["overview", "creatives", "ads", "tasks", "analyze", "team"],
  strategist: ["overview", "creatives", "ads", "tasks", "analyze"],
  ugc_manager: ["overview", "creatives", "tasks"],
  video_editor: ["overview", "creatives", "tasks", "analyze"],
};

export function canAccess(role: Role, page: PageKey) {
  return ROLE_ACCESS[role].includes(page);
}

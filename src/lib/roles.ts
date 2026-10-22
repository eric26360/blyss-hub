// Who can see which page. Edit this table to change access.

export type Role = "admin" | "media_buyer" | "editor" | "viewer";

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
  admin: "Admin",
  media_buyer: "Media Buyer",
  editor: "Editor / Creator",
  viewer: "Viewer",
};

export const ROLE_ACCESS: Record<Role, PageKey[]> = {
  admin: ["overview", "creatives", "ads", "tasks", "analyze", "team"],
  media_buyer: ["overview", "creatives", "ads", "analyze"],
  editor: ["overview", "creatives", "tasks", "analyze"],
  viewer: ["overview", "ads"],
};

export function canAccess(role: Role, page: PageKey) {
  return ROLE_ACCESS[role].includes(page);
}

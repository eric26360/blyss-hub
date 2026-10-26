import { CREATOR_STATUS_LABEL, ugcStatusColor, type Creator } from "@/lib/ugc";

export function StatusBadge({ status }: { status: Creator["status"] }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ugcStatusColor[status]}`}>
      {CREATOR_STATUS_LABEL[status]}
    </span>
  );
}

export function Avatar({ creator, size = 8 }: { creator: Pick<Creator, "full_name" | "photo_url">; size?: 8 | 16 }) {
  const cls = size === 8 ? "h-8 w-8 text-xs" : "h-16 w-16 text-xl";
  if (creator.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={creator.photo_url} alt="" className={`${cls} rounded-full object-cover shrink-0`} />;
  }
  const initials = creator.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`${cls} rounded-full bg-orange-100 text-brand font-semibold flex items-center justify-center shrink-0`}>{initials}</span>;
}

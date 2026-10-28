// UGC creator performance: rolls ad totals up to one row per creator, applies
// whitelisted / paid overrides, and matches ad-name handles to the creator
// directory. Ads come from creative-performance.ts; seeding from seeding_sends.

import type { AdType, CreativeTotals } from "./creative-performance";
import type { Creator } from "./ugc";

export type AdClassification = { ad_name: string; ad_type: AdType };

export type CreatorRollup = {
  handle: string; // normalized, no @
  ads: CreativeTotals[];
  adCount: number;
  spend: number;
  revenue: number;
  orders: number;
  avgSpend: number;
  cpa: number | null;
  roas: number | null;
  ncPct: number | null;
  newVisitorPct: number | null;
  ctr: number | null;
  cpm: number | null;
  hookRate?: number | null;
  winners: number;
};

/** "@Jane_Doe", "jane_doe", "https://www.instagram.com/jane_doe/" → "jane_doe". */
export function normalizeHandle(value: string | null | undefined) {
  if (!value) return "";
  let v = value.trim();
  if (/^https?:\/\//i.test(v)) {
    try {
      const parts = new URL(v).pathname.split("/").filter(Boolean);
      v = parts[0] ?? "";
    } catch {
      return "";
    }
  }
  return v.replace(/^@/, "").toLowerCase();
}

/** Directory creators keyed by every handle they're known by (Instagram and TikTok). */
export function creatorsByHandle<C extends Pick<Creator, "instagram" | "tiktok">>(creators: C[]) {
  const map = new Map<string, C>();
  for (const c of creators) {
    for (const h of [normalizeHandle(c.instagram), normalizeHandle(c.tiktok)]) {
      if (h && !map.has(h)) map.set(h, c);
    }
  }
  return map;
}

/** A saved whitelisted/paid choice beats the data source's default. */
export function applyAdTypes(totals: CreativeTotals[], overrides: Map<string, AdType>): CreativeTotals[] {
  return totals.map((t) => (overrides.has(t.adName) ? { ...t, adType: overrides.get(t.adName)! } : t));
}

/** One row per creator handle. Ads without a creator in the name are skipped. */
export function rollupByCreator(totals: CreativeTotals[], winners: Set<string>): CreatorRollup[] {
  const byCreator = new Map<string, CreativeTotals[]>();
  for (const t of totals) {
    const h = normalizeHandle(t.creator);
    if (!h) continue;
    byCreator.set(h, [...(byCreator.get(h) ?? []), t]);
  }

  return [...byCreator.entries()].map(([handle, ads]) => {
    const sum = (k: "spend" | "revenue" | "orders" | "newCustomerOrders" | "visits" | "newVisits" | "impressions" | "clicks") =>
      ads.reduce((s, a) => s + a[k], 0);
    const spend = sum("spend");
    const revenue = sum("revenue");
    const orders = sum("orders");
    const visits = sum("visits");
    const impressions = sum("impressions");
    const hookAds = ads.filter((a) => a.hookRate !== undefined);
    const hookImpressions = hookAds.reduce((s, a) => s + a.impressions, 0);
    return {
      handle,
      ads,
      adCount: ads.length,
      spend,
      revenue,
      orders,
      avgSpend: ads.length ? spend / ads.length : 0,
      cpa: orders ? spend / orders : null,
      roas: spend ? revenue / spend : null,
      ncPct: orders ? (sum("newCustomerOrders") / orders) * 100 : null,
      newVisitorPct: visits ? (sum("newVisits") / visits) * 100 : null,
      ctr: impressions ? (sum("clicks") / impressions) * 100 : null,
      cpm: impressions ? (spend / impressions) * 1000 : null,
      // Impression-weighted, and only when the source gives hook views.
      ...(hookAds.length
        ? {
            hookRate: hookImpressions
              ? hookAds.reduce((s, a) => s + (a.hookRate ?? 0) * a.impressions, 0) / hookImpressions
              : null,
          }
        : {}),
      winners: ads.filter((a) => winners.has(a.adName)).length,
    };
  });
}

// ───────────── Product seeding ─────────────

export type SeedingStatus = "shipped" | "delivered" | "posted" | "no_post";

export const SEEDING_STATUSES: SeedingStatus[] = ["shipped", "delivered", "posted", "no_post"];

export const SEEDING_STATUS_LABEL: Record<SeedingStatus, string> = {
  shipped: "Shipped",
  delivered: "Delivered",
  posted: "Posted",
  no_post: "No Post",
};

export const seedingStatusColor: Record<SeedingStatus, string> = {
  shipped: "bg-sky-100 text-sky-700",
  delivered: "bg-amber-100 text-amber-700",
  posted: "bg-emerald-100 text-emerald-700",
  no_post: "bg-rose-100 text-rose-700",
};

export type SeedingSend = {
  id: string;
  creator_id: string | null;
  creator_handle: string | null;
  product: string;
  scent: string | null;
  quantity: number;
  product_cost: number;
  shipping_cost: number;
  shipped_on: string;
  status: SeedingStatus;
  post_url: string | null;
  posted_on: string | null;
  platform: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  discount_code: string | null;
  code_orders: number | null;
  code_revenue: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type SeedingRollup = {
  key: string; // creator id, or "@handle" for creators not in the directory
  creatorId: string | null;
  handle: string;
  sends: number;
  posts: number;
  views: number;
  codeOrders: number;
  codeRevenue: number;
  cost: number;
};

export const sendCost = (s: Pick<SeedingSend, "product_cost" | "shipping_cost">) =>
  Number(s.product_cost) + Number(s.shipping_cost);

export function rollupSeeding(sends: SeedingSend[]): SeedingRollup[] {
  const map = new Map<string, SeedingRollup>();
  for (const s of sends) {
    const handle = normalizeHandle(s.creator_handle);
    const key = s.creator_id ?? "@" + handle;
    const r = map.get(key) ?? { key, creatorId: s.creator_id, handle, sends: 0, posts: 0, views: 0, codeOrders: 0, codeRevenue: 0, cost: 0 };
    r.sends += 1;
    if (s.status === "posted") r.posts += 1;
    r.views += s.views ?? 0;
    r.codeOrders += s.code_orders ?? 0;
    r.codeRevenue += Number(s.code_revenue ?? 0);
    r.cost += sendCost(s);
    map.set(key, r);
  }
  return [...map.values()];
}

/** True when the error means a table or column from a newer database file isn't there yet. */
export function needsMigration(error: { code?: string } | null | undefined) {
  return !!error && ["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code ?? "");
}

export const pct = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1) + "%");
export const ratio = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2) + "x");
export const compact = (n: number) => n.toLocaleString("en-US", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 });

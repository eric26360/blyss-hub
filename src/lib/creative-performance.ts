// Creative (ad) performance for Top Creatives, UGC Creator Performance and Overview.
// Rows are per ad per day so any date range (day / week / month / custom)
// is just a sum. fetchCreativeDays currently returns SAMPLE data; it gets
// swapped for Northbeam once that's connected — the rest stays the same.

import { parseAdName } from "./ad-naming";
import { addDays } from "./checkins";
import { isWinner } from "./winning";

export type AdType = "whitelisted" | "paid";

export type CreativeDay = {
  adName: string;
  launchDate: string; // YYYY-MM-DD, the day the ad was posted
  // Default guess; an owner or UGC manager can override it (ad_classifications table).
  adType: AdType;
  date: string; // YYYY-MM-DD
  spend: number;
  revenue: number;
  orders: number;
  newCustomerOrders: number; // orders from first-time customers
  visits: number;
  newVisits: number; // visits from first-time visitors
  impressions: number;
  clicks: number;
  // 3-second video views. Only filled in if the data source provides it.
  hookViews?: number;
};

export type CreativeTotals = {
  adName: string;
  launchDate: string;
  strategist?: string;
  creator?: string;
  spend: number;
  revenue: number;
  orders: number;
  newCustomerOrders: number;
  roas: number;
  cpa: number | null; // cost per order
  cac: number | null; // cost per new customer
  ncPct: number | null; // % of orders from new customers
  newVisitorPct: number | null; // % of visits from new visitors
  adType: AdType;
  visits: number;
  newVisits: number;
  impressions: number;
  clicks: number;
  ctr: number | null; // %
  cpm: number | null;
  hookRate?: number | null; // %, only when the source provides hook views
};

export const DATA_IS_SAMPLE = true;

/** Per-ad, per-day rows between `from` and `to` (inclusive). */
export async function fetchCreativeDays(from: string, to: string): Promise<CreativeDay[]> {
  return sampleDays().filter((d) => d.date >= from && d.date <= to);
}

/** Sum per-day rows into one row per ad. */
export function totalsByCreative(days: CreativeDay[]): CreativeTotals[] {
  const byAd = new Map<string, CreativeDay[]>();
  for (const d of days) byAd.set(d.adName, [...(byAd.get(d.adName) ?? []), d]);

  return [...byAd.entries()].map(([adName, rows]) => {
    const sum = (k: keyof CreativeDay) => rows.reduce((s, r) => s + (r[k] as number), 0);
    const spend = sum("spend");
    const revenue = sum("revenue");
    const orders = sum("orders");
    const newCustomerOrders = sum("newCustomerOrders");
    const visits = sum("visits");
    const newVisits = sum("newVisits");
    const impressions = sum("impressions");
    const clicks = sum("clicks");
    const hasHook = rows.some((r) => r.hookViews !== undefined);
    const parsed = parseAdName(adName);
    return {
      adName,
      launchDate: rows[0].launchDate,
      strategist: parsed.strategist,
      creator: parsed.creator,
      spend,
      revenue,
      orders,
      newCustomerOrders,
      roas: spend ? revenue / spend : 0,
      cpa: orders ? spend / orders : null,
      cac: newCustomerOrders ? spend / newCustomerOrders : null,
      ncPct: orders ? (newCustomerOrders / orders) * 100 : null,
      newVisitorPct: visits ? (newVisits / visits) * 100 : null,
      adType: rows[0].adType,
      visits,
      newVisits,
      impressions,
      clicks,
      ctr: impressions ? (clicks / impressions) * 100 : null,
      cpm: impressions ? (spend / impressions) * 1000 : null,
      ...(hasHook ? { hookRate: impressions ? (rows.reduce((t, r) => t + (r.hookViews ?? 0), 0) / impressions) * 100 : null } : {}),
    };
  });
}

/** Winner check on a creative's totals, using the owner's winning rules. */
export function isWinningCreative(t: CreativeTotals) {
  if (t.cac === null || t.newVisitorPct === null) return false;
  return isWinner({ spend: t.spend, cac: t.cac, newVisitorPct: t.newVisitorPct });
}

// ───────────── Sample data ─────────────

// Names follow the NEW NAMING convention (see src/lib/ad-naming.ts).
const SAMPLE_ADS: {
  name: string;
  type: AdType;
  daysAgo: number;
  dailySpend: number;
  roas: number;
  ncShare: number;
  newVisitShare: number;
  ctr: number; // %
}[] = [
  { name: "C5436-1_V2_The Door Test_Mop Soap_Video_UGC_Comparison_Royalty_kristinp_Roman_Daria__PDP_EVG", type: "whitelisted", daysAgo: 62, dailySpend: 410, roas: 3.1, ncShare: 0.64, newVisitShare: 0.58, ctr: 1.9 },
  { name: "C5441_V1_Guest Ready In 5_Mop Soap_Video_UGC_Life Hack_Heartbreaker_ayeitsashleyy_Alec_Daria__PDP_EVG", type: "whitelisted", daysAgo: 48, dailySpend: 360, roas: 2.7, ncShare: 0.59, newVisitShare: 0.55, ctr: 1.7 },
  { name: "C5452-2_V1_Safe For Paws_Mop Soap_Video_UGC_Non-Toxic_Baja_summerlynn_1_Roman_Sergei_DOJO_PDP_EVG", type: "paid", daysAgo: 40, dailySpend: 290, roas: 2.4, ncShare: 0.61, newVisitShare: 0.57, ctr: 1.4 },
  { name: "C5460_V3_Sticky Floors Gone_Mop Soap_Video_AI UGC_Problem / Solution_Brazilian Waves__Alec_Daria__PDP_SALE", type: "paid", daysAgo: 33, dailySpend: 240, roas: 2.2, ncShare: 0.52, newVisitShare: 0.49, ctr: 1.1 },
  { name: "C5467-1_V1_Hotel Lobby Smell_Mist Spray_Video_UGC_Comparison_Royalty_elyse_miller_Roman_Daria_BNGR_PDP_EVG", type: "whitelisted", daysAgo: 28, dailySpend: 330, roas: 2.9, ncShare: 0.48, newVisitShare: 0.46, ctr: 1.6 },
  { name: "C5471_V2_Mop Swap Hack_Mop Head Replacement_Video_UGC_Life Hack_Baja_kristinp_Alec_Sergei__PLP_EVG", type: "paid", daysAgo: 25, dailySpend: 120, roas: 1.6, ncShare: 0.55, newVisitShare: 0.53, ctr: 0.9 },
  { name: "C5478_V1_Scent Lineup_Mop Soap_Static_Mashup_Comparison_Heartbreaker__Roman_Daria__PLP_SALE", type: "paid", daysAgo: 21, dailySpend: 180, roas: 2.0, ncShare: 0.44, newVisitShare: 0.42, ctr: 1.0 },
  { name: "C5480-3_V1_Kids And Pets_Mop Soap_Video_UGC_Non-Toxic_Royalty_summerlynn_1_Alec_Daria_DOJO_PDP_EVG", type: "whitelisted", daysAgo: 18, dailySpend: 450, roas: 2.6, ncShare: 0.62, newVisitShare: 0.6, ctr: 1.8 },
  { name: "C5486_V2_Gift For Hosts_Mop Soap_Static_Mashup_Life Hack_Brazilian Waves__Roman_Sergei__HP_GIFTS", type: "paid", daysAgo: 12, dailySpend: 150, roas: 1.4, ncShare: 0.39, newVisitShare: 0.4, ctr: 0.8 },
  { name: "C5490_V1_Before Guests Arrive_Mist Spray_Video_UGC_Problem / Solution_Heartbreaker_ayeitsashleyy_Roman_Daria__PDP_EVG", type: "whitelisted", daysAgo: 9, dailySpend: 520, roas: 2.8, ncShare: 0.6, newVisitShare: 0.56, ctr: 2.0 },
  { name: "C5494-1_V1_Mop Test Week_Mop Soap_Video_AI UGC_Comparison_Baja__Alec_Daria_ADPROS_PDP_EVG", type: "paid", daysAgo: 6, dailySpend: 260, roas: 1.9, ncShare: 0.57, newVisitShare: 0.54, ctr: 1.2 },
  { name: "C5499_V2_Weekend Reset_Mop Soap_Video_UGC_Life Hack_Royalty_elyse_miller_Roman_Daria__PDP_SALE", type: "paid", daysAgo: 3, dailySpend: 300, roas: 2.3, ncShare: 0.5, newVisitShare: 0.51, ctr: 1.3 },
  { name: "C5502_V1_Smells Like A Spa_Mist Spray_Video_UGC_Comparison_Brazilian Waves_ayeitsashleyy_Alec_Daria__PDP_EVG", type: "paid", daysAgo: 36, dailySpend: 210, roas: 2.1, ncShare: 0.53, newVisitShare: 0.5, ctr: 1.2 },
  { name: "C5505-2_V1_Mop With Me_Mop Soap_Video_UGC_Life Hack_Heartbreaker_kristinp_Roman_Daria__PDP_EVG", type: "whitelisted", daysAgo: 15, dailySpend: 280, roas: 2.5, ncShare: 0.58, newVisitShare: 0.55, ctr: 1.5 },
  { name: "C5509_V2_First Clean Reaction_Mop Soap_Video_UGC_Comparison_Royalty_jess.homereset_Alec_Sergei__PDP_EVG", type: "whitelisted", daysAgo: 30, dailySpend: 190, roas: 1.8, ncShare: 0.47, newVisitShare: 0.45, ctr: 1.0 },
  { name: "C5512_V1_Grout Gone_Mop Soap_Video_UGC_Problem / Solution_Baja_jess.homereset_Roman_Daria_BNGR_PDP_SALE", type: "paid", daysAgo: 20, dailySpend: 140, roas: 1.5, ncShare: 0.5, newVisitShare: 0.48, ctr: 0.9 },
];

// Small deterministic random so the sample doesn't change on every page load.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

let cache: { today: string; rows: CreativeDay[] } | null = null;

function sampleDays(): CreativeDay[] {
  const today = new Date().toISOString().slice(0, 10);
  if (cache?.today === today) return cache.rows;

  const rows: CreativeDay[] = [];
  SAMPLE_ADS.forEach((ad, i) => {
    const rand = seeded(i + 1);
    const launchDate = addDays(today, -ad.daysAgo);
    for (let d = 0; d <= ad.daysAgo; d++) {
      const date = addDays(launchDate, d);
      // Spend ramps up over the first week, then wobbles ±30%.
      const ramp = Math.min(1, (d + 1) / 7);
      const spend = Math.round(ad.dailySpend * ramp * (0.7 + rand() * 0.6));
      const revenue = Math.round(spend * ad.roas * (0.8 + rand() * 0.4));
      const orders = Math.max(0, Math.round(revenue / 58));
      const newCustomerOrders = Math.round(orders * Math.min(1, ad.ncShare * (0.85 + rand() * 0.3)));
      const visits = Math.round(spend * 1.9);
      const newVisits = Math.round(visits * Math.min(1, ad.newVisitShare * (0.9 + rand() * 0.2)));
      // Roughly a $14–$22 CPM.
      const impressions = Math.round((spend / (14 + rand() * 8)) * 1000);
      const clicks = Math.round(impressions * (ad.ctr / 100) * (0.85 + rand() * 0.3));
      rows.push({
        adName: ad.name,
        launchDate,
        adType: ad.type,
        date,
        spend,
        revenue,
        orders,
        newCustomerOrders,
        visits,
        newVisits,
        impressions,
        clicks,
      });
    }
  });
  cache = { today, rows };
  return rows;
}

// What counts as a "winning ad". The owner will be able to edit these
// from the admin settings page; until then, change the numbers here.

export type WinningRules = {
  minSpend: number; // spend must be over this
  maxCac: number; // CAC must be below this
  minNewVisitorPct: number; // new visitor % must be above this
};

export const DEFAULT_WINNING_RULES: WinningRules = {
  minSpend: 10_000,
  maxCac: 70,
  minNewVisitorPct: 50,
};

export type AdStats = { spend: number; cac: number; newVisitorPct: number };

export function isWinner(ad: AdStats, rules: WinningRules = DEFAULT_WINNING_RULES) {
  return ad.spend > rules.minSpend && ad.cac < rules.maxCac && ad.newVisitorPct > rules.minNewVisitorPct;
}

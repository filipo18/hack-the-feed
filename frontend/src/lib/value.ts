import type { Creator, Mention } from "./types";

/**
 * Placeholder pricing. Tilen owns these numbers.
 * The result is what the same reach would cost to buy. It is not money owed.
 */
export const MARKET_CPM: Record<string, number> = {
  US: 15,
  UK: 13,
  CA: 12,
  AU: 12,
  DE: 11,
  FR: 10,
  ES: 8,
  Other: 8,
};

export function accountSizeFactor(followers: number): number {
  if (followers < 10_000) return 0.7;
  if (followers < 100_000) return 0.85;
  if (followers < 1_000_000) return 1;
  return 1.2;
}

/** Each past brand deal adds 10%, up to 30%. */
export function brandDealFactor(brandDeals: number): number {
  return 1 + Math.min(brandDeals, 3) * 0.1;
}

export function reachCost(views: number, creator: Creator): number {
  const cpm = MARKET_CPM[creator.market] ?? MARKET_CPM.Other;
  const factor = accountSizeFactor(creator.followers) * brandDealFactor(creator.brandDeals);
  return Math.round((views / 1000) * cpm * factor);
}

export function totalViews(mentions: Mention[]): number {
  return mentions.reduce((sum, mention) => sum + (mention.views ?? 0), 0);
}

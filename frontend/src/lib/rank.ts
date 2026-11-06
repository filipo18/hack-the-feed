import type { BrandResult, CreatorResult } from "./types";
import { reachCost, totalViews } from "./value";

export function rankCreators(result: BrandResult) {
  return result.creators
    .map((creator) => {
      const views = totalViews(creator.mentions);
      const top = [...creator.mentions].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
      return { ...creator, views, cost: reachCost(views, creator), top };
    })
    .sort((a, b) => b.views - a.views);
}

export function rankBrands(result: CreatorResult) {
  return result.brands
    .map((entry) => {
      const views = totalViews(entry.mentions);
      const top = [...entry.mentions].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
      return { ...entry, views, value: reachCost(views, result.creator), top };
    })
    .sort((a, b) => b.value - a.value);
}

export type RankedCreator = ReturnType<typeof rankCreators>[number];
export type RankedBrand = ReturnType<typeof rankBrands>[number];

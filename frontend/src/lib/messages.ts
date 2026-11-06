import { compact, money } from "./format";
import type { RankedBrand, RankedCreator } from "./rank";

export function brandOutreach(brand: string, creator: RankedCreator) {
  return {
    title: `Reach out to @${creator.handle}`,
    message: `Hi ${creator.handle},\n\nWe saw your video with ${brand}: ${creator.top.postUrl}\n\nIt has ${compact(creator.top.views ?? 0)} views, and we loved it. Since you're already showing ${brand}, would you like to do a paid collaboration?\n\nAre you open to a short call this week?`,
  };
}

export function creatorPitch(handle: string, entry: RankedBrand) {
  return {
    title: `Pitch ${entry.brand}`,
    message: `Hi ${entry.brand} team,\n\nI'm @${handle}. ${entry.brand} has appeared in ${entry.mentions.length} of my videos, with at least ${compact(entry.views)} views so far. Buying that reach would cost about ${money(entry.value)}.\n\nHere's the best one: ${entry.top.postUrl}\n\nI'd like to do this properly with you. Are you open to a short call this week?`,
  };
}

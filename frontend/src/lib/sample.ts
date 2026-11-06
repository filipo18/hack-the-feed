import type { BrandResult, Creator, CreatorResult, Mention } from "./types";

/** Synthetic rows only. This repo is public, so no real creator goes in here. */
const CREATORS: (Creator & { line: string; views: number[]; stamps: (string | null)[] })[] = [
  { handle: "sample.sofia", platform: "instagram", followers: 412_000, market: "US", brandDeals: 2, line: "I take my {brand} everywhere, honestly", views: [3_180_000, 942_000], stamps: ["0:14", "0:41"] },
  { handle: "sample.kenji", platform: "tiktok", followers: 1_240_000, market: "UK", brandDeals: 3, line: "okay this {brand} thing actually changed my mornings", views: [2_460_000], stamps: ["0:06"] },
  { handle: "sample.amara", platform: "instagram", followers: 88_000, market: "US", brandDeals: 0, line: "packing list: {brand}, passport, nothing else", views: [1_020_000, 310_000, 96_000], stamps: [null, "0:22", "0:09"] },
  { handle: "sample.lea", platform: "tiktok", followers: 236_000, market: "DE", brandDeals: 1, line: "my {brand} after two years, still going", views: [874_000], stamps: ["0:31"] },
  { handle: "sample.noor", platform: "instagram", followers: 54_000, market: "AU", brandDeals: 0, line: "{brand} in every shot and nobody asked me to", views: [412_000, 188_000], stamps: ["0:03", null] },
  { handle: "sample.mateo", platform: "tiktok", followers: 31_000, market: "ES", brandDeals: 0, line: "the {brand} one, you know the one", views: [266_000], stamps: ["0:18"] },
  { handle: "sample.ivy", platform: "instagram", followers: 9_400, market: "CA", brandDeals: 0, line: "day in my life with my {brand}", views: [121_000], stamps: [null] },
];

const CHANNEL_SETS: Mention["channels"][] = [
  ["spoken", "caption"],
  ["on_screen"],
  ["hashtag"],
  ["spoken"],
  ["caption", "on_screen"],
];

const FOLLOW_UP_LINES = ["{brand} again, same as last time", "told you, {brand} on every trip"];

function mentionsFor(creator: (typeof CREATORS)[number], brand: string, offset: number): Mention[] {
  return creator.views.map((views, index) => ({
    postUrl: `https://example.com/sample/${creator.handle}/${index + 1}`,
    platform: creator.platform,
    publishedAt: `2026-${String(10 - index).padStart(2, "0")}-${String(4 + offset).padStart(2, "0")}`,
    views,
    brand,
    channels: CHANNEL_SETS[(offset + index) % CHANNEL_SETS.length],
    snippet: (index === 0 ? creator.line : FOLLOW_UP_LINES[(index - 1) % FOLLOW_UP_LINES.length]).replace("{brand}", brand),
    timestamp: creator.stamps[index],
  }));
}

export function sampleBrand(brand: string): BrandResult {
  return {
    brand,
    paidPostsRemoved: 14,
    creators: CREATORS.map(({ line: _line, views: _views, stamps: _stamps, ...creator }, index) => ({
      ...creator,
      mentions: mentionsFor(CREATORS[index], brand, index),
    })),
  };
}

const SAMPLE_BRANDS = ["Birkenstock", "Owala", "Ryanair", "Hydro Flask"];

export function sampleCreator(handle: string): CreatorResult {
  const clean = handle.replace(/^@/, "");
  const base = CREATORS[0];
  return {
    creator: { handle: clean, platform: "instagram", followers: 412_000, market: "US", brandDeals: 2 },
    paidPostsRemoved: 3,
    brands: SAMPLE_BRANDS.map((brand, index) => ({
      brand,
      mentions: mentionsFor(
        { ...base, handle: clean, views: CREATORS[index].views, stamps: CREATORS[index].stamps, line: CREATORS[index].line },
        brand,
        index,
      ),
    })),
  };
}

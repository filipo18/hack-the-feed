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
  { handle: "sample.theo", platform: "tiktok", followers: 890_000, market: "US", brandDeals: 2, line: "ranking everything in my bag, {brand} wins", views: [3_640_000, 210_000], stamps: ["0:12", "0:33"] },
  { handle: "sample.priya", platform: "instagram", followers: 310_000, market: "UK", brandDeals: 1, line: "the {brand} haul nobody asked for", views: [2_910_000], stamps: ["0:08"] },
  { handle: "sample.lucas", platform: "tiktok", followers: 2_100_000, market: "FR", brandDeals: 3, line: "je pars en week-end avec mon {brand}", views: [2_380_000, 640_000], stamps: ["0:05", "0:27"] },
  { handle: "sample.hana", platform: "instagram", followers: 145_000, market: "US", brandDeals: 0, line: "get ready with me, {brand} edition", views: [1_760_000], stamps: ["0:19"] },
  { handle: "sample.diego", platform: "tiktok", followers: 72_000, market: "ES", brandDeals: 0, line: "{brand} at the airport again, send help", views: [1_430_000, 98_000], stamps: ["0:02", null] },
  { handle: "sample.maya", platform: "instagram", followers: 520_000, market: "CA", brandDeals: 2, line: "honest review after a month with {brand}", views: [1_190_000], stamps: ["0:44"] },
  { handle: "sample.felix", platform: "tiktok", followers: 61_000, market: "DE", brandDeals: 0, line: "my mum stole my {brand} and I get it", views: [960_000], stamps: ["0:11"] },
  { handle: "sample.zara", platform: "instagram", followers: 198_000, market: "AU", brandDeals: 1, line: "beach day, {brand}, nothing else matters", views: [820_000, 140_000], stamps: [null, "0:16"] },
  { handle: "sample.omar", platform: "tiktok", followers: 44_000, market: "UK", brandDeals: 0, line: "what’s in my gym bag, {brand} first", views: [705_000], stamps: ["0:07"] },
  { handle: "sample.elena", platform: "instagram", followers: 27_000, market: "US", brandDeals: 0, line: "road trip essentials: {brand}, snacks, playlist", views: [598_000], stamps: [null] },
  { handle: "sample.jonas", platform: "tiktok", followers: 380_000, market: "DE", brandDeals: 1, line: "{brand} unboxing but make it chaotic", views: [541_000], stamps: ["0:04"] },
  { handle: "sample.chloe", platform: "instagram", followers: 93_000, market: "FR", brandDeals: 0, line: "ma routine du matin avec {brand}", views: [466_000, 72_000], stamps: ["0:25", null] },
  { handle: "sample.ravi", platform: "tiktok", followers: 18_000, market: "US", brandDeals: 0, line: "three things I never leave without, {brand} is one", views: [402_000], stamps: ["0:13"] },
  { handle: "sample.nina", platform: "instagram", followers: 260_000, market: "UK", brandDeals: 2, line: "dorm tour, yes that’s my {brand}", views: [355_000], stamps: ["0:38"] },
  { handle: "sample.kai", platform: "tiktok", followers: 12_500, market: "AU", brandDeals: 0, line: "{brand} in the wild, spotted at the cafe", views: [298_000], stamps: ["0:01"] },
  { handle: "sample.lina", platform: "instagram", followers: 67_000, market: "ES", brandDeals: 0, line: "what I packed for Lisbon, {brand} obviously", views: [233_000], stamps: [null] },
  { handle: "sample.ben", platform: "tiktok", followers: 39_000, market: "CA", brandDeals: 0, line: "my {brand} survived the festival", views: [187_000], stamps: ["0:21"] },
  { handle: "sample.ayse", platform: "instagram", followers: 21_000, market: "DE", brandDeals: 0, line: "studying with my {brand} next to me", views: [144_000], stamps: ["0:09"] },
  { handle: "sample.marco", platform: "tiktok", followers: 8_900, market: "US", brandDeals: 0, line: "the {brand} that started it all", views: [79_000], stamps: ["0:15"] },
];

/** Generated UGC-style stills in public/ugc/<set>/<n>.jpg. Unknown brands use the generic set. */
const THUMB_SETS: Record<string, number> = { birkenstock: 8, starbucks: 6, ryanair: 3, generic: 3 };

function thumbnail(brand: string, index: number): string {
  const key = brand.trim().toLowerCase().replace(/[^a-z]/g, "");
  const set = key in THUMB_SETS ? key : "generic";
  return `/ugc/${set}/${(index % THUMB_SETS[set]) + 1}.jpg`;
}

const CHANNEL_SETS: Mention["channels"][] = [
  ["spoken", "caption"],
  ["on_screen"],
  ["hashtag"],
  ["spoken"],
  ["caption", "on_screen"],
];

const FOLLOW_UP_LINES = ["{brand} again, same as last time", "told you, {brand} on every trip"];

/** Creator positions by total views, so the top-ranked creators get distinct stills. */
const RANK = [...CREATORS.keys()]
  .sort((a, b) => CREATORS[b].views.reduce((x, y) => x + y, 0) - CREATORS[a].views.reduce((x, y) => x + y, 0))
  .reduce<Record<number, number>>((map, position, rank) => ({ ...map, [position]: rank }), {});

function mentionsFor(creator: (typeof CREATORS)[number], brand: string, offset: number): Mention[] {
  return creator.views.map((views, index) => ({
    postUrl: `https://example.com/sample/${creator.handle}/${index + 1}`,
    platform: creator.platform,
    publishedAt: `2026-${String(8 + ((offset + index) % 3)).padStart(2, "0")}-${String(1 + ((offset * 5 + index * 9) % 28)).padStart(2, "0")}`,
    views,
    brand,
    channels: CHANNEL_SETS[(offset + index) % CHANNEL_SETS.length],
    snippet: (index === 0 ? creator.line : FOLLOW_UP_LINES[(index - 1) % FOLLOW_UP_LINES.length]).replace("{brand}", brand),
    timestamp: creator.stamps[index],
    thumbnail: thumbnail(brand, (RANK[offset] ?? offset) + index * 5),
  }));
}

export function sampleBrand(brand: string): BrandResult {
  return {
    brand,
    paidPostsRemoved: 41,
    creators: CREATORS.map(({ line: _line, views: _views, stamps: _stamps, ...creator }, index) => ({
      ...creator,
      mentions: mentionsFor(CREATORS[index], brand, index),
    })),
  };
}

const SAMPLE_BRANDS = ["Birkenstock", "Starbucks", "Ryanair", "Hydro Flask"];

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

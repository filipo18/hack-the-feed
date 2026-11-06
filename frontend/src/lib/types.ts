export type Channel = "caption" | "hashtag" | "spoken" | "on_screen";
export type Platform = "instagram" | "tiktok";

export interface Mention {
  postUrl: string;
  platform: Platform;
  publishedAt: string;
  views: number | null;
  brand: string;
  channels: Channel[];
  snippet: string;
  timestamp: string | null;
}

export interface Creator {
  handle: string;
  platform: Platform;
  followers: number;
  market: string;
  /** Posts on this account with an ad marker. Shows the creator already does brand deals. */
  brandDeals: number;
}

export interface BrandResult {
  brand: string;
  paidPostsRemoved: number;
  creators: (Creator & { mentions: Mention[] })[];
}

export interface CreatorResult {
  creator: Creator;
  paidPostsRemoved: number;
  brands: { brand: string; mentions: Mention[] }[];
}

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
  /** Optional frame from the video. Without one, the card shows a painted tile. */
  thumbnail?: string | null;
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

export type ReportPlatform = "instagram" | "tiktok" | "youtube";
export type EntityType = "brand" | "team" | "product" | "person" | "platform_distribution";
export type ReviewDisclosure = "unknown" | "disclosed";

export interface CreatorEntity {
  id: string;
  name: string;
  entityType: EntityType;
  aliases: string[];
  status: "candidate";
  disclosure: "unknown" | "disclosed";
  reviewStatus: "unreviewed";
  matchingPostCount: number;
  matchingPosts: { platformId: string; publishedAt: string | null; views: number | null }[];
  evidence: {
    postId: string | null;
    platformId: string;
    publishedAt: string | null;
    views: number | null;
    field: string;
    snippet: string | null;
    timestampSeconds: number | null;
    frameId: string | null;
    frameUrl: string | null;
    source: "text" | "vision";
    reviewStatus: "unreviewed";
  }[];
  viewsNote: string;
}

export interface CreatorReport {
  handle: string;
  platform: ReportPlatform;
  source: string;
  historyComplete: boolean;
  paymentOwed: boolean;
  confirmationRequired: boolean;
  illustrativeCpm: number | null;
  cpmSource: string | null;
  invoice: null;
  followers: number | null;
  textWindowTruncated: boolean;
  visionFramesSent: number;
  retrieval: {
    status: string;
    message: string | null;
    indexedTotalCount: number | null;
    returnedCount: number;
    cap: number;
    offset: number;
    paginationComplete: boolean | null;
    earliestPublishedAt: string | null;
    latestPublishedAt: string | null;
  };
  posts: {
    id: string | null;
    platform: string;
    platformId: string;
    publishedAt: string | null;
    viewsCount: number | null;
    transcriptState: string;
    ocrLineCount: number;
    frameCount: number;
    disclosure: "unknown" | "disclosed";
  }[];
  entities: CreatorEntity[];
  assessment: { text: string; vision: string; reason: string | null; textReason?: string | null; visionReason?: string | null };
}

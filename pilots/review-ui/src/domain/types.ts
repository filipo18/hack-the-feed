export type Platform = "instagram" | "tiktok" | "youtube";

/** Oriane content search does not document a paid-partnership field. */
export type AbsentSourceField = "not_in_oriane_schema";

export type TextChannel = "caption" | "transcript" | "on_screen_text" | "hashtag";

export type BrandResolution =
  | "rejected_homonym"
  | "ambiguous_homonym"
  | "text_only"
  | "visual_only"
  | "text_and_visual";

export type CreatorMark = "unset" | "organic" | "paid_deal" | "false_positive";

export type DisclosureState = "disclosed" | "review" | "creator_confirmed_organic";

export type TranscriptChunk = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type SourceFrame = {
  frameId: string;
  timestampSeconds: number;
  url: string | null;
};

/**
 * Fields we actually have a documented place for, plus the gaps we refuse to invent.
 * `canonicalPostUrl` stays null. There is no brand array and no paid flag.
 */
export type SourceContent = {
  origin: "synthetic" | "mapped_oriane_shape";
  /** Present on fixtures so a row cannot be mistaken for a live account. */
  syntheticLabel: string | null;
  contentId: string;
  platform: Platform;
  platformId: string;
  profileHandle: string;
  caption: string | null;
  hashtags: string[];
  thumbnailMediaUrl: string | null;
  /** Null when Oriane omitted it. Never coerced to 0. */
  viewsCount: number | null;
  publishedAt: string;
  transcript: string | null;
  transcriptChunks: TranscriptChunk[];
  onScreenText: string[];
  frameText: string[];
  frames: SourceFrame[];
  canonicalPostUrl: null;
  postUrlStatus: AbsentSourceField;
  platformPaidPartnership: AbsentSourceField;
};

/**
 * A visual similarity hit against an asset we uploaded and mapped to a brand.
 * Oriane scores frames against that asset. It does not return a brand name.
 */
export type VisualAssetHit = {
  contentId: string;
  platform: Platform;
  platformId: string;
  assetId: string;
  brandId: string;
  frameId: string;
  timestampSeconds: number;
  score: number;
};

export type LexiconEntry = {
  id: string;
  name: string;
  /** Phrases that identify this brand without a homonym hold. */
  strongPhrases: string[];
  /** Tokens that are not enough on their own (Apple, Stanley). */
  ambiguousTokens: string[];
  /** Phrases that mean the ambiguous token is not this brand. */
  homonymRejections: string[];
};

export type TextEvidence = {
  channel: TextChannel;
  excerpt: string;
};

export type VisualEvidence = {
  frameId: string;
  timestampSeconds: number;
  score: number;
  assetId: string;
};

export type Signal = {
  code: string;
  excerpt: string;
};

export type BrandHit = {
  brandId: string;
  brandName: string;
  resolution: BrandResolution;
  textEvidence: TextEvidence[];
  visualEvidence: VisualEvidence[];
  notes: string[];
};

export type Appearance = {
  id: string;
  contentId: string;
  platform: Platform;
  platformId: string;
  profileHandle: string;
  publishedAt: string;
  thumbnailMediaUrl: string | null;
  canonicalPostUrl: null;
  postUrlStatus: AbsentSourceField;
  platformPaidPartnership: AbsentSourceField;
  syntheticLabel: string | null;
  brandId: string;
  brandName: string;
  resolution: Exclude<BrandResolution, "rejected_homonym">;
  textEvidence: TextEvidence[];
  visualEvidence: VisualEvidence[];
  brandNotes: string[];
  disclosure: DisclosureState;
  disclosureReasons: string[];
  signals: Signal[];
  creatorMark: CreatorMark;
  viewsCount: number | null;
  viewsConflict: boolean;
  eligible: boolean;
  exclusion: string | null;
};

export type HeldOutHit = {
  id: string;
  contentId: string;
  platform: Platform;
  platformId: string;
  syntheticLabel: string | null;
  brandId: string;
  brandName: string;
  resolution: "rejected_homonym";
  textEvidence: TextEvidence[];
  notes: string[];
  captionExcerpt: string | null;
};

export type CpmScenario = {
  id: string;
  label: string;
  /** Placeholder assumption. Teammate replaces the number and the label. */
  cpmUsd: number;
  owner: "teammate";
};

export type ValuationLine = {
  appearanceId: string;
  brandName: string;
  resolution: Appearance["resolution"];
  videoKey: string;
  videoViews: number | null;
  /** Equal share of video views across resolved, non-rejected brands on that video. */
  allocatedViews: number | null;
  shareCount: number;
  scenarios: {
    id: string;
    label: string;
    cpmUsd: number;
    illustrativeCents: number | null;
  }[];
  caveats: string[];
};

export type ValuationSummary = {
  geography: "unknown";
  viewSplit: "equal_among_resolved_brands_on_video";
  dedupeKey: "platform_plus_platform_id";
  notUniqueReach: true;
  notADebt: true;
  notPurchasedMedia: true;
  cpmScenarios: CpmScenario[];
  lines: ValuationLine[];
  /** Gross known views of videos that contribute at least one included line. Counted once per video. */
  grossKnownVideoViews: number;
  /** Views actually multiplied by CPM, after the split. */
  allocatedViewsInSum: number;
  includedLineCount: number;
  includedLinesMissingViews: number;
  /** False when every included line has a view count. An empty set is not a $0 total. */
  sumComplete: boolean;
  scenarios: {
    id: string;
    label: string;
    cpmUsd: number;
    illustrativeCents: number | null;
  }[];
};

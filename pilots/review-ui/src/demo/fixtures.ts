import type { CreatorMark, SourceContent, VisualAssetHit } from "../domain/types";

export const SAMPLE_HANDLE = "sample.creator.demo";
export const SYNTHETIC_LABEL = "SYNTHETIC FIXTURE — not a live Oriane row";

const base = {
  origin: "synthetic" as const,
  syntheticLabel: SYNTHETIC_LABEL,
  profileHandle: SAMPLE_HANDLE,
  hashtags: [] as string[],
  thumbnailMediaUrl: null as string | null,
  viewsCount: null as number | null,
  publishedAt: "2026-10-02T15:00:00.000Z",
  transcript: null as string | null,
  transcriptChunks: [],
  onScreenText: [] as string[],
  frameText: [] as string[],
  frames: [],
  canonicalPostUrl: null as null,
  postUrlStatus: "not_in_oriane_schema" as const,
  platformPaidPartnership: "not_in_oriane_schema" as const,
};

function row(
  partial: Pick<SourceContent, "contentId" | "platform" | "platformId" | "caption"> &
    Partial<SourceContent>,
): SourceContent {
  return { ...base, ...partial };
}

export const DEMO_CONTENTS: SourceContent[] = [
  row({
    contentId: "cnt_SYNTHETIC_PK_ORGANIC_00001",
    platform: "instagram",
    platformId: "plt_synth_pk_organic",
    caption: "SYNTHETIC FIXTURE. The Paper Kettle lives by the sink.",
    viewsCount: 48000,
    thumbnailMediaUrl: "synthetic://thumbnail/paper-kettle",
  }),
  row({
    contentId: "cnt_SYNTHETIC_SHARED_000000001",
    platform: "tiktok",
    platformId: "plt_synth_shared",
    caption: "SYNTHETIC FIXTURE. Morning sink with Paper Kettle and Lumen Soap.",
    viewsCount: 20000,
    publishedAt: "2026-10-03T15:00:00.000Z",
  }),
  row({
    contentId: "cnt_SYNTHETIC_AD_CAPTION_000001",
    platform: "instagram",
    platformId: "plt_synth_ad",
    caption: "SYNTHETIC FIXTURE. Lumen Soap before work #ad",
    viewsCount: 15000,
    publishedAt: "2026-10-04T15:00:00.000Z",
  }),
  row({
    contentId: "cnt_SYNTHETIC_NEGATION_0000001",
    platform: "instagram",
    platformId: "plt_synth_negation",
    caption: "SYNTHETIC FIXTURE. Not sponsored, I just like Paper Kettle.",
    viewsCount: 8000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_GIFTED_000000001",
    platform: "instagram",
    platformId: "plt_synth_gifted",
    caption: "SYNTHETIC FIXTURE. Paper Kettle on the counter.",
    hashtags: ["#gifted"],
    viewsCount: 4000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_AFFILIATE_0000001",
    platform: "instagram",
    platformId: "plt_synth_affiliate",
    caption: "SYNTHETIC FIXTURE. Paper Kettle affiliate link. I earn a commission if you buy.",
    viewsCount: 6000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_ADAPT_0000000001",
    platform: "instagram",
    platformId: "plt_synth_adapt",
    caption: "SYNTHETIC FIXTURE. Adapt your sink routine with Paper Kettle.",
    hashtags: ["#adapt"],
    viewsCount: 1000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_APPLE_FRUIT_00001",
    platform: "instagram",
    platformId: "plt_synth_apple_fruit",
    caption: "SYNTHETIC FIXTURE. I ate an apple by the lake.",
    viewsCount: 22000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_APPLE_WATCH_00001",
    platform: "instagram",
    platformId: "plt_synth_apple_watch",
    caption: "SYNTHETIC FIXTURE. The Apple Watch battery lasted the hike.",
    viewsCount: 18000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_STANLEY_PERSON_01",
    platform: "instagram",
    platformId: "plt_synth_stanley_person",
    caption: "SYNTHETIC FIXTURE. My friend Stanley came over for dinner.",
    viewsCount: 3000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_STANLEY_NAME_0001",
    platform: "instagram",
    platformId: "plt_synth_stanley_name",
    caption: "SYNTHETIC FIXTURE. Shoutout to Stanley.",
    viewsCount: 7000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_STANLEY_VISUAL_01",
    platform: "instagram",
    platformId: "plt_synth_stanley_visual",
    caption: "SYNTHETIC FIXTURE. Packing for a hike.",
    viewsCount: 9000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_FALSE_VISUAL_001",
    platform: "instagram",
    platformId: "plt_synth_false_visual",
    caption: "SYNTHETIC FIXTURE. This camping kettle boils fast.",
    viewsCount: 11000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_MISSING_VIEWS_001",
    platform: "instagram",
    platformId: "plt_synth_missing",
    caption: "SYNTHETIC FIXTURE. Paper Kettle, second shelf.",
    viewsCount: null,
  }),
  row({
    contentId: "cnt_SYNTHETIC_DUP_VIEWS_A_0001",
    platform: "instagram",
    platformId: "plt_synth_dup_views",
    caption: "SYNTHETIC FIXTURE. Paper Kettle on the stove.",
    viewsCount: 1000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_DUP_VIEWS_B_0001",
    platform: "instagram",
    platformId: "plt_synth_dup_views",
    caption: "SYNTHETIC FIXTURE. Paper Kettle on the stove.",
    viewsCount: 5000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_DUP_AD_A_0000001",
    platform: "tiktok",
    platformId: "plt_synth_dup_ad",
    caption: "SYNTHETIC FIXTURE. Paper Kettle, evening.",
    viewsCount: 3000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_DUP_AD_B_0000001",
    platform: "tiktok",
    platformId: "plt_synth_dup_ad",
    caption: "SYNTHETIC FIXTURE. Paper Kettle, evening.",
    hashtags: ["#sponsored"],
    viewsCount: 3000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_ONSCREEN_0000001",
    platform: "youtube",
    platformId: "plt_synth_onscreen",
    caption: "SYNTHETIC FIXTURE. Paper Kettle.",
    onScreenText: ["PAID PARTNERSHIP"],
    viewsCount: 50000,
  }),
  row({
    contentId: "cnt_SYNTHETIC_TRANSCRIPT_00001",
    platform: "instagram",
    platformId: "plt_synth_transcript",
    caption: "SYNTHETIC FIXTURE. Paper Kettle.",
    transcript: "SYNTHETIC FIXTURE. This is a paid partnership, said out loud.",
    viewsCount: 2500,
  }),
];

export const DEMO_VISUAL_HITS: VisualAssetHit[] = [
  {
    contentId: "cnt_SYNTHETIC_STANLEY_VISUAL_01",
    platform: "instagram",
    platformId: "plt_synth_stanley_visual",
    assetId: "ast_SYNTHETIC_STANLEY_CUP",
    brandId: "stanley",
    frameId: "frm_SYNTHETIC_STANLEY_1",
    timestampSeconds: 1.2,
    score: 0.91,
  },
  {
    contentId: "cnt_SYNTHETIC_FALSE_VISUAL_001",
    platform: "instagram",
    platformId: "plt_synth_false_visual",
    assetId: "ast_SYNTHETIC_PAPER_KETTLE",
    brandId: "paper-kettle",
    frameId: "frm_SYNTHETIC_KETTLE_1",
    timestampSeconds: 0.4,
    score: 0.62,
  },
];

export const INITIAL_MARKS: Record<string, CreatorMark> = {
  "instagram:plt_synth_pk_organic:paper-kettle": "organic",
};

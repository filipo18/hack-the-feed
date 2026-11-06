import type { SearchResponse } from "./contract";

/** Explicit layout fixture. The brand page must not use this unless the URL is the demo route. */
export const DEMO_LABEL = "MOCKED FIXTURE — not a live Oriane or GMI result";

export const DEMO_SEARCH: SearchResponse = {
  brand: "Fixture Brand",
  assessment: "complete",
  assessmentReason: null,
  gmiModel: "not-a-live-model",
  sampleNote: "Fixture only.",
  warnings: ["transcript: fixture channel failed on purpose."],
  channels: [
    { channel: "written", status: "ok", warning: null, retrieved: 1 },
    { channel: "transcript", status: "failed", warning: "fixture channel failed on purpose.", retrieved: 0 },
  ],
  rankedCreators: [
    {
      creatorKey: "instagram:fixture-1",
      platform: "instagram",
      handle: "fixture.creator",
      sumViews: 12500,
      viewsIncomplete: false,
      relevantPostCount: 1,
      disclosure: "unknown",
      why: "The caption names Fixture Brand once.",
      judgmentSource: "model",
      posts: [
        {
          postKey: "instagram:post-1",
          platform: "instagram",
          viewsCount: 12500,
          canonicalPostUrl: null,
          evidenceLabels: ["caption", "transcript"],
          disclosure: "unknown",
          countsTowardReach: true,
          verdict: "relevant",
          holdout: null,
          media: [{ transcript: "We flew Fixture Brand today.", onScreenText: [] }],
        },
      ],
    },
    {
      creatorKey: "tiktok:fixture-2",
      platform: "tiktok",
      handle: "fixture.noviews",
      sumViews: null,
      viewsIncomplete: true,
      relevantPostCount: 1,
      disclosure: "disclosed",
      why: "On-screen text shows the brand, and the view count was missing.",
      judgmentSource: "model",
      posts: [
        {
          postKey: "tiktok:post-2",
          viewsCount: null,
          evidenceLabels: ["ocr"],
          disclosure: "disclosed",
          countsTowardReach: true,
          verdict: "relevant",
          holdout: null,
          media: [{ transcript: null, onScreenText: ["FIXTURE BRAND"] }],
        },
      ],
    },
  ],
  heldOut: [
    {
      creatorKey: "instagram:owned",
      platform: "instagram",
      handle: "fixturebrand",
      sumViews: null,
      viewsIncomplete: false,
      disclosure: "unknown",
      holdoutReason: "owned_account",
      why: null,
      judgmentSource: "rule",
      posts: [],
    },
  ],
  unassessedCreators: [
    {
      creatorKey: "tiktok:pending",
      platform: "tiktok",
      handle: "fixture.pending",
      sumViews: null,
      viewsIncomplete: false,
      disclosure: "unknown",
      why: null,
      judgmentSource: "pending",
      posts: [],
    },
  ],
};

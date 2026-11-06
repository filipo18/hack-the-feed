import { describe, expect, it } from "vitest";
import { classifyDisclosure } from "../src/domain/classifyDisclosure";
import { factualPitch, fictionalInvoice } from "../src/domain/copy";
import { extractBrands } from "../src/domain/extractBrands";
import { DEMO_LEXICON } from "../src/domain/lexicon";
import { mapOrianeFullResult } from "../src/domain/mapOriane";
import { appearanceId, runPilot } from "../src/domain/pipeline";
import type { SourceContent, VisualAssetHit } from "../src/domain/types";
import { illustrativeCents } from "../src/domain/value";
import { DEMO_CONTENTS, DEMO_VISUAL_HITS, INITIAL_MARKS, SAMPLE_HANDLE, SYNTHETIC_LABEL } from "../src/demo/fixtures";

function synthetic(overrides: Partial<SourceContent> & Pick<SourceContent, "platformId" | "caption">): SourceContent {
  return {
    origin: "synthetic",
    syntheticLabel: SYNTHETIC_LABEL,
    contentId: `cnt_${overrides.platformId}`,
    platform: "instagram",
    profileHandle: SAMPLE_HANDLE,
    hashtags: [],
    thumbnailMediaUrl: null,
    viewsCount: 1000,
    publishedAt: "2026-10-02T15:00:00.000Z",
    transcript: null,
    transcriptChunks: [],
    onScreenText: [],
    frameText: [],
    frames: [],
    canonicalPostUrl: null,
    postUrlStatus: "not_in_oriane_schema",
    platformPaidPartnership: "not_in_oriane_schema",
    ...overrides,
  };
}

function byPlatformId(platformId: string) {
  return (appearance: { platformId: string }) => appearance.platformId === platformId;
}

describe("brand extraction", () => {
  it("rejects an apple the fruit and keeps Apple Watch as text only", () => {
    const fruit = synthetic({ platformId: "fruit", caption: "SYNTHETIC FIXTURE. I ate an apple by the lake." });
    const watch = synthetic({ platformId: "watch", caption: "SYNTHETIC FIXTURE. The Apple Watch battery lasted." });
    expect(extractBrands(fruit, [], DEMO_LEXICON).map((hit) => hit.resolution)).toEqual(["rejected_homonym"]);
    const watchHit = extractBrands(watch, [], DEMO_LEXICON).find((hit) => hit.brandId === "apple");
    expect(watchHit?.resolution).toBe("text_only");
    expect(watchHit?.notes).toContain("text_is_not_visual_appearance");
  });

  it("rejects a person named Stanley and holds a bare Stanley", () => {
    const person = synthetic({
      platformId: "person",
      caption: "SYNTHETIC FIXTURE. My friend Stanley came over for dinner.",
    });
    const bare = synthetic({ platformId: "bare", caption: "SYNTHETIC FIXTURE. Shoutout to Stanley." });
    expect(extractBrands(person, [], DEMO_LEXICON)[0]?.resolution).toBe("rejected_homonym");
    expect(extractBrands(bare, [], DEMO_LEXICON)[0]?.resolution).toBe("ambiguous_homonym");
  });

  it("does not treat pineapple or a camping kettle as the brand", () => {
    const pineapple = synthetic({ platformId: "pine", caption: "SYNTHETIC FIXTURE. pineapple on the table." });
    const kettle = synthetic({ platformId: "camp", caption: "SYNTHETIC FIXTURE. This camping kettle boils fast." });
    expect(extractBrands(pineapple, [], DEMO_LEXICON)).toEqual([]);
    expect(extractBrands(kettle, [], DEMO_LEXICON)).toEqual([]);
  });

  it("keeps a visual asset hit even when the caption never names the brand", () => {
    const content = synthetic({ platformId: "hike", caption: "SYNTHETIC FIXTURE. Packing for a hike." });
    const hit: VisualAssetHit = {
      contentId: content.contentId,
      platform: "instagram",
      platformId: "hike",
      assetId: "ast_SYNTHETIC_STANLEY_CUP",
      brandId: "stanley",
      frameId: "frm_1",
      timestampSeconds: 1.2,
      score: 0.91,
    };
    const [brand] = extractBrands(content, [hit], DEMO_LEXICON);
    expect(brand?.resolution).toBe("visual_only");
    expect(brand?.textEvidence).toEqual([]);
    expect(brand?.notes).toContain("visual_similarity_is_not_a_brand_label");
  });

  it("matches a compacted product phrase without matching a longer word", () => {
    const compact = synthetic({ platformId: "compact", caption: "SYNTHETIC FIXTURE. stanleycup on the desk." });
    const longer = synthetic({ platformId: "longer", caption: "SYNTHETIC FIXTURE. stanleycupboard is full." });
    expect(extractBrands(compact, [], DEMO_LEXICON)[0]?.resolution).toBe("text_only");
    expect(extractBrands(longer, [], DEMO_LEXICON)).toEqual([]);
  });
});

describe("disclosure", () => {
  it("flags explicit hashtags and phrases, including on-screen text", () => {
    const tagged = synthetic({ platformId: "tag", caption: "SYNTHETIC FIXTURE. Lumen Soap before work #ad" });
    const spoken = synthetic({
      platformId: "spoken",
      caption: "SYNTHETIC FIXTURE. Paper Kettle.",
      transcript: "SYNTHETIC FIXTURE. This is a paid partnership, said out loud.",
    });
    const screen = synthetic({
      platformId: "screen",
      caption: "SYNTHETIC FIXTURE. Paper Kettle.",
      onScreenText: ["PAID PARTNERSHIP"],
    });
    for (const content of [tagged, spoken, screen]) {
      const result = classifyDisclosure(content, "unset");
      expect(result.state).toBe("disclosed");
      expect(result.reasons).toContain("explicit_disclosure");
      expect(result.reasons).toContain("platform_paid_field_absent");
    }
  });

  it("does not treat #adapt, a denial, gifted, or affiliate as a paid disclosure", () => {
    const adapt = classifyDisclosure(
      synthetic({ platformId: "adapt", caption: "Adapt your routine", hashtags: ["#adapt"] }),
      "unset",
    );
    const denial = classifyDisclosure(
      synthetic({ platformId: "denial", caption: "SYNTHETIC FIXTURE. Not sponsored, I just like it." }),
      "unset",
    );
    const gifted = classifyDisclosure(
      synthetic({ platformId: "gift", caption: "SYNTHETIC FIXTURE. On the counter.", hashtags: ["#gifted"] }),
      "unset",
    );
    const affiliate = classifyDisclosure(
      synthetic({ platformId: "aff", caption: "SYNTHETIC FIXTURE. affiliate link. I earn a commission." }),
      "unset",
    );
    expect(adapt.state).toBe("review");
    expect(adapt.reasons).toContain("no_disclosure_is_not_unpaid");
    expect(adapt.reasons).not.toContain("explicit_disclosure");
    expect(denial.state).toBe("review");
    expect(denial.reasons).toContain("negated_disclosure_is_not_proof");
    expect(gifted.reasons).toContain("gifted_not_a_media_buy");
    expect(gifted.state).toBe("review");
    expect(affiliate.reasons).toContain("affiliate_material_connection");
    expect(affiliate.state).toBe("review");
  });

  it("keeps #ad disclosed when the caption also denies a sponsorship", () => {
    const mixed = classifyDisclosure(
      synthetic({
        platformId: "mixed",
        caption: "SYNTHETIC FIXTURE. Not sponsored #ad",
      }),
      "organic",
    );
    expect(mixed.state).toBe("disclosed");
    expect(mixed.reasons).toContain("creator_organic_conflicts_with_disclosure");
  });

  it("emits creator-confirmed organic only from a mark, and never from silence", () => {
    const quiet = synthetic({ platformId: "quiet", caption: "SYNTHETIC FIXTURE. Paper Kettle by the sink." });
    expect(classifyDisclosure(quiet, "unset").state).toBe("review");
    expect(classifyDisclosure(quiet, "organic").state).toBe("creator_confirmed_organic");
  });
});

describe("pilot contract", () => {
  const demo = runPilot({
    contents: DEMO_CONTENTS,
    visualHits: DEMO_VISUAL_HITS,
    marks: INITIAL_MARKS,
    orianeAggregationTotalViews: 9_999_999,
  });

  it("labels every demo row synthetic and does not invent a post url or paid flag", () => {
    expect(demo.contents.every((content) => content.syntheticLabel === SYNTHETIC_LABEL)).toBe(true);
    expect(demo.appearances.every((row) => row.canonicalPostUrl === null)).toBe(true);
    expect(demo.appearances.every((row) => row.platformPaidPartnership === "not_in_oriane_schema")).toBe(true);
    expect(demo.contents).toHaveLength(DEMO_CONTENTS.length - 2);
  });

  it("holds fruit and a person's name out of the review queue", () => {
    expect(demo.heldOut.map((hit) => hit.platformId).sort()).toEqual([
      "plt_synth_apple_fruit",
      "plt_synth_stanley_person",
    ]);
    expect(demo.appearances.some((row) => row.platformId === "plt_synth_apple_fruit")).toBe(false);
  });

  it("keeps the planted Oriane view aggregate out of the illustration", () => {
    const other = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: INITIAL_MARKS,
      orianeAggregationTotalViews: 1,
    });
    expect(demo.valuation).toEqual(other.valuation);
    expect(demo.valuation.grossKnownVideoViews).toBe(48000);
    expect(demo.valuation.allocatedViewsInSum).toBe(48000);
    expect(demo.ignoredAggregationTotalViews).toBe(9_999_999);
  });

  it("illustrates only the creator-confirmed organic row, with the placeholder CPMs", () => {
    expect(demo.valuation.lines).toHaveLength(1);
    expect(demo.valuation.sumComplete).toBe(true);
    expect(demo.valuation.geography).toBe("unknown");
    const [line] = demo.valuation.lines;
    expect(line?.allocatedViews).toBe(48000);
    expect(line?.scenarios.map((scenario) => scenario.illustrativeCents)).toEqual([
      illustrativeCents(48000, 5),
      illustrativeCents(48000, 15),
      illustrativeCents(48000, 40),
    ]);
    expect(line?.caveats).toContain("text_only");
  });

  it("collapses duplicate videos and refuses conflicting view counts", () => {
    const conflict = demo.appearances.find(byPlatformId("plt_synth_dup_views"));
    const disclosed = demo.appearances.find(byPlatformId("plt_synth_dup_ad"));
    expect(conflict?.viewsCount).toBeNull();
    expect(conflict?.viewsConflict).toBe(true);
    expect(demo.appearances.filter(byPlatformId("plt_synth_dup_views"))).toHaveLength(1);
    expect(disclosed?.disclosure).toBe("disclosed");
    expect(disclosed?.viewsCount).toBe(3000);
  });

  it("leaves missing views unknown and does not count them as zero", () => {
    const missing = demo.appearances.find(byPlatformId("plt_synth_missing"));
    expect(missing?.viewsCount).toBeNull();
    expect(missing?.viewsConflict).toBe(false);
    const withMark = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: {
        ...INITIAL_MARKS,
        [appearanceId("instagram", "plt_synth_missing", "paper-kettle")]: "organic",
      },
    });
    expect(withMark.valuation.sumComplete).toBe(false);
    const missingLine = withMark.valuation.lines.find((line) => line.videoKey.endsWith("plt_synth_missing"));
    expect(missingLine?.allocatedViews).toBeNull();
    expect(missingLine?.scenarios.every((scenario) => scenario.illustrativeCents === null)).toBe(true);
    expect(withMark.valuation.scenarios.find((scenario) => scenario.id === "low")?.illustrativeCents).toBe(
      illustrativeCents(48000, 5),
    );
  });

  it("splits one video's views across resolved brands and does not double the gross", () => {
    const both = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: {
        [appearanceId("tiktok", "plt_synth_shared", "paper-kettle")]: "organic",
        [appearanceId("tiktok", "plt_synth_shared", "lumen-soap")]: "organic",
      },
    });
    expect(both.valuation.grossKnownVideoViews).toBe(20000);
    expect(both.valuation.allocatedViewsInSum).toBe(20000);
    expect(both.valuation.lines.map((line) => line.allocatedViews)).toEqual([10000, 10000]);
    expect(both.valuation.scenarios.find((scenario) => scenario.id === "mid")?.illustrativeCents).toBe(
      illustrativeCents(20000, 15),
    );
  });

  it("still shares views with a paid co-mention, and drops a rejected brand from the split", () => {
    const sharedWithPaid = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: {
        [appearanceId("tiktok", "plt_synth_shared", "paper-kettle")]: "organic",
        [appearanceId("tiktok", "plt_synth_shared", "lumen-soap")]: "paid_deal",
      },
    });
    expect(sharedWithPaid.valuation.lines).toHaveLength(1);
    expect(sharedWithPaid.valuation.lines[0]?.allocatedViews).toBe(10000);
    expect(sharedWithPaid.valuation.grossKnownVideoViews).toBe(20000);

    const dropped = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: {
        [appearanceId("tiktok", "plt_synth_shared", "paper-kettle")]: "organic",
        [appearanceId("tiktok", "plt_synth_shared", "lumen-soap")]: "false_positive",
      },
    });
    expect(dropped.valuation.lines[0]?.allocatedViews).toBe(20000);
  });

  it("does not let an organic mark override a disclosure or an unresolved homonym", () => {
    const marked = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: {
        [appearanceId("instagram", "plt_synth_ad", "lumen-soap")]: "organic",
        [appearanceId("instagram", "plt_synth_stanley_name", "stanley")]: "organic",
        [appearanceId("instagram", "plt_synth_stanley_visual", "stanley")]: "organic",
      },
    });
    const ad = marked.appearances.find(byPlatformId("plt_synth_ad"));
    const name = marked.appearances.find(byPlatformId("plt_synth_stanley_name"));
    const visual = marked.appearances.find(byPlatformId("plt_synth_stanley_visual"));
    expect(ad?.disclosure).toBe("disclosed");
    expect(ad?.eligible).toBe(false);
    expect(name?.eligible).toBe(false);
    expect(name?.exclusion).toBe("homonym_unresolved");
    expect(visual?.resolution).toBe("visual_only");
    expect(visual?.eligible).toBe(true);
    expect(visual?.textEvidence).toEqual([]);
  });

  it("keeps a false visual similarity hit in review until the creator marks it", () => {
    const visual = demo.appearances.find(byPlatformId("plt_synth_false_visual"));
    expect(visual?.resolution).toBe("visual_only");
    expect(visual?.brandId).toBe("paper-kettle");
    expect(visual?.disclosure).toBe("review");
    expect(visual?.eligible).toBe(false);
    expect(visual?.textEvidence).toEqual([]);
  });

  it("uses no unique-reach or debt fields", () => {
    const found = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          found.add(key);
          walk(child);
        }
      }
    };
    walk(demo.valuation);
    expect(found.has("uniqueReach")).toBe(false);
    expect(found.has("amountOwed")).toBe(false);
    expect(found.has("debt")).toBe(false);
    expect(demo.valuation.notUniqueReach).toBe(true);
    expect(demo.valuation.notADebt).toBe(true);
    expect(demo.valuation.notPurchasedMedia).toBe(true);
  });
});

describe("copy", () => {
  it("keeps the joke invoice fictional and the pitch from claiming free ads", () => {
    const demo = runPilot({
      contents: DEMO_CONTENTS,
      visualHits: DEMO_VISUAL_HITS,
      marks: INITIAL_MARKS,
    });
    const invoice = fictionalInvoice(demo.valuation);
    const pitch = factualPitch(demo.valuation, `@${SAMPLE_HANDLE}`);
    const text = `${invoice.banner} ${invoice.lines.join(" ")} ${invoice.footer} ${pitch}`.toLowerCase();
    expect(invoice.banner).toMatch(/Not a bill/);
    expect(invoice.footer).toMatch(/not unique people/);
    expect(text).not.toMatch(/amount due/);
    expect(text).not.toMatch(/\bdebt\b/);
    expect(text).not.toMatch(/\bowed\b/);
    expect(text).not.toMatch(/free ads/);
    expect(text).not.toMatch(/unique reach/);
    expect(text).toMatch(/audience country is unknown/);
    expect(invoice.lines.join(" ")).toMatch(/\$240\.00/);
    expect(invoice.lines.join(" ")).toMatch(/\$720\.00/);
    expect(invoice.lines.join(" ")).toMatch(/\$1,920\.00/);
  });
});

describe("Oriane mapping", () => {
  it("reads views, captions, transcripts, and frame text without inventing brands or a post url", () => {
    const mapped = mapOrianeFullResult({
      id: "cnt_SYNTHETICMAPPEDSHAPE000001",
      platform: "instagram",
      platformId: "18000000000000000",
      profileHandle: "sample.creator.demo",
      caption: "SYNTHETIC SHAPE. I ate an apple.",
      hashtags: [],
      thumbnailMediaUrl: "https://example.invalid/thumbnail.webp",
      viewsCount: null,
      publishedAt: "2026-11-03T20:14:45.669Z",
      media: [
        {
          transcript: null,
          transcriptChunks: [
            { startSeconds: 0.2, endSeconds: 1.4, text: "SYNTHETIC SHAPE. paid partnership in the chunk." },
          ],
          onScreenText: [],
          frames: [
            {
              id: "med_SYNTHETICFRAME00000000001",
              timestampSeconds: 0.5,
              url: "https://example.invalid/frame.webp",
              onScreenTextRegions: [{ text: "Lumen Soap" }],
            },
          ],
        },
      ],
    });

    expect(mapped.viewsCount).toBeNull();
    expect(mapped.canonicalPostUrl).toBeNull();
    expect(mapped.platformPaidPartnership).toBe("not_in_oriane_schema");
    expect(mapped.transcript).toMatch(/paid partnership in the chunk/);
    expect(mapped.frameText).toEqual(["Lumen Soap"]);
    expect(mapped.origin).toBe("mapped_oriane_shape");

    const pilot = runPilot({ contents: [mapped] });
    expect(pilot.appearances.map((row) => row.brandId)).toEqual(["lumen-soap"]);
    expect(pilot.heldOut.map((hit) => hit.brandId)).toEqual(["apple"]);
    expect(pilot.appearances[0]?.disclosure).toBe("disclosed");
    expect(pilot.valuation.lines).toHaveLength(0);
    expect("brands" in mapped).toBe(false);
  });
});

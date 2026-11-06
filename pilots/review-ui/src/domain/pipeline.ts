import { classifyDisclosure } from "./classifyDisclosure";
import { extractBrands } from "./extractBrands";
import type {
  Appearance,
  CreatorMark,
  HeldOutHit,
  LexiconEntry,
  SourceContent,
  VisualAssetHit,
} from "./types";
import { DEMO_LEXICON } from "./lexicon";
import type { ValuationSummary } from "./types";
import { valueAppearances } from "./value";

export type PilotInput = {
  contents: SourceContent[];
  visualHits?: VisualAssetHit[];
  lexicon?: LexiconEntry[];
  marks?: Record<string, CreatorMark>;
  /**
   * Oriane's search aggregation can sum views and skip nulls.
   * This pilot accepts the number only to prove it is ignored.
   */
  orianeAggregationTotalViews?: number | null;
};

export type DedupeNote = {
  key: string;
  copies: number;
  viewsConflict: boolean;
};

export type PilotResult = {
  contents: SourceContent[];
  dedupe: DedupeNote[];
  appearances: Appearance[];
  heldOut: HeldOutHit[];
  valuation: ValuationSummary;
  ignoredAggregationTotalViews: number | null;
};

export function appearanceId(platform: string, platformId: string, brandId: string): string {
  return `${platform}:${platformId}:${brandId}`;
}

export function runPilot(input: PilotInput): PilotResult {
  const lexicon = input.lexicon ?? DEMO_LEXICON;
  const visualHits = input.visualHits ?? [];
  const marks = input.marks ?? {};
  const { contents, dedupe } = dedupeContents(input.contents);

  const appearances: Appearance[] = [];
  const heldOut: HeldOutHit[] = [];

  for (const content of contents) {
    const hits = extractBrands(content, visualHits, lexicon);
    for (const hit of hits) {
      const id = appearanceId(content.platform, content.platformId, hit.brandId);
      if (hit.resolution === "rejected_homonym") {
        heldOut.push({
          id,
          contentId: content.contentId,
          platform: content.platform,
          platformId: content.platformId,
          syntheticLabel: content.syntheticLabel,
          brandId: hit.brandId,
          brandName: hit.brandName,
          resolution: "rejected_homonym",
          textEvidence: hit.textEvidence,
          notes: hit.notes,
          captionExcerpt: content.caption,
        });
        continue;
      }

      const creatorMark = marks[id] ?? "unset";
      const disclosure = classifyDisclosure(content, creatorMark);
      const exclusion = exclusionFor(hit.resolution, disclosure.state, creatorMark);
      appearances.push({
        id,
        contentId: content.contentId,
        platform: content.platform,
        platformId: content.platformId,
        profileHandle: content.profileHandle,
        publishedAt: content.publishedAt,
        thumbnailMediaUrl: content.thumbnailMediaUrl,
        canonicalPostUrl: null,
        postUrlStatus: "not_in_oriane_schema",
        platformPaidPartnership: "not_in_oriane_schema",
        syntheticLabel: content.syntheticLabel,
        brandId: hit.brandId,
        brandName: hit.brandName,
        resolution: hit.resolution,
        textEvidence: hit.textEvidence,
        visualEvidence: hit.visualEvidence,
        brandNotes: hit.notes,
        disclosure: disclosure.state,
        disclosureReasons: disclosure.reasons,
        signals: disclosure.signals,
        creatorMark,
        viewsCount: content.viewsCount,
        viewsConflict:
          dedupe.find((note) => note.key === `${content.platform}:${content.platformId}`)?.viewsConflict ===
          true,
        eligible: exclusion === null,
        exclusion,
      });
    }
  }

  return {
    contents,
    dedupe,
    appearances,
    heldOut,
    valuation: valueAppearances(appearances),
    ignoredAggregationTotalViews: input.orianeAggregationTotalViews ?? null,
  };
}

function exclusionFor(
  resolution: Appearance["resolution"],
  disclosure: Appearance["disclosure"],
  mark: CreatorMark,
): string | null {
  if (mark === "false_positive") return "creator_marked_false_positive";
  if (mark === "paid_deal") return "creator_marked_paid_deal";
  if (resolution === "ambiguous_homonym") return "homonym_unresolved";
  if (disclosure !== "creator_confirmed_organic") return "not_creator_confirmed_organic";
  return null;
}

function dedupeContents(contents: SourceContent[]): { contents: SourceContent[]; dedupe: DedupeNote[] } {
  const groups = new Map<string, SourceContent[]>();
  for (const content of contents) {
    const key = `${content.platform}:${content.platformId}`;
    const list = groups.get(key) ?? [];
    list.push(content);
    groups.set(key, list);
  }

  const merged: SourceContent[] = [];
  const dedupe: DedupeNote[] = [];
  for (const [key, group] of groups) {
    const viewTokens = new Set(group.map((item) => (item.viewsCount === null ? "null" : String(item.viewsCount))));
    const viewsConflict = viewTokens.size > 1;
    dedupe.push({ key, copies: group.length, viewsConflict });
    merged.push(mergeGroup(group, viewsConflict));
  }
  return { contents: merged, dedupe };
}

function mergeGroup(group: SourceContent[], viewsConflict: boolean): SourceContent {
  const first = group[0];
  const captions = uniqueStrings(group.map((item) => item.caption));
  const transcripts = uniqueStrings(group.map((item) => item.transcript));
  return {
    ...first,
    caption: captions.join("\n") || null,
    transcript: transcripts.join("\n") || null,
    hashtags: uniqueStrings(group.flatMap((item) => item.hashtags)),
    onScreenText: uniqueStrings(group.flatMap((item) => item.onScreenText)),
    frameText: uniqueStrings(group.flatMap((item) => item.frameText)),
    transcriptChunks: group.flatMap((item) => item.transcriptChunks),
    frames: group.flatMap((item) => item.frames),
    viewsCount: viewsConflict ? null : first.viewsCount,
    thumbnailMediaUrl: group.find((item) => item.thumbnailMediaUrl)?.thumbnailMediaUrl ?? null,
    syntheticLabel: group.find((item) => item.syntheticLabel)?.syntheticLabel ?? null,
  };
}

function uniqueStrings(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

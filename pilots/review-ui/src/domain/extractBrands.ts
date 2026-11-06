import type { BrandHit, LexiconEntry, SourceContent, TextChannel, TextEvidence, VisualAssetHit } from "./types";
import { compactPhrase, excerptAt, findBounded, normalizeHashtag, overlaps, type Span } from "./text";

type ChannelText = { channel: TextChannel; text: string };

export function extractBrands(
  content: SourceContent,
  visualHits: VisualAssetHit[],
  lexicon: LexiconEntry[],
): BrandHit[] {
  const channels = channelTexts(content);
  const hits: BrandHit[] = [];

  for (const entry of lexicon) {
    const textEvidence: TextEvidence[] = [];
    const strongSpans = new Map<TextChannel, Span[]>();

    for (const channel of channels) {
      const phrases = [
        ...entry.strongPhrases,
        ...entry.strongPhrases.map(compactPhrase).filter((phrase): phrase is string => phrase !== null),
      ];
      const spans = phrases.flatMap((phrase) => findBounded(channel.text, phrase));
      if (spans.length === 0) continue;
      strongSpans.set(channel.channel, spans);
      for (const span of spans) {
        textEvidence.push({
          channel: channel.channel,
          excerpt: excerptAt(channel.text, span.start, span.end),
        });
      }
    }

    const ambiguousEvidence: TextEvidence[] = [];
    const rejectedEvidence: TextEvidence[] = [];
    let ambiguousCount = 0;
    let rejectedCount = 0;

    for (const channel of channels) {
      for (const token of entry.ambiguousTokens) {
        for (const span of findBounded(channel.text, token)) {
          const strong = strongSpans.get(channel.channel) ?? [];
          if (strong.some((outer) => overlaps(outer, span))) continue;
          ambiguousCount += 1;
          const rejected = entry.homonymRejections.some((phrase) =>
            findBounded(channel.text, phrase).some((outer) => overlaps(outer, span)),
          );
          if (rejected) {
            rejectedCount += 1;
            rejectedEvidence.push({
              channel: channel.channel,
              excerpt: excerptAt(channel.text, span.start, span.end),
            });
            continue;
          }
          ambiguousEvidence.push({
            channel: channel.channel,
            excerpt: excerptAt(channel.text, span.start, span.end),
          });
        }
      }
    }

    const visualEvidence = visualHits
      .filter(
        (hit) =>
          hit.brandId === entry.id &&
          hit.platform === content.platform &&
          hit.platformId === content.platformId,
      )
      .map((hit) => ({
        frameId: hit.frameId,
        timestampSeconds: hit.timestampSeconds,
        score: hit.score,
        assetId: hit.assetId,
      }));

    const hasStrong = textEvidence.length > 0;
    const hasVisual = visualEvidence.length > 0;
    const unresolvedAmbiguous = ambiguousEvidence.length > 0;

    if (!hasStrong && ambiguousCount === 0 && !hasVisual) continue;

    if (hasStrong) {
      hits.push({
        brandId: entry.id,
        brandName: entry.name,
        resolution: hasVisual ? "text_and_visual" : "text_only",
        textEvidence: dedupeEvidence(textEvidence),
        visualEvidence,
        notes: hasVisual
          ? ["text_and_visual_are_separate_evidence"]
          : ["text_is_not_visual_appearance"],
      });
      continue;
    }

    if (unresolvedAmbiguous) {
      hits.push({
        brandId: entry.id,
        brandName: entry.name,
        resolution: "ambiguous_homonym",
        textEvidence: dedupeEvidence(ambiguousEvidence),
        visualEvidence,
        notes: [
          "homonym_unresolved",
          ...(hasVisual ? ["visual_similarity_is_not_a_brand_label"] : []),
        ],
      });
      continue;
    }

    if (rejectedCount > 0 && hasVisual) {
      hits.push({
        brandId: entry.id,
        brandName: entry.name,
        resolution: "visual_only",
        textEvidence: dedupeEvidence(rejectedEvidence),
        visualEvidence,
        notes: ["visual_similarity_is_not_a_brand_label", "nearby_text_rejected_as_homonym"],
      });
      continue;
    }

    if (rejectedCount > 0) {
      hits.push({
        brandId: entry.id,
        brandName: entry.name,
        resolution: "rejected_homonym",
        textEvidence: dedupeEvidence(rejectedEvidence),
        visualEvidence: [],
        notes: ["homonym_rejected"],
      });
      continue;
    }

    hits.push({
      brandId: entry.id,
      brandName: entry.name,
      resolution: "visual_only",
      textEvidence: [],
      visualEvidence,
      notes: ["visual_similarity_is_not_a_brand_label"],
    });
  }

  return hits;
}

function channelTexts(content: SourceContent): ChannelText[] {
  const channels: ChannelText[] = [];
  if (content.caption) channels.push({ channel: "caption", text: content.caption });
  if (content.transcript) channels.push({ channel: "transcript", text: content.transcript });
  const screen = [...content.onScreenText, ...content.frameText].filter(Boolean).join("\n");
  if (screen) channels.push({ channel: "on_screen_text", text: screen });
  const tags = content.hashtags.map((tag) => `#${normalizeHashtag(tag)}`).join(" ");
  if (tags.trim()) channels.push({ channel: "hashtag", text: tags });
  return channels;
}

function dedupeEvidence(evidence: TextEvidence[]): TextEvidence[] {
  const seen = new Set<string>();
  const unique: TextEvidence[] = [];
  for (const item of evidence) {
    const key = `${item.channel}:${item.excerpt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

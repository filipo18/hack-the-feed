import type { CreatorMark, DisclosureState, Signal, SourceContent } from "./types";
import { excerptAt, findBounded, hashtagTokens, overlaps } from "./text";

const HARD_HASHTAGS = new Set([
  "ad",
  "sponsored",
  "paidpartnership",
  "paidpartner",
  "advertisement",
  "paidpromotion",
]);

const HARD_PHRASES = [
  "paid partnership",
  "paid promotion",
  "sponsored by",
  "includes paid promotion",
  "this is an ad",
  "this is a paid ad",
];

const NEGATION_PHRASES = [
  "not sponsored",
  "not an ad",
  "not a paid partnership",
  "not a paid promotion",
  "no paid partnership",
  "no one paid",
  "nobody paid",
  "unsponsored",
  "isn't sponsored",
  "is not sponsored",
];

const SOFT_HASHTAGS: Record<string, string> = {
  gifted: "gifted_not_a_media_buy",
  prpackage: "gifted_not_a_media_buy",
  pr: "gifted_not_a_media_buy",
  affiliate: "affiliate_material_connection",
  affiliatelink: "affiliate_material_connection",
  partner: "ambiguous_hashtag",
  collab: "ambiguous_hashtag",
  sp: "ambiguous_hashtag",
  ambassador: "ambiguous_hashtag",
};

const SOFT_PHRASES: { phrase: string; code: string }[] = [
  { phrase: "gifted", code: "gifted_not_a_media_buy" },
  { phrase: "pr package", code: "gifted_not_a_media_buy" },
  { phrase: "they sent me", code: "gifted_not_a_media_buy" },
  { phrase: "affiliate", code: "affiliate_material_connection" },
  { phrase: "affiliate link", code: "affiliate_material_connection" },
  { phrase: "commission", code: "affiliate_material_connection" },
];

export type DisclosureResult = {
  state: DisclosureState;
  reasons: string[];
  signals: Signal[];
};

/**
 * Explicit disclosure flags the post for review.
 * Missing disclosure stays `review`. It is never organic by itself.
 * `creator_confirmed_organic` is emitted only from a creator mark, and not
 * when an explicit disclosure is also present.
 */
export function classifyDisclosure(content: SourceContent, creatorMark: CreatorMark): DisclosureResult {
  const corpus = corpusFields(content);
  const signals: Signal[] = [];
  let explicit = false;
  let negatedOnly = false;

  const tags = hashtagTokens(content.caption, content.hashtags);
  for (const tag of tags) {
    if (HARD_HASHTAGS.has(tag)) {
      explicit = true;
      signals.push({ code: "explicit_hashtag", excerpt: `#${tag}` });
    } else if (SOFT_HASHTAGS[tag]) {
      signals.push({ code: SOFT_HASHTAGS[tag], excerpt: `#${tag}` });
    }
  }

  for (const field of corpus) {
    const hardSpans = HARD_PHRASES.flatMap((phrase) => findBounded(field, phrase));
    const negationSpans = NEGATION_PHRASES.flatMap((phrase) => findBounded(field, phrase));
    for (const span of hardSpans) {
      const negated = negationSpans.some((negation) => overlaps(negation, span));
      if (negated) {
        negatedOnly = true;
        signals.push({ code: "negated_disclosure", excerpt: excerptAt(field, span.start, span.end) });
      } else {
        explicit = true;
        signals.push({ code: "explicit_phrase", excerpt: excerptAt(field, span.start, span.end) });
      }
    }
    if (hardSpans.length === 0) {
      for (const span of negationSpans) {
        negatedOnly = true;
        signals.push({ code: "negated_disclosure", excerpt: excerptAt(field, span.start, span.end) });
      }
    }
    for (const soft of SOFT_PHRASES) {
      for (const span of findBounded(field, soft.phrase)) {
        signals.push({ code: soft.code, excerpt: excerptAt(field, span.start, span.end) });
      }
    }
  }

  const reasons: string[] = ["platform_paid_field_absent"];
  let machine: "disclosed" | "review";
  if (explicit) {
    machine = "disclosed";
    reasons.push("explicit_disclosure");
    if (negatedOnly) reasons.push("disclosure_conflicts_with_negation");
  } else if (negatedOnly) {
    machine = "review";
    reasons.push("negated_disclosure_is_not_proof");
  } else {
    machine = "review";
    reasons.push("no_disclosure_is_not_unpaid");
  }

  for (const signal of signals) {
    if (
      (signal.code === "gifted_not_a_media_buy" ||
        signal.code === "affiliate_material_connection" ||
        signal.code === "ambiguous_hashtag") &&
      !reasons.includes(signal.code)
    ) {
      reasons.push(signal.code);
    }
  }

  if (creatorMark === "organic") {
    if (machine === "disclosed") {
      return {
        state: "disclosed",
        reasons: [...reasons, "creator_organic_conflicts_with_disclosure"],
        signals,
      };
    }
    return {
      state: "creator_confirmed_organic",
      reasons: [...reasons, "creator_confirmed_organic"],
      signals,
    };
  }

  return { state: machine, reasons, signals };
}

function corpusFields(content: SourceContent): string[] {
  const fields = [content.caption, content.transcript, [...content.onScreenText, ...content.frameText].join("\n")];
  return fields.filter((field): field is string => Boolean(field && field.trim()));
}

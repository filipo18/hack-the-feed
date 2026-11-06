import type { ValuationSummary } from "./types";

/** Teammate owns these sentences. Codes in the domain layer stay stable. */
export const REASON_COPY: Record<string, string> = {
  platform_paid_field_absent: "Oriane has no paid-partnership field. This read uses caption, transcript, on-screen text, and hashtags.",
  explicit_disclosure: "Explicit disclosure. Hold for review. Do not treat it as an unpaid mention.",
  no_disclosure_is_not_unpaid: "No explicit disclosure. That does not mean the mention was unpaid.",
  negated_disclosure_is_not_proof: "The text denies a sponsorship. A denial is not proof the mention was unpaid.",
  disclosure_conflicts_with_negation: "A disclosure and a denial are both present. The disclosure still holds the row for review.",
  gifted_not_a_media_buy: "Gifted or PR language is a material connection, not a paid media buy, and not proof of an unpaid mention.",
  affiliate_material_connection: "Affiliate or commission language is a material connection. It is not a CPM valuation by itself.",
  ambiguous_hashtag: "Hashtag is ambiguous (#partner, #collab, #sp, #ambassador). It is not an explicit paid disclosure.",
  creator_organic_conflicts_with_disclosure: "Creator marked organic, but an explicit disclosure is present. The row stays held.",
  creator_confirmed_organic: "Creator marked this organic after review.",
  text_is_not_visual_appearance: "Text mention only. This does not mean the product is on screen.",
  visual_similarity_is_not_a_brand_label: "Visual similarity to an asset we mapped. Oriane did not name the brand.",
  text_and_visual_are_separate_evidence: "Text and visual similarity both hit. They are separate evidence.",
  homonym_unresolved: "The name also belongs to something else. Not assigned to the brand.",
  homonym_rejected: "Rejected as a homonym, not a brand appearance.",
  nearby_text_rejected_as_homonym: "Nearby text matched a homonym and was rejected. The visual hit is still unconfirmed.",
  views_unknown: "View count is missing. It is left out of the sum, not counted as zero.",
  views_conflict: "Duplicate rows disagreed on views. Views are treated as unknown.",
  views_shared: "More than one resolved brand is on this video. Each line uses an equal share of the same views.",
};

const CAVEAT_COPY: Record<string, string> = {
  text_only: "Text only. Not a claim the product is on screen.",
  visual_only: "Visual similarity the creator confirmed. Oriane did not label the brand.",
  text_and_visual: "Text plus a visual similarity hit.",
  views_shared: "Views on this video are split equally across the resolved brands on it.",
  views_unknown: "Views are missing, so this line has no illustrated number.",
  views_conflict: "Duplicate rows disagreed on views, so this line has no illustrated number.",
  gifted_not_a_media_buy: "The post also uses gifted or PR language.",
  affiliate_material_connection: "The post also uses affiliate or commission language.",
  negated_disclosure_is_not_proof: "The post denies a sponsorship. The creator still marked it after review.",
};

export function reasonSentence(code: string): string {
  return REASON_COPY[code] ?? code;
}

export function caveatSentence(code: string): string {
  return CAVEAT_COPY[code] ?? code;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatViews(views: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(views);
}

export type InvoiceDraft = {
  banner: string;
  empty: string | null;
  lines: string[];
  footer: string;
};

export function fictionalInvoice(summary: ValuationSummary): InvoiceDraft {
  const banner = "Fictional illustration. Not a bill. Not a request for payment. Do not send this.";
  const footer =
    "Each figure is views divided by 1,000, times the CPM assumption on that line. Audience country is unknown, so there is no country rate. Views are plays of a video, not unique people. This is not the price of an ad the brand would have bought, and it is not an amount anyone owes.";

  if (summary.lines.length === 0) {
    return {
      banner,
      empty:
        "Nothing is included. A missing disclosure is not a reason to add a line. Include a row only after the creator marks it organic, and only when the brand match is resolved.",
      lines: [],
      footer,
    };
  }

  const lines = summary.lines.map((line) => {
    const viewText =
      line.allocatedViews === null
        ? "Views unknown. No number on this line."
        : `${formatViews(line.allocatedViews)} allocated views` +
          (line.shareCount > 1 && line.videoViews !== null
            ? ` (equal share of ${formatViews(line.videoViews)})`
            : "");
    const prices = line.scenarios
      .map((scenario) =>
        scenario.illustrativeCents === null
          ? `${scenario.label} at $${scenario.cpmUsd} CPM: no number`
          : `${scenario.label} at $${scenario.cpmUsd} CPM: ${formatUsdFromCents(scenario.illustrativeCents)}`,
      )
      .join(". ");
    const notes = line.caveats.map(caveatSentence).join(" ");
    return `${line.brandName}. ${viewText}. ${prices}. ${notes}`.trim();
  });

  if (!summary.sumComplete) {
    lines.push(
      "The illustrated numbers above skip lines with unknown views. They are not a complete sum.",
    );
  }

  return { banner, empty: null, lines, footer };
}

export function factualPitch(summary: ValuationSummary, handle: string): string {
  if (summary.lines.length === 0) {
    return `${handle} has no creator-confirmed organic rows in this pilot. There is nothing to pitch from yet.`;
  }

  const brands = [...new Set(summary.lines.map((line) => line.brandName))].join(", ");
  const viewSentence = summary.sumComplete
    ? `The illustrated lines use ${formatViews(summary.allocatedViewsInSum)} allocated views. The videos behind those lines have ${formatViews(summary.grossKnownVideoViews)} known views, counted once per video before any split.`
    : `Some included lines have no view count, so a single sum would be incomplete. Known allocated views on the other lines come to ${formatViews(summary.allocatedViewsInSum)}.`;

  const rates = summary.cpmScenarios.map((scenario) => `$${scenario.cpmUsd}`).join(", ");

  return [
    `I am ${handle}. I reviewed videos that mention a brand and marked the rows I am willing to call unpaid.`,
    `Brands on those rows: ${brands}.`,
    viewSentence,
    `The range uses CPM assumptions of ${rates} per thousand views. I picked those assumptions so they can be read on the page. Audience country is unknown, and a tagged location is not the audience.`,
    `Where a video names more than one resolved brand, each brand is given an equal share of that video's views. I am not adding the brands' views together into a larger reach number.`,
    `This is a pitch for a future paid post. It is not a statement that the past views were advertising the brand would have purchased.`,
  ].join(" ");
}

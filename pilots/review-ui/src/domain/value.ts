import type { Appearance, CpmScenario, ValuationLine, ValuationSummary } from "./types";

/**
 * Placeholder CPM assumptions. Teammate owns the final numbers and labels.
 * They are not a measured rate and they are not a country rate.
 */
export const CPM_SCENARIOS: CpmScenario[] = [
  { id: "low", label: "Low assumption", cpmUsd: 5, owner: "teammate" },
  { id: "mid", label: "Mid assumption", cpmUsd: 15, owner: "teammate" },
  { id: "high", label: "High assumption", cpmUsd: 40, owner: "teammate" },
];

const RESOLVED = new Set<Appearance["resolution"]>(["text_only", "visual_only", "text_and_visual"]);

export function illustrativeCents(views: number, cpmUsd: number): number {
  return Math.round((views * cpmUsd * 100) / 1000);
}

export function valueAppearances(
  appearances: Appearance[],
  scenarios: CpmScenario[] = CPM_SCENARIOS,
): ValuationSummary {
  const sharersByVideo = new Map<string, Appearance[]>();
  for (const appearance of appearances) {
    if (appearance.creatorMark === "false_positive") continue;
    if (!RESOLVED.has(appearance.resolution)) continue;
    const key = videoKey(appearance);
    const list = sharersByVideo.get(key) ?? [];
    list.push(appearance);
    sharersByVideo.set(key, list);
  }

  const included = appearances.filter((appearance) => appearance.eligible);
  const lines: ValuationLine[] = included.map((appearance) => {
    const key = videoKey(appearance);
    const sharers = sharersByVideo.get(key) ?? [appearance];
    const shareCount = sharers.length;
    const videoViews = appearance.viewsConflict ? null : appearance.viewsCount;
    const allocatedViews = videoViews === null ? null : videoViews / shareCount;
    const caveats = lineCaveats(appearance, shareCount, videoViews);
    return {
      appearanceId: appearance.id,
      brandName: appearance.brandName,
      resolution: appearance.resolution,
      videoKey: key,
      videoViews,
      allocatedViews,
      shareCount,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        cpmUsd: scenario.cpmUsd,
        illustrativeCents:
          allocatedViews === null ? null : illustrativeCents(allocatedViews, scenario.cpmUsd),
      })),
      caveats,
    };
  });

  const grossByVideo = new Map<string, number>();
  let allocatedViewsInSum = 0;
  let includedLinesMissingViews = 0;
  for (const line of lines) {
    if (line.allocatedViews === null || line.videoViews === null) {
      includedLinesMissingViews += 1;
      continue;
    }
    allocatedViewsInSum += line.allocatedViews;
    if (!grossByVideo.has(line.videoKey)) grossByVideo.set(line.videoKey, line.videoViews);
  }
  const grossKnownVideoViews = [...grossByVideo.values()].reduce((sum, views) => sum + views, 0);
  const sumComplete = lines.length > 0 && includedLinesMissingViews === 0;

  return {
    geography: "unknown",
    viewSplit: "equal_among_resolved_brands_on_video",
    dedupeKey: "platform_plus_platform_id",
    notUniqueReach: true,
    notADebt: true,
    notPurchasedMedia: true,
    cpmScenarios: scenarios,
    lines,
    grossKnownVideoViews,
    allocatedViewsInSum,
    includedLineCount: lines.length,
    includedLinesMissingViews,
    sumComplete,
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      cpmUsd: scenario.cpmUsd,
      illustrativeCents: sumComplete
        ? lines.reduce((sum, line) => {
            const match = line.scenarios.find((item) => item.id === scenario.id);
            return sum + (match?.illustrativeCents ?? 0);
          }, 0)
        : partialCents(lines, scenario.id),
    })),
  };
}

/**
 * A partial sum is still returned on each scenario so the UI can show it as
 * incomplete. Callers must read `sumComplete` before presenting it.
 */
function partialCents(lines: ValuationLine[], scenarioId: string): number | null {
  const known = lines.filter((line) => line.scenarios.some((scenario) => scenario.id === scenarioId && scenario.illustrativeCents !== null));
  if (known.length === 0) return null;
  return known.reduce((sum, line) => {
    const match = line.scenarios.find((scenario) => scenario.id === scenarioId);
    return sum + (match?.illustrativeCents ?? 0);
  }, 0);
}

function lineCaveats(appearance: Appearance, shareCount: number, videoViews: number | null): string[] {
  const caveats: string[] = [];
  if (appearance.resolution === "text_only") caveats.push("text_only");
  if (appearance.resolution === "visual_only") caveats.push("visual_only");
  if (appearance.resolution === "text_and_visual") caveats.push("text_and_visual");
  if (shareCount > 1) caveats.push("views_shared");
  if (videoViews === null) caveats.push(appearance.viewsConflict ? "views_conflict" : "views_unknown");
  if (appearance.disclosureReasons.includes("gifted_not_a_media_buy")) caveats.push("gifted_not_a_media_buy");
  if (appearance.disclosureReasons.includes("affiliate_material_connection")) {
    caveats.push("affiliate_material_connection");
  }
  if (appearance.disclosureReasons.includes("negated_disclosure_is_not_proof")) {
    caveats.push("negated_disclosure_is_not_proof");
  }
  return caveats;
}

export function videoKey(appearance: Pick<Appearance, "platform" | "platformId">): string {
  return `${appearance.platform}:${appearance.platformId}`;
}

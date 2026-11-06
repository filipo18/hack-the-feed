/** Browser-side view of POST /api/search. The server remains the source of truth. */

export interface SearchPost {
  postKey?: string;
  platform?: string;
  viewsCount?: number | null;
  canonicalPostUrl?: string | null;
  evidenceLabels?: string[];
  disclosure?: string;
  countsTowardReach?: boolean;
  verdict?: string | null;
  holdout?: string | null;
  media?: { transcript?: string | null; onScreenText?: string[] | null }[];
}

export interface SearchCreator {
  creatorKey: string;
  platform?: string;
  handle?: string;
  sumViews?: number | null;
  viewsIncomplete?: boolean;
  relevantPostCount?: number;
  disclosure?: string;
  holdoutReason?: string | null;
  why?: string | null;
  judgmentSource?: string;
  posts?: SearchPost[];
}

export interface SearchChannel {
  channel?: string;
  status?: string;
  warning?: string | null;
  retrieved?: number;
}

export interface SearchResponse {
  brand: string;
  assessment: string;
  assessmentReason: string | null;
  gmiModel?: string | null;
  sampleNote?: string;
  warnings: string[];
  channels: SearchChannel[];
  rankedCreators: SearchCreator[];
  heldOut: SearchCreator[];
  unassessedCreators: SearchCreator[];
}

export interface SearchBody {
  brand: string;
  aliases: string[];
  platforms: string[];
}

export function isSearchResponse(value: unknown): value is SearchResponse {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.brand === "string" &&
    typeof body.assessment === "string" &&
    (body.assessmentReason === null || typeof body.assessmentReason === "string") &&
    Array.isArray(body.rankedCreators) &&
    Array.isArray(body.heldOut) &&
    Array.isArray(body.unassessedCreators) &&
    Array.isArray(body.warnings) &&
    Array.isArray(body.channels)
  );
}

export function asCreator(value: unknown): SearchCreator | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SearchCreator>;
  if (typeof row.creatorKey !== "string" || !row.creatorKey) return null;
  return row as SearchCreator;
}

export function renderableCreators(rows: unknown[]): { creators: SearchCreator[]; skipped: number } {
  const creators: SearchCreator[] = [];
  let skipped = 0;
  for (const row of rows) {
    const creator = asCreator(row);
    if (creator) creators.push(creator);
    else skipped += 1;
  }
  return { creators, skipped };
}

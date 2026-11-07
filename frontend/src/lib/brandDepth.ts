import { isSearchResponse, renderableCreators, type SearchCreator, type SearchPost, type SearchResponse } from "./contract";

export const DEPTH_LIMIT = 10;
const PRODUCT_CONTEXTS = new Set(["product_use", "review", "recommendation"]);
export const CONTEXT_LABELS: Record<string, string> = {
  product_use: "Product use", review: "Review", recommendation: "Recommendation", mention: "Brand mention",
  incidental: "Incidental mention", news: "News coverage", criticism: "Criticism", unknown: "Context unknown",
};

export function matchingPosts(creator: SearchCreator): SearchPost[] {
  return Array.isArray(creator.posts) ? creator.posts.filter(post => post && post.countsTowardReach === true) : [];
}

function fitKey(creator: SearchCreator): number[] {
  const posts = matchingPosts(creator);
  const direct = posts.filter(post => PRODUCT_CONTEXTS.has(post.context ?? "unknown")).length;
  const known = posts.filter(post => post.context === "mention").length;
  return [direct > 0 ? 1 : 0, posts.length >= 2 ? 1 : 0, direct, known, posts.length, creator.sumViews ?? -1];
}

export function bestFitCreators(creators: SearchCreator[]): SearchCreator[] {
  return [...creators].sort((a, b) => {
    const left = fitKey(a), right = fitKey(b);
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return right[i] - left[i];
    return a.creatorKey.localeCompare(b.creatorKey);
  });
}

export function fitLabels(creator: SearchCreator): string[] {
  const posts = matchingPosts(creator);
  const labels = [...new Set(posts.map(post => CONTEXT_LABELS[post.context ?? "unknown"] ?? CONTEXT_LABELS.unknown))];
  return [...(posts.length >= 2 ? ["Repeated mentions"] : []), ...labels];
}

export function mergeCreatorEvidence(original: SearchCreator, additions: SearchPost[]): SearchCreator {
  const posts = new Map<string, SearchPost>();
  for (const post of original.posts ?? []) if (post.postKey) posts.set(post.postKey, { ...post });
  for (const next of additions) {
    if (!next.postKey) continue;
    const prior = posts.get(next.postKey);
    // A missing model judgment cannot erase an already assessed discovery match.
    if (prior?.assessment === "complete" && next.assessment !== "complete") continue;
    const merged = { ...next };
    if (prior) {
      merged.evidenceLabels = [...new Set([...(prior.evidenceLabels ?? []), ...(next.evidenceLabels ?? [])])];
      if (prior.disclosure === "disclosed") merged.disclosure = "disclosed";
      const conflict = prior.viewsConflict || next.viewsConflict ||
        (prior.viewsCount != null && next.viewsCount != null && prior.viewsCount !== next.viewsCount);
      merged.viewsConflict = Boolean(conflict);
      merged.viewsCount = conflict ? null : next.viewsCount ?? prior.viewsCount;
    }
    posts.set(next.postKey, merged);
  }
  const all = [...posts.values()].sort((a, b) => (b.viewsCount ?? -1) - (a.viewsCount ?? -1));
  const relevant = all.filter(post => post.countsTowardReach);
  const known = relevant.filter(post => typeof post.viewsCount === "number" && Number.isFinite(post.viewsCount) && post.viewsCount >= 0 && !post.viewsConflict);
  return {
    ...original, posts: all, relevantPostCount: relevant.length,
    sumViews: known.length ? known.reduce((sum, post) => sum + post.viewsCount!, 0) : null,
    viewsIncomplete: known.length < relevant.length,
    disclosure: all.some(post => post.disclosure === "disclosed") ? "disclosed" : "unknown",
    why: relevant.find(post => post.why)?.why ?? original.why,
    holdoutReason: relevant.length ? null : all.find(post => post.holdout)?.holdout ?? "uncertain",
  };
}

export function mergeDepthResult(data: SearchResponse, target: SearchCreator, result: SearchResponse): SearchResponse {
  const matches = renderableCreators([...result.rankedCreators, ...result.heldOut, ...result.unassessedCreators]).creators.filter(
    row => row.platform === target.platform && row.handle?.toLowerCase() === target.handle?.toLowerCase(),
  );
  const status = result.depth?.status ?? "failed";
  const current = data.rankedCreators.find(row => row.creatorKey === target.creatorKey);
  if (!current) return data;
  const merged = status === "failed" ? current : mergeCreatorEvidence(current, matches.flatMap(row => row.posts ?? []));
  const updated = { ...merged, depthStatus: status, depthHasMore: result.depth?.hasMore };
  const remains = status === "failed" || (updated.relevantPostCount ?? 0) > 0;
  return {
    ...data,
    rankedCreators: data.rankedCreators.flatMap(row => row.creatorKey === target.creatorKey ? remains ? [updated] : [] : [row]),
    heldOut: remains ? data.heldOut : [...data.heldOut, updated],
  };
}

const cache = new Map<string, { until: number; data: SearchResponse }>();

export async function searchCreatorBrand(brand: string, creator: SearchCreator, signal: AbortSignal): Promise<SearchResponse> {
  const request = { brand: brand.trim(), handle: creator.handle, platform: creator.platform, aliases: [] };
  const key = JSON.stringify(request), cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.data;
  const timeout = AbortSignal.timeout(270_000);
  const response = await fetch("/api/search/creator", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: key, signal: AbortSignal.any([signal, timeout]),
  });
  if (!response.ok) throw new Error(`Deeper search failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!isSearchResponse(data) || !data.depth || typeof data.depth.handle !== "string" ||
      !["complete", "partial", "failed"].includes(data.depth.status) ||
      data.depth.handle.toLowerCase() !== creator.handle?.toLowerCase() || data.depth.platform !== creator.platform) {
    throw new Error("The deeper search reply could not be verified.");
  }
  if (data.depth.status === "complete") {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 600_000, data });
  }
  return data;
}

export async function runDepthQueue<T>(
  creators: SearchCreator[], run: (creator: SearchCreator) => Promise<T>,
  done: (creator: SearchCreator, result?: T) => void, signal: AbortSignal,
): Promise<void> {
  const queue = creators.slice(0, DEPTH_LIMIT);
  async function worker() {
    while (queue.length && !signal.aborted) {
      const creator = queue.shift()!;
      let result: T | undefined;
      try { result = await run(creator); } catch { /* Keep discovery results; report this creator's failure. */ }
      if (!signal.aborted) done(creator, result);
    }
  }
  await Promise.all([worker(), worker()]);
}

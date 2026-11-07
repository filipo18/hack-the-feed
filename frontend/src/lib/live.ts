import type { OutreachDraft } from "../components/OutreachDialog";
import { renderableCreators, type SearchCreator, type SearchResponse } from "./contract";
import { compact } from "./format";
import { evidenceExcerpt, evidenceLabels } from "./present";
import type { CardItem } from "./view";
import { CONTEXT_LABELS, fitLabels, matchingPosts } from "./brandDepth";

/** A ranked creator from POST /api/search, shaped for the cards and the desk. */
export interface LiveCreator {
  key: string;
  handle: string;
  platform: string;
  views: number | null;
  viewsIncomplete: boolean;
  posts: number;
  why: string | null;
  labels: string[];
  excerpt: string | null;
  postUrl: string | null;
  thumbnail: string | null;
  raw: SearchCreator;
}

export function liveCreators(data: SearchResponse): LiveCreator[] {
  return renderableCreators(data.rankedCreators).creators.map((creator) => {
    const posts = creator.posts ?? [];
    const post = posts.find((item) => item.countsTowardReach) ?? posts[0];
    const views = typeof creator.sumViews === "number" && Number.isFinite(creator.sumViews) ? creator.sumViews : null;
    return {
      key: creator.creatorKey,
      handle: creator.handle || creator.creatorKey,
      platform: creator.platform || "platform unknown",
      views,
      viewsIncomplete: Boolean(creator.viewsIncomplete),
      posts: creator.relevantPostCount ?? 0,
      why: creator.why?.trim() || null,
      labels: evidenceLabels(creator),
      excerpt: evidenceExcerpt(creator),
      postUrl: post?.canonicalPostUrl ?? null,
      thumbnail: post?.media?.flatMap((media) => media.frames ?? [])
        .map((frame) => safeHttpsUrl(frame.url)).find((url) => url !== null) ?? null,
      raw: creator,
    };
  });
}

export function liveItem(brand: string, creator: LiveCreator): CardItem {
  return {
    id: creator.key,
    title: `@${creator.handle}`,
    subtitle: `${creator.platform} · ${creator.posts} matching ${creator.posts === 1 ? "post" : "posts"} found`,
    reason: creator.excerpt ? (creator.why ?? undefined) : undefined,
    amount: creator.views === null ? "Views unknown" : compact(creator.views),
    amountNote: creator.views === null ? undefined : creator.viewsIncomplete ? "some views missing" : "views",
    quote: creator.excerpt ?? creator.why ?? "No text excerpt was returned.",
    where: creator.labels.length > 0 ? creator.labels.join(", ") : "No evidence label",
    views: creator.views,
    unit: "views",
    postUrl: creator.postUrl,
    thumbnail: creator.thumbnail,
    highlight: brand,
    signals: fitLabels(creator.raw),
    depthLabel: creator.raw.depthStatus === "checking" ? "Checking more posts…"
      : creator.raw.depthStatus === "failed" ? "Deeper check unavailable · initial matches shown"
      : creator.raw.depthStatus === "partial" ? "Deeper check incomplete · verified matches shown"
      : creator.raw.depthStatus === "complete" ? creator.raw.depthHasMore ? "20-post search limit reached · more may exist" : "Deeper check complete · indexed matches only"
      : "Initial search only",
    matches: matchingPosts(creator.raw).map((post, index) => ({
      id: post.postKey ?? String(index),
      postUrl: safeHttpsUrl(post.canonicalPostUrl),
      thumbnail: post.media?.flatMap(media => media.frames ?? []).map(frame => safeHttpsUrl(frame.url)).find(Boolean) ?? null,
      context: CONTEXT_LABELS[post.context ?? "unknown"] ?? CONTEXT_LABELS.unknown,
      why: post.why ?? post.caption ?? "No explanation returned for this post.",
      views: post.viewsConflict ? null : post.viewsCount ?? null,
    })),
  };
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Sum of the known view counts. `known` is false when no creator had a number. */
export function liveViews(creators: LiveCreator[]): { total: number; known: boolean; missing: boolean } {
  let total = 0;
  let known = false;
  let missing = false;
  for (const creator of creators) {
    if (creator.views === null) missing = true;
    else {
      total += creator.views;
      known = true;
    }
    if (creator.viewsIncomplete) missing = true;
  }
  return { total, known, missing };
}

export function liveFoundIn(creators: LiveCreator[]): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const creator of creators) {
    for (const label of creator.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function liveOutreach(brand: string, creator: LiveCreator): OutreachDraft {
  const seen = creator.postUrl ? `We saw ${brand} in your ${creator.platform} post: ${creator.postUrl}` : `We saw ${brand} in your ${creator.platform} posts.`;
  const views =
    creator.views === null
      ? "We loved it."
      : `The posts we found have ${compact(creator.views)} views, and we loved them.`;
  return {
    title: `Reach out to @${creator.handle}`,
    message: `Hi ${creator.handle},\n\n${seen}${creator.why ? ` ${creator.why}` : ""}\n\n${views} Since you're already showing ${brand}, would you like to do a paid collaboration?\n\nAre you open to a short call this week?\n\nThis draft was written in the browser and has not been sent.`,
  };
}

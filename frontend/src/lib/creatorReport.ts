import type { CreatorEntity } from "./types";

/** Prefer the observed frame; a post preview only identifies the source video. */
export function videoPreviewUrl(evidence: CreatorEntity["evidence"], thumbnail?: string | null): string | null {
  for (const value of [...evidence.map((item) => item.frameUrl), thumbnail]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch {
      // Missing or malformed provider images should not hide the text evidence.
    }
  }
  return null;
}

/** View counts belong to distinct posts, not to each extracted mention. */
export function postViews(posts: { platformId: string; views: number | null }[]) {
  const distinct = [...new Map(posts.map((post) => [post.platformId, post])).values()];
  const known = distinct.filter((post) => post.views != null);
  return {
    total: known.length ? known.reduce((sum, post) => sum + post.views!, 0) : null,
    incomplete: known.length < distinct.length,
  };
}

import { describe, expect, it } from "vitest";
import { postViews, videoPreviewUrl } from "./creatorReport";
import type { CreatorEntity } from "./types";

describe("creator post views", () => {
  it("counts a post once even when several evidence rows refer to it", () => {
    expect(postViews([
      { platformId: "one", views: 1400000 },
      { platformId: "one", views: 1400000 },
      { platformId: "two", views: 2000000 },
    ])).toEqual({ total: 3400000, incomplete: false });
  });

  it("preserves unknown counts and real zero counts", () => {
    expect(postViews([{ platformId: "one", views: null }])).toEqual({ total: null, incomplete: true });
    expect(postViews([{ platformId: "one", views: 0 }])).toEqual({ total: 0, incomplete: false });
    expect(postViews([{ platformId: "one", views: 1000 }, { platformId: "two", views: null }]))
      .toEqual({ total: 1000, incomplete: true });
  });
});

describe("video preview selection", () => {
  const frame = (frameUrl: string): CreatorEntity["evidence"][number] => ({
    postId: "one", platformId: "post-one", publishedAt: null, views: null,
    field: "frame", snippet: null, timestampSeconds: 12, frameId: "frame-one",
    frameUrl, source: "vision", reviewStatus: "unreviewed",
  });

  it("prefers the observed frame to the general post preview", () => {
    expect(videoPreviewUrl([frame("https://images.example/evidence.jpg")], "https://images.example/preview.jpg"))
      .toBe("https://images.example/evidence.jpg");
    expect(videoPreviewUrl([], "https://images.example/preview.jpg")).toBe("https://images.example/preview.jpg");
  });

  it("ignores unsafe URLs and preserves a valid fallback", () => {
    expect(videoPreviewUrl([frame("javascript:alert(1)")], "https://images.example/preview.jpg"))
      .toBe("https://images.example/preview.jpg");
    expect(videoPreviewUrl([], "https://user:secret@images.example/preview.jpg")).toBeNull();
    expect(videoPreviewUrl([], "http://images.example/preview.jpg")).toBeNull();
    expect(videoPreviewUrl([], "broken")).toBeNull();
    expect(videoPreviewUrl([])).toBeNull();
  });
});

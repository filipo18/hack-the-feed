import { describe, expect, it } from "vitest";
import { postViews } from "./creatorReport";

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

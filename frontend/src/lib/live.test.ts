import { describe, expect, it } from "vitest";
import type { SearchResponse } from "./contract";
import { liveCreators, liveItem } from "./live";

function response(frames: { url: string | null }[]): SearchResponse {
  return {
    brand: "Nike", assessment: "complete", assessmentReason: null,
    warnings: [], channels: [], heldOut: [], unassessedCreators: [],
    rankedCreators: [{
      creatorKey: "instagram:creator", handle: "creator", sumViews: 100,
      relevantPostCount: 1,
      posts: [
        { countsTowardReach: false, media: [{ frames: [{ url: "https://images.example/unrelated.jpg" }] }] },
        { countsTowardReach: true, media: [{ frames }] },
      ],
    }],
  };
}

describe("live post previews", () => {
  it("uses excerpts only from matching posts, including captions", () => {
    const data = response([]);
    data.rankedCreators[0].posts![0].media = [{ transcript: "Unrelated high-view post" }];
    data.rankedCreators[0].posts![1].caption = "I run in Nike shoes.";
    expect(liveCreators(data)[0].excerpt).toBe("I run in Nike shoes.");
  });
  it("uses an Oriane frame from the relevant post on the creator card", () => {
    const creator = liveCreators(response([{ url: "https://images.example/relevant.jpg" }]))[0];
    expect(liveItem("Nike", creator).thumbnail).toBe("https://images.example/relevant.jpg");
  });

  it("skips missing or unsafe frame URLs and preserves a clean fallback", () => {
    const creator = liveCreators(response([{ url: null }, { url: "javascript:alert(1)" }]))[0];
    expect(liveItem("Nike", creator).thumbnail).toBeNull();
  });
});

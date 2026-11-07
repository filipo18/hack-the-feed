import { describe, expect, it } from "vitest";
import { bestFitCreators, mergeCreatorEvidence, runDepthQueue } from "./brandDepth";
import type { SearchCreator, SearchPost } from "./contract";

const post = (postKey: string, viewsCount: number | null = 100, context = "product_use"): SearchPost => ({
  postKey, viewsCount, countsTowardReach: true, assessment: "complete", context,
  verdict: "relevant", holdout: null, why: "Uses Nike shoes.",
});
const creator = (key: string, posts: SearchPost[]): SearchCreator => ({
  creatorKey: key, handle: key, platform: "instagram", posts,
  relevantPostCount: posts.length, sumViews: posts.reduce((sum, p) => sum + (p.viewsCount ?? 0), 0),
});

describe("deeper brand evidence", () => {
  it("merges distinct posts without adding duplicate views", () => {
    const first = creator("runner", [post("one")]);
    const merged = mergeCreatorEvidence(first, [post("one"), post("two", 200)]);
    expect(merged.relevantPostCount).toBe(2);
    expect(merged.sumViews).toBe(300);
  });

  it("keeps prior judgments when the deeper assessment is missing", () => {
    const first = creator("runner", [post("one")]);
    const merged = mergeCreatorEvidence(first, [{ ...post("one"), assessment: "pending", countsTowardReach: false },
      { ...post("two"), assessment: "pending", countsTowardReach: false }]);
    expect(merged.sumViews).toBe(100);
    expect(merged.relevantPostCount).toBe(1);
  });

  it("does not invent views for missing or conflicting counts", () => {
    const merged = mergeCreatorEvidence(creator("runner", [post("one", 100)]), [post("one", 120), post("two", null)]);
    expect(merged.sumViews).toBeNull();
    expect(merged.viewsIncomplete).toBe(true);
    expect(merged.relevantPostCount).toBe(2);
  });

  it("removes a post from totals when new completed evidence holds it out", () => {
    const merged = mergeCreatorEvidence(creator("runner", [post("one")]), [{ ...post("one"), countsTowardReach: false, holdout: "incidental" }]);
    expect(merged.relevantPostCount).toBe(0);
    expect(merged.sumViews).toBeNull();
  });

  it("puts direct and repeated product evidence before a huge incidental mention", () => {
    const viral = creator("viral", [post("v", 10000000, "mention")]);
    const repeat = creator("repeat", [post("a", 100, "review"), post("b", 100, "product_use")]);
    const unknown = creator("unknown", [post("u", 500000, "unknown")]);
    expect(bestFitCreators([viral, repeat, unknown]).map(c => c.creatorKey)).toEqual(["repeat", "viral", "unknown"]);
    expect(viral.posts?.length).toBe(1);
  });

  it("runs only ten creators, at most two at once, and continues after failures", async () => {
    let active = 0, peak = 0, called = 0, finished = 0;
    await runDepthQueue(Array.from({ length: 12 }, (_, i) => creator(String(i), [])), async () => {
      called++; active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      if (called < 3) throw new Error("provider failed");
    }, () => { finished++; }, new AbortController().signal);
    expect(called).toBe(10);
    expect(peak).toBe(2);
    expect(finished).toBe(10);
  });

  it("does not start queued work after navigation cancels the search", async () => {
    const controller = new AbortController();
    let calls = 0;
    await runDepthQueue([creator("a", []), creator("b", []), creator("c", [])], async () => {
      calls++; controller.abort();
    }, () => {}, controller.signal);
    expect(calls).toBe(1);
  });
});

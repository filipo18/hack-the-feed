import { useEffect, useState } from "react";
import { searchBrand } from "./brandSearch";
import { renderableCreators, type SearchResponse } from "./contract";
import { DEPTH_LIMIT, matchingPosts, mergeDepthResult, runDepthQueue, searchCreatorBrand } from "./brandDepth";

export type BrandSearchState =
  | { status: "loading" }
  | { status: "ready"; data: SearchResponse; deeper: { total: number; finished: number; failed: number } }
  | { status: "error"; message: string };

export function useBrandSearch(brand: string): BrandSearchState {
  const [state, setState] = useState<BrandSearchState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setState({ status: "loading" });
    searchBrand(brand).then(
      (data) => {
        if (!live) return;
        const rankedCreators = renderableCreators(data.rankedCreators).creators;
        const targets = rankedCreators.filter(row => typeof row.handle === "string" && row.handle && typeof row.platform === "string" && matchingPosts(row).some(post => post.postKey)).slice(0, DEPTH_LIMIT);
        const keys = new Set(targets.map(row => row.creatorKey));
        setState({ status: "ready", data: { ...data, rankedCreators: rankedCreators.map(row => keys.has(row.creatorKey) ? { ...row, depthStatus: "checking" } : row) }, deeper: { total: targets.length, finished: 0, failed: 0 } });
        void runDepthQueue(targets, creator => searchCreatorBrand(brand, creator, controller.signal), (creator, result) => {
          if (!live) return;
          setState(previous => {
            if (previous.status !== "ready") return previous;
            const failed = !result || result.depth?.status !== "complete";
            const updated = result ? mergeDepthResult(previous.data, creator, result) : {
              ...previous.data, rankedCreators: previous.data.rankedCreators.map(row => row.creatorKey === creator.creatorKey ? { ...row, depthStatus: "failed" as const } : row),
            };
            return { status: "ready", data: updated, deeper: { ...previous.deeper, finished: previous.deeper.finished + 1, failed: previous.deeper.failed + Number(failed) } };
          });
        }, controller.signal);
      },
      (error: unknown) => {
        if (!live) return;
        const message = error instanceof Error ? error.message : "Search failed. No results were invented.";
        setState({ status: "error", message });
      },
    );
    return () => {
      live = false;
      controller.abort();
    };
  }, [brand]);

  return state;
}

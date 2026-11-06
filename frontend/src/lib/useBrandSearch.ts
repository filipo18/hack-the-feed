import { useEffect, useState } from "react";
import { searchBrand } from "./brandSearch";
import type { SearchResponse } from "./contract";

export type BrandSearchState =
  | { status: "loading" }
  | { status: "ready"; data: SearchResponse }
  | { status: "error"; message: string };

export function useBrandSearch(brand: string): BrandSearchState {
  const [state, setState] = useState<BrandSearchState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    searchBrand(brand).then(
      (data) => {
        if (live) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (!live) return;
        const message = error instanceof Error ? error.message : "Search failed. No results were invented.";
        setState({ status: "error", message });
      },
    );
    return () => {
      live = false;
    };
  }, [brand]);

  return state;
}

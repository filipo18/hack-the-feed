import { describe, expect, it, vi } from "vitest";
import { searchBrand } from "./brandSearch";
import { isSearchResponse } from "./contract";

const ready = {
  brand: "Ryanair",
  assessment: "complete",
  assessmentReason: null,
  gmiModel: "configured-by-env",
  warnings: [],
  channels: [],
  rankedCreators: [],
  heldOut: [],
  unassessedCreators: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("searchBrand", () => {
  it("posts the brand contract to /api/search and returns the body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ready));
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchBrand(" Ryanair ");
    expect(result.brand).toBe("Ryanair");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/search");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      brand: "Ryanair",
      aliases: [],
      platforms: ["instagram"],
    });
    vi.unstubAllGlobals();
  });

  it("rejects a provider failure instead of substituting sample rows", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "upstream failed" }, 502)));
    await expect(searchBrand("Ryanair")).rejects.toThrow(/upstream failed|HTTP 502/);
    vi.unstubAllGlobals();
  });

  it("rejects a body that is not the search contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ creators: [{ handle: "sample.sofia" }] })),
    );
    await expect(searchBrand("Ryanair")).rejects.toThrow(/shape/);
    expect(isSearchResponse({ creators: [] })).toBe(false);
    vi.unstubAllGlobals();
  });

  it("reports a network failure without inventing creators", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(searchBrand("Ryanair")).rejects.toThrow(/could not reach/);
    vi.unstubAllGlobals();
  });
});

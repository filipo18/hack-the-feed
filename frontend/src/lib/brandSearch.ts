import { isSearchResponse, type SearchBody, type SearchResponse } from "./contract";

export class SearchFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchFailure";
  }
}

export function searchRequest(brand: string): SearchBody {
  return {
    brand: brand.trim(),
    aliases: [],
    platforms: ["instagram", "tiktok"],
  };
}

export async function searchBrand(brand: string): Promise<SearchResponse> {
  const request = searchRequest(brand);
  let response: Response;
  try {
    response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new SearchFailure("The browser could not reach /api/search. No results were invented.");
  }
  if (!response.ok) throw new SearchFailure(await readFailure(response));
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SearchFailure("The server reply was not JSON. Nothing was ranked.");
  }
  if (!isSearchResponse(payload)) {
    throw new SearchFailure("The server returned a shape this screen cannot show. Nothing was ranked.");
  }
  return payload;
}

async function readFailure(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
    else if (Array.isArray(body.detail)) {
      detail = body.detail
        .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : ""))
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    detail = "";
  }
  if (response.status === 429) return detail || "Too many searches. Wait a minute and try again.";
  if (response.status === 422) return detail || "That search was rejected. Check the brand name.";
  return detail || `Search failed (HTTP ${response.status}). No results were invented.`;
}

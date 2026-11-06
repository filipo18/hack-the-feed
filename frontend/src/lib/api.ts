import { sampleBrand, sampleCreator } from "./sample";
import type { BrandResult, CreatorResult } from "./types";

const API_URL: string | undefined = import.meta.env.VITE_API_URL;

/** Without VITE_API_URL the app runs on synthetic rows and says so on screen. */
export const USING_SAMPLE_DATA = !API_URL;

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch {
    throw new Error("The search could not reach the backend.");
  }
  if (!response.ok) throw new Error(`The search failed with status ${response.status}.`);
  return response.json();
}

export function searchBrand(brand: string): Promise<BrandResult> {
  if (USING_SAMPLE_DATA) return Promise.resolve(sampleBrand(brand));
  return get(`/brands/${encodeURIComponent(brand)}/creators`);
}

export function searchCreator(handle: string): Promise<CreatorResult> {
  if (USING_SAMPLE_DATA) return Promise.resolve(sampleCreator(handle));
  return get(`/creators/${encodeURIComponent(handle.replace(/^@/, ""))}/mentions`);
}

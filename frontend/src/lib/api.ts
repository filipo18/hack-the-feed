import { sampleBrand, sampleCreator } from "./sample";
import type { BrandResult, CreatorResult } from "./types";

const API_URL: string | undefined = import.meta.env.VITE_API_URL;

export interface Loaded<T> {
  data: T;
  /** True when these are sample rows. The screen must show the "Sample data" tag. */
  sample: boolean;
}

/**
 * Live data overrides sample data, one endpoint at a time.
 * Without a backend, or when an endpoint is missing or returns another shape, the screen stays on sample rows.
 */
async function load<T>(path: string, isValid: (body: T) => boolean, sample: () => T): Promise<Loaded<T>> {
  if (!API_URL) return { data: sample(), sample: true };
  try {
    const response = await fetch(`${API_URL}${path}`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = (await response.json()) as T;
    if (!isValid(body)) throw new Error("unexpected response shape");
    return { data: body, sample: false };
  } catch (reason) {
    console.warn(`Using sample data for ${path}: ${(reason as Error).message}`);
    return { data: sample(), sample: true };
  }
}

export function searchBrand(brand: string): Promise<Loaded<BrandResult>> {
  return load(
    `/brands/${encodeURIComponent(brand)}/creators`,
    (body) => Array.isArray(body?.creators),
    () => sampleBrand(brand),
  );
}

export function searchCreator(handle: string): Promise<Loaded<CreatorResult>> {
  const clean = handle.replace(/^@/, "");
  return load(
    `/creators/${encodeURIComponent(clean)}/mentions`,
    (body) => Array.isArray(body?.brands) && Boolean(body?.creator),
    () => sampleCreator(clean),
  );
}

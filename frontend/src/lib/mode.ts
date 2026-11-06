/**
 * Build with VITE_SAMPLE=1 for the hosted demo on synthetic rows.
 * The default build is live only: it never shows sample rows.
 */
export const SAMPLE_MODE = import.meta.env.VITE_SAMPLE === "1";

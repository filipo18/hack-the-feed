/**
 * Seam for the creator-report change. That work owns POST /api/creator-report
 * and the creator screens. This build does not call the endpoint and does not
 * invent its rows. Leave CREATOR_REPORT_READY false until that contract is integrated.
 */
export const CREATOR_REPORT_PATH = "/api/creator-report";
export const CREATOR_REPORT_READY = false;

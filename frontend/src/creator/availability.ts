/**
 * Creator screens call POST /api/creator-report. They do not mount the old sample workspace.
 * A missing model stays unassessed in the response. This flag does not invent rows.
 */
export const CREATOR_REPORT_PATH = "/api/creator-report";
export const CREATOR_REPORT_READY = true;

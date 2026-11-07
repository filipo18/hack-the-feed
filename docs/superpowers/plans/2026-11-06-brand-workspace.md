# Brand workspace implementation plan

**Goal:** Complete the approved browser-local search, evidence review, shortlist, and outreach flow.

**Architecture:** Keep the existing brand search hook and its progressive evidence checks. Store the latest report and saved creator snapshots separately per brand in this browser. Extract the brand workspace from AppPages without changing creator routes or the public search implementation.

**Approved design:** Always show search state and recovery actions. Overview summarizes the latest search and saved work; Creators contains the shortlist; Outreach tracks saved creators and editable drafts. Changing brands switches browser-local workspaces. No authentication or message sending is added.

**Constraints:** Production frontend only. Preserve concurrent brand-depth and creator-report work. Views remain distinct relevant post views in the retrieved sample; disclosure remains disclosed or unknown. Storage failures must be visible and must not crash the workspace.

## Tasks

- [x] Add browser regressions for empty/excluded results, failed-search recovery, persistence through refresh, navigation without repeated searches, brand isolation, drafts, and outreach progression. Run against the existing UI and confirm failures.
- [x] Implement a workspace storage hook and search runner using the existing useBrandSearch. Preserve saved creator snapshots across empty/failed searches, and report browser storage failures.
- [x] Build overview, evidence review, saved creators, brand switching, and outreach controls using existing components. Add draft-save support to OutreachDialog without changing existing callers.
- [x] Run frontend tests, build, browser regressions, and desktop/mobile visual checks. Review the diff and fix material findings.

## Review focus

- Search completion after a brand switch must not update the new brand.
- A failed refresh must retain the prior report and saved work with clear status.
- No ranked creators must still show counts, excluded/unassessed evidence, and actions.
- Saving and removing a creator must persist without duplicate entries or lost outreach state.
- Cached reports must be labeled with their timestamp, and storage errors must not claim data was saved.

## Execution notes

Working in the supplied checkout to integrate with ongoing frontend work. Changes are confined to new workspace files, the brand branch in AppPages, and optional dialog callbacks. User approved implementation in the chat; no additional design approval needed.

Legacy outreach stages migrate when the creator appears in a search; unmatched stages remain pending. Saved snapshots remain independent of later searches. Evidence saved during a deeper check is labeled incomplete. Failed browser writes retain a per-brand copy in memory for the lifetime of this tab.

Independent review identified two storage-failure cases: failed session writes blocking brand switching, and failed workspace writes losing in-memory state on brand switches. Both were reproduced or verified in code, fixed, and covered by browser regressions. The mobile dialog overflow and view sorting after progressive evidence updates were also caught by failing browser checks and fixed.

Verification: production build passed; 22 frontend unit tests passed; all 12 workspace browser tests passed. The broader existing browser run passed 26 of 27 tests; the remaining creator reduced-motion test encountered a temporary static-page 404 while another build replaced dist and passed when rerun against stable assets. Desktop and 390px mobile screenshots were inspected. Tests used installed Chromium and an existing Python environment via temporary Playwright configs because the default config expects a missing Chrome installation and backend/.venv. Providers were disabled and search responses mocked in workspace tests. No deployment performed.

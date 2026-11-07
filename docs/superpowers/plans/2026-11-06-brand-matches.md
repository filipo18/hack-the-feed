# Better brand matches implementation plan

**Goal:** Find more distinct matching posts from discovered creators and explain partnership relevance.

**Architecture:** Preserve the existing discovery request and view-based API ranking. Add a bounded creator-and-brand search endpoint, progressively called for the first ten eligible creators with two browser workers. Merge distinct posts without losing verified initial results on a provider failure. Add post context labels, a separate Best fit UI sort, and an expandable evidence gallery.

**Approved scope:** User approved deeper creator searches, context classification, evidence, and a separate Best fit order. Campaign demographic filters are deferred because those attributes are not currently verified. No deployment configuration changes or historical pilot changes.

## Constraints and decisions
- Exact platform and creator handle, AND brand matches across caption, hashtags, mentions, transcript, and OCR.
- Maximum two pages of ten per creator; at most ten creators automatically, two requests in flight.
- GMI classifies batches of ten, preserving unknown context when evidence is missing. Product use, review, recommendation, mention, incidental, news, and criticism are distinct.
- Original distinct relevant view ranking remains available. Best fit prioritizes direct product evidence, repeated relevant posts, direct evidence count, then known views. This is a transparent heuristic, not a prediction of campaign performance.
- Initial results remain visible. Failed/partial deeper checks are explicit and cannot erase prior assessed posts. New unassessed posts never contribute views.
- Cache complete deeper results for the existing TTL; do not cache incomplete work. Keep keys server-side.

## Tasks
- [x] Backend: regression tests for context validation, exact scope, pagination, deduplication, missing model judgments, provider failures, and cache isolation; implement the bounded endpoint and context annotations.
- [x] Frontend: tests for preserving initial evidence on failures, deduplication, safe view totals, best-fit ordering, and bounded progressive work; implement requests, merge, cancellation, labels, sort, and evidence gallery.
- [x] Verify backend/frontend suites, build, browser progressive success/failure, mobile layout; review changes; publish through existing main/Vercel integration and verify live search.

## Review focus
Unknown context must not become a recommendation. Cross-platform or wrong-author responses must be discarded. Partial model responses must remain marked partial. Duplicate/conflicting view counts cannot inflate totals. Navigating to another brand must stop queued requests and prevent stale UI updates.

## Verification so far

50 backend tests, 22 frontend tests, and production build passed. Seven browser integration checks passed; the added malformed-row regression failed before the fix and passed afterward. Independent review found that regression and it was fixed. Current official Oriane schema at https://connect.oriane.xyz/rest/docs verifies all five text filters, exact profileHandle, platform, and offset pagination.

Production commit `63558d9` deployed through Git-triggered Vercel production deployment `dpl_3eHc44MxKhjz4XMwXr6Hcz4jubNy`. Live Birkenstock discovery returned 12 ranked creators and 13 matching posts in 19 seconds. All ten deeper checks completed by 46 seconds, increasing the shortlist to 18 matching posts; `jwstudios` increased from one to three. Chromium verified counts, galleries, zero page errors, and no horizontal overflow at 390px. Screenshots and response captures are in ignored `dist/brand-fit-*` and `dist/live-brand-*` files.

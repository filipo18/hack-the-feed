# Acceptance

Run `bash scripts/acceptance.sh`. It prints `PASS`, `FAIL`, or `BLOCKED` and does not print secret values.

Live HTTPS and a real Oriane + GMI search stay `BLOCKED` until `ORIANE_API_KEY`, `GMI_API_KEY`, `GMI_MODEL`, `PUBLIC_HTTPS_URL`, and `GMI_CONSOLE_TOKEN` exist, and until a container budget is known. A localhost run is not that check.

## Checks

1. Production build and the combined image boot together and serve the UI plus `GET /health`. Reloading `/brands/Ryanair` returns the app. Assets load from `/assets/`.
2. Brand search posts `/api/search`. Ranked cards show why, evidence, and views. Held-out and unassessed rows stay out of the ranking. `/demo/brand-search` is the only mocked brand fixture, and it is labeled. A live provider call is blocked without keys.
3. Missing Oriane config, HTTP failure, a malformed model body, a missing view count, and an empty sample each render an explicit state. The browser stays on one origin.
4. HTTPS is Caddy on the same container when `TLS_DOMAIN` and `TLS_EMAIL` are set. Keys are runtime env only. This is not deploy-ready while the hostname, entitlement, and budget are unknown.
5. `/login` is demo access and checks no password. `/creators/:handle` says the creator report is not connected. `POST /api/creator-report` is not in this change.
6. After a public URL exists: open `/` over HTTPS, reload `/brands/Ryanair`, run a real Ryanair search, and capture one controlled error. That pass is still blocked.

## Frontend PR #5 issues

| Severity | Where | What changed |
| --- | --- | --- |
| High | `frontend/src/lib/api.ts`, `frontend/API.md` | The UI called `GET /brands/...` and `GET /creators/...`, then swapped in sample rows on any miss. Brand search now posts `/api/search` and surfaces the error. |
| High | `frontend/src/pages/BrandResults.tsx`, `frontend/src/lib/rank.ts`, `frontend/src/lib/value.ts` | Cards claimed ad posts were removed and priced reach from followers and market, and treated a missing view as zero. Live cards show why, evidence, disclosure, and views. |
| High | `frontend/.env.example`, `frontend/vite.config.ts` | `VITE_API_URL` pointed the browser at another origin. The hosted UI and API share one origin. Dev uses a proxy. |
| Medium | `frontend/src/pages/Login.tsx`, `frontend/src/components/Nav.tsx` | Login looked like an account check. The control is labeled demo access. |
| Medium | `frontend/src/pages/CreatorResults.tsx`, `frontend/src/lib/sample.ts` | Creator screens presented sample brands as a result. Those screens are not mounted. `/creators/:handle` says the report is unavailable. The creator endpoint is a separate change. |
| Medium | `frontend/src/content.ts` | The name and hero still say unpaid. The footer and result note say disclosure is disclosed or unknown, and marketing figures are examples. |
| Low | `frontend/src/components/OutreachDialog.tsx`, `frontend/src/lib/session.ts` | A failed copy and a bad stored session no longer throw. |

PR #6 stays a separate pilot. It is not a creator endpoint and it is not merged here.

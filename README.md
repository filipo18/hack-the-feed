# hack-the-feed

Brand search is the production path. The UI in [`frontend/`](frontend/) and the API in [`backend/`](backend/) are served together from the repo-root image. See [`ACCEPTANCE.md`](ACCEPTANCE.md) and [`backend/DEPLOY.md`](backend/DEPLOY.md).

```bash
bash scripts/acceptance.sh
```

The creator report is not connected. `/creators/:handle` says so. A separate creator-discovery pilot is not an endpoint and is not part of this branch.

Two preliminary pilots sit under `pilots/`. Each was tested on its own before import. Together they are a local starting point: a pinned public API snapshot, a keyless 401 record, synthetic fixtures, and review rules. Tilen owns pricing and copy.

No API key and no auth header are in this repo. Nothing here is an authenticated Oriane result.

## Where the pilots live

| Path | Role |
| --- | --- |
| [`pilots/oriane-api`](pilots/oriane-api) | Probe. Public OpenAPI snapshot, keyless 401 evidence, one synthetic content fixture, offline unit tests. `execute()` refuses to send. |
| [`pilots/review-ui`](pilots/review-ui) | Historical synthetic pilot. Review rules on synthetic rows, an illustrative view split, and its own Vite config. It stays here. It is not the production frontend. |

Scope for the first brand pass, including the test plan, is in [`SCOPE.md`](SCOPE.md).

## How to run

Oriane probe, from `pilots/oriane-api`:

```bash
python3 -m unittest discover -s tests -v
python3 -m oriane_probe
```

The suite is 13 tests. The second command rewrites `evidence/capability-report.json` from the pinned snapshot and the recorded gate files. It does not call Oriane. `scripts/refresh_openapi_snapshot.py` fetches the public docs HTML only. Leave it until the docs page should replace the snapshot.

Review UI, from `pilots/review-ui`:

```bash
npm ci
npm test
npm run typecheck
npm run dev
```

`npm test` is `vitest run` (`test/pilot.test.ts`), 22 tests. `npm run dev` serves the synthetic review page at http://127.0.0.1:47321. `npm ci` uses the committed lockfile.

## What was checked, and what is synthetic

| Item | Status |
| --- | --- |
| Public OpenAPI 3.0 snapshot (`pilots/oriane-api/schema/openapi.snapshot.json`) | Fetched 2026-11-06 from the Scalar page at https://connect.oriane.xyz/rest/docs (iframe on https://www.oriane.xyz/api). Hash in `schema/PROVENANCE.json`. `live_authenticated_calls` is false. |
| Keyless gate | Live POSTs on 2026-11-06 to `/rest/contents/search`, `/rest/profiles/search`, and `/rest/assets`. Each returned HTTP 401, operation `AUTHENTICATION`, code `UNAUTHORIZED`, message `Authorization failed.`, empty context, no `WWW-Authenticate`. No content payload. Header name and scheme stay unknown. `Authorization: Bearer` and `x-api-key` were not tried. |
| Probe unit tests | 13 offline tests. They check the snapshot, the recorded 401s, and the synthetic fixture. |
| Review unit tests and typecheck | 22 tests on synthetic rows, plus `tsc --noEmit`. |
| `fixtures/synthetic_content_full.json` | Synthetic. The caption is a fixture, not a creator. |
| Review demo rows | Synthetic. `origin: "synthetic"`, label `SYNTHETIC FIXTURE — not a live Oriane row`, handle `@sample.creator.demo`, brands Paper Kettle and Lumen Soap. Apple and Stanley are homonym traps. |
| Creator `agatha.catchrain` | Chosen demo handle only. No request was sent. See `SCOPE.md`. |
| Ryanair hashtags on that account | User report. Unverified. |
| Illustrative dollars | Prototype placeholders. See below. |

`pilots/oriane-api/README.md` ranks short-build ideas from the schema, including a recommendation to show caption, transcript, and on-screen text together. `pilots/review-ui` is a separate synthetic review of brand text. Those notes stay inside each pilot. This root file does not pick the Lovable screen.

## Illustrative money

`pilots/review-ui/src/domain/value.ts` keeps an equal split of a video's views across resolved brands, and three CPM placeholders: $5, $15, and $40 (`owner: "teammate"`). Sentences live in `src/domain/copy.ts`. The invoice banner in that pilot says it is not a bill.

Those figures and the equal split are arbitrary prototype assumptions. They are not a settled pricing method, a country rate, a debt, or a media buy. Tilen owns the final numbers and the copy. Leave `CPM_SCENARIOS` and `copy.ts` for Tilen to replace. Missing views stay null.

## Blockers before a live row

- No API key in this repo. Issuance is described on the public docs as https://app.oriane.xyz/billing/subscription?tab=api. This pilot did not open that page or create an account.
- The auth header name and scheme are undocumented. The 401 body does not name them. Do not guess a header, and do not treat private traffic as evidence.
- `execute()` still raises if a key is passed in. A real send can spend credits. Credit cost of `projection=default` and `projection=full` is unknown. HTTP 402 is documented with an empty description.
- No authenticated payload: no post list, view count, caption, hashtag, transcript, title, or frame for any creator, including `agatha.catchrain`.
- The user report that `agatha.catchrain` uses Ryanair hashtags is unverified.
- Content `title` is a nullable field on the pinned schema. The review mapper does not copy it yet. A null title is an empty field, not a finding that the brand is absent.
- The REST schema has no canonical post URL and no paid-partnership field. The review pilot leaves both unset on purpose.
- A known Ryanair logo or livery asset is optional and is not in this repo. Color match is weak evidence. See `SCOPE.md`.
- Product-help limits (about a 3-month window, accounts under 5,000 followers, indexing lag) are help-page prose. They are not confirmed as rules of this REST API.
- Whether thumbnail and frame URLs fetch without a second credential is unknown.

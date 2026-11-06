# Brand search contract

The live brand screen `POST`s same-origin `/api/search`. It does not call `GET /brands/...` and it does not substitute sample rows when the call fails.

```json
{ "brand": "Ryanair", "aliases": [], "platforms": ["instagram", "tiktok"] }
```

The response is the backend contract: `assessment`, `assessmentReason`, `gmiModel`, `rankedCreators`, `heldOut`, `unassessedCreators`, `channels`, and `warnings`. Missing view counts stay null. Disclosure is `disclosed` or `unknown`, never unpaid.

`/demo/brand-search` renders a checked-in fixture with a MOCKED FIXTURE banner. That page does not call the API.

## Creator report

`POST /api/creator-report` is live. `CREATOR_REPORT_READY` is true. `/creators/:handle` and the creator workspace call it on the same origin. They do not fall back to sample rows.

```json
{ "handle": "lukadoncic", "platform": "instagram", "maxPosts": 5 }
```

`platform` is `instagram`, `tiktok`, or `youtube`. Optional `cpm` is an explicit illustrative rate. There is no brand field. `retrieval` reports `indexedTotalCount`, `returnedCount`, `cap`, `offset`, and `paginationComplete`. `viewsCount` stays null when missing. `entities` use `entityType` of `brand`, `team`, `product`, `person`, or `platform_distribution`. Disclosure is `disclosed` or `unknown`. Evidence keeps `snippet`, `field`, `timestampSeconds`, and `frameId`. Vision rows have a null snippet and `reviewStatus` `unreviewed`. `illustrativeCpm` is null unless the request or `CREATOR_ILLUSTRATIVE_CPM` sets it. `invoice` is null. `paymentOwed` is false. Text status is `complete`, `failed`, or `unassessed`. Vision status is `complete`, `failed`, or `blocked`. Zero indexed posts use the message `no indexed content found`.

The old sample client in `src/lib/api.ts` is not mounted. `CreatorResults` and `CreatorWorkspace` stay unmounted.

## Local dev

```bash
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` serves http://127.0.0.1:5180 and proxies `/api` and `/health` to `VITE_DEV_API_PROXY` (default `http://127.0.0.1:8000`). Provider keys stay in the API process.

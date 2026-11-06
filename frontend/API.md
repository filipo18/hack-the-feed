# Brand search contract

The live brand screen `POST`s same-origin `/api/search`. It does not call `GET /brands/...` and it does not substitute sample rows when the call fails.

```json
{ "brand": "Ryanair", "aliases": [], "platforms": ["instagram", "tiktok"] }
```

The response is the backend contract: `assessment`, `assessmentReason`, `gmiModel`, `rankedCreators`, `heldOut`, `unassessedCreators`, `channels`, and `warnings`. Missing view counts stay null. Disclosure is `disclosed` or `unknown`, never unpaid.

`/demo/brand-search` renders a checked-in fixture with a MOCKED FIXTURE banner. That page does not call the API.

## Creator report

`POST /api/creator-report` is not implemented in this change. `frontend/src/creator/availability.ts` stays `CREATOR_REPORT_READY = false`. `/creators/:handle` and the creator demo workspace explain that the report is unavailable. They do not show sample creators.

The old sample client remains in `src/lib/api.ts` for the unmounted PR5 creator components. Do not route those components until the creator endpoint is integrated.

## Local dev

```bash
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` serves http://127.0.0.1:5180 and proxies `/api` and `/health` to `VITE_DEV_API_PROXY` (default `http://127.0.0.1:8000`). Provider keys stay in the API process.

# Agent instructions

## Production frontend lives in `frontend/`

The production UI is the app in [`frontend/`](frontend/). It is self-hosted with the API. It does not depend on Lovable hosting.

Brand search posts `/api/search`. The creator report is not connected yet. `frontend/src/creator/availability.ts` stays off until `POST /api/creator-report` is integrated. Do not mount the old sample creator screens.

Do not put secrets, API keys, or auth headers in `frontend/`.

## Leave the historical pilot where it is

`pilots/review-ui` is a historical synthetic pilot. It has its own UI, tests, and Vite config. Leave that tree in place. Do not move it into `frontend/`.

`pilots/oriane-api` and the rest of the current tree stay where they are. Do not relocate unrelated pilot or research files as part of frontend work.

## Product direction

Brand search ranks relevant creators by distinct relevant post views in the retrieved sample. Views are not unique reach. Disclosure is disclosed or unknown, not unpaid. The creator report is a later endpoint, not this file.

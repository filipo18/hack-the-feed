# Agent instructions

## Production frontend lives in `frontend/`

Put every future production frontend file in [`frontend/`](frontend/).

That set is the whole Lovable-generated app:

- the app itself
- components
- routes
- styling
- assets
- frontend build configs and dependencies, including `package.json`, lockfiles, and the bundler config for this app

`frontend/` is empty of application code until that Lovable app is added. Do not scaffold a framework, pick a stack, or add a production build in a placement-only change.

## Backend and secrets stay out

Backend code stays outside `frontend/`. The GMI backend is backend, so it does not go in `frontend/`.

Do not put secrets, API keys, or auth headers in `frontend/`.

## Leave the historical pilot where it is

`pilots/review-ui` is a historical synthetic pilot. It has its own UI, tests, and Vite config. Leave that tree in place. Do not move it into `frontend/` to satisfy this rule.

`pilots/oriane-api` and the rest of the current tree stay where they are. Do not relocate unrelated pilot or research files as part of frontend placement.

## Product direction, not this change

The product is brand-facing across all mentions. The Lovable frontend and the GMI backend are the production split, and the product ranks the highest-reach relevant creators. Record that direction here. Do not implement ranking, a GMI client, or a Lovable screen in the same change as this placement rule.

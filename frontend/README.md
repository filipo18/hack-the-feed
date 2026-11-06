# Frontend

This folder is the location for production frontend code. No production frontend exists in the repo yet, so this file is what keeps the folder tracked.

When the Lovable app is added, put all of it here:

- the Lovable-generated app
- components
- routes
- styling
- assets
- frontend build configs and dependencies (`package.json`, the lockfile, and the bundler config for this app)

Backend code stays outside this folder. That includes the GMI backend. Do not put secrets, API keys, or auth headers here.

`pilots/review-ui` is a historical synthetic pilot with its own Vite app. It stays under `pilots/` and is not this folder. Do not move it here.

The product is brand-facing across all mentions, with this Lovable frontend and a GMI backend outside it, and it ranks the highest-reach relevant creators. This folder does not implement that. Do not scaffold a framework here ahead of the Lovable app.

Placement rules for agents are in the root [`AGENTS.md`](../AGENTS.md).

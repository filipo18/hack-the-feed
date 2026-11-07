# Deploy frontend and backend on Vercel

Deploy from the repository root, with Vercel's Root Directory left at `.`.
The root `vercel.json` builds `frontend/` with Vite and `backend/` with
FastAPI as two services in one project. `/api/*` and `/health` reach the
Python service. Other paths reach the frontend, including its SPA fallback.

This deployment does not use or change the Docker, GMI, or GitHub Actions
deployment configuration. The existing `frontend/vercel.json` remains in place.

## Deploy on pushes to main

The Vercel project `filip-7433s-projects/hack-the-feed` is connected to
`filipo18/hack-the-feed`, with `main` as the Production Branch. Keep the
Vercel GitHub app's access to this repository enabled.
Pushes and merges to `main` build both services and update
<https://hack-the-feed-beta.vercel.app> after a successful build. A failed build
leaves the previous production deployment serving traffic.

The root Vercel configuration must be committed to `main`. Keep Root Directory
at `.` so Vercel sees both services. Production provider credentials stay in
Vercel's environment settings; no GitHub deployment token is needed. Existing
GitHub Actions tests and image publication continue independently. Vercel does
not wait for those checks, so use branch protection if they must pass before a
change reaches `main`.

## Manual deployment

```bash
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env add ORIANE_API_KEY production
npx vercel@latest env add GMI_API_KEY production
npx vercel@latest env add GMI_MODEL production
npx vercel@latest deploy --prod
```

Choose a new Vercel project when linking unless an existing project is already
reserved for this app. Enter secret values only in the CLI prompts or Vercel
Project Settings. Do not prefix keys with `VITE_` or put them in `frontend/`.
`GMI_MODEL` must be an available model for the configured GMI account.
Use `GMI_API_KEY` on Vercel; Agentbox's automatically injected credential is
not available there. Keep `VITE_SAMPLE` unset for the live UI.

Set `HTTP_TIMEOUT_SECONDS=60` and `GMI_HTTP_TIMEOUT_SECONDS=120` in Production.
The previous 20-second limit interrupted both Oriane retrieval and model
inference during live Nike searches. These Vercel environment overrides leave
other hosting environments unchanged. The backend function allows up to 300
seconds, covering the visual asset and search calls followed by inference.

Production also sets `GMI_VISION=1`. The configured `openai/gpt-6.1-sol`
model accepted an Oriane frame in a staged creator-report request before
enabling this flag. Creator reports analyze at most ten frames, up to two
per post, with text and image requests running concurrently. Image requests
use `GMI_HTTP_TIMEOUT_SECONDS`, and visual evidence can cite only a frame
actually sent to the model. This checks selected frames, not every moment
of a video. Leave `GMI_VISION_MODEL` unset to use the configured text model;
verify image support again before changing models. Other environments keep
visual analysis opt-in.

The app can start without provider credentials, but searches then report an
unconfigured provider and cannot return live rankings. After setting or
changing environment variables, deploy again.

Check `/`, a frontend deep link such as `/login`, and `/health` after deploying.
Health should report `status: "ok"`, `orianeConfigured: true`, and
`gmiConfigured: true` once all three environment variables are set. Health
checks do not call either provider. A live search does use provider credits.

The backend's cache and rate limiter are per process. Vercel instances do not
share them, and cold starts clear them. This deployment adds no shared store.

References: [Vercel Services](https://vercel.com/docs/services) and
[FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi).

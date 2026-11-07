# Frontend

Production UI for brand search. It runs from this folder without Lovable. The API is the Python service outside this folder. Do not put secrets, API keys, or auth headers here.

```bash
npm ci
npm test
npm run build
npm run dev    # http://127.0.0.1:5180
```

Brand search posts `/api/search`. In dev, Vite proxies that path to the local API. The hosted image serves this build and the API on one origin, so the browser does not call a separate HTTP host.

`/demo/brand-search` is a labeled fixture, not a live result.

`/creators/:handle` posts `/api/creator-report`. If Oriane or GMI is unset, the screen says so. It does not invent creator rows. The live app requests Instagram only. Creator reports have no platform switcher. Set server-only `GMI_VISION_MODEL` to an available image-capable model to enable visual analysis, or use `GMI_VISION=1` when `GMI_MODEL` itself supports images. Missing frames are reported separately from disabled analysis. This workspace did not run that live call.

Demo access at `/login` stores a name in the browser and checks no password. The brand workspace runs a real search. The creator workspace requests the creator report.

Hosting has to send unknown paths to `index.html`. The combined image does that. Copy lives in `src/content.ts`. The working name is `PRODUCT_NAME`.

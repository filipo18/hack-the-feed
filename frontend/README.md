# Frontend

Two audiences, one app: `/for-brands` and `/for-creators`, each with a search that leads to results at `/brands/:brand` and `/creators/:handle`.

After login, `/app` is the dashboard for each side: overview, a ranked list, and an outreach or pitch board. Log in at `/login`.

```bash
npm install
npm run dev     # http://localhost:5180
npm run build
```

- Runs on synthetic sample data until `VITE_API_URL` is set: copy `.env.example` to `.env`. The backend contract is in [`API.md`](API.md).
- Hosting: send every route to `index.html`, or links like `/for-creators` will 404 on refresh.
- Copy for both pages: `src/content.ts`. The working name is `PRODUCT_NAME` there.
- Pricing: `src/lib/value.ts`. The numbers are placeholders.
- This repo is public, so keep real creator handles out of `src/lib/sample.ts`.
- Backend code stays outside this folder. Do not put secrets, API keys, or auth headers here.

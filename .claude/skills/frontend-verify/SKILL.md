---
name: frontend-verify
description: Run the full verification sequence for the Solveit frontend (lint, typecheck, unit tests, build, Playwright e2e with axe) and report real results. Use before committing frontend changes or when asked to verify, test, or QA the site.
---

Run from `frontend/` and report the actual output of each step; stop at the first failure and fix it.

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build` (without `VITE_SITE_URL` it warns that the sitemap is skipped; that is expected)
5. `npm run test:e2e` (builds with `VITE_SITE_URL=http://localhost:4173` and serves `build/client`; first run needs `npx playwright install chromium`)

For performance numbers, serve the build (`npm run preview`) and run Lighthouse against `http://localhost:4173/`, stating device preset and throttling with every score.

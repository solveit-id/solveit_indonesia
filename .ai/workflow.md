# Working without Claude Code

Claude Code adds skills (`frontend-verify`, `impeccable`) and an MCP browser. Other agents get the same results with the steps below. Rules from [`../AGENTS.md`](../AGENTS.md) always apply.

## Setup

```bash
cd frontend
npm install
npx playwright install chromium   # add firefox webkit for cross-browser runs
npm run dev                        # http://localhost:5173
```

Optional variables are documented in `frontend/.env.example` and `docs/development/development-guide.md`. Never commit `.env*` other than `.env.example`.

## Making a change

1. Read the relevant docs first: content in `docs/PRODUCT.md`, visual rules in `docs/DESIGN.md` and `docs/design/design-system.md`, placement in `docs/project-structure.md`.
2. Text lives in typed data, never hard-coded in many components: interface copy in `frontend/src/i18n/messages/{id,en}.ts`, page content in `frontend/src/data/` (locale text in `data/locales/{id,en}/`). Every string exists in both languages; TypeScript fails the build when one is missing.
3. Reuse existing primitives (`PageIntro`, `FaqList`, `ProjectCard`, `.btn`, `.field-input`, `.choice`) and tokens in `frontend/src/styles/app.css`. Icons come from `@phosphor-icons/react/dist/ssr/*`.
4. Motion goes through `useMotion` (`frontend/src/lib/motion.ts`); content must be visible without JavaScript and under reduced motion.

## Verifying (replaces the `frontend-verify` skill)

Run in `frontend/`, stop at the first failure, and report real output:

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build` (without `VITE_SITE_URL` it warns that the sitemap is skipped; expected)
6. `npx playwright test --project=desktop --workers=1`, then `tablet`, then `mobile` (axe is part of the suite). Add `PW_ALL_BROWSERS=1 ... --project=firefox` for Firefox.
7. WebKit: push the branch, then `gh workflow run cross-browser-qa.yml -f ref=<full 40-character sha>` and read the run's summary.
8. Performance, when a change can affect it: `npm run preview`, then Lighthouse mobile against `http://localhost:4173/`, median of 3, stating the preset.

Design review without the `impeccable` skill: compare screenshots at 1440, 820, and 390 px in light and dark themes and both languages against `docs/DESIGN.md`, and record findings in `docs/qa/qa-report.md`.

## Releasing

1. Commit on `frontend` (or `backend`) as `(type) short description`, for example `(fix) keep the compact header readable over dark sections`. No co-author trailers or tool attribution.
2. `git push origin frontend` (never force).
3. `gh pr create --base staging --head frontend`, wait for **Frontend CI** to pass, merge. CI runs only when `frontend/**` or the workflow changes; a docs-only PR shows no checks, so verify locally instead.
4. `gh pr create --base main --head staging`, wait for CI, merge.
5. Fast-forward `frontend` to `origin/main` (`git merge --ff-only origin/main`) and push, so the next round starts from the released tree.
6. Update `.ai/project-status.md`.

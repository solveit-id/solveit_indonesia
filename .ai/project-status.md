# Project status

Last updated: 2026-10-15 (repository structure cleanup after the round 6 release).

## In one paragraph

The public website (frontend) is built, bilingual (Indonesian at `/`, English at `/en/`), prerendered as static HTML, and released to `main` through six refinement rounds. There is no backend yet: the contact form composes a WhatsApp or email message that the visitor sends. No domain or hosting exists, so canonical URLs, sitemap, and final SEO/GEO are deliberately off. The next phase is the Laravel backend foundation on the `backend` branch.

## Shipped (on `main`)

| Round | Release PR | Highlights |
|---|---|---|
| 1 | #2 | Company profile frontend: pages, design system, accessibility, prerender |
| 2 | #4 | Light/dark themes, Indonesian/English, navigation, contact channels, parallax, performance |
| 3 | #6 | Motion, premium interactions, the rule-based "Tanya Solveit" assistant, testimonial pledge |
| 4 | #8 | Branded loader, navbar morph, floating controls, portfolio detail |
| 5 | #10 | Compact navbar, demo labels, case study chapters and scrollspy, slice hover |
| 6 | #13 | Navbar logo morph fix, glass navbar, About storytelling and ecosystem map, shared FAQ, responsive case study preview, consultation selects, ecosystem naming proposal, owner's new vision text |

After round 6, the repository structure was tidied: documentation grouped under `docs/`, `PRODUCT.md` and `DESIGN.md` moved to `docs/`, one copy of the logos (`frontend/public/brand/solveit-logo-{full,icon}.svg`), agent settings consolidated, this folder added.

Pages: `/`, `/tentang`, `/layanan`, `/proses`, `/portofolio`, five case studies, `/kontak`, 404, each mirrored under `/en/` with English slugs (`/en/about`, `/en/services`, ...). Case studies are labelled demonstration concepts (`isDemo: true`, no results).

## Branches

- `main`: production line. Receives only `staging` via PR.
- `staging`: integration. Receives `frontend` and `backend` via PR.
- `frontend`: website work. Up to date with `main` after each release.
- `backend`: only the initial commit (`1c9ec51`), 0 commits of its own and an ancestor of `main`, so it can fast-forward to `main` safely before Laravel work starts.

Check live state with `git fetch --prune && git branch -vv` and `gh pr list`; SHAs here go stale.

## Quality baseline (round 6)

- Lint, typecheck, unit tests 69/69, build: pass. E2E: Chromium desktop/tablet/Pixel 7, Firefox, and WebKit desktop/iPhone 14 with 0 failures; axe 0 violations.
- Lighthouse mobile (median of 3): 96 to 99 performance, LCP about 1.57 s, CLS 0, Accessibility/Best Practices/SEO 100. Known trade-off: TBT on `/tentang` about 126 ms from scroll timelines.
- Details and history: `docs/qa/qa-report.md`.

## Open decisions (owner)

- Product names other than Solveit OpsHub are proposals; trademark, domain, and scope checks are listed in `docs/product/product-naming.md` before any commercial use.
- Domain, hosting, and the Search Console token are not decided; they unlock canonical URLs, sitemap, and final SEO/GEO (`docs/seo/seo-geo.md`).
- No client has approved a testimonial or a real case study yet.

## Next task

**Laravel foundation on `backend`:**

1. Fast-forward `backend` to `main`.
2. Scaffold Laravel 13 (PHP 8.5) inside `backend/`, following `docs/architecture/integration-plan.md`: a versioned REST API, an inquiry endpoint that a new `api` channel in `frontend/src/services/inquiry.ts` will post to (it does not exist yet), and data owned by the website only, with no shared database with OpsHub.
3. Keep the frontend's no-backend behaviour until the API is deployed; never fake a submission.
4. Release through PRs `backend` to `staging`, then `staging` to `main`.

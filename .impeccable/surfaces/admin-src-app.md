---
version: 1
slug: "admin-src-app"
primary_target: "admin/src/app"
related_targets: ["admin/src"]
---

# Admin console (admin/), B3.2a foundation

Mode: Operate. Extends the established Solveit world (docs/DESIGN.md); no new identity.

## Scope and audience

- Audience: Solveit owners and admins (founders), office laptop in daylight and phone on the move; sustained work later (B3.2b/c), short visits now.
- Job in B3.2a: see honestly what this console is, which phase it is in, and whether the browser reaches the admin API through the same-origin proxy. No sign-in, no administration, no data.
- Constraints: Indonesian default, English ready; light default, dark only when chosen (owner decision 2026-10-16, same rule as the website); modules that do not exist never appear in navigation (docs/architecture/admin-dashboard.md section 7); no fabricated metrics; component reference only in development and QA builds (owner decision).

## Direction contract

THESIS: A precise working console assembled from the logo's own capsules, where the navy rail is the shell and porcelain is the work surface. It refuses the category default: a grid of same-size KPI cards with invented numbers around a login form that does nothing.

OWN-WORLD: Logo navy rail (night ink on navy) beside a porcelain work area; one cobalt voice for the primary action and the active marker; full capsules for every single-line control, 28px panels for containers, hairlines and tonal steps instead of shadows; Archivo on its width axis (headings 112 percent at 720, text at 100 percent), fixed rem scale.

STORY: The visitor reads which phase the console is in, sees exactly what exists (backend released, not deployed) and what each next phase adds, and can run one real connection check whose result names the cause and the fix.

FIRST VIEWPORT: Desktop: 17.5rem navy rail on the left (lockup, honest environment capsule, navigation, theme and language at its foot); work area with the page title and lede at top left, then the phase track as the main column and the connection panel beside it from 1280px. Phone: navy top bar with mark and a capsule Menu toggle; title, phase track, connection panel stacked.

FORM: Standard admin shell (side rail plus work area), position 1 of the structure pinned by docs/architecture/admin-dashboard.md section 7. Signature move: the build phases drawn as logo capsules on the 33 degree axis, filled when released, half when in progress, hollow and dashed when planned, joined by one spine. seed: none (not rolled; structure pinned by the architecture document and the brief)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Production hostname, TLS, listener exposure (B3.2d).
- Whether audit reads are themselves audited (owner).

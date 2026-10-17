---
version: 1
slug: "admin-src-app"
primary_target: "admin/src/app"
related_targets: ["admin/src"]
---

# Admin console (admin/), B3.2a foundation and B3.2b sign-in and own security

Mode: Operate. Extends the established Solveit world (docs/DESIGN.md); no new identity.

## Scope and audience

- Audience: Solveit owners and admins (founders), office laptop in daylight and phone on the move; short, security-sensitive visits now, sustained administration later (B3.2c).
- Job in B3.2a: see honestly what this console is and which phase it is in (developer connection check, since B3.2b on the dev and reference builds only).
- Job in B3.2b: sign in with password and mandatory TOTP; activate an account or reset access through a one-time link, register the authenticator, and keep the recovery codes shown once; read the own account; change the password, replace recovery codes (password re-confirmation on 423), and end other sessions. No owner administration yet (B3.2c), no metrics.
- Constraints: Indonesian default, English ready; light default, dark only when chosen (owner decision 2026-10-16, same rule as the website); modules that do not exist never appear in navigation (docs/architecture/admin-dashboard.md section 7); no fabricated metrics; component reference only in development and QA builds (owner decision).

- Owner brief for B3.2b (2026-10-17), quoted: recovery-code regeneration "When Laravel returns 423: Open a password-confirmation dialog. Use `POST auth/confirm-password`. Require deliberate confirmation before performing the originally requested sensitive action again." and "Never silently regenerate recovery codes in the background." So after the password is confirmed the dialog advances to one more explicit decision; it is one dialog whose content advances, not stacked modals.

## Direction contract

THESIS: A precise working console assembled from the logo's own capsules, where the navy rail is the shell and porcelain is the work surface. It refuses the category default: a grid of same-size KPI cards with invented numbers around a login form that does nothing.

OWN-WORLD: Logo navy rail (night ink on navy) beside a porcelain work area; one cobalt voice for the primary action and the active marker; full capsules for every single-line control, 28px panels for containers, hairlines and tonal steps instead of shadows; Archivo on its width axis (headings 112 percent at 720, text at 100 percent), fixed rem scale.

STORY: Without an account the visitor meets the same navy rail with nothing behind it (no navigation, no account) and a two-step sign-in or a four-step access flow drawn with the console's own step capsules. Once Laravel verifies the account, navigation and the account foot appear; home says who is signed in, this session's limits, the state of account and recovery codes, and which phase the console is in. Every secret is shown once and every risky choice is a deliberate press. (B3.2b, owner decision 2026-10-17: the connection panel left the production home for the dev and reference builds; the session panel and the account-state links took its place.)

FIRST VIEWPORT: Desktop: 17.5rem navy rail on the left (lockup, honest environment capsule, navigation once signed in, account foot with sign-out, theme and language at its foot); work area with the page title and lede at top left. Sign-in: step track, title, the fields in a 34rem column, help below a hairline. Home: the phase track as the main column and the session panel with the account-state links beside it from 1280px. Phone: navy top bar with mark and, once signed in, a capsule Menu toggle; content stacked, preferences at the foot of signed-out screens.

FORM: Standard admin shell (side rail plus work area), position 1 of the structure pinned by docs/architecture/admin-dashboard.md section 7. Signature move: the build phases drawn as logo capsules on the 33 degree axis, filled when released, half when in progress, hollow and dashed when planned, joined by one spine. seed: none (not rolled; structure pinned by the architecture document and the brief)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Seed: the finish reviewer asks for a recorded concept-seed reference or the owner's explicit waiver. Neither exists yet (2026-10-17); no waiver is recorded until the owner gives one.

- Production hostname, TLS, listener exposure (B3.2d).
- Whether audit reads are themselves audited (owner).

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by the brief: one repository for this website only, with `frontend/` (React, TypeScript strict, Vite, GSAP) and the website's own `backend/` (Laravel 13 API on PHP 8.5, at least 8.5.7, and MySQL 8.4 LTS; inquiry endpoint built, not yet deployed; the frontend client exists behind a flag that is off by default). Other Solveit systems are separate repositories. Styling, routing, and prerendering were delegated: Tailwind CSS v4, React Router 7 framework mode with static prerendering (`ssr: false`).

## Users

Owners and decision makers at individual businesses, UMKM, startups, organisations, and companies in Indonesia who need a professional digital solution (website, web application, information system, or custom software). They arrive while evaluating vendors, often on a phone during working hours or on an office laptop, and need to understand quickly what Solveit builds, how the engagement works, and how to start a conversation.

## Product Purpose

Solveit Indonesia is a technology startup and software house. This website is the company profile and portfolio: branding, service marketing, portfolio presentation, and lead acquisition. Success means a qualified visitor understands the offer and starts a consultation.

It is also the first piece of a planned ecosystem covering consultation, service ordering, proposals, contracts, invoices, project development, progress and revision tracking, and maintenance. None of those features exist yet. Naming (2026-10-14, see `docs/product/product-naming.md`): Solveit OpsHub is the established name of the internal operations hub (in design); "Solveit Orbit" is a proposed umbrella name for the ecosystem, and Connect, Scope, Accord, Ledger, Pulse, and Care are proposed names for planned client-facing parts. Proposed names are not trademarks and must stay labelled as plans. OpsHub and other business systems are built as independent projects (own repository, deployment, and lifecycle); this website connects to them through API contracts, events, or links, never a shared database, and never grows into them.

## Positioning

Tagline (official, English): "We Don't Just Build Software. We Build Digital Solutions That Last." The position is durability and end-to-end ownership of the client journey, not one-off builds.

## Capabilities and Constraints

- Services: website development, web applications, information systems, custom software, technical support and maintenance.
- The Laravel API stores inquiries (`POST /api/v1/inquiries`, contract in `docs/api/inquiries.md`) but is not deployed. The form's "Send through website" channel is built (B2) but disabled by default (`VITE_INQUIRY_API_ENABLED=false`), so the public website does not call the API: contact happens through confirmed channels (email, WhatsApp) and the form says it sends and stores nothing. Enabling the channel needs owner approval of the privacy notice, retention, hosting, database, and operational handling. Forms must never pretend to submit: a reference number is shown only from a verified `201`.
- Content language: Indonesian (natural, professional). Tagline stays in English.
- Domain: not yet available (inferred to be set later via configuration). Physical address: not available.

## Brand Commitments

- Logos `frontend/public/brand/solveit-logo-icon.svg` and `frontend/public/brand/solveit-logo-full.svg` are the source of visual identity; their shapes must not be modified.
- Visual approach named by the brief: "Precision in Motion".

## Evidence on Hand

- Confirmed contact (from the user, 2026-10-12): email `solveit.team.id@gmail.com`; WhatsApp `+62 877-5964-1358`, `+62 812-3025-2499`, `+62 823-3550-1778`.
- No real portfolio projects with publication permission yet: the portfolio uses clearly labelled demonstration concepts.
- No clients, testimonials, awards, statistics, team photos, or business results exist. Do not fabricate any of them.

## Product Principles

1. Truth over polish: never state a claim the company cannot back.
2. Explain the engagement plainly: what happens, in what order, and what the client receives.
3. Build for the ecosystem: keep the website's data behind services and typed contracts, so it can exchange data with OpsHub and other systems without rework, while staying its own application.
4. Fast and accessible on ordinary Indonesian mobile connections.

## Accessibility & Inclusion

WCAG 2.2 AA. Respect reduced-motion preferences; motion is never required to access content.

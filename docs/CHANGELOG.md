# CHANGELOG — Documentation, Schema, and Prototype

All notable changes are recorded here. The audit report remains the detailed finding-by-finding record; this file is the chronological project log.

Format follows a simple `Added / Changed / Fixed / Removed` structure. Dates are in EAT.

---

## [1.2.0] — 2026-11-09

### Added

- v1.2 analytics contract: `docs/ANALYTICS.md` with KPI formulas, dashboard layout, access, and validation.
- `docs/BROWSER_SUPPORT.md`: supported browsers, device baseline, performance targets, and test matrix.
- `docs/GLOSSARY.md`, `docs/SEQUENCE_DIAGRAMS.md`, and this changelog.
- Root `SECURITY.md` with vulnerability reporting and non-negotiable security rules.
- Static kitchen portal: `site/kitchen.html`, `site/assets/js/kitchen.js`, `site/assets/css/kitchen.css`.
- ADR-017 (v2 green/orange design system) and ADR-018 (8.1 km COD test ceiling).
- P0-11 closure for the COD-radius contradiction found during reconciliation.
- Design-system and kitchen-portal amendments in `docs/SPEC_AMENDMENTS.md` §4.9–§4.10.

### Changed

- All normative documents rewritten to v1.2 and cross-referenced to the migration, ERD, API contracts, and canonical examples.
- Four-portal model everywhere: Customer, Kitchen, Rider, Admin. Dine-in is a customer mode/tracker subroute.
- Canonical COD test ceiling is now **8.1 km**, matching the 8.093 km Ntinda fixture; the commercial ceiling remains founder gate F-14.
- Flutterwave webhook route is now `POST /api/webhooks/flutterwave`; `FLW_WEBHOOK_HASH` is the canonical environment variable.
- Prototype fixtures now use `#1047` as **USh 27,500 COD** and Juma's end-of-day ledger as **USh 65,500** (`#1043` 38,000 + `#1047` 27,500).
- Rider prototype no longer offers a next-job queue; one active delivery per rider is enforced in the UI and docs.
- Accessibility target is WCAG 2.2 AA with the v2 green/orange tokens; orange actions use green-900 text, never white.
- Test scenarios are A–I across the plan and persona documents.
- Added the approved error-code-to-copy map to the portal specification and CI/dependency/secret-scanning gates to the stack and implementation plan.

### Fixed

- Retired terracotta palette, AAA claim, six-portal count, `h-13`, stale fixture totals, and invalid UUID examples removed from normative text.
- Prepaid orders correctly arrive in `PREPARING`; only `CONFIRMED_UNPAID` COD orders show Accept.
- Admin ledger, dispatch copy, and rider cash fixtures aligned with canonical values; the ledger footer now sums the five visible rider rows (USh 229,000) and is labelled as an end-of-day example.
- Documentation references no longer use numeric filename prefixes that did not exist.
- Operations runbook and compliance checklist aligned to 8.1 km COD and Supabase Auth sessions.

### Removed

- The `#1047` fixture exception and the alternate 64,000 ledger from the design-system document.
- The rider next-job queue and `#1047` prepaid 33,000 fixture from the prototype.
- Competing normative authority from `docs/stitch-design/` and `site/ui-kit.html`; both are archived/non-normative.

---

## [1.1.0] — 2026-10-29

### Added

- Supabase Auth staff model with 6-digit staff PINs and synthetic emails.
- Deny-by-default RLS and token-scoped RPCs.
- Durable handover PIN attempts, lockout, geofence, and admin reset.
- Payment transactions, webhook idempotency, refunds, settlements, audit/history/outbox tables.
- Flutterwave hosted checkout with `verif-hash` and transaction verification.
- OSRM road-distance fee formula, integer metres, no Haversine fee fallback.
- Canonical fixtures for Nakasero, Ntinda, dine-in, and Juma's ledger.
- Operations runbook, compliance checklist, test plan, and founder action register.
- Static customer, admin, and rider prototype.

### Fixed

- Payment signature contract, PIN durability, settlement closure, phone normalization, checkout idempotency, and total-integrity constraints.
- Order-number identity and unique constraints; menu soft-delete; image bucket; store-closed block; rider shifts; business-day handling.

---

## [1.0.0] — 2026-10-27

- Initial project brief, stack, design, database, integrations, security, testing, and implementation documents.
- Static design explorations under `docs/stitch-design/` (now non-normative).

---

## How to update this file

1. Add the entry under the current version on the day of the change.
2. Reference the affected document or migration.
3. If a canonical number changes, update `CANONICAL_EXAMPLES.md` first and cite it here.
4. Never rewrite a released entry; add a correction entry instead.

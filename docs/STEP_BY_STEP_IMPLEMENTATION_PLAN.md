# STEP-BY-STEP IMPLEMENTATION PLAN

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.2.0 |
| **Date** | 2026-11-09 |
| **Execution model** | Phased, test-driven, contract-verified |
| **Start condition** | Founder gates in [`AUDIT_REPORT.md`](AUDIT_REPORT.md) §12 that block the phase must be acknowledged before that phase starts |

Agents complete phases in order and run every gate before moving on. This plan describes the production build; it is not permission to start the build during the specification phase.

---

## Phase 0 — Specification Baseline

**Objective:** keep specs, schema, seed, and prototype consistent before application code.

**Artifacts:** `docs/`, `supabase/`, `scripts/`, `site/`.

**Exit criteria:**

- `AUDIT_REPORT.md` v1.2 closure matrix is current.
- `CANONICAL_EXAMPLES.md` is the only numeric source.
- Migration applies cleanly to a local Supabase instance.
- `node --check` passes for every `site/assets/js/*.js`.
- No retired fixture, invalid UUID, default PIN, or unsafe RLS pattern remains outside historical audit text.

---

## Phase 1 — Project Foundation

**Objective:** initialize the Next.js application with pinned dependencies and security headers.

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `src/lib/utils.ts`, `src/lib/env.ts`, `.github/workflows/ci.yml`, `.github/dependabot.yml`.

**Directives:**

1. Create the app with a **pinned** Next.js 15 scaffold. Do not run `create-next-app@latest`; pin the exact version in `package.json` and commit the lockfile.
2. Install React 19, Tailwind 3.4.x, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `zustand`, `leaflet`, `lucide-react`, `clsx`, `tailwind-merge`, `date-fns`/`date-fns-tz`.
3. Enable `strict`, `noImplicitAny`, and ES2022.
4. Add the security headers and CSP from `SPEC_AMENDMENTS.md` §4.2.
5. Add the env schema; no default admin PIN, no restaurant coordinates in env.
6. Add the CI workflow: `npm ci`, lint, typecheck, unit, and build; enable secret scanning and weekly Dependabot updates. DB/RLS and E2E jobs join in Phases 2 and 12.

**Gate:** lint, typecheck, unit, and build pass; `env.ts` rejects missing secrets; no secret is present in the client bundle; the required CI check is green and branch protection is on.

---

## Phase 2 — Database, Auth, RLS, Seed

**Objective:** apply the schema, provision staff, and prove the security boundary.

**Files:** `supabase/migrations/20261029000000_initial_schema.sql`, `supabase/seed.sql`, `scripts/seed-staff.mjs`, `src/lib/supabase/{client,server,admin}.ts`, `src/types/database.types.ts`, `src/middleware.ts`, `src/lib/auth/*`.

**Directives:**

1. Apply the migration; do not re-type DDL from prose. The migration is the schema authority.
2. Run `supabase/seed.sql` (idempotent).
3. Provision staff with `scripts/seed-staff.mjs`; staff are Auth users with 6-digit PINs as passwords.
4. Generate `database.types.ts`.
5. Implement `server-only` admin client and role guards.
6. Add RLS/database tests from `TEST_PLAN.md` §3.

**Gate:**

- Local reset succeeds.
- `profiles.id` references `auth.users`.
- `anon`/`authenticated` direct selects on orders/PIN/telemetry are denied.
- `claim_order_atomic` race test has exactly one winner.
- No `profiles.pin_code`.

---

## Phase 3 — Design Tokens and UI Kit

**Objective:** implement the v2 green/orange system and accessible primitives.

**Files:** `tailwind.config.ts`, `src/app/globals.css`, `src/components/ui/*`, `src/components/map/dynamic-map.tsx`.

**Directives:**

1. Bind the v2 tokens: green-800 `#173F35`, green-900 `#102E27`, orange-500 `#F28C28`, orange-700 `#A65A0F`, red-600 `#C62828`, success `#17603F`, warning `#8A4B00`.
2. Orange buttons use green-900 text; never white on orange.
3. Build button, badge, input, sheet/dialog, toast, skeleton, table, and empty state.
4. Import Leaflet CSS in the client wrapper.
5. Add focus rings, reduced-motion handling, and 48/52/56 px targets.

**Gate:** axe zero critical/serious; contrast script passes; no forbidden palette token.

---

## Phase 4 — Storefront, Menu, Cart

**Objective:** browse, customize, and cart with authoritative prices.

**Files:** `src/hooks/use-cart.ts`, `src/components/storefront/*`, `src/app/(storefront)/page.tsx`.

**Directives:**

1. Server-fetch active categories, items, groups, and combos.
2. Zustand cart with `persist`; validate against current availability.
3. Modifier sheet enforces single/multi and min/max.
4. Combo builder uses `combo_steps`/`combo_step_options`.
5. Sold-out, empty, and store-closed states.
6. Cart subtotal uses items + modifiers only.

**Gate:** unit tests for pricing; keyboard-only customization; no stale image or price.

---

## Phase 5 — Map, Routing, Fees, MOV

**Objective:** pin-drop, OSRM metres, fee, and MOV.

**Files:** `src/lib/routing/*`, `src/app/api/distance/route.ts`, `src/components/map/*`, `src/app/(storefront)/checkout/page.tsx`.

**Directives:**

1. `/api/distance` validates coordinates, calls OSRM, caches 24 h, returns integer metres + duration.
2. On failure return `DISTANCE_UNAVAILABLE`; never substitute Haversine.
3. `fee = 0` ≤5 km; `ceil((m−5000)/1000) × rate` ≤15 km; block >15 km.
4. Checkout enforces MOV, COD radius (8.1 km), cart limits, store hours.
5. Map has a text fallback and accessible pin control.

**Gate:** canonical fixtures: Nakasero 1,562 m / fee 0; Ntinda 8,093 m / fee 6,000; out-of-bounds blocked. Unit tests use fixed metres; E2E mocks OSRM.

---

## Phase 6 — Order Pipeline and Payments

**Objective:** create orders server-side, verify payments, and handle COD.

**Files:** `src/lib/schemas/order.ts`, `src/actions/checkout.ts`, `src/actions/payments.ts`, `src/actions/otp.ts`, `src/app/api/webhooks/flutterwave/route.ts`, `src/app/api/cron/expire-orders/route.ts`.

**Directives:**

1. Zod discriminated union for delivery/dine-in; normalize phone.
2. Idempotency key required; recompute all totals; insert order/items/modifiers in one transaction.
3. Digital: create `payment_transactions`, call Flutterwave hosted checkout; webhook validates `verif-hash`, verifies transaction, checks amount/currency, stores event, moves `PENDING_PAYMENT → PREPARING`.
4. COD: enforce radius, OTP when required, store change due, create `CONFIRMED_UNPAID`.
5. Duplicate/late events never resurrect a terminal order.
6. Expire unpaid digital orders after 10 minutes.

**Gate:** webhook signature/replay/amount tests; idempotency tests; canonical totals 35,000 / 38,000 / 8,000; no client-supplied price accepted.

---

## Phase 7 — Customer Tracker

**Objective:** token-scoped tracking, PIN, telemetry, feedback.

**Files:** `src/components/tracker/*`, `src/app/(storefront)/orders/[token]/page.tsx`, `src/actions/orders.ts`.

**Directives:**

1. Read only through `get_order_by_token`.
2. Timeline, ETA, docket, payment status.
3. Map only during `OUT_FOR_DELIVERY`; poll telemetry; show stale state.
4. PIN displayed only after the safety-seal instruction.
5. Feedback once on `DELIVERED`.
6. Not-found, cancelled, failed, and payment-pending states.
7. Broadcast + polling; no `postgres_changes`.

**Gate:** unknown token produces not-found; PIN absent from network payloads except the token RPC; tracker updates without reload.

---

## Phase 8 — Kitchen Display

**Objective:** reliable KDS with audio, accept/bump, 86, and busy mode.

**Files:** `src/lib/audio/chimes.ts`, `src/components/kitchen/*`, `src/actions/kitchen.ts`, `src/app/(operations)/kitchen/{login,page}.tsx`, `src/app/(operations)/kitchen/layout.tsx`.

**Directives:**

1. Auth gate with 6-digit PIN.
2. Shift-start gesture unlocks Web Audio; repeated chime stops on `acknowledged_at`.
3. Prepaid orders arrive `PREPARING`; **Accept** applies only to `CONFIRMED_UNPAID`.
4. Bump: delivery → `READY_FOR_PICKUP`; dine-in → `DELIVERED`.
5. 86 via RPC; busy mode via RPC; both audited.
6. Late timers show text, not colour alone.
7. Print docket; no PIN/phone.

**Gate:** audio test after gesture; accept/bump state tests; 86 propagation; busy buffer does not change existing orders.

---

## Phase 9 — Rider Portal

**Objective:** auth, atomic claim, navigation, telemetry, PIN, cash summary.

**Files:** `src/hooks/use-geolocation.ts`, `src/components/rider/*`, `src/actions/rider.ts`, `src/app/(operations)/rider/{login,page}.tsx`.

**Directives:**

1. Phone + 6-digit PIN; role guard.
2. Start/end shift with opening float.
3. Pool uses safe RPC; no PII/PIN.
4. `claim_order_atomic`; one active order; refresh on loss.
5. Start trip → `OUT_FOR_DELIVERY`; foreground telemetry with IndexedDB queue and Wake Lock.
6. PIN modal calls `verify_delivery_pin`; handles invalid/locked/too-far/offline.
7. Offline completion is **Awaiting verification**, never delivered.
8. Report failed delivery/release with reason; cash summary read-only.

**Gate:** claim race; PIN lockout/reset; telemetry scope; offline queue replay drops stale points; no background GPS claim.

---

## Phase 10 — Admin Hub

**Objective:** orders, menu, settings, ledger, analytics, audit, staff, tables.

**Files:** `src/components/admin/*`, `src/actions/admin.ts`, `src/app/(operations)/admin/**`.

**Directives:**

1. Auth gate; ADMIN only.
2. Live monitor and order drawer with edit/cancel/complete/reassign/reset PIN/refund, each with reason + audit.
3. Menu CRUD with soft archive and image upload validation.
4. Settings with bounds and `settings_history`.
5. Ledger with EAT business date and linked orders; reconcile.
6. Analytics and audit views.
7. Staff cannot demote the last admin.
8. Destructive confirmations require a typed reason.

**Gate:** every admin action writes an audit row; ledger 65,500 example reconciles; second settlement updates the same row; refund request created on paid cancellation.

---

## Phase 11 — Dine-In

**Objective:** table QR mode end to end.

**Files:** `src/components/storefront/table-header.tsx`, `src/app/(storefront)/page.tsx`, `src/actions/checkout.ts`, `src/app/(operations)/kitchen/*`.

**Directives:**

1. Validate table QR token server-side; do not trust `?table=4`.
2. Hide delivery UI; fee/packaging/MOV = 0.
3. Store `order_type = DINE_IN` and `table_id`.
4. KDS shows table badge; bump marks `DELIVERED`.
5. No rider pool or PIN.
6. Canonical Alex total 8,000.

**Gate:** forged/inactive token rejected; dine-in never enters rider pool; KDS completion works.

---

## Phase 12 — E2E, Performance, Security, Launch

**Objective:** prove the whole system and prepare launch.

**Files:** `tests/e2e/*`, `tests/db/*`, `tests/unit/*`, `playwright.config.ts`, `vitest.config.ts`, `public/manifest.webmanifest`, `public/sw.js`.

**Directives:**

1. Implement scenarios A–I from `TESTING_PERSONAS_AND_E2E_SCENARIOS.md` / `TEST_PLAN.md`.
2. Mock OSRM and payments; fixed test OTP; no live keys.
3. Accessibility suite on all portals.
4. Performance budgets and bundle check.
5. Security checks: RLS, PIN isolation, webhook replay, price tampering, CSP.
6. Runbook rollback and backup restore exercise.
7. PWA manifest with v2 theme color `#173F35`.
8. Run `npm audit --omit=dev --audit-level=high`, CodeQL or Semgrep, and provider secret scanning; resolve high/critical findings before launch.

**Gate:**

- All E2E, DB, unit, and a11y gates pass.
- No retired numbers or invalid fixtures.
- Ledger sums to linked orders.
- Dependency and secret scans have no unresolved high/critical findings.
- Rollback/restore exercised.
- Founder go-live checklist signed.

---

## Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.2.0 | 2026-11-09 | Rewritten for pinned Next 15, Supabase Auth, integer-metre OSRM, canonical fixtures, v2 palette, kitchen portal, payment/refund/audit, scenarios A–I, CI and dependency/secret scanning. |
| 1.1.0 | 2026-10-29 | Amendment banner. |
| 1.0.0 | 2026-10-27 | Original 12-phase plan. |

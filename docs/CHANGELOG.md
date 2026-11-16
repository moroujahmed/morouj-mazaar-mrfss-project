# CHANGELOG — Documentation, Schema, and Prototype

All notable changes are recorded here. The audit report remains the detailed finding-by-finding record; this file is the chronological project log.

Format follows a simple `Added / Changed / Fixed / Removed` structure. Dates are in EAT.

---

## Implementation - Phase 5: Distance API, delivery quote, and checkout (2026-11-16)

### Added

- OSRM routing layer in `src/lib/routing/`: coordinate validation and 6-decimal cache quantization, 24-hour route cache (Upstash REST in production, in-memory for local tests), fixed-window 30 requests/minute/IP limiter, OSRM driving-route client with no Haversine fallback, and the shared fee/MOV/COD/total quote builders in `quote.ts`.
- `GET /api/distance` (`src/app/api/distance/route.ts`) returning integer metres and duration with `VALIDATION_ERROR`, `DISTANCE_OUT_OF_BOUNDS`, `DISTANCE_UNAVAILABLE`, and `RATE_LIMITED` envelopes, `Retry-After` on throttling, a Uganda routing envelope, and production fail-closed checks for missing OSRM/Upstash configuration.
- Distance wire contract in `src/lib/routing/contract.ts`, shared by the route and the checkout client.
- `/checkout` server route (`src/app/(storefront)/checkout/page.tsx`) and `src/components/checkout/checkout-client.tsx`: map click/drag pin with keyboard-accessible latitude/longitude fields, debounced distance fetch, free/excess fee breakdown, MOV progress, COD-radius gating, store-hours and kitchen-paused blocks, cart limit checks, contact fields with Ugandan phone normalization (`src/lib/phone.ts`), payment-method selection, order summary, and an interim place-order CTA that does not pretend to submit an order.
- Dine-in checkout from `?table=<qr-token>`: `getTableByToken()` resolves tokens through `validate_table_token()`, `getPublicSettings()` wraps `get_public_settings()`, mobile-storefront banner, and a checkout mode that removes delivery and packaging fees and bypasses the delivery MOV. Forged, inactive, or malformed tokens fall back to delivery with a visible warning.
- Shared `useCartHydration()` hook used by both the storefront and checkout so persisted carts rehydrate once and reconcile against the fresh server menu.
- Settings-derived delivery radii: `calculateDeliveryFee` and `isBeyondMaxDelivery` accept optional free/max metre values defaulting to the canonical 5 km/15 km.
- Leaflet destination pin (draggable), click-to-place support, dev OSM tiles with production MapTiler tiles, and CSP updates for OpenStreetMap images/connections.
- Unit coverage (`tests/unit/routing.test.ts`, `tests/unit/distance-api.test.ts`) for canonical quotes and totals, MOV/COD/radius boundaries, coordinate validation and quantization, OSRM success/failure paths, 24-hour cache expiry, rate-limit windows, and the distance API contracts.
- Playwright coverage (`tests/e2e/checkout.spec.ts`) for the canonical USh 35,000 and USh 38,000 totals, out-of-area and failed-route blocks with retry, exact MOV shortfall, COD-radius enforcement, dine-in USh 8,000, and forged-token fallback, plus a checkout axe scan.

### Changed

- Storefront menu loading now shares `getPublicSettings()` and reads dine-in tokens server-side; `src/lib/storefront/types.ts` exports `DineInTable`.
- Storefront cart CTA navigates to `/checkout` (preserving the table token) instead of showing a placeholder toast.
- `src/lib/currency.ts` fee helpers derive radii from settings rather than hard-coded constants.
- `next.config.mjs` CSP allows OpenStreetMap tiles for development.
- `playwright.config.ts` pins `DISTANCE_FIXTURE=1` and `vitest.config.ts` aliases `server-only` to a test stub.

### Verification

- `npm run check` passes: lint, typecheck, 90 unit tests across 8 files, token checks, and the production build.
- `npm run test:e2e` passes 20 Chromium tests at 1 worker: 11 Phase 4 flows/axe checks, 8 checkout flows, and the checkout axe scan, with zero critical or serious violations.
- Client bundle inspection finds no server secret identifiers and no `process.env` references.
- Production distance requests require durable Upstash configuration and an OSRM base URL; missing infrastructure returns `DISTANCE_UNAVAILABLE` instead of an estimated fee.

---

## Implementation — Phase 4: Storefront, menu, and cart (2026-11-15)

### Added

- Server-only storefront data loader (`src/lib/storefront/menu.ts`) reading `get_public_settings()` plus active categories, items, modifier links/groups/options, and combo steps/options through anon RLS; malformed settings or any query error fail closed to an unavailable screen.
- Domain builders in `src/lib/storefront/build.ts` and Zod settings validation in `settings.ts`; database enums are mapped without trusting client input.
- Canonical test fixture (`fixture.ts`, `STOREFRONT_FIXTURE=1` only) mirroring `supabase/seed.sql` prices, modifier deltas, combo steps, and app settings, with a pinned mid-service clock so opening-hours checks stay deterministic.
- Zustand cart store (`src/hooks/use-cart.ts`) with `persist` + `skipHydration`, explicit client rehydration, limit-enforcing add/update/remove/clear, and reconciliation against the freshly fetched menu.
- Cart domain rules in `src/lib/storefront/cart.ts` and `selection.ts`: stable line keys, item/modifier/combo pricing, subtotal excluding fees, selection min/max validation, `max_cart_lines`/`max_item_quantity`/`max_cart_value`, combo defaults, and repricing of base, modifier, and combo-option deltas.
- Storefront UI in `src/components/storefront/`: restaurant header with search and store status, horizontally scrollable category pills, dish cards with sold-out badges, bottom-sheet customization with keyboard-operable radio/checkbox controls and quantity stepper, sticky cart dock, cart sheet with per-line quantity/removal, and empty, sold-out, store-closed, kitchen-paused, and menu-unavailable states.
- Home route moved to `src/app/(storefront)/page.tsx` with `dynamic = "force-dynamic"`; the old `src/app/page.tsx` was removed.
- Unit coverage (`tests/unit/cart.test.ts`, `tests/unit/store-status.test.ts`) for the canonical 32,000 + 2,000 = 34,000 subtotal, quantity multiplication, limits, modifier/combo validation, price/availability reconciliation, and Kampala business hours.
- Playwright storefront coverage (`tests/e2e/storefront.spec.ts`) for canonical prices, search/category filtering, keyboard-only combo customization, Escape focus restoration, and cart persistence, plus item-sheet and cart-sheet axe scans.

### Verification

- `npm run lint`, `npm run typecheck`, `npm run test` (56 tests), `npm run test:tokens`, `npm run test:contrast`, and `npm run build` pass.
- `npm run test:e2e` passes 11 Chromium tests: six axe checks (zero critical/serious violations) and five storefront flows, including the canonical USh 34,000 line and USh 68,000 doubled subtotal.
- Storefront prices, modifier deltas, combo options, and limits come from the server-rendered menu; persisted cart lines are repriced and flagged unavailable rather than trusted.
- No Supabase secret identifiers appear in the client bundle; the browser suite uses only the explicit fixture branch.

---

## Implementation — Phase 3: Design tokens and UI kit (2026-11-15)

### Added

- v2 token layer: green/orange palette, status tints, display/sans/mono families, type scale, card/sheet shadows, and 48/52/56 px target utilities.
- Accessible primitives in `src/components/ui/`: button (six variants, four sizes, loading and disabled states), status badge, text/textarea/select fields with visible labels and `aria-invalid`/`aria-describedby` errors, native `<dialog>` sheet, toast provider with `role="alert"` errors, skeletons, data table with caption and keyboard-scrollable region, and empty state.
- `src/components/map/dynamic-map.tsx` and `leaflet-map.tsx`: browser-only Leaflet wrapper, MapTiler tiles when configured, DOM-safe marker labels, and a visible text fallback.
- Internal `/design-system` reference page (noindex) showing the palette, controls, statuses, table, overlays, map, and measured contrast evidence.
- Root layout skip link, toast provider, and branded focus/reduced-motion base styles.
- `tests/unit/contrast.test.ts`, `scripts/check-tokens.mjs`, and Playwright/axe coverage in `tests/e2e/a11y.spec.ts`; `test:contrast`, `test:tokens`, `test:e2e`, and `test:a11y` scripts.

### Verification

- `npm run test:contrast` passes all canonical AA/AAA pairs, keeps white-on-orange below AA, and verifies status text on tinted surfaces.
- `npm run test:tokens` finds no forbidden white-on-orange or orange-500 body-text pairing.
- `npm run test:a11y` passes four Chromium checks: zero critical/serious axe violations on `/` and `/design-system`, an open sheet scan, Escape focus restoration, and alert toast announcement/dismissal.
- `npm run lint`, `npm run typecheck`, `npm run test` (30 tests), and `npm run build` pass.

---

## Implementation — Phase 2: Database, Auth, RLS, Seed (2026-11-15)

### Added

- Verified the full migration chain (`initial_schema → storage → remediation_enum → remediation → v1_5_remediation`) plus `supabase/seed.sql` applies cleanly to a fresh database; regenerated UTF-8 `src/types/database.types.ts` from the migrated schema.
- Supabase clients: browser (`src/lib/supabase/client.ts`), cookie-bound server (`server.ts`), and `server-only` service-role (`admin.ts`).
- Staff identity helpers (`src/lib/auth/phone.ts`), role helpers (`roles.ts`), session lookup (`session.ts`), and page/action guards (`guards.ts`): E.164 phone → `<digits>@staff.moroujmazaar.com` synthetic email, 6-digit PIN as the Auth password.
- `src/middleware.ts` deny-by-default portal protection for `/admin`, `/kitchen`, and `/rider`, including wrong-role redirects and inactive-account sign-out.
- `tests/db/bootstrap.sql` (Supabase auth/storage stubs), `tests/db/rls.sql` (privilege matrix and row visibility, transactional rollback), and `tests/db/claim-race.mjs` (two concurrent riders, one winner).
- `test:db` and `test:db:race` npm scripts; `pg` and `@types/pg` dev dependencies.
- Supabase CLI 3.1 compatibility: `supabase/config.toml` uses `[local_smtp]`.

### Verification

- Fresh local reset equivalent: database dropped/recreated, bootstrap applied, all five migrations applied in order, seed applied — no errors.
- `profiles.id` references `auth.users`; `profiles.pin_code` does not exist.
- `anon` and `authenticated` are denied direct `orders`, `handover_pin`, and `rider_telemetry` access; `service_role` retains access; admin/kitchen/rider RPC grants match the contract.
- `claim_order_atomic`: exactly one winner; the loser receives `ORDER_ALREADY_CLAIMED`; a rider with an active order cannot claim another.
- `npm run lint`, `npm run typecheck`, `npm run test` (23 tests), and `npm run build` pass; no server secret identifiers appear in the client bundle.
- Local Supabase Docker stack was unavailable in this environment; the same DDL and RLS assertions were executed against PostgreSQL 18.4 on `127.0.0.1:55433`.

---

## Implementation — Phase 1: Project foundation (2026-11-15)

### Added

- Pinned application scaffold: Next.js `15.5.29`, React `19.2.0`, TypeScript `5.9.3`, Tailwind CSS `3.4.19`, Supabase clients, Zod, Zustand, Leaflet, and the approved utility libraries.
- `next.config.mjs` security headers and CSP from `SPEC_AMENDMENTS.md` §4.2; `unsafe-eval` is development-only.
- `src/lib/env.ts` with fail-closed Zod validation (including mock/live payment and production OSRM/Upstash/cron requirements) plus `src/lib/public-env.ts` for browser-safe values.
- `src/lib/currency.ts` (integer UGX, canonical delivery-fee formula), `src/lib/time.ts` (`Africa/Kampala`), and `src/lib/utils.ts` (`cn`).
- v2 green/orange Tailwind tokens and accessible base styles.
- Vitest unit tests for environment validation, delivery fees, currency formatting, and EAT date rollover.
- GitHub Actions CI (`npm ci`, lint, typecheck, unit, build) and weekly grouped Dependabot updates.

### Verification

- `npm run lint`, `npm run typecheck`, `npm run test` (15 tests), and `npm run build` pass.
- The production client bundle contains no service-role key, provider secret, or cron secret identifiers.

---

## [1.5.0] — 2026-11-13

### Added

- `20261113000000_v1_5_remediation.sql` adds per-attempt payment references (`payment_transactions.attempt_number`, immutable `tx_ref = '<order_token>-<attempt_number>'`, unique `(order_id, attempt_number)` and unique `tx_ref`), with a legacy backfill.
- `start_payment_attempt(uuid, payment_method, text)` allocates the next attempt under a row lock and abandons the previous open attempt; `resolve_payment_tx_ref(text)` returns exactly one order/attempt for webhook handling.
- `admin_redeliver_order(uuid, text, uuid)` returns a `DELIVERY_FAILED` order to `READY_FOR_PICKUP`, clears the rider, and writes an audit row.
- Audited admin mutation RPCs: `admin_update_settings`, `admin_update_order_contact`, `admin_upsert_category`, `admin_upsert_menu_item`, `admin_upsert_modifier_group`, `admin_upsert_combo`, `admin_upsert_table`, `admin_update_staff`, and `admin_approve_refund`.
- `rider_telemetry(order_id)` partial index for tracker reads.
- Scenarios J (admin reassignment/redelivery/audit) and K (cart limits/COD change) in the persona narratives; payment-attempt tests in `TEST_PLAN.md`.
- `SENTRY_DSN` and an explicit `STAFF_SEED_FILE` in `.env.example`; `docs/` and `tests/` in the repository manifest.

### Changed

- Every retry gets a new `tx_ref`; a late webhook for an abandoned attempt can no longer mark the current attempt or order paid.
- Staff synthetic email domain changed to `staff.moroujmazaar.com`.
- Canonical dine-in table label is `Table T4`; seed label is `Food Court Table T4`.
- Brand hierarchy made explicit: Morouj Mazaar (umbrella) → Bazaar Flame & Grill (restaurant) → MRFSS (system).
- All normative documents and the audit report advanced to v1.5.0; go-live acceptance is Scenarios A–K.

### Fixed

- `TEST_PLAN.md` Scenario C no longer asks the kitchen to “accept” prepaid dine-in; verified payment enters `PREPARING`.
- `SEQUENCE_DIAGRAMS.md` and `INTEGRATIONS_AND_HARDWARE_APIS.md` now use the per-attempt `tx_ref` instead of `tx_ref = order_token`.
- `OPERATIONS_RUNBOOK.md` and `STEP_BY_STEP_IMPLEMENTATION_PLAN.md` now reference Scenarios A–K.
- `TECH_STACK_AND_CONVENTIONS.md` no longer lists the retired `staff.bazaareats.com` domain.

### Removed

- No files deleted.

---

## [1.4.0] — 2026-11-12

### Added

- `20261112000000_remediation_enum.sql` adds `RETURNED` to `delivery_outcome`.
- `20261112000001_remediation.sql` adds `max_cart_lines`, webhook error text, refund approval fields, audit reasons, blacklist E.164 normalization, last-admin protection, FSM recovery transitions, deterministic timestamps, extended RPC payloads, admin list/audit/close-shift RPCs, and explicit grants.
- `scripts/staff.test.json` for repeatable test-only staff provisioning.
- `public/manifest.webmanifest`, `public/sw.js`, favicon, and 192/512 PWA icons.

### Changed

- Failed digital payments remain retryable until `expire_pending_orders` cancels them; the timeout sets `payment_status = FAILED` and fails open transactions.
- `verify_delivery_pin` returns `AUTH_UNAUTHORIZED` for another rider; terminal orders hide the PIN.
- Partial settlements carry their shortfall forward in rider cash summaries.
- Admin reassignment requires a reason and a three-argument RPC.
- Prototype fixtures aligned to the canonical Sarah/Brian/Alex/Juma set and Juma's USh 65,500 ledger.

### Fixed

- Removed the retired USh 229,000 ledger claim, missing `max_cart_lines` seed value, hardcoded MOV/radius copy, and `local SMS gateway` wording.
- Documented admin list/audit/refund/close-shift contracts, `ITEM_NOT_FOUND`, `LAST_ADMIN_PROTECTED`, and cart-line/COD-change states.

### Removed

- No files deleted.

---

## [1.3.0] — 2026-11-10

### Added

- `orders.ready_at` with trigger population on `READY_FOR_PICKUP` and dine-in `PREPARING → DELIVERED`; analytics uses it for prep/delivery KPIs.
- `app_settings.is_kitchen_paused`, `set_kitchen_paused(boolean)`, `isKitchenPaused` in public settings, and `KITCHEN_PAUSED` across API/UX/tests.
- Missing test scenarios H (payment failure/retry) and I (store closed/kitchen paused); exit criteria are now A–I.
- `src/lib/schemas/order.ts` and `src/app/api/print/receipt/[orderId]/route.ts` in the stack manifest.

### Changed

- ADR-017 clarified: `docs/stitch-design/screens/` is canonical; `docs/stitch-design/_archive/` and `site/ui-kit.html` are non-normative.
- Route groups standardized as `(storefront)` and `(operations)` across the portal spec and stack manifest.
- Canonical touch targets unified: 44 px absolute minimum, 48 px customer/admin, 52 px kitchen, 56 px rider; 3 px focus ring.
- Analytics COD KPI uses `CASH_ON_DELIVERY`, not `COD`.
- Integrations aligned: 15.0 km prepaid / 8.1 km COD distance envelope, 50-point/10-minute rider telemetry queue, Chrome 110+/Safari 16+ minimums, and HTML browser-print route.
- `total_amount` documented as a generated column; `blacklisted_phones` DDL aligned with the migration.

### Fixed

- `TEST_PLAN.md` scenario coverage and traceability now match `TESTING_PERSONAS_AND_E2E_SCENARIOS.md`.
- Stale audit statements that treated the entire Stitch package as archived.
- Prep-time KPI references that used nonexistent fields or the wrong boundary.

### Removed

- No files deleted. Historical v1.0/v1.2 text remains under its existing historical banners.

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
- The canonical `docs/stitch-design/` package now uses the v1.2 green/orange tokens end to end: palette swatches, component CSS, screen classes, and generated Tailwind selectors were reconciled with `ACCESSIBILITY.md`.

### Fixed

- Retired terracotta palette, AAA claim, six-portal count, `h-13`, stale fixture totals, and invalid UUID examples removed from normative text.
- Prepaid orders correctly arrive in `PREPARING`; only `CONFIRMED_UNPAID` COD orders show Accept.
- Admin ledger, dispatch copy, and rider cash fixtures aligned with canonical values; the ledger footer now sums Juma's two visible orders (#1043 USh 38,000 + #1047 USh 27,500 = USh 65,500) and is labelled as an end-of-day example.
- Documentation references no longer use numeric filename prefixes that did not exist.
- Operations runbook and compliance checklist aligned to 8.1 km COD and Supabase Auth sessions.
- Repaired escaped arbitrary colour selectors in the generated design-package CSS and restored the missing `#A65A0F` text and `#1D4F42` hover rules.
- Removed white-on-orange selection highlighting and stale inset/placeholder RGB values from the design package; orange selections now use green-900 text.

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

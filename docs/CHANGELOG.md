# CHANGELOG — Documentation, Schema, and Prototype

All notable changes are recorded here. The audit report remains the detailed finding-by-finding record; this file is the chronological project log.

Format follows a simple `Added / Changed / Fixed / Removed` structure. Dates are in EAT.

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

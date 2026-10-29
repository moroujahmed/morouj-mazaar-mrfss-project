# SPEC AMENDMENTS — v1.1 Normative Changes to the Original 10 Documents

| Field | Value |
| :--- | :--- |
| **Status** | Normative. Supersedes conflicting text in the v1.0 specification set. |
| **Version** | 1.1.0 |
| **Date** | 2026-10-29 |
| **Precedence** | `DECISIONS.md` → `CANONICAL_EXAMPLES.md` → `API_CONTRACTS.md` / `ERD.md` / `ACCESSIBILITY.md` → this file → the original 10 documents |

If a v1.0 document conflicts with this file, **this file wins** until the original is corrected. The original documents are retained for history and product context; they are not the build contract where amended.

---

## 1. Amendment Index by Original Document

| Original document | Sections superseded | Replacement / authority |
| :--- | :--- | :--- |
| `SYSTEM_OVERVIEW.md` | Pricing formula, distance fallback, “zero ongoing cost” claims, route map | `CANONICAL_EXAMPLES.md` §8; `DECISIONS.md` ADR-005/ADR-010; `API_CONTRACTS.md` §3 |
| `TECH_STACK_AND_CONVENTIONS.md` | Version matrix, Realtime `postgres_changes`, OSM tiles, directory manifest, environment variables | `DECISIONS.md` ADR-004/005/006/008/014/016; `API_CONTRACTS.md` §5/§7; `SPEC_AMENDMENTS.md` §4 |
| `DATABASE_SCHEMA_AND_RLS.md` | Entire schema, RLS, seed, triggers | `supabase/migrations/20261029000000_initial_schema.sql`; `ERD.md`; `supabase/seed.sql` |
| `DESIGN_SYSTEM_AND_UI_SPEC.md` | Accessibility standard, palette contrast claims, primary CTA tokens, `h-13` | `ACCESSIBILITY.md` |
| `PORTALS_AND_UX_SPECIFICATION.md` | Auth screens, closed-store state, dine-in completion, rider background GPS | `API_CONTRACTS.md` §1.3/§2; `DECISIONS.md` ADR-001/012/014; `TEST_PLAN.md` |
| `STATE_MACHINES_AND_BUSINESS_RULES.md` | FSM transitions, OSRM fallback, pricing formula, claim RPC, PIN logic, settlement linkage | `ERD.md` §4; `CANONICAL_EXAMPLES.md`; `supabase/migrations/...initial_schema.sql` §16–18 |
| `INTEGRATIONS_AND_HARDWARE_APIS.md` | Payment webhook signature, OTP provider, map tiles, printing, deep links | `DECISIONS.md` ADR-002/003/004/007; `API_CONTRACTS.md` §3.2/§3.3 |
| `SECURITY_AND_VERIFICATION_PROTOCOLS.md` | Custom staff session, plaintext PIN, in-memory lockout, COD OTP storage | `DECISIONS.md` ADR-001/003/013; `supabase/migrations/...initial_schema.sql` §7/§12–16 |
| `STEP_BY_STEP_IMPLEMENTATION_PLAN.md` | File paths with numeric prefixes, Phase 12 test scope, Phase 6 payment provider | `README.md`; `TEST_PLAN.md`; `DECISIONS.md` ADR-002/008 |
| `TESTING_PERSONAS_AND_E2E_SCENARIOS.md` | Seed UUIDs, staff auth, distances, totals, Playwright blueprint | `CANONICAL_EXAMPLES.md`; `TEST_PLAN.md`; `supabase/seed.sql`; `scripts/seed-staff.mjs` |

---

## 2. P0 Remediation Matrix

| ID | Original finding | v1.1 resolution | Evidence artifact | Status |
| :--- | :--- | :--- | :--- | :--- |
| P0-01 | Auth model incompatible with RLS | Supabase Auth for all staff; synthetic email + 6-digit PIN as password; customer remains token-based. No `profiles.pin_code`. | `DECISIONS.md` ADR-001; migration `profiles`; `API_CONTRACTS.md` §2.5–2.6; `scripts/seed-staff.mjs` | **Resolved** |
| P0-02 | Unsafe RLS and public order inserts | Deny-by-default RLS; no direct anon/authenticated access to orders/PIN/telemetry; all reads/writes through RPCs or service-role server actions; column grants revoked; helper functions `SECURITY DEFINER` with `search_path`. | Migration §19–21; smoke tests in §6; `ERD.md` §5 | **Resolved** |
| P0-03 | PIN lockout not durable; code fails | Durable `failed_pin_attempts`, `pin_locked_until`, `pin_verification_attempts`; atomic `verify_delivery_pin` RPC; `pgcrypto` generation; admin reset; geofence; lockout. | Migration §7/§14/§16; `API_CONTRACTS.md` §2.8 | **Resolved** |
| P0-04 | Cash settlement cannot close | `cash_settlements` with `expected_cash`, `counted_cash`, generated `variance`; `orders.settlement_id`/`settled_at`; `reconcile_rider_cash` links orders atomically; ledger RPC. | Migration §6/§18; `CANONICAL_EXAMPLES.md` §7; smoke test 2 | **Resolved** |
| P0-05 | Payment lifecycle incomplete / wrong signature | Flutterwave hosted checkout; `verif-hash` timing-safe comparison; mandatory `/transactions/{id}/verify`; `payment_transactions` + `webhook_events` idempotency; `refunds`; payment-timeout cron. | `DECISIONS.md` ADR-002; `API_CONTRACTS.md` §2.2/§3.2/§3.4; migration §8 | **Resolved** |
| P0-06 | Missing domain models | Added modifier groups, combo steps/options, dining tables + QR tokens, delivery attempts, rider shifts, refunds, OTP, blacklist, notifications outbox, settings history, admin audit, checkout idempotency. | `ERD.md`; migration §3–§10 | **Resolved** |
| P0-07 | Distances and totals wrong | Live OSRM values: Nakasero **1.562 km / fee 0**; Ntinda **8.093 km / fee 6,000**; totals **35,000** and **38,000**; metres stored as integer. | `CANONICAL_EXAMPLES.md` §3–§9; `TEST_PLAN.md` | **Resolved** |
| P0-08 | Seed UUIDs invalid; profiles need auth users | All seed UUIDs valid hex; catalog/settings/tables seeded by SQL; staff created through Auth Admin API script. | `supabase/seed.sql`; `scripts/seed-staff.mjs`; `scripts/staff.example.json` | **Resolved** |
| P0-09 | Accessibility claim false | WCAG 2.2 AA baseline; corrected palette; `#B83817` primary action; `#D84A26` decorative only; focus/touch/contrast rules. | `ACCESSIBILITY.md` | **Resolved** |
| P0-10 | Ops/legal/compliance gaps | Runbook, compliance checklist, legal policy skeletons, founder-only action register, go-live/rollback gates. | `OPERATIONS_RUNBOOK.md`; `COMPLIANCE_AND_LEGAL.md`; `AUDIT_REPORT.md` §12 | **Contracted; founder inputs required** |

---

## 3. P1 Remediation Matrix

Status meanings:

- **Resolved** — the v1.1 specification/schema now answers the finding.
- **Contracted** — the behavior is fully specified, but code must implement it in the named phase.
- **Founder input** — blocked on a business decision or credential.

| ID | Resolution | Artifact | Status |
| :--- | :--- | :--- | :--- |
| P1-01 | `set_kitchen_busy` RPC for KITCHEN/ADMIN with audit | migration §17 | Resolved |
| P1-02 | Kitchen can only toggle availability via RPC; menu CRUD is ADMIN-only server action | migration §17; `API_CONTRACTS.md` §2.9 | Resolved |
| P1-03 | Partial unique index: one active order per rider | migration §11 | Resolved |
| P1-04 | `get_rider_pool()` returns area/distance/total only; no phone, address, notes, PIN | migration §16 | Resolved |
| P1-05 | `normalize_ug_phone()` + `customer_phone_normalized`; profiles normalize too | migration §7/§12 | Resolved |
| P1-06 | Zod discriminated union; DB `orders_delivery_requires_coordinates` / `orders_dine_in_requires_table` | `API_CONTRACTS.md` §2.1; migration §7 | Resolved |
| P1-07 | `checkout_idempotency` table + required key | migration §8; `API_CONTRACTS.md` §2.1 | Resolved |
| P1-08 | `total_amount` generated column from components | migration §7 | Resolved |
| P1-09 | Discount term removed; promotions deferred | `DECISIONS.md` ADR-010 | Resolved |
| P1-10 | Dine-in packaging fee 0 enforced by check constraint | migration §7; `CANONICAL_EXAMPLES.md` §6 | Resolved |
| P1-11 | `PREPARING → DELIVERED` for dine-in in FSM and `bump_order` | migration §13/§17b; `ERD.md` §4 | Resolved |
| P1-12 | `acknowledged_at`; `accept_order` RPC; paid orders enter PREPARING via webhook | migration §7/§17b; `API_CONTRACTS.md` §2.7 | Resolved |
| P1-13 | `acknowledged_at` is the repeat-chime stop condition; KDS polls/broadcasts ack state | migration §7; `TEST_PLAN.md` §4 | Contracted |
| P1-14 | Background GPS is not promised; foreground + Wake Lock + SOP | `OPERATIONS_RUNBOOK.md` §7; `TEST_PLAN.md` §5 | Resolved |
| P1-15 | `update_rider_telemetry` validates rider + active order | migration §16 | Resolved |
| P1-16 | Telemetry offline queue specified with bounded retry/replay | `TEST_PLAN.md` §5; `API_CONTRACTS.md` §5 | Contracted |
| P1-17 | OSRM failure blocks checkout; no Haversine fallback for final fee | `DECISIONS.md` ADR-005; `API_CONTRACTS.md` §3.1 | Resolved |
| P1-18 | `road_distance_m INTEGER`; fee from metres; display rounding separate | migration §7; `CANONICAL_EXAMPLES.md` §8 | Resolved |
| P1-19 | Self-hosted OSRM in production; public demo only for dev/tests | `DECISIONS.md` ADR-005 | Founder input (host) |
| P1-20 | MapTiler production tiles; OSM dev only | `DECISIONS.md` ADR-004 | Founder input (key) |
| P1-21 | Upstash Redis limits, table in API contracts | `DECISIONS.md` ADR-006; `API_CONTRACTS.md` §6 | Founder input (account) |
| P1-22 | CSP/HSTS/frame-ancestors specified for Phase 1 `next.config.mjs` | `SPEC_AMENDMENTS.md` §4.2 | Contracted |
| P1-23 | Service role is server-only; documented import ban | `README.md` §Security; `API_CONTRACTS.md` §7 | Contracted |
| P1-24 | Middleware + per-action role guards; auth matrix | `API_CONTRACTS.md` §1.3/§2 | Contracted |
| P1-25 | `verify_delivery_pin` derives rider from `auth.uid()`; no riderId input | migration §16 | Resolved |
| P1-26 | Kitchen/admin/rider login screens and logout specified | `API_CONTRACTS.md` §2.5–2.6; `PORTALS` amendment | Contracted |
| P1-27 | Admin cancel, force-complete, reassign, reset PIN, refund request | migration §18; `API_CONTRACTS.md` §2.9 | Resolved |
| P1-28 | SMS outbox + Africa's Talking dispatch contract | `DECISIONS.md` ADR-003/009; `API_CONTRACTS.md` §3.3 | Founder input (sender ID) |
| P1-29 | ETA fields + formula; `eta_at` stored | `ERD.md` §3.1; `CANONICAL_EXAMPLES.md` §10 | Contracted |
| P1-30 | `get_admin_analytics` KPI RPC + KPI definitions | migration §18; `OPERATIONS_RUNBOOK.md` §9 | Resolved |
| P1-31 | `is_active`/`archived` semantics; menu items are never hard-deleted | migration §4; `ERD.md` §2.2 | Resolved |
| P1-32 | `menu-images` bucket, 5 MiB limit, WebP/JPEG/PNG, public read | `20261029000001_storage.sql` | Resolved |
| P1-33 | Store-closed hard block + admin override + closed screen | `DECISIONS.md` ADR-012; `API_CONTRACTS.md` §2.1 | Resolved |
| P1-34 | Refund table + admin cancel creates REQUESTED refund; gateway completion Phase 6 | migration §8/§18; `API_CONTRACTS.md` §2.9 | Contracted |
| P1-35 | Timezone strategy: `Intl.DateTimeFormat` / `date-fns-tz`; business day EAT | `DECISIONS.md` ADR-015; `SPEC_AMENDMENTS.md` §4.4 | Resolved |
| P1-36 | Dynamic import moved inside a Client Component wrapper | `SPEC_AMENDMENTS.md` §4.5 | Contracted |
| P1-37 | Leaflet CSS import in client map wrapper | `SPEC_AMENDMENTS.md` §4.5 | Contracted |
| P1-38 | `h-[52px]` replaces `h-13` | `ACCESSIBILITY.md` §3.3 | Resolved |
| P1-39 | Toast/skeleton primitives specified | `SPEC_AMENDMENTS.md` §4.5 | Contracted |
| P1-40 | PWA manifest + service worker cache rules | `DECISIONS.md` ADR-016; `SPEC_AMENDMENTS.md` §4.6 | Contracted |
| P1-41 | Settings validation bounds + `settings_history` audit | migration §2/§14 | Resolved |
| P1-42 | DB is the single source of truth for coordinates/settings; env only for keys | `DECISIONS.md` ADR-015; `API_CONTRACTS.md` §7 | Resolved |
| P1-43 | Business day `Africa/Kampala` for ledger/analytics | `DECISIONS.md` ADR-015; migration §18 | Resolved |
| P1-44 | `rider_shifts` + start/end RPCs + one open shift index | migration §7/§16 | Resolved |
| P1-45 | `order_number` identity + UNIQUE | migration §7 | Resolved |
| P1-46 | Check constraints on PIN, phone, lat/lng, heading, radii, amounts | migration §2–§10 | Resolved |
| P1-47 | Staff provisioned before profiles; seed script | `scripts/seed-staff.mjs` | Resolved |
| P1-48 | Local Supabase config + reset/seed workflow | `supabase/config.toml`; `README.md` | Resolved |
| P1-49 | Playwright plan rewritten with fixtures/storage states/auth | `TEST_PLAN.md` §6 | Resolved |
| P1-50 | Scenarios A–G + unit tests for fee/MOV/FSM | `TEST_PLAN.md` §3–§4 | Resolved |

---

## 4. Technical Amendments

### 4.1 Version pinning (supersedes `TECH_STACK` §1)

- Next.js **15.x App Router** with React 19.
- Tailwind CSS **3.4.x**; do not install Tailwind 4.
- TypeScript **5.x strict**.
- `@supabase/supabase-js` and `@supabase/ssr` pinned to exact versions in `package-lock.json` at Phase 1.
- `date-fns` + `date-fns-tz` (or `Intl.DateTimeFormat` with `timeZone: 'Africa/Kampala'`).
- `zod` for all runtime validation.
- No Prisma, no Google Maps SDK, no component library.
- Record resolved versions in `DECISIONS.md` ADR-008 after Phase 1.

### 4.2 Security headers (supersedes missing `next.config.mjs` headers)

Add at Phase 1:

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://*.flutterwave.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.maptiler.com https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.flutterwave.com https://*.maptiler.com;
  font-src 'self';
  frame-src https://checkout.flutterwave.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self' https://checkout.flutterwave.com;
```

Tighten `script-src` with nonces once the app shell is stable. Do not ship `unsafe-eval`.

### 4.3 Realtime (supersedes `TECH_STACK` §4.1)

- No `postgres_changes` on `orders`, `rider_telemetry`, `payment_transactions`, or `profiles`.
- Customer: Broadcast on `order:{order_token}` + poll `get_order_by_token` every 10 s.
- Kitchen: Broadcast `kitchen` + poll `get_kitchen_orders` every 10 s.
- Rider pool: Broadcast `rider-pool` + poll `get_rider_pool` every 15 s.
- Assigned rider: Broadcast `rider:{rider_id}` + poll `get_rider_active_order` every 10 s.
- Never broadcast PIN, phone, exact address, or payment reference.

### 4.4 Money and time (supersedes all mixed formats)

- All money is integer UGX. No decimals, no floats.
- All timestamps stored UTC; all business dates use `Africa/Kampala`.
- Distance is integer metres; fee uses `ceil((metres - 5000)/1000)` when metres > 5000.
- Display may round, but calculation never uses the rounded display.

### 4.5 Next.js / Leaflet / UI implementation notes

- A Server Component cannot use `next/dynamic` with `ssr: false`. Put the dynamic import inside a `"use client"` wrapper.
- Import `leaflet/dist/leaflet.css` in the client map wrapper or `globals.css`.
- Use `h-[52px]` for the KDS bump button.
- Toast: use a small local primitive or `sonner` (decision required at Phase 1); do not add a heavy component library.
- Skeleton: local `animate-pulse` blocks that match final dimensions; no layout shift.
- Map loading skeleton must have a text fallback and `aria-busy`.

### 4.6 PWA / offline (supersedes “Progressive Web Architecture” claims)

- Ship `public/manifest.webmanifest` and a minimal service worker.
- Cache: app shell, fonts, menu images, offline page.
- Never cache: order pages, PINs, telemetry, staff pages, payment pages.
- Menu browsing works offline; checkout requires connectivity.
- KDS/rider/admin require connectivity and show an offline banner.
- Icons: founder-provided 192/512 PNG; the SVG placeholder is not a store-quality icon.

### 4.7 Store-closed behavior (supersedes “settings exist but unused”)

- Checkout is blocked when `is_store_open = false` or EAT time is outside `opening_time`/`closing_time`.
- Storefront shows opening hours + WhatsApp support.
- Admin override is explicit and audited in `settings_history`/`admin_audit_log`.
- Pre-orders are deferred.

### 4.8 Dine-in completion (supersedes missing transition)

- Dine-in orders: `PENDING_PAYMENT`/`CONFIRMED_UNPAID` → `PREPARING` → `DELIVERED`.
- Kitchen bump marks `DELIVERED`; no rider, no handover PIN gate, no delivery fee, no packaging fee.
- Table QR token is an unguessable UUID validated by `validate_table_token`.

---

## 5. Document Control

- Every change to a canonical number must update `CANONICAL_EXAMPLES.md` first.
- Every architectural fork must add an ADR to `DECISIONS.md`.
- Every schema change must be a new migration; never edit an applied migration.
- Every public mutation must be added to `API_CONTRACTS.md` before implementation.
- Every test fixture must cite `CANONICAL_EXAMPLES.md`.
- The audit report change log records every file added or amended.

---

## 6. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.1.0 | 2026-10-29 | Created; closes P0/P1 specification gaps and records technical amendments. |

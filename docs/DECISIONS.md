# DECISIONS — Architecture Decision Record (ADR) Log

| Field | Value |
| :--- | :--- |
| **Status** | Approved baseline for build |
| **Version** | 1.1.0 |
| **Date** | 2026-10-29 |
| **Supersedes** | Implicit/ambiguous decisions in the v1.0 specification set |

This document is the **single source of truth for architectural forks**. If another document conflicts with a decision here, this document wins until the conflict is corrected.

---

## ADR-001 — Staff authentication uses Supabase Auth

**Status:** Accepted

**Decision**

- All staff (ADMIN, KITCHEN, RIDER) authenticate through **Supabase Auth**.
- The visible credential is **phone number + 6-digit staff PIN**.
- Under the hood, the server maps the phone to a synthetic email:
  `{digits}@staff.bazaareats.com` and calls `signInWithPassword`.
- This produces a real Supabase JWT, so `auth.uid()` works in RLS, RPCs, and Realtime.
- The customer remains anonymous and uses an unguessable order token; customers do not need accounts.
- Staff PINs are never stored in `profiles`; Supabase Auth stores the password hash.
- Login is rate-limited and locked after 5 failed attempts per 15 minutes.
- Sessions last 12 hours; logout revokes the refresh token.

**Rationale**

The v1.0 custom session cookie could not populate `auth.uid()`, making every RLS policy unusable. Supabase Auth is the only option that preserves the intended RLS and Realtime model without a custom JWT implementation.

**Consequences**

- Founders must provision staff auth users (script provided).
- `profiles.pin_code` is removed.
- `profiles.id` remains `REFERENCES auth.users(id)`.
- Admin/kitchen/rider login screens are required.

---

## ADR-002 — Payment provider: Flutterwave (primary)

**Status:** Accepted, subject to merchant onboarding

**Decision**

- Use **Flutterwave** for MTN MoMo, Airtel Money, and Visa/Mastercard.
- Payment initiation uses Flutterwave hosted checkout (`POST /v3/payments`) with `tx_ref = orders.order_token`.
- Webhook authenticity uses Flutterwave's `verif-hash` header (plain shared-secret comparison, timing-safe).
- Every successful webhook is independently verified with `GET /v3/transactions/{id}/verify` before the order is marked paid.
- Store the gateway transaction ID in `payment_transactions`.
- Refunds use Flutterwave's refund API.
- Direct MTN/Airtel integrations are a future adapter, not v1.

**Rationale**

Flutterwave supports Ugandan mobile money and cards through one merchant account and one settlement flow. The v1.0 generic "HMAC-SHA256" contract was wrong for Flutterwave and Paystack; this decision fixes the contract.

**Founder dependency:** merchant account, API keys, webhook hash, settlement bank account.

---

## ADR-003 — SMS/OTP provider: Africa's Talking

**Status:** Accepted, subject to account approval

**Decision**

- Use **Africa's Talking** for transactional SMS and COD OTP.
- OTP is 6 digits, expires in 10 minutes, maximum 3 attempts, maximum 3 sends per phone per hour.
- OTP codes are stored as Argon2/bcrypt hashes in `otp_verifications`; never plaintext.
- If the SMS provider is unavailable, COD checkout is disabled with a clear message. It does not silently skip verification.
- Returning customers with at least one successfully delivered order may skip OTP (configurable).

**Founder dependency:** Africa's Talking account, API key, username, sender ID.

---

## ADR-004 — Map tiles: MapTiler in production, OSM in development

**Status:** Accepted, subject to key

**Decision**

- Development: OpenStreetMap standard tiles with attribution.
- Production: **MapTiler** vector/raster tiles (free tier is sufficient for launch) with a restricted domain key.
- Never ship the OSM standard tile server as the production tile CDN; its usage policy is not intended for commercial traffic.
- Leaflet remains the rendering library; MapTiler is a tile URL change only.
- Attribution is always visible.

**Founder dependency:** MapTiler account and restricted API key.

---

## ADR-005 — Routing: OSRM public for development, self-hosted for production

**Status:** Accepted

**Decision**

- Development and E2E tests use a **mocked OSRM adapter** or the public OSRM demo server.
- Production uses a **self-hosted OSRM** instance (Docker, Uganda/OSM extract) behind `/api/distance`.
- The public demo server is not a production SLA and must not be a hard dependency.
- If OSRM is unavailable and no cached route exists, checkout is **blocked** with a retry message. The system does not silently substitute a straight-line estimate for a final fee.
- A cached route (same quantized coordinates) may be reused for up to 24 hours.

**Rationale**

This resolves the v1.0 contradiction between "strictly road distance" and the Haversine fallback. A wrong fee is worse than a retry prompt.

**Founder dependency:** a small VPS or container host for OSRM (or approval to use a paid routing provider).

---

## ADR-006 — Durable rate limiting: Upstash Redis

**Status:** Accepted

**Decision**

- Use **Upstash Redis** (REST) for distributed rate limits and short-lived caches.
- Limits:
  - `/api/distance`: 30 requests/minute/IP.
  - Checkout: 5 attempts/minute/IP and 10/hour/phone.
  - Staff login: 5 attempts/15 minutes/phone.
  - OTP send: 3/hour/phone.
  - Handover PIN: 3 attempts/order (database-enforced, not Redis-only).
- In-memory limiters are prohibited in production.

**Founder dependency:** Upstash account and REST credentials.

---

## ADR-007 — Printing: browser print for MVP

**Status:** Accepted

**Decision**

- MVP prints kitchen dockets and customer receipts through the browser's native print dialog to a **58 mm or 80 mm thermal printer** installed on the kitchen tablet/PC.
- CSS `@media print` controls the roll width.
- ESC/POS over Web Bluetooth/USB is a Phase 2 enhancement; it is not required for launch.
- The printer model and connection type must be confirmed before Phase 3 print styling.

**Founder dependency:** printer make/model and paper width.

---

## ADR-008 — Next.js and dependency pinning

**Status:** Accepted

**Decision**

- Use the **Next.js 15.x App Router** line with React 19.
- Pin the exact patch version in `package-lock.json` at Phase 1. Do not run `create-next-app@latest`.
- Pin **Tailwind CSS 3.4.x**; do not let the scaffolder install Tailwind 4.x.
- Pin `@supabase/supabase-js` and `@supabase/ssr` to exact versions at Phase 1.
- Use `next/font` for self-hosted fonts.
- Record the resolved versions in this ADR after Phase 1.

**Rationale**

The v1.0 documents allowed 14.2.x or 15.x and told the builder to use `latest`. Those choices produce different APIs (async `cookies()`/`searchParams`, React 19, Tailwind 4 config).

**Founder dependency:** none (engineering decision).

---

## ADR-009 — Customer notifications: SMS for status, WhatsApp for support

**Status:** Accepted

**Decision**

- Transactional status updates use SMS via Africa's Talking.
- The customer tracker remains the primary live view.
- WhatsApp is a support/concierge link, not an automated notification channel in v1.
- PWA push is deferred.
- Notifications are written to an outbox and dispatched by a cron worker with retries.
- Dine-in orders do not send delivery-status SMS.

**Founder dependency:** SMS sender ID and approved message templates.

---

## ADR-010 — Promotions are deferred from v1

**Status:** Accepted

**Decision**

- v1 has **no discount/promo engine**.
- The pricing formula is:
  `total = items_subtotal + modifiers_total + packaging_fee + delivery_fee`.
- The orphaned `Discount_promo` term is removed from all v1 documents.
- A future promotion model is described in the ERD appendix but is not part of the v1 schema.

**Rationale**

The v1.0 formula included a discount term with no table, UI, or state-machine support. Deferring it removes an untestable branch.

---

## ADR-011 — One active delivery per rider in v1

**Status:** Accepted

**Decision**

- A rider may hold at most one active order (`CLAIMED` or `OUT_FOR_DELIVERY`).
- Batching/clustered drops are a future feature.
- The database enforces this with a partial unique index.
- The fleet throughput table's batching row is marked "future".

**Founder dependency:** none.

---

## ADR-012 — Store-closed behavior is a hard block

**Status:** Accepted

**Decision**

- When `app_settings.is_store_open = false`, or the current EAT time is outside opening/closing hours, checkout is blocked.
- The storefront displays a clear closed screen with opening hours and WhatsApp support.
- Admin can override with an explicit "open now" action that is audited.
- Scheduled/pre-orders are deferred.

**Founder dependency:** opening hours and holiday calendar.

---

## ADR-013 — Handover PIN is 4 digits; staff PIN is 6 digits

**Status:** Accepted

**Decision**

- The **customer handover PIN** is 4 digits, per order, generated with `pgcrypto`, valid only for that order, and shown only to the customer.
- The **staff login PIN** is 6 digits, managed by Supabase Auth as the password, and never stored in the database.
- These are different secrets with different threat models. Do not conflate them in UI copy.

**Founder dependency:** staff PIN assignment.

---

## ADR-014 — Realtime uses Broadcast + polling fallback

**Status:** Accepted

**Decision**

- Customer tracker: server emits a safe payload on the public channel `order:{order_token}` after a status change; the page also polls `get_order_by_token` every 10 seconds while visible. Telemetry is polled every 10 seconds during `OUT_FOR_DELIVERY`.
- Kitchen: authenticated Broadcast channel `kitchen` with safe ticket payloads; polling fallback every 10 seconds.
- Rider pool: authenticated Broadcast channel `rider-pool` with safe pool summaries; polling fallback every 15 seconds.
- Raw `postgres_changes` is **not** used on tables containing `handover_pin` or customer PII.
- This avoids the v1.0 conflict between token-based access and Realtime JWT/RLS.

**Rationale**

Supabase Realtime `postgres_changes` cannot do column redaction and cannot authenticate a customer by an order token. Broadcast + polling is simpler and safer.

**Founder dependency:** none.

---

## ADR-015 — Business day and currency

**Status:** Accepted

**Decision**

- All money is stored as whole UGX integers.
- All business dates (ledger, analytics, shifts) use `Africa/Kampala` (EAT, UTC+3).
- Timestamps are stored in UTC and rendered in EAT.
- No fractional cents exist.

**Founder dependency:** none.

---

## ADR-016 — PWA and offline behavior

**Status:** Accepted

**Decision**

- Ship a PWA manifest and a minimal service worker.
- Cache the app shell, fonts, and menu images.
- Never cache order pages, PINs, telemetry, or staff pages.
- The customer menu works offline for browsing; checkout requires connectivity.
- The KDS and rider portal require connectivity and show an offline banner.

**Founder dependency:** PWA icons and brand assets.

---

## Open founder decisions

These are recorded here so they are not lost. **The authoritative, complete register — including F-16 onward, status, and blocking phase — is `AUDIT_REPORT.md` §12.** This table is the first tranche of that register.

| ID | Decision | Needed by |
| :--- | :--- | :--- |
| F-01 | Confirm restaurant GPS on site | Phase 2 |
| F-02 | Confirm fee/MOV/COD constants | Phase 2 |
| F-03 | Provide menu/modifier/combo data | Phase 2 |
| F-04 | Provide staff/rider roster and PINs | Phase 2 |
| F-05 | Provide Flutterwave merchant credentials | Phase 6 |
| F-06 | Provide Africa's Talking credentials | Phase 6 |
| F-07 | Provide MapTiler key | Phase 5 |
| F-08 | Provide Upstash credentials | Phase 5 |
| F-09 | Provide printer model/paper width | Phase 3 |
| F-10 | Provide legal/compliance copy | Phase 10 |
| F-11 | Confirm VAT/EFRIS position | Phase 6 |
| F-12 | Provide brand/dish assets | Phase 3 |
| F-13 | Confirm domain/hosting accounts | Phase 12 |
| F-14 | Confirm COD max radius and change policy | Phase 2 |
| F-15 | Confirm notification templates/sender ID | Phase 9 |

---

## Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.0.0 | 2026-10-29 | Initial ADR baseline created during the readiness upgrade. |

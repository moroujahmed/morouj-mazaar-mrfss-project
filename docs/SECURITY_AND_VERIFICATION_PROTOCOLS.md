# SECURITY AND VERIFICATION PROTOCOLS

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.5.0 |
| **Date** | 2026-11-13 |
| **Supersedes** | v1.0 custom sessions, plaintext PINs, in-memory lockout, and OTP prose |
| **Authority** | `supabase/migrations/20261029000000_initial_schema.sql`, `API_CONTRACTS.md`, `DECISIONS.md` ADR-001/002/003/013 |

This document defines the security controls that the production implementation must preserve. It no longer contains illustrative code that bypasses the schema.

---

## 1. Threat Model

| Threat | Control |
| :--- | :--- |
| Client-side price tampering | Server-side recalculation from database prices and OSRM metres; client totals are ignored |
| Fake delivery / false handover | Per-order 4-digit handover PIN verified by a durable `SECURITY DEFINER` RPC |
| COD abuse and prank orders | 8.1 km COD ceiling, first-time-customer OTP, phone normalization, blacklist, delivery-failure events |
| Order injection | No public `INSERT` on `orders`; creation only through a trusted server action after validation |
| Rider overreach | Riders have no direct table writes; claim/start/release/verify are token-scoped RPCs using `auth.uid()` |
| PIN or PII leakage | Column privileges revoked, safe RPC payloads, no raw `postgres_changes` on orders/telemetry |
| Webhook forgery | Flutterwave `verif-hash` shared-secret comparison plus independent transaction verification |
| Replay / duplicate webhook | `webhook_events(provider, provider_event_id)` unique constraint and processed-at state |
| Stale payment webhook | Per-attempt immutable `tx_ref` + `resolve_payment_tx_ref`; a late event for an abandoned attempt cannot mark the current attempt paid |
| Brute force | Upstash distributed limits, Supabase Auth lockout, database PIN attempts/lockout |
| OSRM scraping | Authenticated distance proxy, coordinate quantisation, 24 h cache, per-IP rate limit |
| Search-path hijack | Every `SECURITY DEFINER` function sets `search_path = public, pg_temp` |

---

## 2. Identity and Session Model

### 2.1 Staff

All staff (`ADMIN`, `KITCHEN`, `RIDER`) authenticate with **Supabase Auth**.

1. The login screen accepts a Ugandan phone number and a **6-digit staff PIN**.
2. The server normalizes the phone to E.164 and maps it to the synthetic email
   `{digits}@staff.moroujmazaar.com`.
3. The server calls `signInWithPassword`. Supabase stores only the password hash.
4. The resulting JWT populates `auth.uid()` for RLS, RPCs, and Broadcast.
5. Sessions last 12 hours. Logout revokes the refresh token.
6. Five failed login attempts for one phone in 15 minutes lock login for 15 minutes.
7. Staff PINs are never stored in `public.profiles` and never logged.

**Provisioning:** `scripts/seed-staff.mjs` creates the Auth user first, then the `profiles` row with the matching UUID and role. `profiles.id REFERENCES auth.users(id)` is mandatory. A staff account is deactivated by setting `profiles.is_active = false` and revoking the Auth user.

### 2.2 Customers

Customers do not create accounts. Each order receives:

- an unguessable UUID `order_token` used only in the customer URL;
- a 4-digit `handover_pin` that is shown only in the token-scoped tracker response;
- no JWT and no direct table access.

The token is a bearer capability. It must never appear in logs, referrers, analytics events, or staff list payloads.

### 2.3 Route Guards

| Route group | Guard |
| :--- | :--- |
| `/` and `/checkout` | Public, rate-limited, store-open gate |
| `/orders/[token]` | Token-scoped RPC only; invalid/expired token shows the not-found state |
| `/kitchen` | `KITCHEN` or `ADMIN` |
| `/rider` | `RIDER` |
| `/admin` | `ADMIN` |

Middleware denies by default. Every server action repeats the role check; middleware is not the only control. The service-role key is imported only in server-only modules and is never bundled to the client.

---

## 3. Handover PIN Protocol

### 3.1 Generation and isolation

- `orders.handover_pin` is generated in the database with `pgcrypto` (`gen_random_bytes`), never `RANDOM()`.
- The value is exactly 4 digits and is constrained by `CHECK (handover_pin ~ '^[0-9]{4}$')`.
- `anon` and `authenticated` have no `SELECT` privilege on the column. The rider payload never contains it.
- The customer sees the PIN only in `get_order_by_token(p_token)`.
- Admin PIN reset uses `admin_reset_handover_pin(order_id, reason)`, which writes an audit row and clears attempts/lockout.

### 3.2 Verification

`verify_delivery_pin(p_order_id, p_pin, p_lat, p_lng, p_ip_hash, p_user_agent)` is the only verification path. It:

1. Requires a rider JWT and derives the rider from `auth.uid()` — there is no `p_rider_id`.
2. Locks the order row with `FOR UPDATE` and requires `order_status = 'OUT_FOR_DELIVERY'` and `rider_id = auth.uid()`.
3. Refuses while `pin_locked_until > now()`.
4. Optionally checks the rider's submitted coordinates against the delivery pin within `app_settings.pin_geofence_m`.
5. Compares the PIN and persists every attempt in `pin_verification_attempts`.
6. On failure increments `failed_pin_attempts`; at `pin_max_attempts` (3) sets `pin_locked_until` to `now() + pin_lock_minutes` (15) and `security_flag = 'PIN_LOCKED'`.
7. On success transitions to `DELIVERED`, sets `delivered_at`, clears attempts and lockout, and for COD sets `payment_status = 'PAID'` and `cod_collected_at`.

The rider UI reports the returned `code` (`INVALID_HANDOVER_PIN`, `PIN_LOCKED`, `TOO_FAR_FROM_DESTINATION`, `ORDER_STATE_INVALID`) and remaining attempts. Completion requires a connection: while offline, the UI blocks the handover with an explanation and keeps the PIN form. It never queues the completion, never offers “sync now”, and never reports “Delivered” before `verify_delivery_pin` succeeds.

### 3.3 Offline completion

- Do not store the completion intent or the PIN locally; offline completion is blocked.
- No background retry or replay of a handover exists, so no completion can be reported late.
- Cash liability changes only after the server returns success.
- If the connection is unavailable, the rider is told to reconnect or contact the customer or admin; the order remains open.

---

## 4. Row-Level Security and RPC Boundary

The migration is deny-by-default.

- RLS is enabled on every application table.
- `anon` and `authenticated` receive no direct `INSERT`/`UPDATE`/`DELETE` on `orders`, `order_items`, `order_item_modifiers`, `payment_transactions`, `webhook_events`, `refunds`, `profiles`, `cash_settlements`, `rider_telemetry`, `notifications`, `admin_audit_log`, or `settings_history`.
- Customer reads use `get_order_by_token`, `get_order_telemetry`, `get_public_settings`, and `submit_feedback`.
- Rider reads/writes use `get_rider_pool`, `get_rider_active_order`, `claim_order_atomic`, `start_delivery`, `release_order`, `verify_delivery_pin`, `report_delivery_failed`, `update_rider_telemetry`, `start_rider_shift`, and `end_rider_shift`.
- Kitchen reads/writes use `get_kitchen_orders`, `accept_order`, `bump_order`, `set_kitchen_busy`, and `set_menu_item_availability`.
- Admin operations use the audited `admin_*`, `reconcile_rider_cash`, `get_admin_ledger`, and `get_admin_analytics` RPCs or server actions.
- Safe views/RPCs omit phone numbers, exact addresses, notes, payment references, and PINs from the unclaimed pool.
- `claim_order_atomic` accepts only `p_order_id`; it rejects a rider who already has a `CLAIMED` or `OUT_FOR_DELIVERY` order.
- Every public mutation has an idempotency key or a natural unique event constraint.

Supabase Realtime uses Broadcast from trusted server code plus polling. Raw `postgres_changes` is prohibited on tables containing PII or secrets.

---

## 5. COD, OTP, and Blacklist

- COD is allowed only within `app_settings.cod_max_radius_km` (8.1 km, founder gate F-14).
- A first-time COD customer must verify a 6-digit OTP sent by Africa's Talking.
- OTPs are stored hashed in `otp_verifications`, expire after 10 minutes, allow 3 attempts, and are limited to 3 sends per phone per hour.
- If the SMS provider is unavailable, COD checkout is disabled with a clear message. Verification is never silently skipped.
- A returning customer with at least one successfully delivered order may skip OTP when the setting permits it.
- Phones are normalized to E.164 by `normalize_ug_phone`; `customer_phone_normalized` is indexed and unique per customer record where required.
- A confirmed COD refusal/abandonment creates a `delivery_attempts` row with outcome `REFUSED`, `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, or `RETURNED`. Admin review may add the normalized phone to `blacklisted_phones`; future COD is disabled for that phone.

---

## 6. Checkout Integrity

The server accepts identifiers only:

```ts
type CheckoutInput =
  | { orderType: "DELIVERY"; delivery: { lat: number; lng: number; address: string }; tableToken?: never }
  | { orderType: "DINE_IN"; tableToken: string; delivery?: never };
```

Validation requirements:

- Valid Ugandan phone, normalized server-side.
- Non-empty cart; quantity 1–20 per line; cart value and line count within `app_settings`.
- Delivery requires coordinates and an address; dine-in requires a valid table token.
- Payment method in the approved enum.
- `idempotency_key` required and unique per customer/session; a replay returns the existing order.
- Store-open gate checked server-side in `Africa/Kampala`; kitchen-pause gate checked against `app_settings.is_kitchen_paused` and returns `KITCHEN_PAUSED`.
- MOV checked against items + modifiers only; dine-in MOV is 0.
- Packaging is 1,000 for delivery and 0 for dine-in.
- Delivery fee is computed from integer `road_distance_m`; food totals never come from the client.
- `total_amount` is a generated column; direct writes to it are rejected by PostgreSQL.
- Promotions are not part of v1.

---

## 7. Rate Limits and Abuse Controls

| Surface | Limit | Store |
| :--- | :--- | :--- |
| `/api/distance` | 30 requests/minute/IP | Upstash |
| Checkout | 5 attempts/minute/IP and 10/hour/phone | Upstash |
| Staff login | 5 attempts/15 minutes/phone | Upstash + Supabase Auth |
| OTP send | 3/hour/phone | Upstash + database |
| Handover PIN | 3 attempts/order, then 15-minute lock | PostgreSQL |
| Public tracker | 60 requests/minute/token | Upstash |
| Feedback | 1 submission/order (DB-enforced) | PostgreSQL |

### 5.1 First-Time Customer OTP Verification Gate
* If a customer selects **Cash on Delivery**, the backend checks the customer's phone number against past order history:
  * **Verified Returning Customer (Has $\ge 1$ successfully delivered order):** Allowed to checkout immediately without SMS verification.
  * **First-Time Customer:** Checkout halts at a verification modal: *"Enter the 6-digit code sent via SMS to verify your cash order."*
* An automated one-time SMS verification code is dispatched through Africa's Talking (mock adapter locally). The order enters `CONFIRMED_UNPAID` only upon correct code entry.

### 5.2 COD Distance Restriction Ceiling
While pre-paid orders (MTN MoMo, Card) can be delivered up to the global ceiling of **`15.0 km`**, Cash on Delivery orders are restricted to a tighter geographic radius:
* **Prepaid Max Distance:** `15.0 km`
* **Cash on Delivery Max Distance:** **`8.1 km`**
* **Rationale:** A rejected or bogus cash delivery at 14 km results in a 28 km round trip (over 1 hour of rider time and high fuel burn). Restricting COD to 8.1 km limits maximum potential loss per occurrence while keeping the canonical Ntinda COD fixture (8.093 km) valid.

### 5.3 Customer Phone Blacklisting
A dedicated database table tracks phone numbers associated with abandoned deliveries:
```sql
CREATE TABLE public.blacklisted_phones (
  phone TEXT PRIMARY KEY CHECK (phone ~ '^\+256[0-9]{9}$'),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 500),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```
* A `BEFORE INSERT OR UPDATE OF phone` trigger normalizes the value with `normalize_ug_phone`, so callers may submit local format; the stored value is always `+256…`.
* Rows are written by admin/service-role code only; RLS is enabled and no client role receives direct INSERT/UPDATE.
* If a confirmed COD delivery fails or is refused (`delivery_attempts.outcome` in `REFUSED`, `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `RETURNED`), an admin may add the normalized phone to `blacklisted_phones`.
* Future checkout attempts from this number automatically disable Cash on Delivery, requiring 100% upfront digital payment via MTN MoMo or Airtel Money.

No production limiter may rely on process memory. CAPTCHA or a proof-of-work challenge may be added to public checkout if abuse is observed; it is not a substitute for server validation.

---

## 8. Privacy and Retention

- Collect only the name, phone, delivery coordinates/address, order contents, and optional notes needed to fulfil the order.
- Display full customer phone numbers only to the assigned rider, kitchen manager, and authorized admin.
- Mask phone numbers on printed customer receipts and exports where full contact is unnecessary.
- Do not store card data. Flutterwave hosted checkout keeps the app in PCI SAQ A scope.
- Retain order/financial records for the founder-approved statutory period; anonymize or delete marketing data when consent is withdrawn.
- Log access to admin audit records. Never log PINs, OTPs, tokens, full webhook payloads containing secrets, or raw phone lists.
- Breach handling follows `COMPLIANCE_AND_LEGAL.md` and `OPERATIONS_RUNBOOK.md`.

---

## 9. Security Verification Checklist

- [ ] `anon` cannot select `orders` directly; token RPC returns only the safe payload.
- [ ] `authenticated` rider cannot select `handover_pin` or update another rider's order.
- [ ] `claim_order_atomic` fails for a second active claim and for another rider's order.
- [ ] `verify_delivery_pin` rejects wrong PINs, locks after 3, resets on success, and enforces geofence.
- [ ] Kitchen can accept/bump only through RPCs; menu price CRUD is admin-only.
- [ ] Admin cancel on a paid order creates a `REQUESTED` refund and an audit row.
- [ ] Settlement links only `DELIVERED` + `PAID` COD orders for the business date.
- [ ] Flutterwave webhook rejects a bad `verif-hash`, replays are idempotent, and late success for a cancelled order triggers review/refund.
- [ ] Staff logout revokes the session; deactivated staff cannot call RPCs.
- [ ] No `postgres_changes` subscription exists on orders, telemetry, payments, or profiles.
- [ ] CSP/HSTS/frame-ancestors headers are present in the Phase 1 build.
- [ ] No secret appears in client bundles, source maps, logs, or Git.

---

## 10. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.5.0 | 2026-11-13 | Added per-attempt payment-reference isolation, the `staff.moroujmazaar.com` synthetic domain, and audited admin mutation coverage. |
| 1.4.0 | 2026-11-12 | Aligned SMS provider, one-feedback-per-order limit, and blacklist E.164 normalization/constraint. |
| 1.3.0 | 2026-11-10 | Corrected blacklist DDL/columns and `total_amount` protection; added the kitchen-pause checkout gate. |
| 1.2.0 | 2026-11-09 | Replaced with Supabase Auth, durable PIN RPC, RLS boundary, OTP, rate limits, and verification checklist. |
| 1.1.0 | 2026-10-29 | Amendment banner only. |
| 1.0.0 | 2026-10-29 | Original custom-session draft. |

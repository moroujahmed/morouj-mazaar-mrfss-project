# API CONTRACTS — Server Actions, Route Handlers, and Database RPCs

| Field | Value |
| :--- | :--- |
| **Status** | Normative build contract |
| **Version** | 1.5.0 |
| **Date** | 2026-11-13 |
| **Rule** | Every public mutation must appear here before implementation. |

---

## 1. Conventions

### 1.1 Response envelope

```ts
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string; details?: unknown } };
```

### 1.2 Error codes

| Code | HTTP | Meaning |
| :--- | ---: | :--- |
| `AUTH_UNAUTHORIZED` | 401 | No valid session or wrong role. |
| `AUTH_LOCKED` | 423 | Too many failed login attempts. |
| `VALIDATION_ERROR` | 400 | Zod validation failed. |
| `MOV_NOT_MET` | 422 | Subtotal below minimum order value. |
| `DISTANCE_OUT_OF_BOUNDS` | 422 | Beyond 15 km delivery ceiling. |
| `DISTANCE_UNAVAILABLE` | 503 | OSRM unavailable and no cached route. |
| `STORE_CLOSED` | 409 | Store is outside opening hours. |
| `KITCHEN_PAUSED` | 409 | Kitchen has paused new orders. |
| `ITEM_OUT_OF_STOCK` | 409 | Item was 86'd during checkout. |
| `ITEM_NOT_FOUND` | 404 | Unknown menu item in a staff availability mutation. |
| `PAYMENT_METHOD_UNAVAILABLE` | 409 | Provider or COD is disabled. |
| `COD_NOT_AVAILABLE` | 409 | COD outside radius or phone blacklisted. |
| `OTP_REQUIRED` | 428 | COD phone verification required. |
| `OTP_INVALID` | 422 | Wrong/expired OTP. |
| `ORDER_ALREADY_CLAIMED` | 409 | Another rider won the claim race. |
| `RIDER_HAS_ACTIVE_ORDER` | 409 | One active delivery per rider. |
| `INVALID_HANDOVER_PIN` | 422 | PIN mismatch. |
| `PIN_LOCKED` | 423 | PIN attempts exhausted. |
| `TOO_FAR_FROM_DESTINATION` | 422 | Geofence check failed. |
| `ORDER_NOT_FOUND` | 404 | Unknown token/order. |
| `ORDER_STATE_INVALID` | 409 | Transition not allowed from current state. |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different payload. |
| `RATE_LIMITED` | 429 | Too many requests. |
| `LAST_ADMIN_PROTECTED` | 409 | Cannot deactivate or demote the final active admin. |
| `INTERNAL_ERROR` | 500 | Unexpected failure. |

### 1.3 Auth matrix

| Surface | Auth | Notes |
| :--- | :--- | :--- |
| `/` storefront | anon | Public menu. |
| `/checkout` | anon | Order token issued after creation. |
| `/orders/[token]` | anon + token | Token is the capability. |
| `/kitchen` | Supabase Auth, `KITCHEN` or `ADMIN` | Middleware + server guard. |
| `/rider` | Supabase Auth, `RIDER` | Middleware + server guard. |
| `/admin` | Supabase Auth, `ADMIN` | Middleware + server guard. |
| `/api/webhooks/flutterwave` | provider signature | No user session. |
| `/api/notifications/dispatch` | `CRON_SECRET` | Cron only. |
| `/api/distance` | anon + rate limit | No PII. |

---

## 2. Server Actions

### 2.1 `createOrderAction`

**File:** `src/actions/checkout.ts`
**Auth:** anon
**Rate limit:** 5/min/IP, 10/hour/phone
**Idempotency:** required `idempotencyKey` (UUID v4, client-generated, stored 24 h)

**Input**

```ts
{
  idempotencyKey: string;              // UUID
  customerName: string;                // 2..100
  customerPhone: string;               // Ugandan format, normalized server-side
  orderType: "DELIVERY" | "DINE_IN";
  tableToken?: string;                 // required for DINE_IN; UUID from QR
  deliveryCoordinates?: { lat: number; lng: number }; // required for DELIVERY
  deliveryAddressText?: string;        // <= 300
  items: Array<{
    menuItemId: string;                // UUID
    quantity: number;                  // 1..20
    modifierIds: string[];             // UUIDs, validated against groups
  }>;
  paymentMethod: "MTN_MOMO" | "AIRTEL_MONEY" | "CASH_ON_DELIVERY" | "BANK_CARD";
  codChangeRequestedFor?: number;      // 20000 | 50000 | ...; >= total
  otpCode?: string;                    // required for first-time COD
  customerNotes?: string;              // <= 500
  promoCode?: never;                   // deferred in v1
}
```

**Server pipeline**

1. Validate Zod discriminated union.
2. Normalize phone to E.164.
3. Check store open (EAT hours + `is_store_open`).
4. Check kitchen intake (`app_settings.is_kitchen_paused`); return `KITCHEN_PAUSED` if paused.
5. Check idempotency key; return existing order if same payload.
6. Fetch authoritative menu prices, active/available flags, modifier groups.
7. Reject any item that is 86'd or inactive; reject carts with more than `max_cart_lines` distinct lines.
8. Compute `items_subtotal` and `modifiers_total`.
9. Enforce MOV (delivery) or bypass (dine-in).
10. Resolve table token for dine-in; reject invalid/inactive table.
11. Compute road distance via OSRM adapter (metres). Block on out-of-bounds or unavailable.
12. Compute delivery fee from metres.
13. Packaging fee: delivery 1,000; dine-in 0.
14. Compute `total_amount`.
15. COD checks: radius <= `app_settings.cod_max_radius_km` (8.1 km), phone not blacklisted, OTP verified if first-time.
16. Insert order + items + modifier snapshots in one transaction.
17. Generate `order_token` and `handover_pin` in DB.
18. Insert status history row.
19. Return `{ orderToken, orderNumber, totalAmount }`.

**Output**

```ts
{ orderToken: string; orderNumber: number; totalAmount: number }
```

**Errors:** `VALIDATION_ERROR`, `STORE_CLOSED`, `KITCHEN_PAUSED`, `ITEM_OUT_OF_STOCK`, `MOV_NOT_MET`, `DISTANCE_OUT_OF_BOUNDS`, `DISTANCE_UNAVAILABLE`, `COD_NOT_AVAILABLE`, `OTP_REQUIRED`, `OTP_INVALID`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`.

---

### 2.2 `initiatePaymentAction`

**File:** `src/actions/payments.ts`
**Auth:** anon + order token
**Input:** `{ orderToken: string; method: "MTN_MOMO" | "AIRTEL_MONEY" | "BANK_CARD" }`
**Output:** `{ redirectUrl: string; transactionId: string; txRef: string; attemptNumber: number }`
**Behavior:** calls `start_payment_attempt(order_token, method, 'flutterwave')`, which locks the order, abandons any open attempt, allocates the next `attempt_number`, stores an `INITIATED` row with `tx_ref = '<order_token>-<attempt_number>'`, then calls Flutterwave `/v3/payments` with that `tx_ref` and returns the hosted checkout link. Rejects cash orders with `PAYMENT_METHOD_UNAVAILABLE`, a method mismatch with `VALIDATION_ERROR`, and any state other than `PENDING_PAYMENT` + `PENDING` with `ORDER_STATE_INVALID`. Retries never reuse a `tx_ref`; the rate limit is 5 attempts/hour/order.

---

### 2.3 `submitFeedbackAction`

**File:** `src/actions/orders.ts`
**Auth:** anon + order token
**Input:** `{ orderToken: string; rating: "GREAT" | "OKAY" | "BAD"; notes?: string }`
**Output:** `{ success: true }`
**Rules:** only once, only when `DELIVERED`.

---

### 2.4 `sendCodOtpAction`

**File:** `src/actions/otp.ts`
**Auth:** anon
**Input:** `{ phone: string }`
**Output:** `{ sent: true; expiresInSeconds: 600 }`
**Rate limit:** 3/hour/phone, 10/hour/IP.
**Rules:** normalize phone; if returning customer with >= 1 delivered order, return `{ sent: false, skip: true }`; otherwise generate 6-digit code, hash, store, send SMS.

---

### 2.5 `staffLoginAction`

**File:** `src/actions/auth.ts`
**Auth:** anon
**Input:** `{ phone: string; pin: string }`
**Output:** `{ role: "ADMIN" | "KITCHEN" | "RIDER" }`
**Behavior:** rate limit; map phone to synthetic email; `signInWithPassword`; set Supabase cookies; update `profiles.last_login_at`; reject inactive users.

---

### 2.6 `staffLogoutAction`

**Auth:** staff
**Output:** `{ success: true }`
**Behavior:** `supabase.auth.signOut()`; clear cookies.

---

### 2.7 Kitchen actions

| Action | Auth | Input | Rules |
| :--- | :--- | :--- | :--- |
| `acceptOrderAction` | KITCHEN/ADMIN | `{ orderId }` | `CONFIRMED_UNPAID` → `PREPARING`; sets `acknowledged_at`. Paid orders arrive already `PREPARING` from the verified webhook and do not use accept. |
| `bumpOrderAction` | KITCHEN/ADMIN | `{ orderId }` | `PREPARING` → `READY_FOR_PICKUP` (delivery) or `DELIVERED` (dine-in). |
| `setItemAvailabilityAction` | KITCHEN/ADMIN | `{ itemId, available }` | Calls `set_menu_item_availability` RPC; audited. |
| `setBusyModeAction` | KITCHEN/ADMIN | `{ busy, bufferMinutes }` | Calls `set_kitchen_busy` RPC; buffer 0..60. |
| `setKitchenPausedAction` | KITCHEN/ADMIN | `{ paused }` | Calls `set_kitchen_paused` RPC; blocks new checkout with `KITCHEN_PAUSED`; audited. |

---

### 2.8 Rider actions

| Action | Auth | Input | Rules |
| :--- | :--- | :--- | :--- |
| `claimOrderAction` | RIDER | `{ orderId }` | Calls `claim_order_atomic`; one active order. |
| `startDeliveryAction` | RIDER | `{ orderId }` | Calls `start_delivery`; `CLAIMED` → `OUT_FOR_DELIVERY`. |
| `releaseOrderAction` | RIDER/ADMIN | `{ orderId, reason }` | `CLAIMED` → `READY_FOR_PICKUP`; clears rider. |
| `verifyPinAction` | RIDER | `{ orderId, pin, lat?, lng? }` | Calls `verify_delivery_pin(order_id, pin, lat, lng, ip_hash, user_agent)`; returns remaining attempts/change due. |
| `reportDeliveryFailedAction` | RIDER | `{ orderId, outcome, reason }` | `OUT_FOR_DELIVERY` → `DELIVERY_FAILED`; writes `delivery_attempts`. |

---

### 2.9 Admin actions

| Action | Auth | Input | Rules |
| :--- | :--- | :--- | :--- |
| `updateOrderContactAction` | ADMIN | `{ orderId, phone?, notes?, coordinates? }` | Recomputes fee if coordinates change; audit. |
| `cancelOrderAction` | ADMIN | `{ orderId, reason }` | Sets `CANCELLED`; refund if paid; audit. |
| `adminCompleteOrderAction` | ADMIN | `{ orderId, reason }` | Overrides PIN; audit + security flag. |
| `adminRedeliverOrderAction` | ADMIN | `{ orderId, reason, riderId? }` | Calls `admin_redeliver_order`; `DELIVERY_FAILED` only; audited. |
| `approveRefundAction` | ADMIN | `{ refundId, decision: "APPROVE" \| "REJECT", notes? }` | Calls `admin_approve_refund`; approving moves `REQUESTED` → `PROCESSING`; audit. Gateway refund execution remains a Phase 6 server job. |
| `reconcileCashAction` | ADMIN | `{ riderId, countedCash, notes }` | Calls `reconcile_rider_cash`; a shortfall produces `PARTIAL` and remains outstanding. |
| `updateSettingsAction` | ADMIN | `{ ...allow-listed settings, reason }` | Calls `admin_update_settings`; validates bounds and writes history + audit. |
| `upsertMenuItemAction` | ADMIN | `{ ...item fields, reason }` | Calls `admin_upsert_menu_item`; image path must exist in storage; slug unique; audited. |
| `upsertModifierGroupAction` | ADMIN | `{ ...group + options, reason }` | Calls `admin_upsert_modifier_group`; validates min/max; audited. |
| `upsertComboAction` | ADMIN | `{ ...combo + steps, reason }` | Calls `admin_upsert_combo`; validates steps/options; audited. |
| `upsertTableAction` | ADMIN | `{ tableNumber, label, isActive, reason }` | Calls `admin_upsert_table`; generates QR token; audited. |
| `updateStaffAction` | ADMIN | `{ profileId, role, active, motorcyclePlate, reason }` | Calls `admin_update_staff`; cannot demote/deactivate last admin (`LAST_ADMIN_PROTECTED`); audited. |

---

## 3. Route Handlers

### 3.1 `GET /api/distance`

**Query:** `lat`, `lng`
**Auth:** anon
**Rate limit:** 30/min/IP
**Response:** `{ distanceM: number; distanceKm: number; source: "OSRM" | "CACHE" | "MOCK"; durationSeconds?: number; cached?: boolean }`
**Errors:** `DISTANCE_UNAVAILABLE`, `DISTANCE_OUT_OF_BOUNDS`, `RATE_LIMITED`.
**Rules:** quantize coordinates to 5 decimals for cache key; cache 24 h; never return a Haversine estimate as final.

### 3.2 `POST /api/webhooks/flutterwave`

**Auth:** Flutterwave `verif-hash` (timing-safe)
**Flow:**

1. Read raw body.
2. Compare `verif-hash` to `FLW_WEBHOOK_HASH` with `crypto.timingSafeEqual`.
3. Parse with Zod.
4. Insert `webhook_events` with `UNIQUE(provider, provider_event_id)`; if duplicate, return 200.
5. Resolve the attempt with `resolve_payment_tx_ref(tx_ref)`. A `tx_ref` maps to exactly one `(order, attempt_number)`. If it does not resolve, record the event and return 200 without a state change.
6. Verify transaction with Flutterwave `/v3/transactions/{id}/verify`.
7. Check amount and currency against the resolved attempt.
8. If order is `CANCELLED`/`DELIVERED`, record and return 200 without state change.
9. If successful: mark that attempt `SUCCESSFUL`; set `payment_status = PAID`, `order_status = PREPARING`, set `acknowledged_at` when not already set. A later attempt cannot overwrite a paid order.
10. If failed: mark that attempt `FAILED`, record the provider error, and leave the order in `PENDING_PAYMENT` so the customer can retry. A definitive timeout is handled only by `expire_pending_orders()`. An abandoned attempt's late success never marks the order paid; it is recorded for manual review/refund.
11. Return 200 quickly; no long work.

**Idempotency:** unique event ID + order status guard.

### 3.3 `POST /api/notifications/dispatch`

**Auth:** `Authorization: Bearer ${CRON_SECRET}`
**Behavior:** select up to 50 `PENDING` notifications, send via Africa's Talking, update status/attempts, exponential backoff.
**Schedule:** every minute (Vercel Cron or Supabase cron).

### 3.4 `POST /api/cron/expire-orders`

**Auth:** `CRON_SECRET`
**Behavior:** calls `expire_pending_orders()`: `PENDING_PAYMENT` older than 10 minutes → `CANCELLED` + `payment_status = FAILED`, reason `PAYMENT_TIMEOUT`; linked `INITIATED`/`PENDING` payment transactions become `FAILED`.
**Schedule:** every minute.

### 3.5 `POST /api/cron/close-shifts`

**Auth:** `CRON_SECRET`
**Behavior:** at 22:30 EAT, calls `close_open_rider_shifts()` to close every open shift, snapshot expected cash, and notify admin for settlement.

### 3.6 `GET /api/health`

**Auth:** none
**Response:** `{ status: "ok", time: string, version: string }`
**Rules:** no secrets, no DB details.

### 3.7 `GET /api/print/receipt/[orderId]`

**Auth:** KITCHEN/ADMIN
**Response:** `text/html; charset=utf-8` browser-printable docket (58 mm/80 mm print stylesheet, `window.print()`-ready). ESC/POS is deferred per ADR-007.
**Rules:** mask customer phone; never include handover PIN on kitchen docket; reprint is audited.

---

## 4. Database RPCs

All RPCs are `SECURITY DEFINER` with `SET search_path = public, pg_temp`.

| RPC | Auth | Purpose |
| :--- | :--- | :--- |
| `get_order_by_token(p_token uuid)` | anon | Safe customer tracker payload; handover PIN returned only for an active delivery order, never for dine-in/terminal orders. Includes latest refund and delivery-failure summaries. |
| `start_payment_attempt(p_order_token uuid, p_method public.payment_method, p_provider text)` | anon | Locks the order, abandons any open attempt, allocates the next attempt number, and returns `{ transactionId, txRef, attemptNumber, amount, currency }`. Token is the capability. |
| `resolve_payment_tx_ref(p_tx_ref text)` | service role | Read-only webhook lookup returning the single transaction/order/attempt bound to a `tx_ref`. |
| `get_rider_pool()` | RIDER | Safe pool summaries with `readyAt` and `itemCount`; no PII/PIN. |
| `get_rider_active_order()` | RIDER | Active order details; no PIN. |
| `claim_order_atomic(p_order_id uuid)` | RIDER | Atomic claim; one active order. |
| `start_delivery(p_order_id uuid)` | RIDER | `CLAIMED` → `OUT_FOR_DELIVERY`. |
| `release_order(p_order_id uuid, p_reason text)` | RIDER/ADMIN | Return to pool. |
| `verify_delivery_pin(p_order_id uuid, p_pin text, p_lat numeric, p_lng numeric, p_ip_hash text, p_user_agent text)` | RIDER | Atomic PIN check, attempts, geofence, completion. A rider probing another rider's order receives `AUTH_UNAUTHORIZED`, not an order-state error. |
| `report_delivery_failed(p_order_id uuid, p_outcome public.delivery_outcome, p_reason text, p_lat numeric, p_lng numeric)` | RIDER | Terminal failure. |
| `admin_complete_order(p_order_id uuid, p_reason text)` | ADMIN | PIN override with audit; accepts `CLAIMED`, `OUT_FOR_DELIVERY`, or `READY_FOR_PICKUP`. |
| `admin_cancel_order(p_order_id uuid, p_reason text)` | ADMIN | Cancel + refund request if paid. |
| `admin_reassign_order(p_order_id uuid, p_rider_id uuid, p_reason text)` | ADMIN | Reassign with audit; target must be an active rider with no other active order. |
| `admin_redeliver_order(p_order_id uuid, p_reason text, p_rider_id uuid)` | ADMIN | `DELIVERY_FAILED` only; clears failure state, returns to `READY_FOR_PICKUP`, or assigns a rider and moves to `CLAIMED` atomically; audited. |
| `admin_reset_handover_pin(p_order_id uuid, p_reason text)` | ADMIN | New PIN, clear lock, audit; rejected for terminal orders. |
| `admin_update_settings(p_payload jsonb, p_reason text)` | ADMIN | Allow-listed, bounded settings update; writes `settings_history` and an `ADMIN_UPDATE_SETTINGS` audit row. |
| `admin_update_order_contact(p_order_id uuid, ...contact/address/fee fields, p_reason text)` | ADMIN | Pre-dispatch contact/address correction; recomputes the generated total from new fee components; audited. |
| `admin_upsert_category(p_payload jsonb, p_reason text)` | ADMIN | Create/update category; audited. |
| `admin_upsert_menu_item(p_payload jsonb, p_reason text)` | ADMIN | Create/update item and modifier-group links; audited. |
| `admin_upsert_modifier_group(p_payload jsonb, p_reason text)` | ADMIN | Create/update group and options; rejects options owned by another group; audited. |
| `admin_upsert_combo(p_payload jsonb, p_reason text)` | ADMIN | Create/update combo steps/options; audited. |
| `admin_upsert_table(p_payload jsonb, p_reason text)` | ADMIN | Create/update table and QR token; audited. |
| `admin_update_staff(p_profile_id uuid, p_role public.user_role, p_is_active boolean, p_motorcycle_plate text, p_reason text)` | ADMIN | Role/active/plate update; last-admin guard; audited. |
| `admin_approve_refund(p_refund_id uuid, p_decision text, p_notes text)` | ADMIN | `APPROVE` moves `REQUESTED → PROCESSING`; `REJECT` moves `REQUESTED → FAILED`; audited; no gateway call. |
| `set_kitchen_busy(p_busy boolean, p_buffer_minutes int)` | KITCHEN/ADMIN | Busy mode; audited with reason. |
| `set_kitchen_paused(p_paused boolean)` | KITCHEN/ADMIN | Pause/resume new-order intake; audited with reason. |
| `set_menu_item_availability(p_item_id uuid, p_available boolean)` | KITCHEN/ADMIN | 86 toggle; `ITEM_NOT_FOUND` for unknown IDs; audited. |
| `reconcile_rider_cash(p_rider_id uuid, p_counted_cash int, p_notes text, p_business_date date)` | ADMIN | Settlement + order linkage; shortfall leaves `PARTIAL` status and carried-forward outstanding cash. |
| `get_rider_cash_summary(p_rider_id uuid)` | RIDER self/ADMIN | Expected vs. settled, including `settlementShortfall`. |
| `get_admin_ledger(p_business_date date)` | ADMIN | Ledger rows with linked order IDs/numbers. |
| `get_admin_analytics(p_from date, p_to date)` | ADMIN | KPIs. |
| `validate_table_token(p_token uuid)` | anon | Table lookup for dine-in. |
| `update_rider_telemetry(p_order_id uuid, p_lat numeric, p_lng numeric, p_accuracy numeric, p_heading numeric, p_speed numeric)` | RIDER | Scoped telemetry. |
| `expire_pending_orders()` | service role | Payment timeout; sets order `CANCELLED` + `payment_status = FAILED` and fails open transactions. |
| `close_open_rider_shifts()` | service role | Close open shifts and snapshot expected cash for settlement. |
| `admin_get_order(p_order_id uuid)` | ADMIN | Full order incl. PIN/attempts/status history/delivery attempts/payments/refunds. |
| `admin_list_orders(p_status text, p_search text, p_limit int, p_offset int)` | ADMIN | Paginated order list with rider name and timestamps. |
| `admin_get_audit_feed(p_limit int, p_offset int, p_entity_type text)` | ADMIN | Paginated audit feed with actor names and reasons. |

---

## 5. Realtime Channels

| Channel | Audience | Payload | Fallback |
| :--- | :--- | :--- | :--- |
| `order:{order_token}` | Customer with token | `{ status, etaAt, telemetry? }` | Poll `get_order_by_token` every 10 s. |
| `kitchen` | KITCHEN/ADMIN | Safe ticket summary | Poll every 10 s. |
| `rider-pool` | RIDER | Safe pool summary | Poll `get_rider_pool` every 15 s. |
| `rider:{rider_id}` | Assigned rider | Assignment/status change | Poll `get_rider_active_order` every 10 s. |

**Rules**

- Never broadcast `handover_pin`, customer phone, exact address, or payment references.
- Broadcast is emitted by a trusted server action/route after the DB mutation.
- The customer channel name contains the unguessable order token; treat it as a capability.
- Do not use raw `postgres_changes` on `orders`, `rider_telemetry`, `payment_transactions`, or `profiles`.

---

## 6. Rate Limits

| Endpoint | Limit | Store |
| :--- | :--- | :--- |
| `/api/distance` | 30/min/IP | Upstash |
| Checkout | 5/min/IP + 10/hour/phone | Upstash |
| Staff login | 5/15 min/phone | Upstash + DB lock |
| OTP send | 3/hour/phone + 10/hour/IP | Upstash |
| Handover PIN | 3/order | Postgres |
| Payment initiate | 5/hour/order | Upstash |
| Notification dispatch | cron only | secret |

---

## 7. Environment Variables

See `.env.example` at the repository root. The canonical list:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STAFF_EMAIL_DOMAIN=staff.moroujmazaar.com
STAFF_SEED_FILE=scripts/staff.example.json
FLW_PUBLIC_KEY=
FLW_SECRET_KEY=
FLW_WEBHOOK_HASH=
FLW_BASE_URL=https://api.flutterwave.com/v3
PAYMENTS_MODE=mock
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
AFRICASTALKING_SENDER_ID=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_MAPTILER_KEY=
OSRM_BASE_URL=
CRON_SECRET=
NEXT_PUBLIC_SUPPORT_WHATSAPP=
SENTRY_DSN=
```

All variables are validated at startup by `src/lib/env.ts` with Zod.

---

## 8. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.5.0 | 2026-11-13 | Replaced `tx_ref = order_token` with per-attempt references, added `start_payment_attempt`/`resolve_payment_tx_ref`/`admin_redeliver_order`, documented the audited admin mutation RPCs, and added `STAFF_SEED_FILE`/`SENTRY_DSN`. |
| 1.4.0 | 2026-11-12 | Added `max_cart_lines`, `ITEM_NOT_FOUND`, `LAST_ADMIN_PROTECTED`; aligned failed-payment retry semantics, timeout transaction failure, rider pool `readyAt`/`itemCount`, token PIN hiding, ledger linked orders, extended admin payloads, and list/audit/close-shift/refund-approval contracts. |
| 1.3.0 | 2026-11-10 | Added `KITCHEN_PAUSED`, `setKitchenPausedAction`/`set_kitchen_paused`, and aligned the print route with browser-print HTML. |
| 1.2.0 | 2026-11-09 | Canonical Flutterwave route, 8.1 km COD ceiling, corrected accept/verify/RPC signatures, admin reset/reassign/refund/analytics entries. |
| 1.1.0 | 2026-10-29 | Created; replaces the ambiguous v1.0 route/action descriptions. |

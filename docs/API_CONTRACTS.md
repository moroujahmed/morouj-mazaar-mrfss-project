# API CONTRACTS — Server Actions, Route Handlers, and Database RPCs

| Field | Value |
| :--- | :--- |
| **Status** | Approved build contract |
| **Version** | 1.1.0 |
| **Date** | 2026-10-29 |
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
| `ITEM_OUT_OF_STOCK` | 409 | Item was 86'd during checkout. |
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
| `/api/webhooks/payment` | provider signature | No user session. |
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
4. Check idempotency key; return existing order if same payload.
5. Fetch authoritative menu prices, active/available flags, modifier groups.
6. Reject any item that is 86'd or inactive.
7. Compute `items_subtotal` and `modifiers_total`.
8. Enforce MOV (delivery) or bypass (dine-in).
9. Resolve table token for dine-in; reject invalid/inactive table.
10. Compute road distance via OSRM adapter (metres). Block on out-of-bounds or unavailable.
11. Compute delivery fee from metres.
12. Packaging fee: delivery 1,000; dine-in 0.
13. Compute `total_amount`.
14. COD checks: radius <= 8 km, phone not blacklisted, OTP verified if first-time.
15. Insert order + items + modifier snapshots in one transaction.
16. Generate `order_token` and `handover_pin` in DB.
17. Insert status history row.
18. Return `{ orderToken, orderNumber, totalAmount }`.

**Output**

```ts
{ orderToken: string; orderNumber: number; totalAmount: number }
```

**Errors:** `VALIDATION_ERROR`, `STORE_CLOSED`, `ITEM_OUT_OF_STOCK`, `MOV_NOT_MET`, `DISTANCE_OUT_OF_BOUNDS`, `DISTANCE_UNAVAILABLE`, `COD_NOT_AVAILABLE`, `OTP_REQUIRED`, `OTP_INVALID`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`.

---

### 2.2 `initiatePaymentAction`

**File:** `src/actions/payments.ts`
**Auth:** anon + order token
**Input:** `{ orderToken: string; method: "MTN_MOMO" | "AIRTEL_MONEY" | "BANK_CARD" }`
**Output:** `{ redirectUrl: string }`
**Behavior:** creates a `payment_transactions` row (`INITIATED`), calls Flutterwave `/v3/payments`, returns hosted checkout link. Rejects if order not `PENDING_PAYMENT` or amount mismatch.

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
| `acceptOrderAction` | KITCHEN/ADMIN | `{ orderId }` | `CONFIRMED_UNPAID`/`PENDING_PAYMENT` → `PREPARING`; sets `acknowledged_at` (add column if needed). |
| `bumpOrderAction` | KITCHEN/ADMIN | `{ orderId }` | `PREPARING` → `READY_FOR_PICKUP` (delivery) or `DELIVERED` (dine-in). |
| `setItemAvailabilityAction` | KITCHEN/ADMIN | `{ itemId, available }` | Calls `set_menu_item_availability` RPC; audited. |
| `setBusyModeAction` | KITCHEN/ADMIN | `{ busy, bufferMinutes }` | Calls `set_kitchen_busy` RPC; buffer 0..60. |

---

### 2.8 Rider actions

| Action | Auth | Input | Rules |
| :--- | :--- | :--- | :--- |
| `claimOrderAction` | RIDER | `{ orderId }` | Calls `claim_order_atomic`; one active order. |
| `startDeliveryAction` | RIDER | `{ orderId }` | Calls `start_delivery`; `CLAIMED` → `OUT_FOR_DELIVERY`. |
| `releaseOrderAction` | RIDER/ADMIN | `{ orderId, reason }` | `CLAIMED` → `READY_FOR_PICKUP`; clears rider. |
| `verifyPinAction` | RIDER | `{ orderId, pin }` | Calls `verify_delivery_pin`; returns remaining attempts/change due. |
| `reportDeliveryFailedAction` | RIDER | `{ orderId, outcome, reason }` | `OUT_FOR_DELIVERY` → `DELIVERY_FAILED`; writes `delivery_attempts`. |

---

### 2.9 Admin actions

| Action | Auth | Input | Rules |
| :--- | :--- | :--- | :--- |
| `updateOrderContactAction` | ADMIN | `{ orderId, phone?, notes?, coordinates? }` | Recomputes fee if coordinates change; audit. |
| `cancelOrderAction` | ADMIN | `{ orderId, reason }` | Sets `CANCELLED`; refund if paid; audit. |
| `adminCompleteOrderAction` | ADMIN | `{ orderId, reason }` | Overrides PIN; audit + security flag. |
| `reconcileCashAction` | ADMIN | `{ riderId, countedCash, notes }` | Calls `reconcile_rider_cash`; returns settlement. |
| `updateSettingsAction` | ADMIN | `{ freeRadiusKm, ratePerKm, mov, maxRadius, codMaxRadius, packagingFee, isStoreOpen, openingTime, closingTime }` | Validates bounds; audit. |
| `upsertMenuItemAction` | ADMIN | menu item fields | Image path must exist in storage; slug unique. |
| `upsertModifierGroupAction` | ADMIN | group + options | Validates min/max. |
| `upsertComboAction` | ADMIN | combo + steps | Validates steps/options. |
| `upsertTableAction` | ADMIN | `{ tableNumber, label, isActive }` | Generates QR token. |
| `updateStaffAction` | ADMIN | `{ profileId, role, active, motorcyclePlate }` | Cannot demote last admin. |

---

## 3. Route Handlers

### 3.1 `GET /api/distance`

**Query:** `lat`, `lng`
**Auth:** anon
**Rate limit:** 30/min/IP
**Response:** `{ distanceM: number; distanceKm: number; source: "OSRM" | "CACHE"; durationSeconds?: number }`
**Errors:** `DISTANCE_UNAVAILABLE`, `DISTANCE_OUT_OF_BOUNDS`, `RATE_LIMITED`.
**Rules:** quantize coordinates to 5 decimals for cache key; cache 24 h; never return a Haversine estimate as final.

### 3.2 `POST /api/webhooks/payment`

**Auth:** Flutterwave `verif-hash` (timing-safe)
**Flow:**

1. Read raw body.
2. Compare `verif-hash` to `FLW_WEBHOOK_HASH` with `crypto.timingSafeEqual`.
3. Parse with Zod.
4. Insert `webhook_events` with `UNIQUE(provider, provider_event_id)`; if duplicate, return 200.
5. Find order by `tx_ref = order_token`.
6. Verify transaction with Flutterwave `/v3/transactions/{id}/verify`.
7. Check amount and currency.
8. If order is `CANCELLED`/`DELIVERED`, record and return 200 without state change.
9. If successful: `payment_status = PAID`, `order_status = PREPARING`, store transaction.
10. If failed: `payment_status = FAILED`, `order_status = CANCELLED`, reason `PAYMENT_FAILED`.
11. Return 200 quickly; no long work.

**Idempotency:** unique event ID + order status guard.

### 3.3 `POST /api/notifications/dispatch`

**Auth:** `Authorization: Bearer ${CRON_SECRET}`
**Behavior:** select up to 50 `PENDING` notifications, send via Africa's Talking, update status/attempts, exponential backoff.
**Schedule:** every minute (Vercel Cron or Supabase cron).

### 3.4 `POST /api/cron/expire-orders`

**Auth:** `CRON_SECRET`
**Behavior:** `PENDING_PAYMENT` older than 10 minutes → `CANCELLED`, reason `PAYMENT_TIMEOUT`.
**Schedule:** every minute.

### 3.5 `POST /api/cron/close-shifts`

**Auth:** `CRON_SECRET`
**Behavior:** at 22:30 EAT, mark open rider shifts as pending settlement; notify admin.

### 3.6 `GET /api/health`

**Auth:** none
**Response:** `{ status: "ok", time: string, version: string }`
**Rules:** no secrets, no DB details.

### 3.7 `GET /api/print/receipt/[orderId]`

**Auth:** KITCHEN/ADMIN
**Response:** `text/plain; charset=utf-8` ESC/POS-ready text.
**Rules:** mask customer phone; never include handover PIN on kitchen docket; reprint is audited.

---

## 4. Database RPCs

All RPCs are `SECURITY DEFINER` with `SET search_path = public, pg_temp`.

| RPC | Auth | Purpose |
| :--- | :--- | :--- |
| `get_order_by_token(p_token uuid)` | anon | Safe customer tracker payload; includes handover PIN only for that token. |
| `get_rider_pool()` | RIDER | Safe pool summaries; no PII/PIN. |
| `get_rider_active_order()` | RIDER | Active order details; no PIN. |
| `claim_order_atomic(p_order_id uuid)` | RIDER | Atomic claim; one active order. |
| `start_delivery(p_order_id uuid)` | RIDER | `CLAIMED` → `OUT_FOR_DELIVERY`. |
| `release_order(p_order_id uuid, p_reason text)` | RIDER/ADMIN | Return to pool. |
| `verify_delivery_pin(p_order_id uuid, p_pin text)` | RIDER | Atomic PIN check, attempts, geofence, completion. |
| `report_delivery_failed(p_order_id uuid, p_outcome text, p_reason text)` | RIDER | Terminal failure. |
| `admin_complete_order(p_order_id uuid, p_reason text)` | ADMIN | PIN override with audit. |
| `set_kitchen_busy(p_busy boolean, p_buffer_minutes int)` | KITCHEN/ADMIN | Busy mode. |
| `set_menu_item_availability(p_item_id uuid, p_available boolean)` | KITCHEN/ADMIN | 86 toggle. |
| `reconcile_rider_cash(p_rider_id uuid, p_counted_cash int, p_notes text)` | ADMIN | Settlement + order linkage. |
| `get_rider_cash_summary(p_rider_id uuid)` | RIDER self/ADMIN | Expected vs. settled. |
| `validate_table_token(p_token uuid)` | anon | Table lookup for dine-in. |
| `expire_pending_orders()` | service role | Payment timeout. |
| `admin_get_order(p_order_id uuid)` | ADMIN | Full order incl. PIN/attempts/audit. |

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
STAFF_EMAIL_DOMAIN=staff.bazaareats.com
FLW_PUBLIC_KEY=
FLW_SECRET_KEY=
FLW_WEBHOOK_HASH=
FLW_BASE_URL=https://api.flutterwave.com/v3
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
AFRICASTALKING_SENDER_ID=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_MAPTILER_KEY=
OSRM_BASE_URL=
CRON_SECRET=
NEXT_PUBLIC_SUPPORT_WHATSAPP=
```

All variables are validated at startup by `src/lib/env.ts` with Zod.

---

## 8. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.1.0 | 2026-10-29 | Created; replaces the ambiguous v1.0 route/action descriptions. |

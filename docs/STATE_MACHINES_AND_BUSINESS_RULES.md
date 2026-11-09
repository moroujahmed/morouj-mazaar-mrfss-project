# STATE MACHINES AND BUSINESS RULES

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.2.0 |
| **Date** | 2026-11-09 |
| **Supersedes** | v1.0 transition matrix, Haversine fallback, coarse distance, claim signature, settlement prose |
| **Authority** | Migration, `ERD.md`, `CANONICAL_EXAMPLES.md`, `DECISIONS.md` ADR-005/010/011/012/013/015 |

All rules in this document are server-enforced. The UI may preview prices but never authorizes a financial value or a status transition.

---

## 1. Order Lifecycle

```text
                         checkout
                            |
          +-----------------+------------------+
          |                                    |
   digital payment                      cash on delivery
          v                                    v
  PENDING_PAYMENT                       CONFIRMED_UNPAID
          |  verified webhook                  | kitchen accept
          +-----------------+------------------+
                            v
                        PREPARING
                            |
              +-------------+-------------+
              | dine-in                   | delivery
              v                           v
          DELIVERED                READY_FOR_PICKUP
                                          | rider claim
                                          v
                                       CLAIMED
                                          | start trip
                                          v
                                  OUT_FOR_DELIVERY
                                     |           |
                              PIN verified   failure reported
                                     v           v
                                 DELIVERED   DELIVERY_FAILED

  PENDING_PAYMENT --timeout--> CANCELLED
  CONFIRMED_UNPAID/PREPARING/READY/CLAIMED/OUT_FOR_DELIVERY --admin--> CANCELLED
  DELIVERY_FAILED --admin resolution--> CANCELLED or redelivery
```

`DELIVERED`, `DELIVERY_FAILED`, and `CANCELLED` are terminal for the normal rider flow. Admin recovery is audited.

### 1.1 Transition Matrix

| From | To | Actor | Path / guard | Side effects |
| :--- | :--- | :--- | :--- | :--- |
| — | `PENDING_PAYMENT` | Customer | Checkout server action, digital method | Generates token + PIN, starts payment |
| — | `CONFIRMED_UNPAID` | Customer | Checkout server action, COD + OTP/returning rule | Generates token + PIN, enters kitchen queue |
| `PENDING_PAYMENT` | `PREPARING` | Payment webhook | Verified Flutterwave event only | `payment_status = PAID`, `acknowledged_at`, kitchen alert |
| `PENDING_PAYMENT` | `CANCELLED` | Cron | `expire_pending_orders()` after 10 minutes | Payment marked failed/expired |
| `CONFIRMED_UNPAID` | `PREPARING` | Kitchen | `accept_order(p_order_id)` | `acknowledged_at` |
| `PREPARING` | `READY_FOR_PICKUP` | Kitchen | `bump_order(p_order_id)` for delivery | Enters rider pool |
| `PREPARING` | `DELIVERED` | Kitchen | `bump_order(p_order_id)` for dine-in | `delivered_at`; no rider, PIN, packaging, or delivery fee |
| `READY_FOR_PICKUP` | `CLAIMED` | Rider | `claim_order_atomic(p_order_id)` | Sets `rider_id = auth.uid()` under row lock |
| `CLAIMED` | `READY_FOR_PICKUP` | Rider/Admin | `release_order(p_order_id, reason)` | Clears rider, returns to pool |
| `CLAIMED` | `OUT_FOR_DELIVERY` | Assigned rider | `start_delivery(p_order_id)` | `dispatched_at`; telemetry may start |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Assigned rider | `verify_delivery_pin(...)` | Valid PIN, geofence, COD paid, attempts cleared |
| `OUT_FOR_DELIVERY` | `DELIVERY_FAILED` | Assigned rider | `report_delivery_failed(...)` | `delivery_attempts` row and security flag |
| any non-terminal | `CANCELLED` | Admin | `admin_cancel_order(order_id, reason)` | Cancel fields, audit, refund request if paid |
| `CLAIMED`/`OUT_FOR_DELIVERY`/`READY_FOR_PICKUP` | `DELIVERED` | Admin | `admin_complete_order(order_id, reason)` | PIN override, audit, COD paid |
| `CLAIMED`/`OUT_FOR_DELIVERY` | `CLAIMED` | Admin | `admin_reassign_order(order_id, rider_id)` | New rider, audit |

Illegal transitions are rejected by the `enforce_order_transition` trigger even if a caller bypasses the RPC.

### 1.2 Status Copy

Use `CANONICAL_EXAMPLES.md` §10. Do not invent customer-facing status names in UI code.

---

## 2. Delivery Fee

### 2.1 Inputs

- Restaurant pin from `app_settings` (founder-verified; currently unverified `0.3136, 32.5811`).
- Destination pin from the customer map.
- `road_distance_m` from OSRM driving route, stored as **integer metres**.

### 2.2 Formula

```text
if road_distance_m <= 5000:
    fee = 0
elif road_distance_m <= 15000:
    billable_km = ceil((road_distance_m - 5000) / 1000)
    fee = billable_km * rate_per_excess_km   # default 1,500 UGX
else:
    reject DISTANCE_OUT_OF_BOUNDS
```

Never store a one-decimal kilometre value and then apply `ceil`. `5,001 m` is billable; `15,001 m` is blocked.

### 2.3 Canonical Results

| Destination | Metres | Fee |
| :--- | ---: | ---: |
| Nakasero | 1,562 | **USh 0** |
| Ntinda | 8,093 | **USh 6,000** |

The v1.0 `3.8 km`, `7.4 km`, and `USh 4,500` values are retired. They may appear only in historical audit text.

### 2.4 OSRM Failure

If OSRM is unavailable and no valid cached route exists, checkout is **blocked** with `DISTANCE_UNAVAILABLE`. There is no Haversine or straight-line substitute for a final fee. A cached route for the same quantised coordinates may be reused for 24 hours.

---

## 3. Cart, MOV, and Packaging

| Rule | Delivery | Dine-in |
| :--- | :--- | :--- |
| MOV against items + modifiers | USh 20,000 | USh 0 |
| Packaging fee | USh 1,000 | USh 0 |
| Delivery fee | Formula above | USh 0 |
| Max line quantity | 20 | 20 |
| Max cart value | USh 200,000 | USh 200,000 |
| Max distinct lines | 30 | 30 |

Under-MOV copy: “Add USh [deficit] more to unlock delivery.” At or above MOV: “Delivery threshold reached.” Dine-in never shows a delivery threshold.

Promotions and discount codes are **not** part of v1. The pricing formula is:

```text
total = items_subtotal + modifiers_total + packaging_fee + delivery_fee
```

---

## 4. Server Pricing Pipeline

1. Validate the discriminated checkout input and normalize the phone.
2. Enforce store-open and rate limits.
3. Read item and modifier prices from the database; ignore any client price.
4. Validate availability, modifier applicability, selection min/max, and combo steps.
5. Compute `items_subtotal` and `modifiers_total` in integer UGX.
6. Enforce MOV, cart limits, and COD radius/method rules.
7. Resolve OSRM metres; block on failure or > 15 km.
8. Compute packaging and delivery fees.
9. Insert the order, items, modifiers, token, PIN, idempotency record, and status history in one transaction.
10. For digital payment, initiate Flutterwave and return the hosted-checkout URL; for COD, return the confirmed order and tracker token.

`total_amount` is a generated column and a trigger rejects direct component changes that would desync it.

---

## 5. Rider Claim Concurrency

`claim_order_atomic(p_order_id UUID)` is the only claim path:

- derives the rider from `auth.uid()`;
- rejects a rider who already has an active `CLAIMED`/`OUT_FOR_DELIVERY` order;
- updates only `READY_FOR_PICKUP` rows with `rider_id IS NULL`;
- uses a partial unique index as the final race guard;
- returns `ORDER_ALREADY_CLAIMED` if another rider won;
- returns the safe active-order payload.

Client handling:

- success: show the active delivery, enable navigation/telemetry;
- failure: remove the card and show “Order was just claimed by another rider.”

No rider id is accepted from the client.

---

## 6. Handover Gate

The PIN is 4 digits, per order, generated with `pgcrypto`, and verified only by `verify_delivery_pin` as defined in `SECURITY_AND_VERIFICATION_PROTOCOLS.md` §3. The rider UI never receives the PIN.

---

## 7. Cash Ledger and Settlement

### 7.1 Liability

A rider's expected cash is the sum of `total_amount` for orders that are:

- `payment_method = CASH_ON_DELIVERY`;
- `payment_status = PAID`;
- `order_status = DELIVERED`;
- delivered on the selected `Africa/Kampala` business date;
- not already linked to a closed settlement.

### 7.2 Reconciliation

`reconcile_rider_cash(p_rider_id, p_counted_cash, p_notes, p_business_date)`:

1. Requires ADMIN.
2. Defaults the business date to `(now() AT TIME ZONE 'Africa/Kampala')::date`.
3. Computes expected cash from qualifying orders.
4. Inserts or updates the unique `(rider_id, business_date)` settlement with `expected_cash`, `counted_cash`, generated `variance`, status `SETTLED` or `PARTIAL`, `settled_by`, and notes.
5. Links every included order through `orders.settlement_id` and `settled_at`.
6. Writes an audit row.

The ledger UI must show the linked order IDs and the sum that produces the total. A settlement total is never typed independently of its orders.

### 7.3 Canonical Ledger

| Rider | Order | Payment | Amount |
| :--- | :--- | :--- | ---: |
| Juma | #1043 | COD | 38,000 |
| Juma | #1047 | COD | 27,500 |
| **Total** | | | **USh 65,500** |

The retired `USh 64,000` ledger must not appear in current fixtures.

### 7.4 Floats and Shifts

`rider_shifts` records `opening_float`, start/end, and status. A shift may have one open row per rider. Settlement may be per shift or per business date; the v1 canonical report is per rider per business date. Physical change denominations are a founder policy (`F-67`); the app records the requested change (`cod_change_due`) but does not model individual banknotes.

---

## 8. ETA

For delivery:

```text
eta_at = acknowledged_at
       + max(item prep minutes)
       + busy_buffer_minutes
       + OSRM travel duration
```

- Store `estimated_travel_minutes` from OSRM.
- Recompute when the kitchen accepts, when the rider claims, and when the rider starts.
- Show a clock time plus “N minutes remaining”; never rely on a countdown colour alone.
- If the kitchen is busy, add the configured buffer and disclose “Kitchen is busy” to the customer.
- Dine-in shows preparation status, not a rider ETA.

---

## 9. Store-Closed and Failure Rules

- Checkout is blocked when `is_store_open = false` or EAT time is outside opening/closing hours.
- The storefront shows the closed screen with opening hours and WhatsApp support.
- Admin may open the store explicitly; the action is audited in `settings_history` and `admin_audit_log`.
- Delivery failure outcomes: `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `REFUSED`, `RETURNED`, `OTHER`.
- Failed deliveries remain visible to admin with reason, rider, coordinates, timestamp, and any note. They do not silently become `DELIVERED`.
- Admin may cancel/refund, arrange redelivery, or blacklist the phone after review.

---

## 10. Business Day and Money

- All money is integer UGX.
- All timestamps are stored in UTC and rendered in `Africa/Kampala`.
- All financial reports, shifts, and settlements use the `Africa/Kampala` date.
- No floating point arithmetic is allowed for money or distance.

---

## 11. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.0.0 | 2026-10-29 | Original FSM and pricing draft. |
| 1.1.0 | 2026-10-29 | Amendment banner only. |
| 1.2.0 | 2026-11-09 | Rewrote transitions, integer-metre pricing, OSRM blocking, claim RPC, settlement linkage, ETA, and store-closed rules. |

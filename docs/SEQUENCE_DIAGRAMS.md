# SEQUENCE DIAGRAMS — Payment, Kitchen, Claim, Settlement, Refund

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.2 |
| **Version** | 1.2.0 |
| **Date** | 2026-11-09 |
| **Related** | `API_CONTRACTS.md`, `STATE_MACHINES_AND_BUSINESS_RULES.md`, migration RPCs |

These diagrams close the P2 “no sequence diagrams” finding. Mermaid renders on GitHub and in most Markdown viewers. The diagrams are explanatory; the RPC signatures and state transitions in the migration/API contracts remain authoritative.

---

## 1. Prepaid checkout and verified webhook

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Next.js storefront
    participant API as Server action / route
    participant DB as Supabase Postgres
    participant FLW as Flutterwave
    participant K as Kitchen board

    C->>UI: Confirm order + delivery/dine-in
    UI->>API: createOrder(payload, idempotencyKey)
    API->>DB: validate store hours, MOV, OSRM distance, menu
    API->>DB: insert order (PENDING_PAYMENT) + order_items
    API->>FLW: POST /v3/payments (tx_ref = order_token)
    FLW-->>C: Hosted checkout
    C->>FLW: Pay with MoMo/card
    FLW->>API: POST /api/webhooks/flutterwave (verif-hash)
    API->>API: timing-safe hash check
    API->>FLW: GET /v3/transactions/{id}/verify
    FLW-->>API: verified transaction
    API->>DB: insert payment_transactions + webhook_events (idempotent)
    API->>DB: order -> PREPARING, payment_status PAID
    API->>K: Broadcast kitchen / safe payload
    K-->>C: Tracker shows "Cooking in the kitchen"
```

Rules:

- A redirect alone never marks an order paid.
- A replayed webhook is acknowledged but does not double-apply.
- If verification fails, the order stays `PENDING_PAYMENT`; support investigates.
- Prepaid orders enter `PREPARING` directly; the kitchen does not “accept” them.

---

## 2. COD checkout and OTP

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Storefront
    participant API as Server action
    participant DB as Supabase
    participant AT as Africa's Talking

    C->>UI: Choose cash on delivery
    UI->>API: requestCodOtp(phone)
    API->>DB: normalize phone + check COD radius 8.1 km
    API->>DB: check blacklist / returning customer
    alt returning customer with delivered order
        API-->>UI: { sent: false, skip: true }
    else first-time or not eligible to skip
        API->>AT: send 6-digit OTP
        API->>DB: store hash, expiry, attempts
        API-->>UI: { sent: true }
        C->>UI: Enter OTP
        UI->>API: verifyCodOtp(phone, code)
        API->>DB: verify hash, attempts, expiry
    end
    UI->>API: createOrder(payload, idempotencyKey)
    API->>DB: insert order CONFIRMED_UNPAID
    API-->>C: Order confirmed — pay cash on delivery
```

Rules:

- COD is blocked beyond 8.1 km (test/seed ceiling) and when the store is closed.
- OTP failure never silently skips verification.
- The order stays `CONFIRMED_UNPAID` until a rider completes the PIN-verified handover.

---

## 3. Kitchen accept and bump

```mermaid
sequenceDiagram
    autonumber
    participant K as Kitchen portal
    participant DB as Supabase RPC
    participant R as Rider pool
    actor C as Customer

    alt COD order CONFIRMED_UNPAID
        K->>DB: accept_order(order_id)
        DB->>DB: guard role KITCHEN/ADMIN + status
        DB-->>K: order PREPARING
    else prepaid order already PREPARING
        DB-->>K: ticket appears without Accept
    end
    K->>DB: bump_order(order_id)
    alt delivery
        DB->>DB: PREPARING -> READY_FOR_PICKUP
        DB-->>R: Broadcast safe pool summary
    else dine-in
        DB->>DB: PREPARING -> DELIVERED
    end
    DB-->>C: Broadcast tracker status
```

Rules:

- `accept_order` only accepts `CONFIRMED_UNPAID`; it rejects prepaid and already-accepted orders.
- `bump_order` sends delivery to `READY_FOR_PICKUP` and dine-in directly to `DELIVERED`.
- Kitchen cannot edit prices, refunds, settlements, or delivery data.

---

## 4. Rider claim, delivery, and PIN handover

```mermaid
sequenceDiagram
    autonumber
    actor R as Rider
    participant APP as Rider portal
    participant DB as Supabase RPC
    participant T as Customer tracker

    R->>APP: Open pool
    APP->>DB: get_rider_pool()
    DB-->>APP: area, distance, total only (no PII/PIN)
    R->>APP: Claim
    APP->>DB: claim_order_atomic(order_id)
    DB->>DB: auth.uid() + no active order + READY_FOR_PICKUP
    DB-->>APP: order CLAIMED, rider assigned
    R->>APP: Start trip
    APP->>DB: start_delivery(order_id)
    DB->>DB: CLAIMED -> OUT_FOR_DELIVERY
    loop while OUT_FOR_DELIVERY
        APP->>DB: update_rider_telemetry(order_id, lat, lng, heading)
        DB-->>T: safe latest position (poll/Broadcast)
    end
    R->>APP: Enter customer 4-digit PIN
    APP->>DB: verify_delivery_pin(order_id, pin, lat, lng, ip_hash, ua)
    alt valid, in geofence, attempts remain
        DB->>DB: order DELIVERED; COD -> PAID
        DB-->>APP: { ok: true }
    else invalid / locked / too far
        DB-->>APP: { ok: false, code }
    end
```

Rules:

- `claim_order_atomic` derives the rider from `auth.uid()` and uses a partial unique index to prevent double claims.
- One active order per rider; no next-job queue.
- The rider pool never includes phone, exact address, notes, or handover PIN.
- The PIN is entered in front of the customer; the customer checks the safety seal first.

---

## 5. Cash settlement

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant LED as Admin ledger
    participant DB as Supabase RPC
    actor R as Rider

    A->>LED: Open /admin/ledger
    LED->>DB: list delivered, paid, unsettled COD orders by rider/date
    A->>R: Count cash in front of rider
    A->>DB: reconcile_rider_cash(rider_id, counted_cash, notes, business_date)
    DB->>DB: expected = sum linked COD orders (EAT date)
    DB->>DB: upsert cash_settlements(rider_id, business_date)
    DB->>DB: link orders.settlement_id / settled_at
    DB->>DB: audit variance
    DB-->>LED: counted, expected, variance
    A-->>R: Release rider when resolved
```

Rules:

- Expected cash is the sum of `DELIVERED` + `PAID` COD orders for the EAT business date.
- A second reconciliation for the same rider/date updates the same settlement; it does not duplicate.
- Any variance requires a note and admin review before releasing the rider.
- The ledger must show order IDs, not just a lump sum.

---

## 6. Refund and cancellation

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant UI as Admin order drawer
    participant API as Server action
    participant DB as Supabase
    participant FLW as Flutterwave
    actor C as Customer

    A->>UI: Cancel / request refund with reason
    UI->>API: requestRefund(order_id, amount, reason)
    API->>DB: authorise ADMIN + validate amount
    API->>DB: insert refunds(REQUESTED) + audit
    API->>DB: cancel order if still cancellable
    API->>FLW: POST refund (when approved)
    FLW-->>API: refund result
    API->>DB: refunds -> COMPLETED / FAILED + payment_transactions
    API->>C: SMS/status update
```

Rules:

- Refunds are never silent; the admin reason and actor are audited.
- A refund cannot exceed the captured amount.
- Provider failure leaves the refund `FAILED` and visible for retry; it never fakes success.
- Cash refunds follow the documented process and are recorded in the settlement/ledger.

---

## 7. Store-closed block

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Storefront
    participant API as Checkout action
    participant DB as Supabase settings

    C->>UI: Open checkout
    UI->>API: getStoreStatus()
    API->>DB: read is_store_open + EAT opening/closing hours
    alt closed
        API-->>UI: CLOSED + opening hours + WhatsApp
        UI-->>C: Closed screen; checkout disabled
    else open
        API-->>UI: OPEN
        UI-->>C: Checkout allowed
    end
```

Rules:

- The server re-checks store status at order creation; a stale client cannot bypass it.
- Admin override is explicit and audited.
- Pre-orders/scheduling are deferred in v1.

---

## 8. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.2.0 | 2026-11-09 | Created; closes the P2 “no sequence diagrams” finding. |

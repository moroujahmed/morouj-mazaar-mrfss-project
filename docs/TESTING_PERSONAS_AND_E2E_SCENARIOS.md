# TESTING PERSONAS AND E2E SCENARIOS

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.5.0 |
| **Date** | 2026-11-13 |
| **Supersedes** | v1.0 seed SQL, 4-digit staff PINs, retired distances/totals, and the unrunnable Playwright blueprint |
| **Canonical data** | [`CANONICAL_EXAMPLES.md`](CANONICAL_EXAMPLES.md) |
| **Runnable tests** | [`TEST_PLAN.md`](TEST_PLAN.md) — unit, database, RLS, E2E, accessibility |
| **Seed data** | [`../supabase/seed.sql`](../supabase/seed.sql) and [`../scripts/seed-staff.mjs`](../scripts/seed-staff.mjs) |

If a persona, fixture, or assertion in this file disagrees with `CANONICAL_EXAMPLES.md`, the canonical file wins. If it disagrees with `TEST_PLAN.md` about how a test is executed, `TEST_PLAN.md` wins.

This file defines **who** the system serves and **what a successful journey looks like**. It does not contain duplicate seed SQL, a second Playwright blueprint, or hard-coded credentials.

---

## 1. Test Identities

Staff do not log in with a PIN stored in `public.profiles`. Each staff member is a Supabase Auth user with a synthetic email and a **6-digit PIN used as the Auth password** (see `SECURITY_AND_VERIFICATION_PROTOCOLS.md` §2.1).

### 1.1 Local and CI staff

Create `scripts/staff.test.json` from [`../scripts/staff.example.json`](../scripts/staff.example.json), then provision it:

```bash
STAFF_SEED_FILE=scripts/staff.test.json node scripts/seed-staff.mjs
```

`scripts/staff.local.json` is gitignored. Test files must use test-only PINs and `must_change_pin: false`; never reuse a production PIN.

| Persona | Role | Phone | Plate | Login route |
| :--- | :--- | :--- | :--- | :--- |
| Mr. Kasule | `ADMIN` | `+256700111000` | — | `/admin/login` |
| Chef Musa | `KITCHEN` | `+256700111001` | — | `/kitchen/login` |
| Juma Mukasa | `RIDER` | `+256700111002` | `UFD 342B` | `/rider/login` |
| David Okello | `RIDER` | `+256700111003` | `UEX 119A` | `/rider/login` |

The seed script creates the Auth user first and then the `profiles` row with the same UUID. Do not insert staff rows directly with `profiles.pin_code`; that column does not exist.

### 1.2 Customers

Customers are anonymous. A customer is identified by the order token returned at checkout. The token is a bearer capability: it must not be logged or shared, and it is the only way to read the order from `/orders/[token]`.

### 1.3 Deterministic catalog and tables

Menu items, modifier prices, combo steps, and table QR tokens come from `supabase/seed.sql`. Tests must resolve prices from the seeded catalog instead of duplicating them in code. The canonical fixtures below assume:

| Seed object | Value used in the scenarios |
| :--- | :--- |
| Whole Tilapia Flame Combo | `USh 32,000` |
| Extra Garlic Pepper Dip | `USh 2,000` |
| Smoked Beef Luwombo | `USh 26,000` |
| Cold-Pressed Passion Juice (500 ml) | `USh 5,000` |
| Special Bazaar Rolex | `USh 8,000` |
| Table T4 QR token | `88888888-8888-4888-8888-888888888804` |

---

## 2. Personas

```
[ Persona 1: Sarah ] ── Nakasero (1.562 km) ── Prepaid MTN MoMo ── Happy-path delivery
[ Persona 2: Brian ] ── Ntinda (8.093 km)   ── Cash on delivery ── Surcharge, MOV, change
[ Persona 3: Alex ]  ── Table T4            ── Airtel Money     ── Dine-in, zero fees
[ Persona 4: Musa ]  ── Kitchen KDS         ── Line cook        ── Audio, 86, busy mode
[ Persona 5: Juma ]  ── Boda UFD 342B       ── Courier          ── Claim, navigate, PIN
[ Persona 6: Kasule] ── Admin hub           ── Owner/auditor    ── Edits, ledger, audit
```

### Persona 1 — Sarah Namukasa, the office worker (prepaid delivery)

- **Profile:** 29, corporate accountant on Lumumba Avenue, Nakasero.
- **Device:** iPhone 13, Safari, 4G.
- **Location:** Plot 14 Lumumba Avenue, `lat: 0.3245, lng: 32.5782`.
- **Road distance:** **1.562 km** from the restaurant.
- **Goal:** Order lunch without leaving her desk and pay digitally.
- **Behaviour:** Adds a paid modifier, pays with MTN Mobile Money, checks the safety seal, and gives the rider the 4-digit handover PIN only after receiving the bag.

### Persona 2 — Brian Kato, the far customer paying cash (COD edge case)

- **Profile:** 34, architect working from a home studio in Ntinda Ministers' Village.
- **Device:** Tecno Spark, Android, 3G.
- **Location:** Ntinda Ministers' Village, `lat: 0.3542, lng: 32.6120`.
- **Road distance:** **8.093 km** from the restaurant.
- **Goal:** A substantial meal for two, paid with a `USh 50,000` note.
- **Behaviour:** Hits the minimum-order guardrail, pays the excess-distance fee, asks for change, completes first-time COD phone verification, and expects the rider to carry `USh 12,000` change.

> **Policy dependency:** the canonical COD fixture is 8.093 km. The seeded `cod_max_radius_km` must therefore be **8.1 km** (or higher) for this scenario to be valid; the final commercial ceiling remains founder gate F-14.

### Persona 3 — Alex Wandera, the walk-up guest (dine-in)

- **Profile:** 22, university student at the bazaar food court.
- **Device:** Samsung Galaxy A12.
- **Location:** Table T4 inside the bazaar stall.
- **Goal:** Order a low-cost snack without queueing at the counter.
- **Behaviour:** Scans the table QR code, skips address entry, pays with Airtel Money, and expects no delivery fee, no packaging fee, and no minimum-order block.

### Persona 4 — Chef Musa, the kitchen line operator (KDS)

- **Profile:** 42, grill master working on a wall-mounted 10-inch Android tablet.
- **Context:** Hot, noisy kitchen; greasy fingers; viewing distance over 1.5 m.
- **Goal:** No missed tickets, fast bumping, instant 86-ing when an item runs out.
- **Behaviour:** Enables audio at shift start, watches ticket age move green → amber → red, accepts cash orders, bumps delivery orders to `READY_FOR_PICKUP`, serves dine-in orders directly, toggles item availability, and enables busy mode during a rush.

### Persona 5 — Juma Mukasa, the boda rider (logistics and proof of handover)

- **Profile:** 28, professional courier on motorcycle `UFD 342B`.
- **Device:** Rugged Android phone mounted on the handlebars.
- **Context:** Bright sunlight, vibration, helmet audio.
- **Goal:** Claim orders quickly, navigate with one tap, collect cash accurately, and end the shift with zero variance.
- **Behaviour:** Signs in with phone + 6-digit PIN, claims atomically from the pool, starts the trip, streams telemetry only while `OUT_FOR_DELIVERY`, and asks for the customer PIN before releasing the food.

### Persona 6 — Mr. Kasule, the owner and auditor (admin)

- **Profile:** 51, owner of Bazaar Flame & Grill.
- **Device:** iPad Pro or laptop at `/admin`.
- **Goal:** Protect margin, stop cash leakage across the fleet, and correct live mistakes without direct database access.
- **Behaviour:** Changes settings through audited server actions, resets a handover PIN with a reason, monitors stuck orders, and reconciles each rider's cash against the linked orders.

---

## 3. End-to-End Scenarios

These scenarios are the acceptance narrative. The executable versions, selectors, mocks, and CI gates live in `TEST_PLAN.md` §4–§6. Do not add a second test implementation to this file.

### Scenario A — Sarah's prepaid lunch rush

**Covers:** menu selection, paid modifier, free-delivery zone, Flutterwave hosted checkout, verified webhook, KDS ticket, atomic claim, live tracking, PIN handover, feedback.

1. Sarah opens `/` and adds **Whole Tilapia Flame Combo** (`USh 32,000`).
2. She opens the customization drawer and selects **No Onions** (`USh 0`) and **Extra Garlic Pepper Dip** (`USh 2,000`).
3. Items + modifiers = **`USh 34,000`**.
4. At `/checkout` she drops a pin at `0.3245, 32.5782`. The server calls the routing adapter and stores `road_distance_m = 1562`.
5. Pricing assertions:
   - road distance **1.562 km** ≤ 5.0 km free radius;
   - delivery fee **`USh 0`**;
   - packaging fee **`USh 1,000`**;
   - **TOTAL DUE `USh 35,000`**.
6. She enters name and phone `0772000111`, selects **MTN Mobile Money**, and taps **Pay `USh 35,000`**.
7. The server creates the order as `PENDING_PAYMENT` and returns the Flutterwave checkout URL. Sarah completes the sandbox payment.
8. Flutterwave calls `POST /api/webhooks/flutterwave`:
   - `verif-hash` matches the shared secret;
   - the transaction is re-verified against the Flutterwave API;
   - amount and currency match the order;
   - the event is stored in `webhook_events` with a unique provider event ID.
9. The order becomes `PREPARING`; the kitchen ticket appears with the paid badge.
10. Chef Musa packs the order, applies safety seal `#9482`, and taps **Bump**. The order becomes `READY_FOR_PICKUP`.
11. Juma opens `/rider`, sees order `#1042` in the pool, and taps **Claim**. `claim_order_atomic` assigns him inside a row lock; the order becomes `CLAIMED`.
12. Juma taps **Start trip**. The order becomes `OUT_FOR_DELIVERY`; telemetry starts.
13. Sarah's tracker shows the rider position and the 4-digit handover PIN.
14. At the door Juma asks for the PIN. Sarah checks seal `#9482` and reads the PIN from `/orders/[token]`.
15. Juma submits the PIN through `verify_delivery_pin(p_order_id, p_pin, p_lat, p_lng, ...)`.
16. Assertions:
    - `order_status = 'DELIVERED'`;
    - `delivered_at IS NOT NULL`;
    - `payment_status = 'PAID'`;
    - telemetry stops;
    - the customer sees the one-tap feedback prompt and can submit a rating.

**Negative branches:** invalid webhook signature → `401`, no state change; amount mismatch → flagged and not fulfilled; duplicate webhook → ignored; expired `PENDING_PAYMENT` order → `CANCELLED` by `expire_pending_orders`.

---

### Scenario B — Brian's COD surcharge, MOV, and change

**Covers:** minimum order value, excess-distance fee, COD radius, change due, first-time COD OTP, cash liability.

1. Brian adds **Cold-Pressed Passion Juice (500 ml)** (`USh 5,000`).
2. Cart assertions:
   - subtotal `USh 5,000` < MOV `USh 20,000`;
   - checkout is disabled;
   - copy says: “Add `USh 15,000` more to unlock delivery.”
3. He adds **Smoked Beef Luwombo** (`USh 26,000`). Items + modifiers = **`USh 31,000`**; MOV satisfied.
4. At `/checkout` he drops a pin at `0.3542, 32.6120`. The routing adapter returns `road_distance_m = 8093`.
5. Fee assertions:
   - distance **8.093 km**;
   - free allowance 5.0 km;
   - excess `3.093 km`;
   - billable `ceil(3.093) = 4 km`;
   - delivery fee `4 × USh 1,500 =` **`USh 6,000`**;
   - packaging **`USh 1,000`**;
   - **TOTAL DUE `USh 38,000`**.
6. COD assertions:
   - distance is within `app_settings.cod_max_radius_km` (8.1 km);
   - the change selector offers `USh 50,000`;
   - change due = `50,000 − 38,000 =` **`USh 12,000`**.
7. First-time COD verification: Brian enters the mock SMS OTP; the order is created as `CONFIRMED_UNPAID`.
8. The kitchen ticket shows “Collect `USh 38,000` cash — change for `USh 50,000`”. Musa taps **Accept** (`CONFIRMED_UNPAID → PREPARING`).
9. Musa bumps to `READY_FOR_PICKUP`. Juma claims and starts the trip.
10. Juma enters one wrong PIN (`INVALID_HANDOVER_PIN`, remaining 2), then the correct PIN.
11. Assertions:
    - `order_status = 'DELIVERED'`;
    - `payment_status = 'PAID'`;
    - `cod_collected_at IS NOT NULL`;
    - Juma's expected cash increases by exactly `USh 38,000`.
12. Admin ledger shows Juma expected `USh 38,000` for the day; reconciliation with `USh 38,000` yields `SETTLED`, variance `0`.

**Negative branches:** COD above `cod_max_radius_km` → `COD_NOT_AVAILABLE`; COD below MOV → blocked; OTP expired or wrong → no order; rider cannot start before claiming.

---

### Scenario C — Alex's table QR dine-in

**Covers:** table token, dine-in mode, MOV bypass, zero fees, direct `DELIVERED`.

1. Alex scans the Table T4 QR code, which opens `/?table=88888888-8888-4888-8888-888888888804`.
2. The server validates the QR token with `validate_table_token`. The storefront shows the dine-in banner **“Dine-in — Table T4”**.
3. The map, address fields, delivery-fee row, and rider instructions are not rendered.
4. Alex adds **Special Bazaar Rolex** (`USh 8,000`).
5. Pricing assertions:
   - MOV bypassed (`minimum_order_value_dine_in = 0`);
   - delivery fee `USh 0`;
   - packaging fee `USh 0`;
   - **TOTAL DUE `USh 8,000`**.
6. Alex pays with Airtel Money (`0701000222`); the verified webhook moves the order to `PREPARING`.
7. The KDS ticket shows **TABLE T4 — DINE-IN**. Musa prepares the Rolex and taps **Served to table**.
8. `bump_order` moves a dine-in order directly from `PREPARING → DELIVERED`.
9. Assertions:
   - the order never appears in `get_rider_pool`;
   - no handover PIN gate is shown;
   - no `CLAIMED`, `OUT_FOR_DELIVERY`, or telemetry rows exist.

**Negative branches:** invalid or inactive table token → dine-in mode is not enabled; payment failure → order remains `PENDING_PAYMENT` until expiry.

---

### Scenario D — Chef Musa: 86 an item and enable busy mode

**Covers:** availability propagation, cart invalidation, ETA buffer.

1. Musa opens `/kitchen` and toggles **Golden Chips** to unavailable through `set_menu_item_availability`.
2. Storefront assertions:
   - the card is greyed out and labelled **Sold out**;
   - adding it is blocked;
   - if it was already in a cart, checkout returns `ITEM_OUT_OF_STOCK` and names the item.
3. Musa enables **Busy mode +20 minutes** through `set_kitchen_busy`.
4. Assertions:
   - new orders' ETA includes the 20-minute buffer;
   - existing orders keep their original ETA (no retroactive change);
   - the customer tracker explains the delay without changing the order status.
5. Musa disables busy mode; new ETAs return to the calculated value.

---

### Scenario E — two riders claim the same order

**Covers:** atomic claim, one-active-order rule, race feedback.

1. Order `#1042` is `READY_FOR_PICKUP` with `rider_id = NULL`.
2. Juma and David both open `/rider` and see the order.
3. Both tap **Claim** at nearly the same time. Each request calls `claim_order_atomic(p_order_id)`; the rider is derived from `auth.uid()`.
4. Exactly one call succeeds and returns `CLAIMED`.
5. The other call returns `ORDER_ALREADY_CLAIMED`; the UI shows “Order was just claimed by another rider,” removes the card, and refreshes the pool.
6. The winner's active order appears immediately; the partial unique index `orders_one_active_per_rider` prevents either rider from holding two active orders.
7. A rider who already has an active order receives `RIDER_HAS_ACTIVE_ORDER` even if the order is still unclaimed.

**Database assertion:** `SELECT count(*) FROM orders WHERE id = ... AND rider_id IS NOT NULL` is exactly 1 after the race.

---

### Scenario F — handover PIN failure, lockout, and admin reset

**Covers:** durable attempts, 15-minute lock, geofence, admin override with audit.

1. Order `#1042` is `OUT_FOR_DELIVERY`, assigned to Juma, with a 4-digit PIN.
2. Juma submits a wrong PIN:
   - response `{ ok: false, code: "INVALID_HANDOVER_PIN", remainingAttempts: 2 }`;
   - `pin_verification_attempts` gains a failed row.
3. Second wrong PIN: `remainingAttempts: 1`.
4. Third wrong PIN:
   - response `{ ok: false, code: "PIN_LOCKED", remainingAttempts: 0, lockedUntil: ... }`;
   - `pin_locked_until = now() + 15 minutes`;
   - `security_flag = 'PIN_LOCKED'`;
   - order remains `OUT_FOR_DELIVERY`.
5. A correct PIN submitted before the lock expires still returns `PIN_LOCKED` and does not count as an attempt.
6. Geofence assertion: coordinates more than `pin_geofence_m` (300 m) from the delivery pin return `TOO_FAR_FROM_DESTINATION` **without consuming a PIN attempt**.
7. Mr. Kasule calls `admin_reset_handover_pin(order_id, reason)`:
   - a new 4-digit PIN is generated with `pgcrypto`;
   - attempts and lock are cleared;
   - `security_flag = 'PIN_RESET_BY_ADMIN'`;
   - an `ADMIN_RESET_HANDOVER_PIN` audit row records the reason.
8. Juma enters the new PIN at the correct location; the order becomes `DELIVERED`, and the successful attempt is recorded.

**Security assertions:** another rider cannot verify the order (`AUTH_UNAUTHORIZED`); direct `SELECT` on `orders.handover_pin` is denied to `anon` and `authenticated`; no PIN appears in logs or analytics.

---

### Scenario G — end-of-day cash reconciliation

**Covers:** expected cash, linked orders, idempotent settlement, variance, audit.

1. Juma has completed two COD orders on the same `Africa/Kampala` business date:

   | Order | Payment | Amount |
   | :--- | :--- | ---: |
   | `#1043` | COD | `USh 38,000` |
   | `#1047` | COD | `USh 27,500` |
   | **Expected cash** | | **`USh 65,500`** |

2. Mr. Kasule opens `/admin/ledger`. The row for Juma (`UFD 342B`) shows expected **`USh 65,500`**, status `OPEN`.
3. Juma hands over `USh 65,500`. Kasule calls `reconcile_rider_cash(rider_id, 65500, notes, business_date)`.
4. Assertions:
   - settlement status `SETTLED`;
   - variance `0`;
   - both orders receive the same `settlement_id` and `settled_at`;
   - the audit row records expected, counted, and variance.
5. A second reconciliation for the same rider and date with `USh 60,000` **updates the same settlement**:
   - status `PARTIAL`;
   - variance **`−USh 5,500`**;
   - no duplicate settlement row;
   - already-linked orders are not double-counted.
6. The ledger never derives its total from UI state. It is computed from `orders.total_amount` for `CASH_ON_DELIVERY`, `PAID`, `DELIVERED`, and the selected business date.

**Negative branches:** negative counted cash → validation error; a settlement cannot link an order belonging to another rider; a non-admin caller receives `AUTH_UNAUTHORIZED`.

---

### Scenario H — payment failure and retry

**Covers:** failed hosted checkout, retry, expiry, no duplicate order.

1. Sarah starts checkout but the Flutterwave payment fails or is abandoned.
2. The order remains `PENDING_PAYMENT`; the customer sees a retry action and the payment status, not a false “confirmed” state.
3. Retrying with the same idempotency key and unchanged payload returns the same order; changing the payload returns `IDEMPOTENCY_CONFLICT`.
4. Each checkout call allocates a fresh attempt: `start_payment_attempt` stores `tx_ref = '<order_token>-<attempt_number>'`, abandons the previous open attempt, and never reuses a reference. The first Sarah fixture attempt is `#1042-1`, then `#1042-2`.
5. A successful retry moves the order to `PREPARING` through the verified webhook path; `resolve_payment_tx_ref` binds the webhook to exactly one attempt. A late webhook for an abandoned attempt does not mark the current attempt paid.
6. If the retry window expires, `expire_pending_orders` cancels the order and marks the payment failed/expired.

---

### Scenario I — store closed and kitchen paused

**Covers:** store hours, closed-state copy, no order creation.

1. Outside `opening_time`–`closing_time` in `Africa/Kampala`, the storefront shows **Closed** with the next opening time.
2. Checkout is disabled and the server rejects order creation with `STORE_CLOSED` even if the client is bypassed.
3. Staff can still sign in, review history, and reconcile cash.
4. If the kitchen pauses intake, new orders are blocked with `KITCHEN_PAUSED`; existing orders continue through the FSM.

---

### Scenario J — admin reassignment, redelivery, and audit

**Covers:** live dispatch correction, one-active-order protection, failed-delivery return, audited admin mutations.

1. Juma has claimed and started a delivery. Mr. Kasule reassigns it to David with a reason through `admin_reassign_order`.
2. Assertions:
   - the order returns to `CLAIMED` and `dispatched_at` is cleared;
   - Juma's active order disappears and David sees it;
   - an audit row records the actor, old/new rider, and reason.
3. Reassigning to a rider who already has an active order returns `RIDER_HAS_ACTIVE_ORDER`.
4. David reports `DELIVERY_FAILED`. Kasule calls `admin_redeliver_order(order_id, reason, actor)`.
5. Assertions:
   - the order returns to `READY_FOR_PICKUP`, `rider_id` is cleared, and it re-enters `get_rider_pool`;
   - the order can be claimed again;
   - the redelivery reason and actor appear in the audit feed.
6. `admin_list_orders` search finds the order, and no admin mutation bypasses `order_status_history`.

**Negative branches:** non-admin caller → `AUTH_UNAUTHORIZED`; redelivery from a state other than `DELIVERY_FAILED` → `ORDER_STATE_INVALID`; missing reason → `VALIDATION_ERROR`.

---

### Scenario K — cart limits and COD change

**Covers:** `max_cart_lines`, COD change validation, kitchen/tracker change copy.

1. Sarah adds 30 distinct lines; the cart accepts them. A 31st line is blocked with a validation error naming `max_cart_lines`.
2. Brian requests COD change below the server-computed total; checkout blocks until the change amount covers `total_amount`.
3. With a valid change amount, the kitchen ticket and customer tracker both show the change due.
4. The server recomputes the total on submit; a stale client total is rejected rather than trusted.

**Negative branches:** line quantity above `max_item_quantity` → rejected; cart above `max_cart_value` → rejected; change amount below total → `VALIDATION_ERROR`.

---

## 4. Traceability Matrix

| Scenario | Persona | Primary assertions | Executable reference |
| :--- | :--- | :--- | :--- |
| A | Sarah | 1,562 m, fee 0, total 35,000, webhook verification, PIN delivery | `TEST_PLAN.md` §4 Scenario A, §2 |
| B | Brian | 8,093 m, fee 6,000, total 38,000, change 12,000, COD paid | `TEST_PLAN.md` §4 Scenario B, §2.1 |
| C | Alex | dine-in 8,000, zero fees, MOV bypass, direct delivery | `TEST_PLAN.md` §4 Scenario C |
| D | Musa | 86 propagation, `ITEM_OUT_OF_STOCK`, busy buffer | `TEST_PLAN.md` §4 Scenario D |
| E | Juma / David | one claim winner, `ORDER_ALREADY_CLAIMED`, active-order index | `TEST_PLAN.md` §3.3, §4 Scenario E |
| F | Juma / Kasule | 3 attempts, 15-minute lock, geofence, admin reset | `TEST_PLAN.md` §2.5, §4 Scenario F |
| G | Kasule / Juma | 65,500 expected, linked orders, `SETTLED`, `PARTIAL`, variance | `TEST_PLAN.md` §2.6, §4 Scenario G |
| H | Sarah | failed payment, idempotent retry, expiry | `TEST_PLAN.md` §2.7 |
| I | Sarah / Kasule | `STORE_CLOSED`, `KITCHEN_PAUSED`, no order creation | `TEST_PLAN.md` §2.8, §4 Scenario I |
| J | Kasule / Juma / David | reassignment, `RIDER_HAS_ACTIVE_ORDER`, redelivery to pool, audit reason | `TEST_PLAN.md` §4 Scenario J |
| K | Sarah / Brian | `max_cart_lines`, COD change validation, server-recomputed total | `TEST_PLAN.md` §4 Scenario K, §2.2 |

### 4.1 Required data-testids

Use the IDs defined in `TEST_PLAN.md` §6.4. Do not introduce selector names that are not in that table without updating it first.

### 4.2 Rules

- Every scenario starts from `supabase db reset` plus the canonical seed and a test staff file.
- Routing is mocked in E2E; do not call public OSRM.
- Payments use Flutterwave sandbox or a mock adapter; never live keys.
- OTP uses a fixed mock code; never a real SMS.
- Assertions use web-first waits or `expect.poll`; no hard-coded sleeps.
- A test must fail if a retired number, a 4-digit staff PIN, or a direct staff-table write is introduced.

---

## 5. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.5.0 | 2026-11-13 | Added Scenarios J (admin reassignment/redelivery/audit) and K (cart limits/COD change) with traceability rows; added per-attempt payment references to Scenario H. |
| 1.3.0 | 2026-11-10 | Aligned Scenarios H/I traceability with `TEST_PLAN.md` §2.7–§2.8 and §4. |
| 1.2.0 | 2026-11-09 | Rewritten to canonical fixtures, Supabase Auth staff identities, schema-authoritative RPCs, and references to `TEST_PLAN.md`; added payment-retry and store-closed scenarios; removed duplicate seed SQL and unrunnable Playwright code. |
| 1.0.0 | 2026-10-27 | Initial personas and E2E narrative. |

# SYSTEM OVERVIEW

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.3.0 |
| **Date** | 2026-11-10 |
| **System code** | `PROJECT-BAZAAR-D2C` / MRFSS |
| **Environment** | Mobile-first responsive web application (installable PWA) |
| **Locale** | Kampala, Uganda — `Africa/Kampala` (EAT, UTC+3) |
| **Currency** | UGX (`USh`), whole integers |

This document describes the product, the commercial rules, the four portals, and the system boundaries. It does not replace the detailed contracts:

- Numbers and fixtures: [`CANONICAL_EXAMPLES.md`](CANONICAL_EXAMPLES.md)
- States and business rules: [`STATE_MACHINES_AND_BUSINESS_RULES.md`](STATE_MACHINES_AND_BUSINESS_RULES.md)
- Schema: [`../supabase/migrations/20261029000000_initial_schema.sql`](../supabase/migrations/20261029000000_initial_schema.sql)
- API events: [`API_CONTRACTS.md`](API_CONTRACTS.md)
- Security: [`SECURITY_AND_VERIFICATION_PROTOCOLS.md`](SECURITY_AND_VERIFICATION_PROTOCOLS.md)
- UX: [`PORTALS_AND_UX_SPECIFICATION.md`](PORTALS_AND_UX_SPECIFICATION.md)

---

## 1. Product

Bazaar Flame & Grill is a restaurant inside a Kampala bazaar. MRFSS is its own ordering and delivery system: customers order from a web storefront, the kitchen works from a kitchen display, riders claim deliveries from a shared pool, and the owner reconciles cash and settings from an admin hub.

### 1.1 Problem

Third-party aggregators charge high commissions, hide customer data, and own the customer relationship. Informal phone/WhatsApp ordering produces misheard modifiers, vague addresses, disputed delivery fees, and cash leakage.

### 1.2 Solution

A single Next.js codebase with four role-scoped portals:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Next.js App Router + Supabase                    │
├───────────────┬────────────────┬─────────────────┬───────────────────┤
│  Customer     │  Kitchen       │  Rider          │  Admin            │
│  /            │  /kitchen      │  /rider         │  /admin           │
│  /checkout    │  KDS tickets   │  claim pool     │  orders/settings  │
│  /orders/[t]  │  86 + busy     │  start + PIN    │  ledger/audit     │
└───────────────┴────────────────┴─────────────────┴───────────────────┘
```

Dine-in is a **customer mode** (`/?table=<qr-token>`), not a fifth portal. The tracker is a customer subroute, not a separate portal. Staff routes are protected by Supabase Auth and role checks.

---

## 2. Commercial Rules

### 2.1 Delivery fee

All routing is road-network based. Distances are stored as **integer metres**; display rounds separately.

```
distance_m  = OSRM road distance
distance_km = distance_m / 1000

if distance_km <= 5.0:      fee = 0
elif distance_km <= 15.0:   fee = ceil(distance_km - 5.0) × rate_per_excess_km
else:                       BLOCKED (DISTANCE_OUT_OF_BOUNDS)
```

Baseline settings:

| Setting | Value |
| :--- | ---: |
| Free delivery radius | 5.0 km |
| Excess rate | USh 1,500 / km |
| Maximum delivery radius | 15.0 km |
| COD maximum radius | 8.1 km |
| Minimum order value (delivery) | USh 20,000 |
| Minimum order value (dine-in) | USh 0 |
| Packaging (delivery) | USh 1,000 |
| Packaging (dine-in) | USh 0 |

The 8.1 km COD ceiling admits the canonical 8.093 km Ntinda fixture. The final commercial ceiling is founder gate F-14. A failed OSRM lookup blocks checkout; there is no Haversine fallback for a final fee.

### 2.2 Pricing identity

```
items_subtotal  = Σ(base_price × quantity)
modifiers_total = Σ(price_delta × quantity)
total_amount    = items_subtotal + modifiers_total + packaging_fee + delivery_fee
```

There are no promotions or discount terms in v1 (ADR-010). Totals are computed server-side from database prices; the client total is never trusted. The database stores `total_amount` as a generated column so components cannot drift.

### 2.3 Minimum order value and cart limits

- Delivery MOV applies to items + modifiers only; packaging and delivery do not count.
- Dine-in bypasses MOV.
- Cart value and line quantity are capped by `app_settings.max_cart_value` and `max_item_quantity`.
- A cart containing an 86'd item is rejected with `ITEM_OUT_OF_STOCK`, naming the item.

### 2.4 Store hours

Checkout is blocked when `is_store_open = false` or EAT time is outside `opening_time`–`closing_time`. Checkout is also blocked with `KITCHEN_PAUSED` while `app_settings.is_kitchen_paused = true`; existing orders continue. The storefront shows a closed or paused state with the next opening time and WhatsApp support. Staff can still work; pre-orders are out of scope.

### 2.5 COD policy

- COD is available only within `cod_max_radius_km`.
- First-time COD customers complete a 6-digit SMS OTP. Returning customers with a delivered order may skip when the setting permits.
- The customer selects a change denomination; change due is stored and shown to the rider.
- Cash becomes a rider liability only after a successful PIN handover (`payment_status = PAID`, `cod_collected_at` set). It is cleared only by cash reconciliation.
- If SMS is unavailable, COD checkout is disabled rather than silently skipping verification.

---

## 3. Fleet and Fulfilment

- Five in-house motorcycles at launch.
- One active delivery per rider in v1. Batching/clustered drops are a future feature (ADR-011).
- Orders are claimed atomically; a rider cannot claim two active orders and two riders cannot claim the same order.
- Telemetry is foreground-only: the rider keeps the screen open; the app uses Screen Wake Lock and shows an offline/stale state. Background/locked-screen GPS is not promised.
- Bags use numbered tamper-evident safety seals. The customer checks the seal before sharing the 4-digit handover PIN.
- Rider shifts and opening cash floats are recorded; end-of-day reconciliation links every COD order to one settlement.

---

## 4. Payments and Cash

| Method | Flow |
| :--- | :--- |
| MTN MoMo / Airtel Money | Flutterwave hosted checkout; `verif-hash` webhook; independent transaction verification; `PENDING_PAYMENT → PREPARING` on verified success |
| Visa / Mastercard | Same Flutterwave hosted checkout; no card data enters the app |
| Cash on delivery | OTP (first time), change selection, `CONFIRMED_UNPAID`, kitchen accept, cash liability after PIN handover |

- Webhook events are stored with a unique provider event ID.
- Late success events for cancelled/failed/completed orders do not resurrect them; they create a refund/manual-review task.
- Unpaid digital orders expire after 10 minutes.
- Refunds are recorded and processed through Flutterwave for digital payments; cash refunds require an admin reason and audit.
- Cash settlement uses `Africa/Kampala` business dates and links `orders.settlement_id` to one settlement. A settlement total must equal the sum of its linked orders.

---

## 5. Architecture

### 5.1 Application

- Next.js App Router, React 19, TypeScript strict, Tailwind CSS 3.4.
- Server Components for reads; Server Actions and route handlers for mutations.
- The Supabase service-role key is imported only in server-only modules; it is never bundled to the client.
- Customer order creation goes through a server action with idempotency; the browser never inserts financial rows.
- Staff use Supabase Auth JWTs so `auth.uid()` works in RLS and RPCs.

### 5.2 Data and realtime

- Postgres is the source of truth. RLS is deny-by-default on every table.
- `anon` and `authenticated` have no direct access to orders, PINs, telemetry, payments, settlements, or audit tables.
- Customer reads use token-scoped RPCs. Rider/kitchen/admin reads use role-scoped RPCs.
- Realtime uses server-emitted Broadcast with safe payloads plus polling fallback. Raw `postgres_changes` is not used on tables containing PINs or PII (ADR-014).
- All `SECURITY DEFINER` functions set `search_path = public, pg_temp`.

### 5.3 Integrations

| Concern | Production | Development/test |
| :--- | :--- | :--- |
| Payments | Flutterwave | Mock adapter |
| SMS/OTP | Africa's Talking | Console/mock |
| Routing | Self-hosted OSRM | Mock fixtures / public demo |
| Map tiles | MapTiler (restricted key) | OSM with attribution |
| Rate limits/cache | Upstash Redis | In-memory local only |
| Printing | Browser print to thermal printer | Print preview |

### 5.4 Hosting and cost

The system avoids aggregator commissions, but it is **not zero-cost**. Recurring costs include Supabase Pro, hosting, domain, SMS, payment processing fees, MapTiler, Upstash, and OSRM hosting. The cost model is maintained in the operations runbook and must be reviewed before launch.

---

## 6. Personas

| Persona | Primary job | Portal |
| :--- | :--- | :--- |
| Sarah, office worker | Prepaid lunch delivery | Customer |
| Brian, far customer | COD with change and surcharge | Customer |
| Alex, walk-up guest | Dine-in from table QR | Customer (dine-in mode) |
| Musa, line cook | Tickets, 86, busy mode | Kitchen |
| Juma, boda rider | Claim, navigate, hand over | Rider |
| Kasule, owner | Orders, settings, cash, audit | Admin |

Detailed journeys and acceptance scenarios are in [`TESTING_PERSONAS_AND_E2E_SCENARIOS.md`](TESTING_PERSONAS_AND_E2E_SCENARIOS.md).

---

## 7. Success Measures

- 100% of fees computed from integer OSRM metres; no out-of-zone order is accepted.
- Order reaches the KDS within 1.5 seconds of verified payment or COD confirmation.
- Kitchen audio alerts are reliable after the shift-start gesture.
- Daily cash expected equals the sum of linked COD orders; every variance is explained and audited.
- A rider reaches the destination pin without more than one clarification call in normal operation.
- WCAG 2.2 AA for all text and controls; AAA for body and critical status text where achievable.
- No retired fixture value, staff PIN, or customer token appears in UI copy, logs, or analytics.

---

## 8. Out of Scope for v1

- Customer accounts and loyalty.
- Promotions and discount codes.
- Rider batching.
- Pre-orders and scheduled delivery.
- Automated WhatsApp messaging (support link only).
- ESC/POS over Web Bluetooth/USB (browser print only).
- Multi-branch or multi-tenant operation.
- Native mobile apps.

---

## 9. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.3.0 | 2026-11-10 | Added the kitchen-pause checkout state. |
| 1.2.0 | 2026-11-09 | Rewritten: four-portal model, integer-metre fee, 8.1 km COD alignment, no Haversine fallback, accurate cost statement, token-scoped RPC/Broadcast architecture, explicit v1 scope. |
| 1.1.0 | 2026-10-29 | Amendment banner only. |
| 1.0.0 | 2026-10-27 | Original architecture draft. |

# GLOSSARY

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.5 |
| **Version** | 1.5.0 |
| **Date** | 2026-11-13 |
| **Related** | All v1.5 specifications |

Shared vocabulary for the team, testers, and new contributors. If a document uses a term differently, the definition here wins and the document should be corrected.

---

## Business and operations

| Term | Meaning |
| :--- | :--- |
| **Morouj Mazaar** | The product and brand umbrella for this project. |
| **Bazaar Flame & Grill** | The single restaurant operated under Morouj Mazaar. |
| **COD** | Cash on delivery. The customer pays the rider at handover; the order is `CONFIRMED_UNPAID` until accepted and `PAID` after PIN-verified handover. |
| **Dine-in** | A customer mode where the order is tied to a table QR token; no rider, delivery fee, packaging fee, or handover PIN. |
| **EAT** | East Africa Time, `Africa/Kampala`, UTC+3. All business dates and reports use EAT. |
| **EFRIS** | Uganda Revenue Authority’s Electronic Fiscal Receipting and Invoicing Solution. Required only if the business is VAT-registered and onboarded; confirm with the tax adviser. |
| **Float** | Physical change a rider carries at the start of a shift; tracked separately from customer cash. |
| **KDS** | Kitchen display system. In this project, the `/kitchen` portal and its ticket board. |
| **Kitchen pause** | `app_settings.is_kitchen_paused`; blocks new checkout with `KITCHEN_PAUSED` while existing orders continue. |
| **Busy mode** | `app_settings.is_kitchen_busy` plus a 0–60 minute buffer; adds ETA buffer without blocking checkout. |
| **MOV** | Minimum order value for delivery. Dine-in has MOV 0. |
| **MRFSS** | Morouj Restaurant & Food Service System; the software system in this repository. |
| **MRO** | Morouj Mazaar restaurant operations; the business context MRFSS serves. |
| **86 (eighty-six)** | An item is unavailable. Toggled by kitchen/admin through the availability RPC; the storefront hides it. |
| **Settlement** | The end-of-day reconciliation of a rider’s expected COD cash against the physical count, linked to orders through `orders.settlement_id`. |
| **Shift** | A rider’s working window, with start/end, float, and settlement boundary. |

## Money and pricing

| Term | Meaning |
| :--- | :--- |
| **UGX / USh** | Ugandan shilling. Stored as whole integers; no decimals. |
| **Gross revenue** | Sum of `total_amount` for delivered, paid orders. Not profit; excludes fees, refunds, and food cost. |
| **COD collected** | Sum of delivered, paid COD orders. |
| **Digital collected** | Gross revenue minus COD collected. |
| **Variance** | `counted_cash − expected_cash` in a settlement. Positive is over; negative is short. |
| **Billable km** | `ceil(distance_km − 5.0)` when distance exceeds the free radius; multiplied by the excess rate. |
| **Free delivery radius** | 5.0 km. |
| **Maximum delivery radius** | 15.0 km. |
| **COD maximum radius** | 8.1 km test/seed ceiling; final commercial value is founder gate F-14. |

## Technical

| Term | Meaning |
| :--- | :--- |
| **ADR** | Architecture Decision Record in `docs/DECISIONS.md`. |
| **Broadcast** | Supabase Realtime channel used for safe, server-emitted payloads. The project does not use `postgres_changes` on sensitive tables. |
| **Deny-by-default RLS** | Row Level Security posture where no table access is granted unless a specific policy or RPC allows it. |
| **FSM** | Finite state machine for order status. See `STATE_MACHINES_AND_BUSINESS_RULES.md`. |
| **Idempotency key** | Client-generated key that prevents duplicate checkout/payment effects. |
| **OSRM** | Open Source Routing Machine. Production uses a self-hosted instance for road distance and duration. |
| **OTP** | One-time password sent by SMS for first-time COD verification. Six digits, hashed at rest. |
| **PIN (handover)** | Four-digit per-order secret the customer gives the rider after checking the safety seal. Stored in `orders.handover_pin`; never exposed to kitchen/rider pool. |
| **Payment attempt** | One hosted-checkout try stored in `payment_transactions`. Each attempt has `attempt_number` and an immutable `tx_ref = '<order_token>-<attempt_number>'`; retries never reuse a reference. |
| **PIN (staff)** | Six-digit Supabase Auth password for staff login. Never stored in `profiles`. |
| **RLS** | Row Level Security in PostgreSQL/Supabase. |
| **RPC** | Remote procedure call; a PostgreSQL function exposed to a specific role through Supabase. |
| **Service role** | Supabase key that bypasses RLS. Server-only; never shipped to the browser. |
| **Token-scoped RPC** | RPC that returns data only for a valid order token (customer) or authenticated staff identity. |
| **Webhook** | Provider callback, e.g. Flutterwave `POST /api/webhooks/flutterwave`. Must be signature-verified and idempotent. |

## Compliance and security

| Term | Meaning |
| :--- | :--- |
| **DPPA** | Uganda Data Protection and Privacy Act, 2019. |
| **DPO** | Data Protection Officer; appointment/registration to be confirmed by the founders. |
| **PDPO** | Personal Data Protection Office (Uganda regulator). |
| **PII** | Personally identifiable information. |
| **SAQ A** | PCI DSS self-assessment for merchants who never handle card data directly (hosted checkout). |
| **URA** | Uganda Revenue Authority. |
| **VAT** | Value Added Tax; registration and rate to be confirmed by the tax adviser. |

---

## Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.5.0 | 2026-11-13 | Added the Morouj Mazaar/Bazaar Flame & Grill/MRFSS hierarchy and the payment-attempt term. |
| 1.3.0 | 2026-11-10 | Added kitchen pause and busy mode terms. |
| 1.2.0 | 2026-11-09 | Created; closes the P2 “no glossary” finding. |

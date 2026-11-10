# ANALYTICS — KPI Definitions, Dashboard, and Data Rules

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.2 |
| **Version** | 1.3.0 |
| **Date** | 2026-11-10 |
| **Owner** | Founders + engineer |
| **Related** | `API_CONTRACTS.md` §2.9, `CANONICAL_EXAMPLES.md`, `OPERATIONS_RUNBOOK.md` §9, migration `get_admin_analytics` |

This document defines the only approved analytics metrics for v1. It closes audit finding P1-30 and the P2 “no analytics or KPI definitions” finding.

---

## 1. Scope

The MVP analytics surface is `/admin/analytics` plus the overview cards. It answers four questions:

1. How much did we sell, and through which payment method?
2. How fast did the kitchen and delivery operation run?
3. How much cash is outstanding, and where is it?
4. Which items and customers drive repeat volume?

Non-goals: marketing attribution, ad spend, cohort LTV modelling, customer accounts, and cross-branch comparison. Single restaurant, single branch.

---

## 2. Canonical definitions

All business dates use **`Africa/Kampala`** (EAT, UTC+3). Money is integer UGX. A “delivered” order means `order_status = 'DELIVERED'`; a “cancelled” order means `order_status = 'CANCELLED'`.

| KPI | Definition | Source | Notes |
| :--- | :--- | :--- | :--- |
| Orders created | Count of orders with `created_at` in range | `orders` | Includes cancelled/unpaid. |
| Delivered orders | Count where `order_status='DELIVERED'` | `orders` | Fulfilment denominator. |
| Cancelled orders | Count where `order_status='CANCELLED'` | `orders` | Reason is audited. |
| Gross revenue | `sum(total_amount)` where `payment_status='PAID'` and `DELIVERED` | `orders` | Excludes unpaid COD and failed payments. |
| COD collected | `sum(total_amount)` where `payment_method='CASH_ON_DELIVERY'`, `payment_status='PAID'`, `order_status='DELIVERED'` | `orders` | Cash actually collected. |
| Digital collected | Gross revenue − COD collected | `orders` | Provider fees are not netted here. |
| Average order value | Gross revenue ÷ delivered orders | `orders` | `0` when no delivered orders. |
| Average prep time | Mean `(ready_at - acknowledged_at)` for delivery orders | `orders` | `ready_at` set on `READY_FOR_PICKUP`; prepaid starts at webhook confirmation, COD at accept. |
| Average delivery time | Mean `(delivered_at - ready_at)` for delivery orders | `orders` | `ready_at` set on `READY_FOR_PICKUP`; dine-in excluded. |
| Repeat customer rate | Phones with ≥ 2 delivered orders ÷ phones with ≥ 1 delivered order | `orders.customer_phone_normalized` | No account required. |
| Settlement variance | `sum(counted_cash − expected_cash)` | `cash_settlements` | Positive = over, negative = short. |
| 86 frequency | Count of `SET_ITEM_AVAILABILITY` audit actions per item per day | `admin_audit_log` | Uses the audit action name. |
| Rider utilisation | Active delivery minutes ÷ shift minutes | `rider_shifts`, `orders` | Only closed or current shifts. |
| Payment mix | Count and amount by `payment_method` | `orders` | Show MTN, Airtel, card, cash. |
| Busy-mode minutes | Minutes `app_settings.is_kitchen_busy = true` | `settings_history` | Used to explain prep-time changes. |

### 2.1 Revenue caveats

- Gross revenue is **not** profit. It excludes provider fees, refunds, food cost, and payroll.
- Refunded orders remain in gross revenue only if the order was delivered and the refund is separately reported. The dashboard must show refunds as a separate line, not silently reduce revenue.
- Cash is recognised when the order is `DELIVERED` and `PAID`; the physical count is reconciled through `cash_settlements`.
- Do not mix UTC and EAT ranges in one report.

---

## 3. Dashboard layout

`/admin/analytics` has a date-range control (Today, Yesterday, Last 7 days, This month, Custom) and these sections:

1. **Revenue and orders** — gross revenue, delivered orders, average order value, cancellation rate.
2. **Payment mix** — table and bar by method; COD vs digital split.
3. **Kitchen performance** — average prep time, oldest open ticket, 86 frequency, busy-mode minutes.
4. **Delivery performance** — average delivery time, completion rate, failed deliveries, rider utilisation.
5. **Cash** — COD collected, outstanding expected cash, variance by rider and business date.
6. **Menu** — top items by units and revenue, sold-out frequency, average modifier attach rate.
7. **Customers** — repeat rate and order frequency bands; no names or phone numbers in aggregate exports.

Every card must state its date range and whether it is gross or net of refunds.

---

## 4. Event and audit requirements

Analytics depends on durable events, not client-side counters:

- Order created, paid, acknowledged, ready, delivered, cancelled, failed.
- Refund requested, approved, completed, rejected.
- Settlement created/updated; variance recorded.
- Item availability changed; busy mode changed.
- Staff login failures and PIN lockouts (security analytics, not sales).

The `admin_audit_log`, `order_status_history`, `settings_history`, and `cash_settlements` tables are the source of truth. Do not build dashboards from browser local storage or demo fixtures.

---

## 5. Exports and access

- Analytics is `ADMIN` only.
- CSV exports contain aggregate rows; they do not include full phone numbers, addresses, PINs, or payment references.
- Export every report with the range, generation timestamp, and filter values in the filename or header.
- Do not expose analytics through a public route or an unauthenticated Supabase view.

---

## 6. Validation

- Unit-test each formula against the canonical fixtures.
- Integration-test that a refund does not silently disappear from the revenue/refund lines.
- E2E-test the date filter with an order placed just before and after EAT midnight.
- Confirm RLS denies `KITCHEN` and `RIDER` access to analytics RPCs.
- Reconcile one day of gross revenue, COD collected, and settlements to the payment dashboard before launch.

---

## 7. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.3.0 | 2026-11-10 | Corrected COD enum value and defined `ready_at` for prep/delivery KPIs. |
| 1.2.0 | 2026-11-09 | Created; closes P1-30 and the P2 analytics/KPI gap. |

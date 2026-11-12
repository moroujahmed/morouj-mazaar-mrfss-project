# CANONICAL EXAMPLES — Single Source of Truth for Numbers

| Field | Value |
| :--- | :--- |
| **Status** | Approved baseline |
| **Version** | 1.3.0 |
| **Date** | 2026-11-12 |
| **Rule** | If any document, test, screenshot, or fixture disagrees with this file, this file wins. |

This file exists because the v1.0 documents used conflicting totals for the same order and a road distance that did not match the real OSRM route. The verified values below replace them.

---

## 1. Canonical Constants

| Constant | Value | Source of truth |
| :--- | :--- | :--- |
| Currency | UGX (`USh`), whole integers | `app_settings.currency` |
| Timezone | `Africa/Kampala` (EAT, UTC+3) | `app_settings.timezone` |
| Free delivery radius | **5.0 km** | `app_settings.free_delivery_radius_km` |
| Excess rate | **USh 1,500 / km** | `app_settings.rate_per_excess_km` |
| Maximum delivery radius | **15.0 km** | `app_settings.max_delivery_radius_km` |
| COD maximum radius | **8.1 km** | `app_settings.cod_max_radius_km` |
| Minimum order value (delivery) | **USh 20,000** | `app_settings.minimum_order_value` |
| Minimum order value (dine-in) | **USh 0** | `app_settings.minimum_order_value_dine_in` |
| Packaging fee (delivery) | **USh 1,000** | `app_settings.packaging_fee_default` |
| Packaging fee (dine-in) | **USh 0** | `app_settings.packaging_fee_dine_in` |
| Customer handover PIN | 4 digits | `orders.handover_pin` |
| Staff login PIN | 6 digits | Supabase Auth password |
| Handover PIN attempts | 3 | `app_settings.pin_max_attempts` |
| Handover PIN lock | 15 minutes | `app_settings.pin_lock_minutes` |
| Max distinct cart lines | 30 | `app_settings.max_cart_lines` |
| Staff session | 12 hours | `app_settings.staff_session_hours` |
| Business day | `Africa/Kampala` | `app_settings.timezone` |

---

## 2. Restaurant Coordinates (Must Be Verified On Site)

| Field | Value |
| :--- | :--- |
| Latitude | `0.3136000` |
| Longitude | `32.5811000` |
| Status | **UNVERIFIED** — the founders must confirm this pin at the physical bazaar. |

The v1.0 fixture distances do not match this pin. Do not treat the coordinates or the old distances as production truth until verified.

---

## 3. Verified Routing Snapshot

Verified against the public OSRM demo server on **2026-10-29**:

| Route | Coordinates | OSRM road distance | OSRM duration |
| :--- | :--- | ---: | ---: |
| Restaurant → Nakasero | `0.3245, 32.5782` | **1.562 km** | 3.54 min |
| Restaurant → Ntinda | `0.3542, 32.6120` | **8.093 km** | 8.45 min |

> Public OSRM has no SLA. Production uses self-hosted OSRM (ADR-005). Tests use mocks or tolerance.

### 3.1 Fee results

| Destination | Distance | Excess | Billable (`ceil`) | Fee |
| :--- | ---: | ---: | ---: | ---: |
| Nakasero | 1.562 km | 0 | 0 | **USh 0** |
| Ntinda | 8.093 km | 3.093 km | 4 km | **USh 6,000** |

The retired v1.0 distances and fee must not appear in tests or UI copy. Test mocks must reproduce the verified values in this table, clearly labelled `MOCK`; they must not reintroduce the old fixtures.

> **COD radius note:** the canonical Ntinda COD fixture is 8.093 km. The seeded `cod_max_radius_km` is therefore **8.1 km**, not 8.0 km, so the fixture is eligible. The final commercial ceiling remains founder gate F-14.

---

## 4. Canonical Order A — Sarah, Prepaid Delivery

**Scenario:** Nakasero, MTN MoMo, free-delivery zone.

| Line | Unit | Qty | Amount |
| :--- | ---: | ---: | ---: |
| Whole Tilapia Flame Combo | 32,000 | 1 | 32,000 |
| Extra Garlic Pepper Dip | 2,000 | 1 | 2,000 |
| **Items + modifiers** | | | **34,000** |
| Packaging | | | 1,000 |
| Delivery (1.562 km) | | | 0 |
| **TOTAL DUE** | | | **USh 35,000** |

Use **USh 35,000** everywhere for this order. All v1.0 variants are retired.

---

## 5. Canonical Order B — Brian, COD Delivery

**Scenario:** Ntinda, cash on delivery, change for USh 50,000.

| Line | Unit | Qty | Amount |
| :--- | ---: | ---: | ---: |
| Smoked Beef Luwombo | 26,000 | 1 | 26,000 |
| Cold-Pressed Passion Juice (500 ml) | 5,000 | 1 | 5,000 |
| **Items + modifiers** | | | **31,000** |
| Packaging | | | 1,000 |
| Delivery (8.093 km → 4 billable km × 1,500) | | | 6,000 |
| **TOTAL DUE** | | | **USh 38,000** |

**Change calculation:**

```
Customer hands over: USh 50,000
Total due:            USh 38,000
Change due:           USh 12,000
```

All v1.0 variants of this total are retired.

---

## 6. Canonical Order C — Alex, Dine-In

**Scenario:** Table 4, Airtel Money, single Rolex.

| Line | Unit | Qty | Amount |
| :--- | ---: | ---: | ---: |
| Special Bazaar Rolex | 8,000 | 1 | 8,000 |
| **Items + modifiers** | | | **8,000** |
| Packaging (dine-in) | | | 0 |
| Delivery (dine-in) | | | 0 |
| **TOTAL DUE** | | | **USh 8,000** |

MOV is bypassed for dine-in. The order is `DINE_IN`, references `tables.id`, and never enters the rider pool.

---

## 7. Canonical Ledger Example

Use orders generated from the canonical fixtures. Do not invent totals.

| Rider | Order | Payment | Amount |
| :--- | :--- | :--- | ---: |
| Juma | #1043 | COD | 38,000 |
| Juma | #1047 | COD | 27,500 |
| **Juma total** | | | **USh 65,500** |

**Rule:** a settlement total must equal the sum of the linked `orders.total_amount` rows. The ledger UI must show the order IDs. Do not substitute a different second order or a lump-sum total; change this file first if the fixture set changes.

---

## 8. Canonical Fee Formula

All distances are calculated in **metres** on the server, then converted to km for display.

```
distance_m  = OSRM road distance in metres
distance_km = distance_m / 1000

if distance_km <= 5.0:
    fee = 0
elif distance_km <= 15.0:
    billable_km = ceil(distance_km - 5.0)
    fee = billable_km * rate_per_excess_km
else:
    fee = BLOCKED (DISTANCE_OUT_OF_BOUNDS)
```

**Important:** do not store the distance as `DECIMAL(4,1)` and then apply `ceil`. `5.04 km` would round to `5.0` and become free. Store `road_distance_m` as an integer.

---

## 9. Canonical Test Fixtures

| Fixture | Lat | Lng | Expected km | Tolerance | Expected fee |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Nakasero | 0.3245 | 32.5782 | 1.562 | ±0.15 | 0 |
| Ntinda | 0.3542 | 32.6120 | 8.093 | ±0.30 | 6,000 |
| Out of bounds | 0.4200 | 32.7000 | >15 | — | BLOCKED |

For unit tests of the fee function, use fixed metres (not network calls):

```json
[
  { "distance_m": 5000, "expected_fee": 0 },
  { "distance_m": 5001, "expected_fee": 1500 },
  { "distance_m": 5200, "expected_fee": 1500 },
  { "distance_m": 7400, "expected_fee": 4500 },
  { "distance_m": 8093, "expected_fee": 6000 },
  { "distance_m": 11100, "expected_fee": 10500 },
  { "distance_m": 15000, "expected_fee": 15000 },
  { "distance_m": 15001, "expected_fee": "BLOCKED" }
]
```

---

## 10. Canonical Status Copy

| State | Customer copy | Kitchen copy | Rider copy |
| :--- | :--- | :--- | :--- |
| `PENDING_PAYMENT` | "Waiting for payment confirmation…" | — | — |
| `CONFIRMED_UNPAID` | "Order confirmed — pay cash on delivery." | "New cash order" | — |
| `PREPARING` | "Cooking in the kitchen" | "PREPARING" | — |
| `READY_FOR_PICKUP` | "Packed and waiting for a rider" | "READY FOR PICKUP" | "Available in pool" |
| `CLAIMED` | "Rider is picking up your order" | "Collected" | "Go to kitchen" |
| `OUT_FOR_DELIVERY` | "On the road" | — | "Deliver now" |
| `DELIVERED` | "Delivered — enjoy!" | — | "Complete" |
| `DELIVERY_FAILED` | "Delivery could not be completed — support will contact you." | — | "Reported" |
| `CANCELLED` | "Order cancelled." | "Cancelled" | — |

---

## 11. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.3.0 | 2026-11-12 | Added `max_cart_lines` and confirmed the canonical ledger fixture (Juma 38,000 + 27,500 = 65,500). |
| 1.2.0 | 2026-11-09 | Aligned COD radius with the canonical Ntinda fixture; removed optional legacy mocks and the alternate ledger total. |
| 1.1.0 | 2026-10-29 | Created; retired the v1.0 distance, fee, total, and ledger contradictions. |

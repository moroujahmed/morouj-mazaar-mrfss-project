# TEST PLAN — Unit, Database, E2E, Security, and Accessibility

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.1 replacement for `TESTING_PERSONAS_AND_E2E_SCENARIOS.md` §1/§3/§4 |
| **Version** | 1.1.0 |
| **Date** | 2026-10-29 |
| **Canonical data** | `CANONICAL_EXAMPLES.md` |
| **Test runner** | Vitest (unit/integration), Playwright (E2E), axe-core (a11y), k6 (load, optional) |

If a fixture in this file disagrees with `CANONICAL_EXAMPLES.md`, the canonical file wins.

---

## 1. Environments and test data

| Environment | Database | Payments | SMS | Routing | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Local | Supabase CLI (`supabase start`) | Flutterwave sandbox or mock | Mock | Mocked adapter | Development, unit, E2E |
| CI | Ephemeral Supabase branch / local Postgres | Mock | Mock | Mocked adapter | PR gates |
| Staging | Dedicated Supabase project | Flutterwave sandbox | Africa's Talking sandbox | Self-hosted OSRM staging | Release candidate |
| Production | Supabase Pro | Flutterwave live | Africa's Talking live | Self-hosted OSRM | Live |

### 1.1 Reset procedure

```bash
npx supabase db reset
STAFF_SEED_FILE=scripts/staff.test.json node scripts/seed-staff.mjs
npm run test:e2e
```

`scripts/staff.test.json` must use test-only PINs and `must_change_pin: false`. Never reuse production PINs.

### 1.2 Canonical fixtures

| Fixture | Coordinates | Road distance | Fee | Order total |
| :--- | :--- | ---: | ---: | ---: |
| Sarah / Nakasero / MTN MoMo | `0.3245, 32.5782` | **1,562 m** | **0** | **USh 35,000** |
| Brian / Ntinda / COD | `0.3542, 32.6120` | **8,093 m** | **6,000** | **USh 38,000** |
| Alex / Table T4 / Airtel | table token | 0 | 0 | **USh 8,000** |

Retired values that must not appear in tests: `3.8 km`, `7.4 km`, `4,500`, `35,600`, `36,500`, `34,000` as a final total, `37,000`, `38,000` as Sarah's total.

---

## 2. Unit tests (Vitest)

### 2.1 Fee engine

Test the pure function with metres, not network calls:

```ts
const cases = [
  { distanceM: 0,     expectedFee: 0 },
  { distanceM: 5000,  expectedFee: 0 },
  { distanceM: 5001,  expectedFee: 1500 },
  { distanceM: 5200,  expectedFee: 1500 },
  { distanceM: 7400,  expectedFee: 4500 },
  { distanceM: 8093,  expectedFee: 6000 },
  { distanceM: 11100, expectedFee: 10500 },
  { distanceM: 15000, expectedFee: 15000 },
  { distanceM: 15001, expectedFee: 'BLOCKED' },
];
```

Also test:

- `5.04 km` must not become free because of display rounding.
- Negative/NaN/Infinity input is rejected.
- Rate and free radius come from `app_settings`, not hard-coded constants.

### 2.2 Pricing

- `items_subtotal = Σ(base_price × qty)`.
- `modifiers_total = Σ(price_delta × qty)`.
- `total = items_subtotal + modifiers_total + delivery_fee + packaging_fee`.
- Delivery packaging = 1,000; dine-in packaging = 0.
- MOV uses items + modifiers only; packaging and delivery do not count.
- Dine-in bypasses MOV.
- Cart above `max_cart_value` or line quantity above `max_item_quantity` is rejected.

### 2.3 Phone normalization

| Input | Output |
| :--- | :--- |
| `0772000111` | `+256772000111` |
| `+256772000111` | `+256772000111` |
| `256772000111` | `+256772000111` |
| `0772 000 111` | `+256772000111` |
| `12345` | rejected |

### 2.4 FSM

- Allowed transitions pass.
- Every other transition raises `ORDER_STATE_INVALID`.
- `DELIVERED`, `DELIVERY_FAILED`, and `CANCELLED` are terminal.
- Dine-in `PREPARING → DELIVERED` is allowed.
- A status update writes one `order_status_history` row with the correct actor.

### 2.5 PIN and lockout

- 4-digit PIN is generated with `pgcrypto`, not `RANDOM()`.
- Wrong PIN increments `failed_pin_attempts` and inserts an attempt row.
- 3rd wrong PIN sets `pin_locked_until` and returns `PIN_LOCKED`.
- Correct PIN after lock expiry succeeds and resets counters.
- A rider cannot verify another rider's order.
- Geofence > 300 m returns `TOO_FAR_FROM_DESTINATION` without consuming a PIN attempt.
- Admin reset generates a new PIN and clears the lock.

### 2.6 Settlement

- Expected cash = sum of COD `PAID` + `DELIVERED` + unsettled orders for the business date.
- Counted cash < expected → `PARTIAL` and negative variance.
- Counted cash = expected → `SETTLED` and zero variance.
- A second reconciliation for the same rider/date updates the same settlement; it does not duplicate.
- Orders link to exactly one settlement.

### 2.7 Idempotency

- Same checkout key + same payload returns the same order.
- Same key + different payload returns `IDEMPOTENCY_CONFLICT`.
- Duplicate Flutterwave webhook event is ignored.
- Expired idempotency key can be reused.

---

## 3. Database and RLS tests

Run as SQL against a migrated local database. The test must assert both **privileges** and **row visibility**.

### 3.1 Privilege matrix

| Role | `orders` select | `orders` insert | `handover_pin` select | `rider_telemetry` select | `profiles` select | Menu select |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `anon` | denied | denied | denied | denied | denied | active only |
| `authenticated` (no staff profile) | denied | denied | denied | denied | own row only | active only |
| `RIDER` | denied direct; RPC only | denied | denied | denied direct; RPC only | own row | active only |
| `KITCHEN` | denied direct; RPC only | denied | denied | denied | own row | all rows |
| `ADMIN` | denied direct; RPC only | denied | denied direct; `admin_get_order` only | denied | all rows | all rows |
| `service_role` | allowed | allowed | allowed | allowed | allowed | allowed |

### 3.2 RPC authorization

- `get_order_by_token` works with a valid token and returns null for an unknown token.
- `get_rider_pool` raises `AUTH_UNAUTHORIZED` for anon, kitchen, and admin.
- `claim_order_atomic` raises `RIDER_HAS_ACTIVE_ORDER` on a second claim.
- `claim_order_atomic` on an already claimed order raises `ORDER_ALREADY_CLAIMED`.
- `verify_delivery_pin` raises `AUTH_UNAUTHORIZED` for another rider.
- `get_kitchen_orders` raises `AUTH_UNAUTHORIZED` for a rider.
- `admin_*` RPCs raise `AUTH_UNAUTHORIZED` for non-admin.
- `expire_pending_orders` is executable only by `service_role`.

### 3.3 Race test

Use two concurrent sessions:

```sql
-- Session 1
SELECT public.claim_order_atomic('<order-id>');
-- Session 2 (same moment)
SELECT public.claim_order_atomic('<order-id>');
```

Exactly one returns `CLAIMED`; the other returns `ORDER_ALREADY_CLAIMED`. The `orders_one_active_per_rider` index must prevent a rider from holding two active orders.

### 3.4 Payment and settlement integrity

- `orders.total_amount` always equals the sum of its components.
- `orders.settlement_id` is null until reconciliation.
- A settlement cannot link orders from another rider.
- `payment_transactions` duplicate `(provider, provider_transaction_id)` is rejected.
- `webhook_events` duplicate `(provider, provider_event_id)` is rejected.

---

## 4. E2E scenarios (Playwright)

### Scenario A — Sarah, prepaid delivery

1. Open storefront; add Whole Tilapia Flame Combo (32,000) + Extra Garlic Pepper Dip (2,000).
2. Set Nakasero pin; `/api/distance` returns 1,562 m from the mock adapter.
3. Assert delivery fee **0**, packaging **1,000**, total **35,000**.
4. Pay with MTN MoMo sandbox; webhook verified; order becomes `PREPARING`.
5. Kitchen accepts and bumps; rider claims, starts, enters PIN.
6. Assert `DELIVERED`, payment `PAID`, feedback prompt appears.

### Scenario B — Brian, COD surcharge and change

1. Add Smoked Beef Luwombo (26,000) + Passion Juice (5,000).
2. Set Ntinda pin; mock returns 8,093 m.
3. Assert delivery fee **6,000**, packaging **1,000**, total **38,000**.
4. Request change for 50,000; assert change due **12,000**.
5. Complete COD OTP (mock code); order `CONFIRMED_UNPAID`.
6. Kitchen accept/bump; rider claim/start; wrong PIN once, then correct.
7. Assert `DELIVERED`, `payment_status = PAID`, `cod_collected_at` set.
8. Admin ledger shows expected **38,000**; reconcile; variance **0**.

### Scenario C — Alex, dine-in

1. Scan table T4 QR (`88888888-8888-4888-8888-888888888804`).
2. Add Special Bazaar Rolex (8,000).
3. Assert MOV bypassed, packaging **0**, delivery **0**, total **8,000**.
4. Pay Airtel Money; kitchen accept/bump.
5. Assert `DELIVERED`; order never appears in rider pool; no handover PIN gate.

### Scenario D — 86'd item and busy mode

1. Kitchen toggles `Golden Chips` unavailable.
2. Storefront shows “Sold out”; adding it is blocked.
3. Checkout with an item that becomes 86'd mid-flow returns `ITEM_OUT_OF_STOCK`.
4. Kitchen enables busy mode with 20-minute buffer.
5. New order ETA includes the buffer; existing orders do not change retroactively.

### Scenario E — Claim race

1. Two rider browser contexts both see the same `READY_FOR_PICKUP` order.
2. Both click Claim at the same time.
3. Exactly one gets the order; the other sees “Order was just claimed by another rider.”
4. The loser's pool refreshes; the winner's active order appears.

### Scenario F — PIN lockout and admin reset

1. Rider enters wrong PIN three times.
2. Assert lock message and `pin_locked_until`.
3. Admin resets the PIN with a reason; audit row exists.
4. Rider enters the new PIN; delivery completes.
5. Assert `security_flag` and audit trail.

### Scenario G — End-of-day cash settlement

1. Seed two COD delivered orders for Juma: 38,000 and 27,500.
2. Ledger shows expected **65,500**.
3. Reconcile 65,500; status `SETTLED`, variance 0.
4. Reconcile a second time with 60,000; status `PARTIAL`, variance **-5,500**.
5. Orders remain linked to the same settlement; no duplicate settlement row.

---

## 5. Rider GPS and offline tests

- Telemetry writes only while `OUT_FOR_DELIVERY` and only for the assigned rider.
- Customer tracker polls `get_order_telemetry` and shows the last update time.
- When the browser is backgrounded, the UI shows “Keep this screen open for live tracking”; it does not claim background GPS.
- Offline queue: buffer up to 50 points; replay in order with exponential backoff; drop points older than 10 minutes.
- Duplicate points are idempotent by `(rider_id, recorded_at)` in the client queue.
- No telemetry is written for `CLAIMED` or `DELIVERED`.

---

## 6. Playwright blueprint

### 6.1 `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "customer",
      use: { ...devices["Pixel 7"], storageState: "tests/.auth/customer.json" },
      dependencies: ["setup"],
    },
    {
      name: "kitchen",
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/kitchen.json" },
      dependencies: ["setup"],
    },
    {
      name: "rider",
      use: { ...devices["Pixel 7"], storageState: "tests/.auth/rider.json" },
      dependencies: ["setup"],
    },
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 6.2 Auth setup

`tests/e2e/auth.setup.ts` logs in each staff role through the real UI with the test PINs and saves storage state. Do not inject cookies manually. Customer tests use a fresh context; the order token is the capability.

### 6.3 Routing mock

Do not call public OSRM in E2E. Intercept the server adapter at the network boundary or set `OSRM_BASE_URL` to a local mock server:

```ts
await page.route("**/api/distance**", async (route) => {
  const url = new URL(route.request().url());
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const isNtinda = Math.abs(lat - 0.3542) < 0.001 && Math.abs(lng - 32.612) < 0.001;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      data: {
        distanceM: isNtinda ? 8093 : 1562,
        distanceKm: isNtinda ? 8.093 : 1.562,
        source: "MOCK",
      },
    }),
  });
});
```

The UI must display the `MOCK` source only in test/dev, never in production.

### 6.4 Required `data-testid`s

| Test ID | Element |
| :--- | :--- |
| `menu-item-{slug}` | Menu card |
| `add-to-cart` | Add button |
| `cart-subtotal` | Subtotal |
| `cart-total` | Total due |
| `delivery-fee` | Delivery fee |
| `checkout-pay` | Primary CTA |
| `order-token` | Tracker token (hidden input) |
| `order-status` | Tracker status |
| `handover-pin` | Customer PIN |
| `kitchen-ticket-{orderNumber}` | KDS ticket |
| `kitchen-accept` | Accept button |
| `kitchen-bump` | Bump button |
| `rider-pool-item-{orderNumber}` | Pool card |
| `rider-claim` | Claim button |
| `rider-start` | Start trip button |
| `rider-pin-input` | PIN input |
| `rider-pin-submit` | PIN submit |
| `admin-ledger-row-{riderId}` | Ledger row |
| `admin-reconcile` | Reconcile button |

### 6.5 Rules

- No `test:set-coordinates` hook that bypasses the real checkout pipeline.
- No hard-coded sleeps; use `expect.poll` or web-first assertions.
- Every test starts from a known database state (`supabase db reset` in CI).
- Payment tests use the mock adapter or Flutterwave sandbox; never live keys.
- OTP tests use a fixed test code in the mock, not a real SMS.

---

## 7. Accessibility tests

- `@axe-core/playwright` on `/`, `/checkout`, `/orders/[token]`, `/kitchen`, `/rider`, `/admin`.
- Zero critical or serious violations.
- Keyboard-only path for checkout, kitchen bump, rider claim/PIN, admin reconcile.
- 200% zoom and 320 px width; no horizontal scroll.
- Contrast token test against `ACCESSIBILITY.md`.
- Screen reader announcements for status changes and errors.
- Reduced-motion test.

---

## 8. Performance and load

| Check | Target | Method |
| :--- | :--- | :--- |
| Storefront FCP on throttled 3G | < 1.5 s | Lighthouse CI |
| Initial JS bundle | < 150 KB compressed | Next.js build output |
| Menu API p95 | < 300 ms | k6 / Supabase logs |
| Checkout p95 (excluding payment redirect) | < 800 ms | k6 |
| Rider pool poll p95 | < 300 ms | k6 |
| 50 concurrent checkouts | No duplicate orders, no 5xx | k6 + DB assertions |
| Claim race 20 concurrent riders | Exactly one winner | k6/SQL |

---

## 9. CI gates

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:db
npm run test:e2e
npm run test:a11y
npm run build
```

A PR cannot merge if any gate fails. `test:db` and `test:e2e` require a migrated local Supabase instance.

---

## 10. Exit criteria for Phase 12

- Scenarios A–G pass on desktop Chrome and a Pixel 7 viewport.
- RLS matrix passes.
- No critical/serious axe violations.
- No retired numbers in fixtures or UI copy.
- Payment webhook replay/duplicate tests pass.
- Settlement totals reconcile to the linked orders.
- Runbook rollback and backup restore have been exercised at least once.

---

## 11. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.1.0 | 2026-10-29 | Created; replaces wrong fixtures and the unrunnable Playwright blueprint. |

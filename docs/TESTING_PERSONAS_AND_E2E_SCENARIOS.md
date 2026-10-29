# TESTING_PERSONAS_AND_E2E_SCENARIOS.md

> **v1.1 normative amendment:** Seed UUIDs, staff auth, distances, totals, and the Playwright blueprint are superseded by [`CANONICAL_EXAMPLES.md`](CANONICAL_EXAMPLES.md), [`TEST_PLAN.md`](TEST_PLAN.md), [`../supabase/seed.sql`](../supabase/seed.sql), and [`../scripts/seed-staff.mjs`](../scripts/seed-staff.mjs).

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved QA & Testing Specification
* **Target Audience:** QA Engineers, Automated Test Agents (Playwright/Vitest) & Antigravity Builders
* **Scope:** Test Seed Data, User Personas, End-to-End Acceptance Scenarios, and Concurrency Test Scripts
* **Geographic Baseline:** Kampala, Uganda (EAT / UTC+3)

---

## 1. Master QA Test Seed Dataset

To ensure consistent testing across automated agent runs and human acceptance reviews, the database must be seeded with these deterministic records.

### 1.1 Staff & Rider Profiles (`public.profiles`)
```sql
-- Password / PIN for all test staff accounts is: '1234'
INSERT INTO public.profiles (id, full_name, phone_number, role, pin_code, motorcycle_plate, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Mr. Kasule (Admin)', '+256700111000', 'ADMIN', '1234', NULL, true),
  ('k1000000-0000-0000-0000-000000000002', 'Chef Musa (Kitchen)', '+256700111001', 'KITCHEN', '1234', NULL, true),
  ('r1000000-0000-0000-0000-000000000003', 'Rider Juma', '+256700111002', 'RIDER', '1234', 'UFD 342B', true),
  ('r2000000-0000-0000-0000-000000000004', 'Rider David', '+256700111003', 'RIDER', '1234', 'UEX 119A', true),
  ('r3000000-0000-0000-0000-000000000005', 'Rider Brian', '+256700111004', 'RIDER', '1234', 'UEE 902C', true);
```

### 1.2 Baseline System Settings (`public.app_settings`)
```sql
UPDATE public.app_settings SET
  restaurant_name = 'Bazaar Flame & Grill',
  restaurant_lat = 0.3136000,
  restaurant_lng = 32.5811000,
  free_delivery_radius_km = 5.0,
  rate_per_excess_km = 1500,
  minimum_order_value = 20000,
  max_delivery_radius_km = 15.0,
  packaging_fee_default = 1000,
  is_kitchen_busy = false,
  is_store_open = true
WHERE id = 1;
```

---

## 2. Realistic User Personas

```
[ Persona 1: Sarah ] ─── Nakasero (3.8 km)  ─── Pre-Paid MTN MoMo  ─── Happy Path Delivery
[ Persona 2: Brian ] ─── Ntinda (7.4 km)    ─── Cash on Delivery   ─── Distance Surcharge & MOV
[ Persona 3: Alex ]  ─── Bazaar Table 4     ─── Dine-In QR Scan    ─── Zero-Fee Bypass
[ Persona 4: Musa ]  ─── Kitchen KDS        ─── Line Cook          ─── Audio Alerts & 86 Toggles
[ Persona 5: Juma ]  ─── Boda UFD 342B      ─── Motorcycle Courier ─── Navigation & Handover PIN
[ Persona 6: Kasule] ─── Admin Hub          ─── Owner / Auditor    ─── Live Edits & Cash Balancing
```

---

### Persona 1: Sarah Namukasa — The Office Worker (Digital Pre-Paid Path)
* **Profile:** 29, Corporate Accountant at an audit firm on Lumumba Avenue, Nakasero.
* **Device:** iPhone 13 running Safari on 4G.
* **Location:** Plot 14 Lumumba Ave (`lat: 0.3245000, lng: 32.5782000`).
* **Road Distance:** **`3.8 km`** from Bazaar Hub.
* **Goal:** Quick lunch order delivered to the office gate without leaving her desk.
* **Primary Behavior:** Pays digitally via **MTN Mobile Money**, selects custom modifiers, verifies safety seal, and provides 4-digit PIN.

---

### Persona 2: Brian Kato — The Far Customer with Cash (Edge-Case Surcharge & COD)
* **Profile:** 34, Architect working from his home studio in Ntinda Ministers' Village.
* **Device:** Tecno Spark Android on 3G mobile data.
* **Location:** Ntinda Ministers' Village (`lat: 0.3542000, lng: 32.6120000`).
* **Road Distance:** **`7.4 km`** from Bazaar Hub.
* **Goal:** Substantial meal for two, paying with physical paper cash.
* **Primary Behavior:** Triggers Minimum Order Value (MOV) guardrail, incurs excess kilometer delivery surcharge, requests change for a `USh 50,000` banknote, and completes first-time phone verification.

---

### Persona 3: Alex Wandera — The Bazaar Walk-Up Guest (Dine-In Hybrid Mode)
* **Profile:** 22, University student shopping at the bazaar food court.
* **Device:** Samsung Galaxy A12.
* **Location:** Physical Table #4 inside the bazaar stall.
* **Goal:** Quick, low-cost snack without standing in line at the physical counter.
* **Primary Behavior:** Scans laminated table QR code, bypasses delivery address inputs, enjoys `USh 0` delivery fee and `USh 0` MOV, pays via **Airtel Money**.

---

### Persona 4: Chef Musa — The Kitchen Line Operator (High-Stress KDS)
* **Profile:** 42, Veteran grill master managing the tickets on a wall-mounted 10-inch Android tablet.
* **Physical Context:** Hot, steamy, noisy open-flame kitchen. Greasy fingers, visual distance viewing ($> 1.5\text{ m}$).
* **Goal:** Zero missed tickets, rapid order bumping, instant 86-ing when meat runs out.
* **Primary Behavior:** Unlocks Web Audio API on shift start, monitors elapsed ticket timers (Green $\rightarrow$ Amber $\rightarrow$ Red), bumps orders to "Ready for Pickup", toggles busy-mode buffers.

---

### Persona 5: Juma Mukasa — The Motorcycle Boda Rider (Logistics & Proof of Handover)
* **Profile:** 28, Professional courier operating motorcycle plate `UFD 342B`.
* **Device:** Ruggedized Android phone mounted on motorcycle handlebars.
* **Physical Context:** Bright ambient equatorial sunlight, road vibrations, helmet audio.
* **Goal:** Fast claiming of orders, hands-free turn-by-turn navigation, zero cash discrepancies at shift end.
* **Primary Behavior:** Logs in via 4-digit PIN, claims orders atomically from the unclaimed pool, launches Google Maps with one tap, broadcasts GPS telemetry, and demands customer PIN before releasing food.

---

### Persona 6: Mr. Kasule — The Restaurant Owner & General Manager (Control & Audit)
* **Profile:** 51, Owner of Bazaar Flame & Grill.
* **Device:** iPad Pro / Laptop running `/admin`.
* **Goal:** Protect profit margins, eliminate cash leakage across the 5 bikes, and fix live customer mistakes.
* **Primary Behavior:** Adjusts per-km delivery rates, edits incorrect phone numbers on live tickets, and audits the End-of-Day Cash Settlement Ledger.

---

## 3. End-to-End Test Execution Scenarios (Traceability Matrix)

---

### Scenario A: The "Digital Lunch Rush" (Sarah's Happy Path)
**Target:** Verifies menu selection, structured modifiers, zero-fee 5 km threshold, MTN MoMo USSD trigger, live tracking, and PIN handover.

```
[ Step 1: Sarah visits Storefront / ]
   ├── Adds 'Whole Tilapia Flame Combo' (Base: USh 32,000)
   ├── Opens Customization Drawer:
   │     • Selects: [✓] No Onions (Free Omission: USh 0)
   │     • Selects: [+] Extra Garlic Dip (Paid Add-On: +USh 2,000)
   └── Subtotal = USh 34,000

[ Step 2: Checkout /checkout ]
   ├── Drops Map Pin at Plot 14 Lumumba Ave (lat: 0.3245, lng: 32.5782)
   ├── System calls /api/distance -> Returns 3.8 km
   ├── Verification Assertion:
   │     • Road Distance: 3.8 km <= 5.0 km
   │     • Delivery Fee: USh 0 (FREE ZONE BADGE RENDERS GREEN)
   │     • Packaging Fee: USh 1,000
   │     • Total Due: USh 35,000
   ├── Inputs Name: "Sarah Namukasa", Phone: "0772000111"
   ├── Selects: 'MTN Mobile Money'
   └── Clicks [ PAY USh 35,000 VIA MTN MOMO ]

[ Step 3: Webhook & KDS Ingestion ]
   ├── Simulated Webhook POST /api/webhooks/payment:
   │     { tx_ref: "order_token", status: "successful", amount: 35000 }
   ├── Order status mutates: PENDING_PAYMENT -> PREPARING
   ├── Kitchen Tablet: Loud harmonic bell chimes; Ticket #1042 appears in Green queue

[ Step 4: Kitchen Line & Rider Claim ]
   ├── Chef Musa finishes packaging, tags bag with Safety Seal #9482
   ├── Musa taps [ READY FOR PICKUP ] on KDS
   ├── Rider Juma visits /rider -> Sees Order #1042 in pool
   ├── Juma taps [ CLAIM DELIVERY ] -> Locks rider_id = Juma.id
   └── Juma taps [ START TRIP ] -> Telemetry starts streaming

[ Step 5: Living Tracker & Handover ]
   ├── Sarah's screen /orders/[token] shows motorcycle moving on Leaflet map
   ├── Juma arrives at Lumumba Ave; asks: "Please provide your 4-digit code"
   ├── Sarah checks seal #9482, verbally gives PIN: "4821"
   ├── Juma enters '4821' on /rider -> Verification succeeds
   ├── Database Assertion:
   │     • order_status = 'DELIVERED'
   │     • delivered_at IS NOT NULL
   │     • telemetry streaming halts
   └── Sarah's screen transitions to 1-Tap Feedback Modal -> Taps [ 😃 Great ]
```

---

### Scenario B: Distance Surcharge, MOV Guardrail & Cash on Delivery (Brian)
**Target:** Verifies Minimum Order Value blocking, excess distance road calculation, COD change requirement, and rider cash liability logging.

```
[ Step 1: Brian triggers MOV Block ]
   ├── Brian visits / -> Adds 1x Cold-Pressed Passion Juice (USh 5,000)
   ├── Navigates to Cart Dock
   ├── Verification Assertion:
   │     • Subtotal (USh 5,000) < MOV (USh 20,000)
   │     • Checkout Button is DISABLED
   │     • Progress text: "Add USh 15,000 more to unlock delivery."

[ Step 2: Brian fulfills MOV & Pins Ntinda ]
   ├── Adds: 1x Smoked Beef Luwombo (USh 26,000)
   ├── Total Food Subtotal = USh 31,000 (MOV SATISFIED)
   ├── Proceeds to /checkout -> Drops pin at Ntinda Ministers' Village
   ├── System calls /api/distance -> Returns 7.4 km

[ Step 3: Distance Surcharge Calculation Engine ]
   ├── Verification Assertion:
   │     • Total Road Distance: 7.4 km
   │     • Free Allowance: 5.0 km
   │     • Excess Distance: 7.4 - 5.0 = 2.4 km
   │     • Billable Excess (Ceiling Rounding): ceil(2.4) = 3 km
   │     • Rate per Excess Km: USh 1,500
   │     • Delivery Fee: 3 km * USh 1,500 = USh 4,500
   │     • Packaging Fee: USh 1,000
   │     • Final Total: 31,000 + 4,500 + 1,000 = USh 36,500

[ Step 4: Cash on Delivery Checkout ]
   ├── Brian selects: 'Cash on Delivery'
   ├── System displays dropdown: "Do you need change?"
   ├── Brian selects: "Change for USh 50,000"
   ├── First-Time Phone Verification: Inputs SMS code '5544'
   └── Submits Order -> Status: CONFIRMED_UNPAID

[ Step 5: Kitchen & Rider Cash Liability ]
   ├── KDS Ticket flashes amber warning: "COLLECT USH 36,500 CASH (CHANGE FOR 50k)"
   ├── Musa cooks, packs, bumps to READY_FOR_PICKUP
   ├── Juma claims order; completes trip via Handover PIN
   └── Database Ledger Assertion:
         • order_status = 'DELIVERED'
         • payment_status = 'PAID'
         • Juma's un-reconciled cash balance increases by EXACTLY USh 36,500
```

---

### Scenario C: Table QR Dine-In Bypass (Alex)
**Target:** Verifies table parameter parsing, map hiding, zero delivery fee, zero packaging fee, and MOV bypass.

```
[ Step 1: Alex scans Table QR ]
   ├── Browser opens: https://bazaar-eats.com/?table=4
   ├── Verification Assertion:
   │     • Header banner renders: "🍽️ Dine-In: Table 4"
   │     • Leaflet map is NOT mounted in DOM
   │     • Address input fields are REMOVED

[ Step 2: Order Single Low-Cost Item ]
   ├── Alex adds: 1x Special Bazaar Rolex (USh 8,000)
   ├── Verification Assertion:
   │     • Subtotal: USh 8,000
   │     • MOV Guardrail is BYPASSED (Allowed despite USh 8,000 < USh 20,000)
   │     • Delivery Fee: Hardcoded USh 0
   │     • Packaging Fee: USh 0
   │     • Total Due: USh 8,000
   ├── Alex selects: 'Airtel Money' (Phone: 0701000222)
   └── Submits Order -> Webhook confirms payment

[ Step 3: Kitchen Fulfillment ]
   ├── KDS Ticket renders with blue badge: "TABLE 4 [DINE-IN]"
   ├── Musa prepares Rolex
   ├── Musa taps [ SERVED TO TABLE ]
   └── Order transitions directly to 'DELIVERED' (Never enters rider pool)
```

---

### Scenario D: Kitchen Stock-Out & High Rush Buffer (Chef Musa)
**Target:** Verifies instantaneous 86-ing across active client sessions and delivery time buffering.

```
[ Step 1: Musa 86es Tilapia ]
   ├── Musa on /kitchen taps [ 🚫 86 Items ]
   ├── Toggles 'Whole Tilapia Flame Combo' to UNAVAILABLE
   ├── Realtime Sync Assertion:
   │     • Sarah's active storefront immediately grays out the Tilapia card
   │     • Button changes to: [ SOLD OUT ]
   │     • If Tilapia was in a cart, checkout displays:
   │       "Item 'Tilapia Flame Combo' is sold out. Please remove to proceed."

[ Step 2: Musa activates Busy Mode ]
   ├── Walk-in bazaar crowd surges; Musa taps [ ⚠️ Busy Mode (+20 mins) ]
   ├── Settings update: is_kitchen_busy = true, busy_buffer_minutes = 20
   └── Storefront Assertion:
         • All dish prep estimates increase: e.g., "25 mins" -> "45 mins"
         • Delivery tracking displays: "Kitchen experiencing high bazaar demand (+20m buffer)"
```

---

### Scenario E: Concurrency Race Condition — Two Riders Claim Same Order
**Target:** Verifies that row-level locking (`claim_order_atomic`) prevents double allocation.

```
[ Initial State ]
   ├── Order #1042 is READY_FOR_PICKUP with rider_id = NULL
   ├── Rider Juma (Phone A) and Rider David (Phone B) both view /rider

[ Simultaneous Click Execution: T = 0ms ]
   ├── Juma clicks [ CLAIM DELIVERY ] ──(Request arrives at DB at T=12ms)
   └── David clicks [ CLAIM DELIVERY ] ──(Request arrives at DB at T=16ms)

[ Database Execution: claim_order_atomic ]
   ├── Juma's query executes:
   │     UPDATE orders SET rider_id = Juma.id, order_status = 'CLAIMED'
   │     WHERE id = #1042 AND rider_id IS NULL;
   │     --> ROW COUNT: 1 (SUCCESS: Returns TRUE)
   │
   └── David's query executes 4ms later:
         UPDATE orders SET rider_id = David.id, order_status = 'CLAIMED'
         WHERE id = #1042 AND rider_id IS NULL;
         --> ROW COUNT: 0 (LOCK FAILED: Returns FALSE)

[ UI State Assertion ]
   ├── Juma's screen: Transitions immediately to Active Navigation mode
   └── David's screen: Displays high-contrast toast:
         "Order was just claimed by another rider."
         Order #1042 disappears from David's unclaimed pool
```

---

### Scenario F: Handover PIN Challenge & Lockout
**Target:** Verifies brute-force protection on the 4-digit verification gate.

```
[ Initial State: Order #1042 is OUT_FOR_DELIVERY with PIN = '4821' ]

[ Attempt 1: T = 0s ]
   ├── Rider Juma enters: '9999'
   └── Response: { success: false, error: "INVALID_PIN", remainingAttempts: 2 }

[ Attempt 2: T = 5s ]
   ├── Juma enters: '0000'
   └── Response: { success: false, error: "INVALID_PIN", remainingAttempts: 1 }

[ Attempt 3: T = 10s ]
   ├── Juma enters: '1111'
   └── Response: { success: false, error: "MAX_ATTEMPTS_EXCEEDED", remainingAttempts: 0 }

[ State Assertion ]
   ├── Order verification locks
   ├── Order status remains 'OUT_FOR_DELIVERY' (Cannot complete)
   └── Admin Hub (/admin) flashes red alert:
         "SECURITY ALERT: 3 Failed PIN attempts on Order #1042. Manager action required."
```

---

### Scenario G: End-of-Day Rider Cash Balancing & Ledger Reconciliation (Mr. Kasule)
**Target:** Verifies mathematical closure of cash liabilities accumulated across the fleet.

```
[ Context: End of Shift at 21:30 EAT ]
   ├── Rider Juma has completed 7 deliveries today:
   │     • 5 Paid Online via MTN MoMo
   │     • 2 Paid via Cash on Delivery:
   │         - Order #1043: USh 36,500
   │         - Order #1047: USh 27,500
   │     • Total Physical Cash Owed = USh 64,000

[ Execution: /admin/ledger ]
   ├── Mr. Kasule opens End-of-Day Cash Ledger
   ├── Table displays row:
   │     Rider: Juma Mukasa | Plate: UFD 342B | Cash Collected: USh 64,000
   ├── Juma hands over physical banknotes totaling USh 64,000 to Kasule
   ├── Kasule clicks [ RECONCILE & CLEAR RIDER ]
   ├── Database Execution:
   │     INSERT INTO cash_settlements (rider_id, admin_id, total_cash_collected, is_settled, settled_at)
   │     VALUES (Juma.id, Kasule.id, 64000, true, now());
   └── Assertion:
         • Juma's active cash liability balance immediately resets to USh 0
         • Audit log records timestamped reconciliation
```

---

## 4. Automated Playwright E2E Test Blueprint

Agentic builders can translate this TypeScript specification directly into executable Playwright tests (`tests/e2e/order-flow.spec.ts`):

```typescript
import { test, expect } from "@playwright/test";

test.describe("Bazaar D2C Delivery Pipeline", () => {
  test("Persona 1: Complete Happy Path Pre-Paid Delivery", async ({ page, browser }) => {
    // 1. Customer visits storefront and adds Tilapia combo
    await page.goto("/");
    await page.click("text=Whole Tilapia Flame Combo");
    
    // Customization Drawer
    await page.click("text=No Onions");
    await page.click("text=Extra Garlic Dip");
    await page.click("text=Add to Cart");

    // 2. Checkout
    await page.click("text=VIEW CART");
    await page.click("text=PROCEED TO CHECKOUT");

    // Set delivery address (Nakasero 3.8 km)
    await page.fill('input[name="customerName"]', "Sarah Namukasa");
    await page.fill('input[name="customerPhone"]', "0772000111");
    
    // Simulate map pin drop at 3.8 km
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("test:set-coordinates", {
        detail: { lat: 0.3245, lng: 32.5782 }
      }));
    });

    // Verify distance fee calculation
    await expect(page.locator("text=Delivery Fee")).toContainText("USh 0");
    await expect(page.locator("text=TOTAL DUE")).toContainText("USh 37,000");

    // Select MTN MoMo and submit
    await page.click("text=MTN Mobile Money");
    await page.click("button:has-text('PAY USh 37,000 VIA MTN MOMO')");

    // 3. Verify Living Tracker and Handover PIN
    await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+/);
    const pinElement = page.locator("[data-testid='handover-pin']");
    await expect(pinElement).toBeVisible();
    const handoverPin = (await pinElement.textContent())?.trim();
    expect(handoverPin).toHaveLength(4);

    // 4. Kitchen Tablet Context (Second Browser Tab)
    const kitchenContext = await browser.newContext();
    const kitchenPage = await kitchenContext.newPage();
    await kitchenPage.goto("/kitchen");
    await kitchenPage.click("text=Start Shift / Enable Sound");
    
    // Bump order to ready
    await expect(kitchenPage.locator("text=TILAPIA COMBO")).toBeVisible();
    await kitchenPage.click("button:has-text('READY FOR PICKUP')");

    // 5. Rider Context (Third Browser Tab)
    const riderContext = await browser.newContext();
    const riderPage = await riderContext.newPage();
    await riderPage.goto("/rider");
    await riderPage.fill('input[name="pin"]', "1234");
    await riderPage.click("text=LOGIN");

    // Claim order from pool
    await riderPage.click("button:has-text('CLAIM THIS DELIVERY')");
    await riderPage.click("button:has-text('START TRIP')");

    // Enter correct Handover PIN to complete
    await riderPage.click("button:has-text('ENTER 4-DIGIT PIN')");
    await riderPage.fill('input[name="handoverPin"]', handoverPin!);
    await riderPage.click("button:has-text('CONFIRM & COMPLETE')");

    // 6. Verify Customer Screen updates to Delivered
    await expect(page.locator("text=Meal Delivered!")).toBeVisible();
  });
});
```
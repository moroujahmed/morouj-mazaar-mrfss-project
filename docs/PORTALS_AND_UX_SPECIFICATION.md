# PORTALS_AND_UX_SPECIFICATION.md

> **v1.1 normative amendment:** Auth screens, store-closed behavior, dine-in completion, and rider GPS claims are superseded by [`SPEC_AMENDMENTS.md`](SPEC_AMENDMENTS.md), [`API_CONTRACTS.md`](API_CONTRACTS.md), and [`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md).

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved User Experience & Interface Specification
* **Target Environment:** Responsive Web / Progressive Web Application (Single Codebase Next.js)
* **Design Philosophy:** Tactile Realism, Mobile-First Thumb Ergonomics, High Glare Contrast
* **Locale:** Kampala, Uganda (EAT / UTC+3) | Currency: `UGX` (`USh`)

---

## 1. Architectural Route Map & Viewport Roles

The single-codebase application partitions its user experience across six distinct views, each optimized for a specific physical environment:

```
src/app/
├── (storefront)/
│   ├── page.tsx                    ── Public Customer Menu & Instant Search
│   ├── checkout/page.tsx           ── Address Pin-Drop, Distance Fee & Payment
│   └── orders/[token]/page.tsx     ── Living Tracker, Live Map & PIN Display
├── (operations)/
│   ├── kitchen/page.tsx            ── Wall-Mounted KDS, Audio Engine & 86 Toggles
│   ├── rider/page.tsx              ── Handlebar Glance-and-Go, Pool & PIN Entry
│   └── admin/                      ── Management Control Center
│       ├── page.tsx                ── Live Orders & Typo Rectifier
│       ├── menu/page.tsx           ── Dish CRUD & Modifier Settings
│       ├── settings/page.tsx       ── Dynamic 5km Threshold & MOV Sliders
│       └── ledger/page.tsx         ── End-of-Day Rider Cash Settlement
└── ?table=[id]                     ── Dine-In Hybrid Trigger (Query Parameter)
```

---

## 2. Portal 1: Customer Storefront & Checkout (`/` & `/checkout`)

### 2.1 Storefront Layout Hierarchy (`/`)
The storefront is designed for maximum browsing velocity on mobile screens ($360\text{px}$ to $430\text{px}$ width) without requiring sign-up or logins.

```
┌────────────────────────────────────────────────────────┐
│  BAZAAR FLAME & GRILL                [ 🔍 Search dishes ]│ ◄── Top Header (48px)
├────────────────────────────────────────────────────────┤
│  [ All ]  [ 🔥 Combos ]  [ 🍖 Grills ]  [ 🍌 Luwombo ] │ ◄── Horizontal Category Pills
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Image: 60KB WebP]                               │  │ ◄── Dish Card
│  │ Whole Tilapia Flame Combo                        │  │
│  │ Deep-fried or grilled Tilapia + Chips + Juice    │  │
│  │ USh 32,000                       [ + Customize ] │  │ ◄── Primary Action Pill
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Image: 60KB WebP]                               │  │
│  │ Quarter Charcoal Grilled Chicken                 │  │
│  │ Flame-grilled with local herbs & garlic glaze    │  │
│  │ USh 18,000                            [ + Add ]  │  │
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │ ◄── Sticky Thumb Dock
│  │ 🛒 2 Items • USh 50,000       [ VIEW CART ➔ ]   │  │     (Fixed bottom, 56px)
│  └──────────────────────────────────────────────────┘  │     Padding: pb-safe
└────────────────────────────────────────────────────────┘
```

#### Key Component Interactions:
1. **Instant Search Bar:** Fixed at the top. Typing filters items live via client-side search without server re-renders. A clear `[✕]` button resets the filter instantly.
2. **Category Navigation Pills:** Horizontally scrollable row with active pill highlighted in `bg-brand-terracotta text-white`. Tapping a category auto-scrolls the viewport directly to that section header.
3. **Item Modifiers Bottom Sheet:** Clicking `[ + Customize ]` opens a native-feeling mobile drawer sliding up from the bottom:
   * **Section 1: Cooking Preference (Radio Group):** `Normal Salt` vs `Light Salt` | `Mild` vs `Hot Chili`.
   * **Section 2: Free Omissions (Multi-Select Chips):** `[✓] No Onions`, `[✓] No Pepper`.
   * **Section 3: Paid Upgrades (Counter/Add-On):** `[+] Extra Garlic Dip (+USh 2,000)`.
   * **Sticky CTA:** Full-width bottom button: `[ Add to Cart • USh 34,000 ]`.

---

### 2.2 The Checkout Experience (`/checkout`)
The checkout flow eliminates traditional form clutter, focusing purely on delivery location and payment verification.

```
┌────────────────────────────────────────────────────────┐
│  ← Back to Menu                       CHECKOUT (1/2)   │
├────────────────────────────────────────────────────────┤
│  1. DELIVERY PIN-DROP                                  │
│  ┌──────────────────────────────────────────────────┐  │ ◄── Leaflet Interactive Map
│  │                       📍 [Drag Pin to House]     │  │     Height: 220px
│  │   [ OpenStreetMap Tiles ]                        │  │     Center: Kampala Bazaar
│  └──────────────────────────────────────────────────┘  │
│  📍 Pinned: Plot 14 Lumumba Ave, Nakasero (3.8 km)     │
│  🚚 Delivery Fee: USh 0 (Within Free 5 km Zone!)       │
├────────────────────────────────────────────────────────┤
│  2. YOUR CONTACT                                       │
│  Name:  [ Sarah Namukasa                             ] │
│  Phone: [ +256 772 000 111                           ] │
│  Notes: [ Gate code 1234, call when at the gate      ] │
├────────────────────────────────────────────────────────┤
│  3. PAYMENT METHOD                                     │
│  (•) MTN Mobile Money      ( ) Airtel Money            │
│  ( ) Cash on Delivery      ( ) Visa / Mastercard       │
│                                                        │
│  [ If COD Selected: "Do you need change for?" ]        │
│  [ Dropdown: Exact Cash | USh 50,000 Bill          ▼ ] │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │ ◄── Sticky Pay CTA
│  │ PAY USh 34,000 VIA MTN MOMO                      │  │     (Height: 52px, AAA Contrast)
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### Map Pin-Drop Specifications:
* **Leaflet Viewport:** Rendered with OpenStreetMap raster tiles. A fixed center crosshair pin sits over the map. Dragging or panning the map updates the underlying coordinates dynamically.
* **Debounced OSRM Distance Trigger:** Releasing the map pan triggers an automated debounced ($400\text{ms}$) call to `/api/distance`.
* **Dynamic Fee Badge:**
  * If distance $\le 5.0\text{ km}$: Renders `text-status-success`: *"Delivery: USh 0 (Free 5 km Zone)"*.
  * If distance $> 5.0\text{ km}$: Renders `text-ink-primary`: *"Delivery: USh [Fee] ([Excess] km beyond free zone)"*.
  * If distance $> 15.0\text{ km}$: Disables checkout button, turns map border red, displays: *"Outside our fresh 15 km delivery zone."*

---

## 3. Portal 2: The Living Order Tracker (`/orders/[token]`)

Accessed immediately following successful checkout. This page acts as the customer's permanent real-time receipt and progress dashboard.

```
┌────────────────────────────────────────────────────────┐
│  BAZAAR FLAME & GRILL               ORDER #1042        │
├────────────────────────────────────────────────────────┤
│  ●────────────●────────────●────────────○────────────○ │ ◄── Visual Milestone Bar
│ Received   Confirmed    Cooking     On Road  Delivered │
│ Estimated Arrival: 13:15 EAT (22 Mins Remaining)       │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │ ◄── Live Tracking Map
│  │                      📍 (Destination)            │  │     Rendered when status =
│  │               🛵 (Rider Juma moving)             │  │     'OUT_FOR_DELIVERY'
│  │   [ Live Leaflet View ]                          │  │
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │ ◄── Security Handover Box
│  │  HANDOVER PIN: [ 4 8 2 1 ]                       │  │     (Mono font, 24px)
│  │  ⚠️ Check package safety seal before sharing PIN  │  │
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  THE LIVING DOCKET                                     │
│  1x Whole Tilapia Combo                     USh 32,000 │
│     • [NO ONIONS]                                      │
│     • Extra Garlic Dip                      USh  2,000 │
│  Delivery Fee (3.8 km):                         USh  0 │
│  TOTAL PAID (MTN MoMo):                     USh 34,000 │
├────────────────────────────────────────────────────────┤
│  [ 💬 Help with this Order? Chat on WhatsApp ]         │ ◄── Floating Concierge Link
└────────────────────────────────────────────────────────┘
```

### 3.1 Handover PIN Display Box
* Border: `border-2 border-dashed border-ink-primary bg-surface-inset`.
* Prominently displays the 4-digit code generated at order creation.
* Explanatory Micro-Copy: *"Give this 4-digit code to Rider Juma only after you have inspected your food and confirmed the safety sticker seal is unbroken."*

### 3.2 Post-Delivery Feedback Modal
The moment the rider submits the matching PIN, the screen transitions smoothly into an instantaneous feedback card:
```
┌────────────────────────────────────────────────────────┐
│  🎉 Meal Delivered! How was your experience?           │
│                                                        │
│     [ 😃 Great ]       [ 😐 Okay ]       [ 🙁 Bad ]    │
│                                                        │
│  [ Optional note for the manager...                  ] │
│  [ SUBMIT FEEDBACK ]                                   │
└────────────────────────────────────────────────────────┘
```

---

## 4. Portal 3: Kitchen Display System (`/kitchen`)

The KDS is engineered for wall-mounted 10-inch Android tablets operating in high-heat, steamy, ambient noise environments.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  KDS ── BAZAAR FLAME & GRILL        [ 🔔 Sound Active ]  [ ⚠️ Busy Mode: OFF ]       │ ◄── Header Bar
├──────────────────────────┬──────────────────────────┬────────────────────────────────┤
│ TICKET #1042    [ 08:14 ]│ TICKET #1043    [ 16:42 ]│ TICKET #1044          [ 24:10 ]│
│ Nakasero (Delivery)      │ Table 4 (Dine-In)        │ Ntinda (Delivery)              │
├──────────────────────────┼──────────────────────────┼────────────────────────────────┤
│ 1x TILAPIA COMBO         │ 2x SPECIAL ROLEX         │ 1x BEEF LUWOMBO                │
│    * NO ONIONS *         │    * EXTRA CHILI *       │    * MATOOKE EXTRA *           │
│    * EXTRA PEPPER *      │                          │ 1x PASSION JUICE               │
│ 1x PASSION JUICE         │                          │                                │
├──────────────────────────┼──────────────────────────┼────────────────────────────────┤
│ [ READY FOR PICKUP ]     │ [ SERVED TO TABLE ]      │ [ READY FOR PICKUP ] (LATE!)   │ ◄── 52px Bump Button
│ (Green Timer: 0-10m)     │ (Amber Timer: 10-20m)    │ (Flashing Red Timer: >20m)     │
└──────────────────────────┴──────────────────────────┴────────────────────────────────┘
```

### 4.1 Audio Engine User-Gesture Unlock
To comply with browser autoplay security restrictions:
* If the tablet loads or reboots, an overlay covers the screen:
  `[ 🔔 TAP TO START SHIFT & ENABLE SOUND ALERTS ]`
* Tapping this initializes an `AudioContext` using programmatic Web Audio API synthesizers. Subsequent incoming orders trigger a dual-tone chime (`880Hz` $\rightarrow$ `1760Hz`) that repeats every 15 seconds until the ticket is acknowledged.

### 4.2 Quick-Action 86-ing (Stock-Out) Drawer
* Floating header button: `[ 🚫 86 Items ]`.
* Tapping opens a quick-toggle list of all menu items. Toggling an item to `Unavailable` immediately strikes it from customer storefronts via Supabase Realtime without refreshing.

---

## 5. Portal 4: Rider Fleet Portal (`/rider`)

Engineered specifically for smartphone mounts on motorcycle handlebars under bright sunlight. Features oversized touch targets ($56\text{px}$) and high-contrast status cards.

```
┌────────────────────────────────────────────────────────┐
│  RIDER: JUMA (UFD 342B)                [ Status: Active ]│
├────────────────────────────────────────────────────────┤
│  AVAILABLE UNCLAIMED POOL (2)                          │
│  ┌──────────────────────────────────────────────────┐  │ ◄── Claim Card
│  │ ORDER #1042 ── NAKASERO (3.8 km)                 │  │
│  │ Items: 1x Tilapia Combo, 1x Juice                │  │
│  │ Payment: PREPAID (MTN MoMo)                      │  │
│  │ [ 🛵 CLAIM THIS DELIVERY ]                       │  │ ◄── Atomic Lock Action
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  ACTIVE ASSIGNED DELIVERY                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ TO: Sarah Namukasa (0772 000 111)                │  │
│  │ Plot 14 Lumumba Ave, Nakasero                    │  │
│  │                                                  │  │
│  │ ⚠️ COLLECT USH 35,600 CASH (Change for 50k)      │  │ ◄── High-Vis Amber Banner
│  │                                                  │  │
│  │ [ 🗺️ LAUNCH GOOGLE MAPS NAVIGATION ]             │  │ ◄── 56px Tall Direct Action
│  │                                                  │  │
│  │ [ 🔑 ENTER 4-DIGIT CUSTOMER PIN ]                │  │ ◄── Completion Gate
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 5.1 Proof-of-Delivery PIN Modal
When the rider taps `[ 🔑 ENTER 4-DIGIT CUSTOMER PIN ]`:
* A clean numerical keypad opens:
  ```
  ┌─────────────────────────┐
  │  Enter Customer PIN:    │
  │     [ _ ] [ _ ] [ _ ] [ _ ]     │
  │   [ 1 ]   [ 2 ]   [ 3 ] │
  │   [ 4 ]   [ 5 ]   [ 6 ] │
  │   [ 7 ]   [ 8 ]   [ 9 ] │
  │           [ 0 ]   [ ⌫ ] │
  │  [ CONFIRM & COMPLETE ] │
  └─────────────────────────┘
  ```
* **Success:** Triggers device vibration `[20ms, 50ms, 20ms]`, marks order `DELIVERED`, closes modal, and refreshes rider cash liability balance.
* **Failure:** Triggers warning buzz `[60ms, 40ms, 60ms]`, flashes red border: *"Incorrect PIN. 2 attempts remaining."*

---

## 6. Portal 5: Admin Management Hub (`/admin`)

The central operational dashboard for the restaurant owner or general manager.

### 6.1 Sub-Route Navigation
* `/admin` — Live Order Monitor & Real-Time Typo Rectifier.
* `/admin/menu` — Visual Menu CRUD, Modifier Price Adjustment & Combos.
* `/admin/settings` — Free Delivery Radius, Excess Per-Km Surcharge, MOV, and Hours.
* `/admin/ledger` — End-of-Day Rider Cash Balancing & Settlement.

### 6.2 The Live Order Typo Rectifier (`/admin`)
Allows the manager to rectify customer mistakes on active orders without canceling:

```
┌────────────────────────────────────────────────────────┐
│  EDIT ACTIVE ORDER #1042                               │
├────────────────────────────────────────────────────────┤
│  Customer Name:  [ Sarah Namukasa                    ] │
│  Phone Number:   [ +256 772 000 111                  ] │ ◄── Corrects digit typos
│  Drop-Off Notes: [ Changed to: Gate 2 on Lumumba     ] │
│  Delivery Pin:   [ Adjust Pinned Location on Map ]     │ ◄── Updates coordinates
├────────────────────────────────────────────────────────┤
│  [ SAVE & SYNC TO RIDER SCREEN ]                       │
└────────────────────────────────────────────────────────┘
```
* Tapping **Save** pushes real-time updates directly to Rider Juma's phone view while he is in transit.

### 6.3 End-of-Day Rider Cash Settlement Ledger (`/admin/ledger`)
Displays un-reconciled physical paper cash liabilities accumulated across the 5 motorcycles:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  END-OF-DAY CASH RECONCILIATION ── OCTOBER 29, 2026                                    │
├──────────────────┬─────────────────┬─────────────────┬──────────────────┬──────────────┤
│ Rider Name       │ Boda Plate      │ Total Completed │ Cash Collected   │ Action       │
├──────────────────┼─────────────────┼─────────────────┼──────────────────┼──────────────┤
│ Juma Mukasa      │ UFD 342B        │ 7 Deliveries    │ USh 64,000       │ [ RECONCILE ]│
│ David Ochieng    │ UEX 119A        │ 5 Deliveries    │ USh 35,600       │ [ RECONCILE ]│
│ Brian Kato       │ UEE 902C        │ 8 Deliveries    │ USh 112,000      │ [ RECONCILE ]│
│ Samuel Ssebo     │ UFA 450P        │ 6 Deliveries    │ USh 0 (All MoMo) │ [ CLEARED ]  │
│ Alex Wandera     │ UFD 881M        │ 4 Deliveries    │ USh 28,000       │ [ RECONCILE ]│
├──────────────────┴─────────────────┴─────────────────┴──────────────────┴──────────────┤
│ TOTAL PHYSICAL CASH DUE TO CASH DRAWER: USh 239,600                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
* Clicking `[ RECONCILE ]` confirms the manager physically took the paper money, logs a permanent audit entry in `cash_settlements`, and resets that rider's active cash liability to zero.

---

## 7. Portal 6: Dine-In Hybrid Table Mode (`/?table=[id]`)

When a customer scans a table QR code inside the bazaar (e.g., `https://bazaar-eats.com/?table=4`), the storefront adapts dynamically:

### UI Adaptations:
1. **Persistent Header Pill:** Displays `🍽️ Dine-In: Table 4` at the top of the storefront.
2. **Hidden Delivery Map & Address Picker:** The entire Leaflet map, address input, and distance calculator are removed from the DOM.
3. **Delivery Fee Zeroed:** Delivery fee is strictly set to **`USh 0`**.
4. **Bypass MOV:** The Minimum Order Value guardrail is deactivated (`MOV = USh 0`). Customers can order a single Rolex (`USh 8,000`) to their table.
5. **Kitchen Ticket Labeling:** The kitchen KDS displays the ticket with a bright blue badge: `TABLE 4 [DINE-IN]`. The ticket bypasses the motorcycle rider pool completely upon completion.
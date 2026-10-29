# SYSTEM_OVERVIEW.md

> **v1.1 normative amendment (2026-10-29):** This v1.0 document is retained for product context. Pricing, routing, cost, and topology statements are superseded by [`SPEC_AMENDMENTS.md`](SPEC_AMENDMENTS.md), [`DECISIONS.md`](DECISIONS.md), and [`CANONICAL_EXAMPLES.md`](CANONICAL_EXAMPLES.md).

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved Architecture Draft
* **System Code:** `PROJECT-BAZAAR-D2C`
* **Target Environment:** Mobile-First Responsive Web Application (Progressive Web Architecture)
* **Geographic & Economic Context:** Kampala, Uganda (East Africa)
* **Primary Currency:** Ugandan Shillings (`UGX`, symbol: `USh`)
* **Primary Payment Rails:** Mobile Money (MTN MoMo, Airtel Money), Cash on Delivery (COD), Visa/Mastercard

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Urban restaurant vendors operating out of high-density retail markets, food courts, and bazaars face an unsustainable operational paradox:
1. **Third-Party Aggregator Trap:** Commercial delivery platforms (e.g., Glovo, Bolt Food, Jumia Food) extract between **20% and 30% in direct merchant commissions** on every transaction. They intercept the customer relationship, withhold customer phone numbers and dining analytics, and enforce arbitrary promotional discounting that erodes the restaurant's margins.
2. **The "WhatsApp / Phone Call" Chaos:** Direct ordering alternatives managed informally via phone calls or chat apps result in catastrophic operational inefficiencies:
   * Kitchen cooks mishear verbal customer modifications (e.g., allergies, omissions, spice preferences).
   * Delivery riders get lost due to informal street naming and vague directions (*"turn left by the yellow container"*), resulting in delayed drops and cold food.
   * Delivery fee negotiations are friction-heavy, leaving riders underpaid or customers feeling exploited.
   * Cash collected by riders is manually tracked on paper, causing substantial end-of-day cash reconciliation leaks.

### 1.2 The Strategic Solution
`PROJECT-BAZAAR-D2C` is an enterprise-grade, single-codebase web application suite engineered to establish an independent, direct-to-consumer digital ordering and delivery pipeline. 

The platform connects customer storefronts, live GPS order tracking, a kitchen display system (KDS), an automated motorcycle delivery fleet dispatch pool, and an administrative reconciliation engine into a **single, unified real-time system with zero ongoing third-party SaaS subscription costs**.

```
                           ┌─────────────────────────────────────────┐
                           │      Single Unified Next.js Engine      │
                           └────────────────────┬────────────────────┘
                                                │
         ┌───────────────────────┬──────────────┴──────────────┬───────────────────────┐
         ▼                       ▼                             ▼                       ▼
  [ / Storefront ]       [ /kitchen KDS ]             [ /rider Portal ]        [ /admin Hub ]
  • Dynamic Menu         • Real-Time Order Queue      • Unclaimed Pool         • Menu & Modifiers
  • OSRM Fee Engine      • Audio Chime Engine         • 1-Tap Google Maps      • Cash Ledger Audit
  • Pin-Drop Map         • "Busy Mode" Buffer         • GPS Coordinate Stream  • Dynamic Rules
  • Table QR Mode        • Stock Out (86) Toggles     • Handover PIN Gate      • Live Order Edit
```

---

## 2. Core Commercial & Delivery Economics

### 2.1 The Distance-Tiered Fee Engine
To outcompete food aggregators while safeguarding unit economics, the restaurant deploys an automated distance-based delivery calculator using real-world road network calculations (strictly avoiding straight-line Euclidean/Haversine approximations):

* **Tier 1 (Hyper-Local Zone: $0 \le d \le 5.0\text{ km}$):** 
  * **Delivery Fee:** **`USh 0` (Completely Free of Charge)**.
  * **Objective:** Capture hyper-local market share within high-density commercial and residential sectors surrounding the bazaar.
* **Tier 2 (Extended Delivery Zone: $5.0\text{ km} < d \le 15.0\text{ km}$):** 
  * **Delivery Fee:** Calculated per excess kilometer beyond the initial 5.0 km threshold at an administratively adjustable rate $\text{Rate}_{\text{per\_km}}$ (Baseline: `USh 1,500` to `USh 2,000` per km).
  * **Rounding Rule:** Excess distance $(d - 5)$ is rounded up to the nearest whole kilometer ($0.1\text{ km}$ increments round up) to prevent awkward fractional accounting and ensure full driver fuel compensation.
* **Tier 3 (Service Ceiling: $d > 15.0\text{ km}$):**
  * **Hard Cutoff:** The system explicitly forbids order placement for drops beyond 15.0 km.
  * **System Action:** Disables checkout button, marks the delivery zone as out-of-reach, and presents an informative toast: *"Location is outside our fresh delivery zone to guarantee meal temperature."*

#### Delivery Fee Mathematical Specification
$$\text{Fee}_{\text{delivery}} = \begin{cases} 0 & \text{if } d_{\text{road}} \le 5.0\text{ km} \\ \lceil d_{\text{road}} - 5.0 \rceil \times \text{Rate}_{\text{per\_km}} & \text{if } 5.0\text{ km} < d_{\text{road}} \le 15.0\text{ km} \\ \infty \text{ (Blocked)} & \text{if } d_{\text{road}} > 15.0\text{ km} \end{cases}$$

### 2.2 Financial Safeguard: Minimum Order Value (MOV)
A free 5.0 km delivery for a low-cost item (e.g., a single soft drink priced at `USh 3,000`) represents a net loss on driver fuel and packaging.
* **Global Delivery MOV:** The baseline Minimum Order Value required to unlock delivery is set to **`USh 20,000`**.
* **Cart Enforcement:**
  * If $\text{Subtotal} < \text{MOV}$, the checkout button is disabled.
  * The cart UI renders an active progress bar: 
    $$\text{Remaining} = \text{MOV} - \text{Subtotal}$$
    Displaying: *"Add USh [Remaining] more to unlock delivery."*
* **Dine-In Exception:** When ordering via Table QR Mode at the bazaar, $\text{MOV} = \text{USh } 0$.

### 2.3 The Master Order Pricing Pipeline
Every order total is calculated on the server side using the following immutable formula:
$$\text{Total Due} = \text{Subtotal}_{\text{items}} + \sum \text{Price}_{\text{modifiers}} + \text{Fee}_{\text{packaging}} + \text{Fee}_{\text{delivery}} - \text{Discount}_{\text{promo}}$$

---

## 3. Physical Fleet & Logistics Topology

### 3.1 The 5-Motorcycle (Boda-Boda) Fleet
The restaurant maintains an in-house delivery fleet of **five (5) dedicated motorcycles**. The software platform is designed around the physical operational boundaries of this fleet.

#### Fleet Turnaround Cycle (Per Order Drop)
1. **Kitchen Staging & Packaging:** 5 minutes
2. **Outbound Transit (City traffic, 5–8 km avg):** 15–20 minutes
3. **Arrival, Contact & PIN Verification Handover:** 5–10 minutes
4. **Return Transit to Bazaar Base:** 15–20 minutes
* **Average Total Cycle Time:** **40 to 55 minutes per rider per trip.**

#### Fleet Capacity Modeling

| Metric | Single Rider Capacity | 5-Rider Active Fleet Capacity |
| :--- | :--- | :--- |
| **Throughput (Single-Drop Trips)** | 1.2 to 1.5 deliveries / hour | **6 to 8 deliveries / hour** |
| **Throughput (Batched / Clustered Drops)** | 2.0 deliveries / hour | **10 to 12 deliveries / hour** |
| **Shift Output (8-Hour Operational Day)** | 10 to 12 deliveries / day | **50 to 60 deliveries / day** |

### 3.2 Physical Staging & Quality Standards
* **Thermal Compartments:** All five motorcycles are fitted with insulated delivery boxes.
* **Tamper-Evident Safety Seals:** All bags must be physically sealed with numbered sticker seals before leaving the kitchen. The customer's digital tracker explicitly instructs the customer to confirm the seal is intact prior to releasing the 4-digit handover PIN to the rider.

---

## 4. Payment Infrastructure & Settlement Flows

The platform accommodates three core payment channels natively:

```
                                [ Customer Checkout ]
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
    [ Mobile Money ]                [ Bank Card ]                 [ Cash on Delivery ]
   MTN MoMo / Airtel Money         Visa / Mastercard             Physical Paper Currency
            │                             │                             │
    USSD Push Prompt              3D-Secure Modal               SMS/OTP Verification
   (Instant Real-Time)            (Standard Gateway)             + Change Calculation
            │                             │                             │
            └──────────────┬──────────────┘                             ▼
                           ▼                               [ Mark: UNPAID - COLLECT CASH ]
               [ Mark: PAID DIGITALLY ]                                 │
                           │                                            │
                           └──────────────────────┬─────────────────────┘
                                                  ▼
                                    [ Dispatch to Kitchen KDS ]
```

### 4.1 Mobile Money (MoMo) — Primary Rail
* **Integration Strategy:** Automated USSD Push notification to customer handsets via regional payment aggregators (e.g., Flutterwave, Paystack, or direct telecom merchant APIs).
* **Execution Flow:** Customer enters their mobile number (`077X...` or `070X...`). The system triggers an instant USSD popup on their physical device requesting their Mobile Money PIN.
* **Settlement State:** Webhook fires $\rightarrow$ database updates `payment_status` to `PAID` $\rightarrow$ ticket immediately flashes on Kitchen Display. Zero manual payment validation required.

### 4.2 Cash on Delivery (COD) — High Volume / High Risk
To mitigate fake orders and driver safety hazards:
* **First-Time Verification:** First-time cash customers must pass a frictionless 1-time SMS/OTP verification before the order enters the kitchen queue.
* **The "Need Change?" Requirement:** Customer must select their expected cash denomination from a structured dropdown:
  * *Exact Amount*
  * *Change for USh 20,000*
  * *Change for USh 50,000*
* **Driver Balance Ledger:** Cash orders automatically post an outstanding balance to the claiming rider's internal profile. The rider remains financially liable for that physical cash until settled with the restaurant manager at shift closing.

### 4.3 Bank Cards (Visa / Mastercard)
* Served via a secure hosted checkout iframe or redirect. Funds settle via standard merchant clearing (T+1 / T+2).

---

## 5. System Personas & User Journeys

### 5.1 Persona 1: The Customer
* **Access Mode:** Responsive Mobile Web (Zero App Store installs, zero forced passwords).
* **Core Actions:**
  * Browses visual menu categorized with dietary tags and clear price badges.
  * Builds meal combinations (Combos) using a 3-step visual builder.
  * Customizes items via structured preference chips (`No Onions`, `Extra Pepper (+USh 1,000)`).
  * Drops an exact GPS pin on a Leaflet/OpenStreetMap interface.
  * Monitors order progress on an in-app Living Tracker displaying a moving motorcycle icon.
  * Receives a secure **4-digit Handover PIN** to present to the driver upon physical receipt.

### 5.2 Persona 2: The Kitchen Line Cook
* **Access Mode:** Dedicated, wall-mounted 10-inch Android Tablet running `/kitchen`.
* **Core Actions:**
  * Taps **“Start Shift / Enable Sound”** to unlock the browser's Web Audio API context.
  * Receives incoming tickets with distinct audio chimes and high-contrast color coding.
  * Toggles items `In Stock` / `Out of Stock (86)` with a single tap.
  * Activates **“Busy Mode”** (+15 to +30 min buffer) when walk-in bazaar traffic spikes.
  * Bumps orders across phases: `[ Accept ]` $\rightarrow$ `[ Ready for Pickup ]`.

### 5.3 Persona 3: The Motorcycle Boda Rider
* **Access Mode:** Smartphone mounted on motorcycle handlebars running `/rider`.
* **Core Actions:**
  * Authenticates using a low-friction 4-digit driver PIN.
  * Views the **Unclaimed Delivery Pool** and claims available orders.
  * Taps **“Navigate”** to deep-link directly into native Google Maps or Waze with exact coordinates.
  * Taps **“Start Delivery”** to initiate background HTML5 GPS broadcasting every 10–15 seconds.
  * Demands the 4-digit Handover PIN from the customer; inputs it into the portal to complete the job and clear the delivery.

### 5.4 Persona 4: The Restaurant Owner / Manager
* **Access Mode:** Tablet or Desktop running `/admin`.
* **Core Actions:**
  * Modifies menu items, prices, active categories, and combo configurations.
  * Adjusts delivery rules: free radius threshold, per-km surcharge, and Minimum Order Values.
  * Rectifies live customer mistakes (edits phone numbers or adjusts drop pins on active tickets).
  * Audits the **End-of-Day Rider Cash Settlement Ledger** to collect physical cash from all 5 drivers before closing registers.

---

## 6. Architectural Topology & System Boundaries

### 6.1 The Single-Codebase Monolith
To ensure development velocity, low resource consumption, and rapid maintenance for a solo developer, the entire ecosystem is built as a **Single Next.js Application** utilizing route-based role segregation:

```
src/app/
├── (storefront)/              # Public Customer Experience
│   ├── page.tsx               # Menu, Instant Search, Cart & Map Pin-Drop
│   └── orders/[token]/        # The Living Order Tracker & Real-Time Map
├── (operations)/              # Internal Restaurant Staff Operations
│   ├── kitchen/               # High-Glance Kitchen Display System (KDS)
│   ├── rider/                 # Rider Self-Dispatch Pool & Trip Engine
│   └── admin/                 # Management Hub, Audits & Reconciliation
└── api/                       # API Route Handlers & Webhooks
    ├── webhooks/payment/      # MoMo / Card Inbound Payment Callbacks
    ├── routing/distance/      # OSRM Road Distance Proxy
    └── verification/pin/      # Ephemeral Handover PIN Validation
```

### 6.2 Data Flow & Real-Time Synchronization Engine
All real-time communication between the four interfaces is orchestrated via **Supabase Realtime (PostgreSQL CDC - Change Data Capture)** over WebSockets:

```
[ Customer Places Order ] ──> [ Database: Insert 'orders' ]
                                          │
                                 (Realtime WebSocket)
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             ▼                            ▼                            ▼
   [ Kitchen Tablet ]             [ Rider Screen ]           [ Customer Tracker ]
   Chime sounds instantly;        Order appears in           Receipt initializes;
   Ticket appears on screen       "Available Deliveries"     Pin is generated
```

---

## 7. Operational Environment & Infrastructure Constraints

### 7.1 Low-Bandwidth & 3G Network Optimization
Because mobile data in urban Uganda is variable and cellular towers frequently drop connections in crowded markets:
* **Image Compression:** All food imagery must be pre-converted to modern **WebP format** with aggressive 80% lossy compression (file size target: $< 60\text{ KB}$ per dish).
* **Optimistic UI:** Cart additions, status toggles, and ticket bumping must update the UI instantly (optimistically) before server roundtrips complete.
* **Payload Economy:** Real-time location packets sent by riders consist only of two float numbers: `{"lat": 0.3476, "lng": 32.5825, "heading": 180}`. Total network usage: $< 2\text{ MB}$ per 8-hour rider shift.

### 7.2 Zero-Cost Open Infrastructure
The platform explicitly excludes proprietary, metered APIs that introduce unpredictable monthly expenses:
* **Maps:** OpenStreetMap (OSM) vector/raster tiles served via Leaflet.js (**$0/month**).
* **Routing:** Open Source Routing Machine (OSRM) driving profile API (**$0/month**).
* **Database & Auth:** Supabase Free/Pro Tier (**$0 to $25/month flat**).
* **Hosting:** Vercel or Netlify edge network (**$0/month within standard bandwidth**).

---

## 8. Definition of Success & System Health Metrics

The system implementation is deemed production-ready when the following operational standards are satisfied:

1. **Delivery Fee Precision:** 100% of delivery fees within 5.0 km road distance calculate to `USh 0`; all points beyond calculate strictly according to the agreed per-km excess formula.
2. **Order Turnaround Velocity:** Average duration between customer checkout and kitchen receipt display is $< 1.5\text{ seconds}$.
3. **Kitchen Sound Reliability:** Kitchen chimes ring reliably 100% of the time upon order receipt once the shift audio context is initialized.
4. **Zero Cash Discrepancies:** Daily reconciliation between total physical cash collected by riders and the owner's cash register balance matches to within `USh 0` tolerance.
5. **Zero Lost Riders:** Riders reach the destination pin without making more than one clarifying phone call to the customer.
# STEP_BY_STEP_IMPLEMENTATION_PLAN.md

> **v1.1 normative amendment:** File paths, phase gates, and provider references are superseded by [`../README.md`](../README.md), [`TEST_PLAN.md`](TEST_PLAN.md), and [`DECISIONS.md`](DECISIONS.md). Acknowledge the founder gates in [`AUDIT_REPORT.md`](AUDIT_REPORT.md) §12 before Phase 1.

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Master Execution Blueprint
* **Target Audience:** Antigravity Agentic Builders & Lead Software Engineers
* **Execution Paradigm:** Phased, Test-Driven, Contract-Verified Development
* **Zero-Guesswork Mandate:** Agents must complete each phase sequentially, running all verification gates before progressing to the subsequent phase.

---

## Master Phase Execution Overview

```
[ Phase 1: Project Foundation & Environment Setup ]
                     │
                     ▼
[ Phase 2: Database Provisioning, Schema & RLS Policies ]
                     │
                     ▼
[ Phase 3: Design System Tokens & Custom UI Kit ]
                     │
                     ▼
[ Phase 4: Customer Storefront, Menu & Cart Engine ]
                     │
                     ▼
[ Phase 5: Map Engine, Pin-Drop & OSRM Distance Surcharge ]
                     │
                     ▼
[ Phase 6: Server-Side Zero-Trust Order Pipeline ]
                     │
                     ▼
[ Phase 7: The Living Order Tracker & Real-Time Sync ]
                     │
                     ▼
[ Phase 8: Kitchen Display System (KDS) & Audio Engine ]
                     │
                     ▼
[ Phase 9: Rider Fleet Portal & HTML5 Telemetry Relay ]
                     │
                     ▼
[ Phase 10: Admin Control Hub & Cash Reconciliation Ledger ]
                     │
                     ▼
[ Phase 11: Table QR Dine-In Hybrid Mode ]
                     │
                     ▼
[ Phase 12: E2E Playwright Suite, Performance & Security Audit ]
```

---

## Phase 1: Project Foundation & Environment Setup

### 1.1 Objective
Initialize a clean, production-grade Next.js App Router repository with TypeScript strict mode, Tailwind CSS compilation, and required zero-cost dependencies.

### 1.2 File Manifest
* `package.json`
* `tsconfig.json`
* `next.config.mjs`
* `postcss.config.mjs`
* `tailwind.config.ts`
* `.env.example`
* `.env.local`
* `src/lib/utils.ts`

### 1.3 Execution Directives
1. **Initialize Project:**
   ```bash
   npx create-next-app@latest . \
     --typescript \
     --tailwind \
     --eslint \
     --app \
     --src-dir \
     --import-alias "@/*" \
     --use-npm
   ```
2. **Install Locked Dependencies:**
   ```bash
   npm install @supabase/supabase-js@^2.43.0 @supabase/ssr@^0.3.0 \
     zustand@^4.5.2 zod@^3.23.8 lucide-react@^0.390.0 \
     clsx@^2.1.1 tailwind-merge@^2.3.0 date-fns@^3.6.0 leaflet@^1.9.4
   npm install -D @types/leaflet@^1.9.12 @playwright/test@^1.44.0
   ```
3. **Configure TypeScript:** Ensure `tsconfig.json` has `strict: true`, `noImplicitAny: true`, and `target: "ES2022"`.
4. **Configure Image Optimization (`next.config.mjs`):** Add `deviceSizes`, `imageSizes`, and WebP/AVIF format declarations matching `01_TECH_STACK_AND_CONVENTIONS.md`.
5. **Setup `cn()` Helper (`src/lib/utils.ts`):** Export `cn(...inputs: ClassValue[])` combining `clsx` and `tailwind-merge`.

### 1.4 Verification & Exit Criteria
* Command `npm run build` succeeds with zero TypeScript or linting errors.
* Development server boots cleanly via `npm run dev` at `http://localhost:3000`.

---

## Phase 2: Database Provisioning, Schema & RLS Policies

### 2.1 Objective
Deploy the complete PostgreSQL schema, custom ENUMs, relational constraints, triggers, Row Level Security (RLS) policies, and seed data into Supabase.

### 2.2 File Manifest
* `supabase/migrations/20261029000000_initial_schema.sql`
* `supabase/seed.sql`
* `src/types/database.types.ts`
* `src/lib/supabase/client.ts`
* `src/lib/supabase/server.ts`
* `src/lib/supabase/admin.ts`

### 2.3 Execution Directives
1. **Migration File Creation:** Copy the complete SQL DDL from `03_DATABASE_SCHEMA_AND_RLS.md` into `supabase/migrations/20261029000000_initial_schema.sql`:
   * Custom ENUMs (`order_status`, `payment_method`, etc.).
   * Tables: `profiles`, `categories`, `menu_items`, `item_modifiers`, `orders`, `order_items`, `order_item_modifiers`, `rider_telemetry`, `cash_settlements`, `app_settings`.
   * Triggers: `handle_updated_at()`, `generate_handover_pin()`.
   * RLS policies and helper functions (`is_admin`, `is_staff`, `is_rider`).
2. **Seed Data Insertion:** Place the seed script from `03_DATABASE_SCHEMA_AND_RLS.md` into `supabase/seed.sql`.
3. **Generate Typed Schema:**
   * Generate `src/types/database.types.ts` matching the Supabase tables.
4. **Initialize Supabase Clients:**
   * `client.ts`: Uses `createBrowserClient` from `@supabase/ssr`.
   * `server.ts`: Uses `createServerClient` reading cookies for Server Components and Server Actions.
   * `admin.ts`: Uses `createClient` with `SUPABASE_SERVICE_ROLE_KEY` (restricted to webhooks).

### 2.4 Verification & Exit Criteria
* Direct SQL execution in Supabase succeeds with all 10 tables present and RLS enabled.
* Executing `SELECT * FROM app_settings WHERE id = 1` returns the default Kampala Bazaar configuration.
* Executing `SELECT count(*) FROM menu_items` returns 5 baseline seeded dishes.

---

## Phase 3: Design System Tokens & Custom UI Kit

### 3.1 Objective
Implement the anti-AI-slop "Bazaar Warmth" design tokens, typography scale, and tactile restaurant components.

### 3.2 File Manifest
* `tailwind.config.ts`
* `src/app/globals.css`
* `src/components/ui/button.tsx`
* `src/components/ui/badge.tsx`
* `src/components/ui/input.tsx`
* `src/components/ui/bottom-sheet.tsx`
* `src/components/ui/living-docket.tsx`
* `src/components/ui/modifier-chip.tsx`

### 3.3 Execution Directives
1. **Tailwind Token Binding:** Paste the extended theme object from `02_DESIGN_SYSTEM_AND_UI_SPEC.md` into `tailwind.config.ts` (`surface-ground: #F9F8F6`, `ink-primary: #1A1918`, `brand-terracotta: #D84A26`, etc.).
2. **Thermal Print Stylesheet:** Append the `@media print` rules from `06_INTEGRATIONS_AND_HARDWARE_APIS.md` into `src/app/globals.css`.
3. **Build Tactile Components:**
   * `button.tsx`: Implements high-contrast states, 48px standard touch target, 56px rider target, zero diffuse shadows.
   * `bottom-sheet.tsx`: Mobile drawer anchored to the bottom edge with pull-handle and safe-area padding (`pb-safe`).
   * `living-docket.tsx`: Replicates the physical kitchen order docket with dashed tear border and monospace tabular figures.
   * `modifier-chip.tsx`: High-contrast toggle pill with checkmark state and price delta label.

### 3.4 Verification & Exit Criteria
* Visual review confirms no SaaS purple or glowing drop-shadows exist.
* Base canvas renders `#F9F8F6` (Warm Linen).
* Components respect mobile safe-area insets on mobile viewports.

---

## Phase 4: Customer Storefront, Menu & Cart Engine

### 4.1 Objective
Construct the mobile-first customer storefront featuring instant client-side filtering, category navigation, the 3-step combo builder, structured cooking modifiers, and persistent cart state.

### 4.2 File Manifest
* `src/hooks/use-cart.ts`
* `src/components/storefront/menu-card.tsx`
* `src/components/storefront/category-bar.tsx`
* `src/components/storefront/instant-search.tsx`
* `src/components/storefront/modifier-modal.tsx`
* `src/components/storefront/combo-builder.tsx`
* `src/components/storefront/cart-dock.tsx`
* `src/app/(storefront)/page.tsx`

### 4.3 Execution Directives
1. **Zustand Cart Store (`use-cart.ts`):**
   * Implements item addition, quantity modification, and modifier array storage.
   * Enforces `localStorage` synchronization via `persist` middleware.
   * Exports computed selectors: `itemsCount`, `subtotalAmount`.
2. **Storefront Page (`page.tsx`):**
   * Server Component fetching active categories and menu items from `public.menu_items`.
   * Passes data to client-side `InstantSearch` and `CategoryBar`.
3. **Item Customization Drawer (`modifier-modal.tsx`):**
   * Renders cooking styles (radio buttons), free omissions (`No Onions`), and paid add-ons (`Extra Chili +USh 2,000`).
   * Dynamic CTA button updates total in real time: `[ Add to Cart • USh 34,000 ]`.
4. **Persistent Cart Dock (`cart-dock.tsx`):**
   * Floating bottom bar (`h-14`) displaying item count and subtotal in `font-mono`.
   * Tapping opens the cart review drawer.

### 4.4 Verification & Exit Criteria
* Typing into search filters dishes live with zero layout jumps.
* Customizing a dish updates cart subtotal accurately.
* Refreshing the browser preserves cart contents in `localStorage`.

---

## Phase 5: Map Engine, Pin-Drop & OSRM Distance Surcharge

### 5.1 Objective
Implement the Leaflet interactive map with draggable pin-drop, connect to the OSRM road distance engine, enforce the 5.0 km free threshold and excess surcharge, and apply Minimum Order Value (MOV) guardrails.

### 5.2 File Manifest
* `src/lib/distance.ts`
* `src/app/api/distance/route.ts`
* `src/components/map/dynamic-map.tsx`
* `src/components/map/location-picker.tsx`
* `src/app/(storefront)/checkout/page.tsx`

### 5.3 Execution Directives
1. **OSRM Route Proxy (`/api/distance/route.ts`):**
   * Accepts `lat` and `lng`.
   * Calls OSRM public API: `https://router.project-osrm.org/route/v1/driving/32.5811,0.3136;lng,lat`.
   * Returns road distance in kilometers.
   * Implements fallback Haversine distance multiplied by urban curvature factor ($1.35\times$) if OSRM times out ($> 3\text{s}$).
2. **Distance Fee Calculation Logic (`src/lib/distance.ts`):**
   * If $d_{\text{road}} \le 5.0\text{ km} \implies \text{Fee} = 0$.
   * If $5.0\text{ km} < d_{\text{road}} \le 15.0\text{ km} \implies \text{Fee} = \lceil d_{\text{road}} - 5.0 \rceil \times \text{Rate}_{\text{per\_km}}$.
   * If $d_{\text{road}} > 15.0\text{ km} \implies \text{Error: OUT\_OF\_BOUNDS}$.
3. **Location Picker (`location-picker.tsx`):**
   * Dynamically imported client-side component (SSR disabled).
   * Renders Leaflet map centered on Kampala Bazaar (`0.3136, 32.5811`).
   * Center crosshair stays fixed while user pans/drags map.
   * Debounces map movement ($400\text{ms}$) before triggering `/api/distance`.
4. **Checkout Page (`checkout/page.tsx`):**
   * Enforces Minimum Order Value: if $\text{subtotal} < \text{MOV}$, checkout CTA is disabled and progress bar renders deficit.
   * Displays dynamic fee badge (Green for USh 0 free zone).
   * Collects customer name, phone, payment method, and optional COD change request.

### 5.4 Verification & Exit Criteria
* Setting test coordinates to Nakasero (`lat: 0.3245, lng: 32.5782`) results in **3.8 km** and **USh 0 Delivery Fee**.
* Setting test coordinates to Ntinda (`lat: 0.3542, lng: 32.6120`) results in **7.4 km** and **USh 4,500 Delivery Fee** ($3\text{ km} \times \text{USh } 1,500$).
* Setting test coordinates $> 15.0\text{ km}$ disables checkout and displays out-of-bounds warning.

---

## Phase 6: Server-Side Zero-Trust Order Pipeline

### 6.1 Objective
Construct the immutable order creation pipeline using Next.js Server Actions, recalculating all financial totals on the server and generating the 4-digit handover PIN.

### 6.2 File Manifest
* `src/lib/schemas/order.ts`
* `src/actions/checkout.ts`
* `src/app/api/webhooks/payment/route.ts`

### 6.3 Execution Directives
1. **Validation Schema (`order.ts`):** Define `CreateOrderInputSchema` matching `07_SECURITY_AND_VERIFICATION_PROTOCOLS.md` with strict phone regex and positive quantities.
2. **Server Action (`checkout.ts`):**
   * Validates input payload with Zod.
   * Queries `public.menu_items` and `public.item_modifiers` for authoritative prices.
   * Queries distance engine on the server to verify delivery fee.
   * Computes master order total:
     $$\text{Total} = \text{Subtotal} + \text{Modifiers} + \text{Packaging} + \text{DeliveryFee}$$
   * Inserts into `public.orders`, `public.order_items`, and `public.order_item_modifiers`.
   * Automatically generates 4-digit `handover_pin` via database trigger.
   * Returns `{ success: true, orderToken: order.order_token }`.
3. **Payment Webhook Handler (`webhooks/payment/route.ts`):**
   * Validates HMAC-SHA256 signature header.
   * Checks for idempotency (ignores already-paid orders).
   * Verifies paid amount matches `orders.total_amount`.
   * Shifts order status to `PREPARING` on success.

### 6.4 Verification & Exit Criteria
* Client-submitted price tampering is completely overridden by authoritative database prices.
* Order record is successfully created in Supabase with a valid 4-digit `handover_pin`.
* Successful webhook shifts status from `PENDING_PAYMENT` to `PREPARING`.

---

## Phase 7: The Living Order Tracker & Real-Time Sync

### 7.1 Objective
Build the persistent, real-time customer tracking page (`/orders/[token]`) featuring the 5-stage milestone timeline, moving Leaflet motorcycle telemetry, handover PIN display, and WhatsApp concierge link.

### 7.2 File Manifest
* `src/components/orders/milestone-bar.tsx`
* `src/components/orders/pin-display-box.tsx`
* `src/components/orders/feedback-modal.tsx`
* `src/components/map/live-tracker-map.tsx`
* `src/app/(storefront)/orders/[token]/page.tsx`

### 7.3 Execution Directives
1. **Order Tracker Page (`page.tsx`):**
   * Fetches order by `order_token` (UUID).
   * Subscribes to Supabase Realtime channel `orders:id=eq.[order.id]`.
   * Renders the Living Docket with perforated tear border.
2. **Milestone Tracker (`milestone-bar.tsx`):**
   * Visual progress stages: `Received` $\rightarrow$ `Confirmed` $\rightarrow$ `Cooking` $\rightarrow$ `On Road` $\rightarrow$ `Delivered`.
3. **Live Telemetry Map (`live-tracker-map.tsx`):**
   * Mounted only when `order_status === 'OUT_FOR_DELIVERY'`.
   * Subscribes to `public.rider_telemetry` for the assigned `rider_id`.
   * Renders moving motorcycle marker with heading arrow and radar ripple.
4. **Handover PIN Box (`pin-display-box.tsx`):**
   * Displays the 4-digit code in 24px monospace text.
   * Displays safety reminder: *"Verify package safety seal before sharing PIN."*
5. **Post-Delivery Feedback Modal (`feedback-modal.tsx`):**
   * Automatically displays upon status transitioning to `DELIVERED`.
   * Submits 1-tap rating (`GREAT`, `OKAY`, `BAD`) to `public.orders`.

### 7.4 Verification & Exit Criteria
* Manually updating `order_status` in Supabase updates the customer's browser screen instantly via WebSockets without page reload.
* Handover PIN is clearly legible.
* WhatsApp concierge link opens with pre-populated order context.

---

## Phase 8: Kitchen Display System (KDS) & Audio Engine

### 8.1 Objective
Implement the high-contrast `/kitchen` display system for wall-mounted tablets, featuring the Web Audio API synthesizer, elapsed cook timers, ticket bumping, 86-ing toggles, and Busy Mode buffering.

### 8.2 File Manifest
* `src/lib/audio/chimes.ts`
* `src/components/kitchen/audio-banner.tsx`
* `src/components/kitchen/kds-ticket.tsx`
* `src/components/kitchen/stock-out-drawer.tsx`
* `src/actions/kitchen.ts`
* `src/app/(operations)/kitchen/page.tsx`

### 8.3 Execution Directives
1. **Audio Synthesizer (`chimes.ts`):** Implement the Web Audio API class from `06_INTEGRATIONS_AND_HARDWARE_APIS.md` (dual-tone harmonic bell D5 $\rightarrow$ A5, zero MP3 downloads).
2. **User Gesture Unlock (`audio-banner.tsx`):** Full-screen overlay prompt: `[ 🔔 TAP TO START SHIFT & ENABLE SOUND ALERTS ]` to unlock browser audio context.
3. **KDS Ticket Grid (`kds-ticket.tsx`):**
   * Displays order number, order type, elapsed timer, and line items.
   * Highlights omissions in bold amber tags (`* NO ONIONS *`).
   * Color-codes timer badges: Green (0–10m), Amber (10–20m), Flashing Red (>20m).
   * Full-width 52px bump button: `[ BUMP TO READY FOR PICKUP ]`.
4. **Quick 86-ing Drawer (`stock-out-drawer.tsx`):** Drawer to toggle menu items in/out of stock instantly via Supabase mutation.
5. **Busy Mode Buffer:** Toggle in header adding +20 minutes to global prep estimates.

### 8.4 Verification & Exit Criteria
* Tapping "Enable Sound" unlocks audio; creating a new order triggers a loud harmonic chime.
* Tickets automatically shift color from green to red as time elapses.
* Bumping a ticket changes status to `READY_FOR_PICKUP` and removes it from the active cook queue.

---

## Phase 9: Rider Fleet Portal & HTML5 Telemetry Relay

### 9.1 Objective
Construct the mobile handlebar `/rider` portal with low-friction 4-digit PIN authentication, atomic order claiming, turn-by-turn Google Maps launching, background GPS streaming, and the Handover PIN verification gate.

### 9.2 File Manifest
* `src/hooks/use-geolocation.ts`
* `src/components/rider/claim-card.tsx`
* `src/components/rider/pin-modal.tsx`
* `src/actions/rider.ts`
* `src/app/(operations)/rider/page.tsx`

### 9.3 Execution Directives
1. **Staff PIN Auth:** Rider enters registered phone number and 4-digit PIN (`1234`).
2. **Unclaimed Pool & Atomic Claiming (`claim-card.tsx` & `rider.ts`):**
   * Renders available orders in `READY_FOR_PICKUP` state.
   * `claimOrderAction` executes `claim_order_atomic` PostgreSQL function with row-level locking.
   * If claim succeeds, order moves to Rider's Active Delivery view. If another rider claimed first, displays error toast and updates pool.
3. **Active Delivery "Glance-and-Go" View:**
   * 56px oversized touch targets.
   * If Cash on Delivery: High-visibility yellow/amber banner renders: `COLLECT USH [Amount] CASH`.
   * Direct URI trigger: `[ 🗺️ Launch Navigation ]` opens Google Maps via `geo:` or universal link.
4. **HTML5 Telemetry Relay (`use-geolocation.ts`):** Streams rider's coordinates to `public.rider_telemetry` every 12 seconds or when moved $> 20\text{ meters}$.
5. **Handover PIN Verification Modal (`pin-modal.tsx`):**
   * Numerical keypad for entering the customer's 4-digit code.
   * Calls `verifyDeliveryPin` Server Action.
   * Enforces 3-attempt maximum lockout.
   * On success, order marks `DELIVERED`, cash is logged, and GPS streaming halts.

### 9.4 Verification & Exit Criteria
* Simulating two concurrent claim requests results in exactly one winner and one handled failure.
* Correct 4-digit PIN completes the delivery.
* Entering 3 incorrect PINs locks the order and triggers security alert.

---

## Phase 10: Admin Control Hub & Cash Reconciliation Ledger

### 10.1 Objective
Build the management control center (`/admin`) to monitor live orders, edit customer typos on active tickets, adjust dynamic delivery sliders, and reconcile physical cash collected by the 5 motorcycle riders.

### 10.2 File Manifest
* `src/components/admin/live-order-editor.tsx`
* `src/components/admin/settings-sliders.tsx`
* `src/components/admin/cash-ledger-table.tsx`
* `src/actions/admin.ts`
* `src/app/(operations)/admin/page.tsx`
* `src/app/(operations)/admin/ledger/page.tsx`
* `src/app/(operations)/admin/settings/page.tsx`

### 10.3 Execution Directives
1. **Live Typo Rectifier (`live-order-editor.tsx`):**
   * Modal allowing manager to edit customer phone number, drop-off notes, or adjust pinned coordinates on live orders.
   * Saving immediately broadcasts updates to the assigned rider's screen in real time.
2. **Dynamic Settings Sliders (`settings-sliders.tsx`):**
   * Sliders for free delivery distance (3–7 km), per-km surcharge (USh 1,000–3,000), and Minimum Order Value (USh 10,000–30,000).
   * Persists changes to `public.app_settings`.
3. **End-of-Day Cash Ledger (`cash-ledger-table.tsx`):**
   * Aggregates completed COD deliveries per motorcycle rider plate.
   * Computes exact cash liability owed to the restaurant drawer.
   * `[ RECONCILE & CLEAR RIDER ]` button records audit entry in `public.cash_settlements` and resets active balance to USh 0.

### 10.4 Verification & Exit Criteria
* Editing a customer's phone number on an active order syncs to the rider's screen within 1 second.
* Cash settlement cleanly clears driver liability in the database.

---

## Phase 11: Table QR Dine-In Hybrid Mode

### 11.1 Objective
Implement the bazaar table ordering extension triggered via URL parameter (`/?table=[id]`).

### 11.2 File Manifest
* `src/components/storefront/table-header.tsx`
* `src/app/(storefront)/page.tsx` (Updated parameter parsing)
* `src/actions/checkout.ts` (Dine-in branch handling)

### 11.3 Execution Directives
1. **Parameter Detection:** Read `searchParams.table` in `page.tsx`.
2. **UI Adaptations:**
   * Display persistent header badge: `🍽️ Dine-In: Table [ID]`.
   * Unmount Leaflet map and address fields from checkout view.
   * Hardcode delivery fee to `USh 0` and packaging fee to `USh 0`.
   * Override Minimum Order Value: Allow checkout for any subtotal ($> 0$).
3. **Order Insertion:** Set `order_type = 'DINE_IN'` and populate `table_number`.
4. **KDS Routing:** KDS flags ticket with blue badge: `TABLE [ID] [DINE-IN]`. Completing the ticket marks it `DELIVERED` directly, bypassing the motorcycle rider pool.

### 11.4 Verification & Exit Criteria
* Loading `/?table=4` allows ordering a single Rolex (USh 8,000) with zero delivery fee.
* Kitchen tablet shows `TABLE 4 [DINE-IN]` and bump action completes the order immediately.

---

## Phase 12: E2E Playwright Suite, Performance & Security Audit

### 12.1 Objective
Execute automated end-to-end integration tests verifying all 6 realistic personas, validate bundle budgets, and verify zero-cost open-source map compliance.

### 12.2 File Manifest
* `tests/e2e/persona-1-happy-path.spec.ts`
* `tests/e2e/persona-2-distance-cod.spec.ts`
* `tests/e2e/persona-3-table-qr.spec.ts`
* `tests/e2e/concurrency-claim.spec.ts`
* `public/manifest.json`

### 12.3 Execution Directives
1. **Implement Playwright Tests:** Convert scenarios A, B, C, and E from `08_TESTING_PERSONAS_AND_E2E_SCENARIOS.md` into executable test suites.
2. **PWA Manifest Configuration:** Configure `public/manifest.json` with theme color `#D84A26` and standalone display mode.
3. **Bundle Performance Audit:**
   * Verify Leaflet is dynamically imported on client components only.
   * Verify total gzipped JS transfer on `/` is $< 150\text{ KB}$.
   * Verify all images load in WebP format with dimensions $\le 600 \times 400\text{px}$.
4. **Security Audit:**
   * Verify RLS blocks unauthenticated users from reading `orders.handover_pin`.
   * Verify client price tampering fails with server-calculated totals.

### 12.4 Verification & Exit Criteria
* All Playwright E2E test suites pass with 100% green status:
  ```bash
  npx playwright test
  ```
* Production build passes audit:
  ```bash
  npm run build
  ```
* System is verified ready for deployment to Vercel/Netlify with Supabase backend.
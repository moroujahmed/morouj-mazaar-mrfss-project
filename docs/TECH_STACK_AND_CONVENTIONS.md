# TECH_STACK_AND_CONVENTIONS.md

> **v1.1 normative amendment:** The version matrix, Realtime strategy, tiles, directory manifest, and environment variables are superseded by [`SPEC_AMENDMENTS.md`](SPEC_AMENDMENTS.md) §4 and [`API_CONTRACTS.md`](API_CONTRACTS.md) §7. Pin Next.js 15.x, React 19, and Tailwind 3.4.x; do not use `postgres_changes`.

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved Technical Architecture
* **Target Environment:** Production / Antigravity Agentic Builder Specification
* **Repository Architecture:** Single-Codebase Monolith (Next.js App Router)
* **Performance Budget:** First Contentful Paint (FCP) $< 1.2\text{s}$ on 3G networks; Initial JS Bundle $< 150\text{ KB}$ (compressed)

---

## 1. Core Technology Stack Matrix

To satisfy the zero-ongoing-cost requirement while ensuring operational reliability across low-end mobile devices in high-temperature outdoor environments, the system must adhere strictly to the following framework and library selections. 

**Substitutions or additional runtime dependencies require explicit architectural approval.**

| Architectural Layer | Selected Technology | Exact Version / Spec | Justification & Architectural Boundary |
| :--- | :--- | :--- | :--- |
| **Framework & Runtime** | Next.js (App Router) | `14.2.x` or `15.x` | Server Components reduce client-side JavaScript execution on budget smartphones. Native API route handlers eliminate the need for a secondary backend server. |
| **Language** | TypeScript | `^5.4.x` | Strict typing enforced across the entire stack. Zero tolerance for untyped `any` or implicit type coercion. |
| **Database & Auth** | Supabase (PostgreSQL) | PostgreSQL 15+ | Enterprise PostgreSQL with built-in Row Level Security (RLS) and real-time Change Data Capture (CDC) via WebSockets. |
| **Realtime Engine** | `@supabase/supabase-js` | `^2.43.x` | Subscribes directly to PostgreSQL table changes (`postgres_changes`) for kitchen tickets, rider dispatches, and GPS telemetry. |
| **Styling & Design System** | Tailwind CSS | `^3.4.x` | Utility-first compilation. Eliminates runtime CSS overhead and guarantees atomic, zero-runtime styling payloads. |
| **CSS Utility Helpers** | `clsx` + `tailwind-merge` | `clsx ^2.1.x`, `tw-merge ^2.3.x` | Safe, deterministic conditional class merging via a unified `cn()` utility. |
| **Icons** | `lucide-react` | `^0.390.x` | Tree-shakeable SVG icons. Only bundle icons actually rendered. |
| **Map Rendering** | Leaflet.js | `^1.9.x` (`leaflet`) | **100% Free and open-source.** Zero runtime API keys or billable tile quotas. Dynamically imported on the client side only. |
| **Map Tiles** | OpenStreetMap (OSM) | Standard Tile CDN | Tile URLs: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`. Zero subscription or account configuration required. |
| **Road Routing Engine** | OSRM Public API | Car/Motorcycle Profile | Public routing endpoint: `https://router.project-osrm.org/route/v1/driving/...`. Computes precise road-network distances at zero cost. |
| **Client State (Cart)** | Zustand | `^4.5.x` | Ultra-lightweight ($< 1.2\text{ KB}$) client-side state with `persist` middleware configured for `localStorage`. |
| **Schema Validation** | Zod | `^3.23.x` | Single source of truth for runtime validation across Server Actions, form inputs, and incoming payment webhooks. |
| **Audio Processing** | Web Audio API | Browser Native | Programmatic chime synthesizer using oscillators. Zero external audio asset downloads required. |
| **Date & Time** | `date-fns` | `^3.6.x` | Modular, tree-shakeable date formatting locked to `Africa/Kampala` (EAT / UTC+3). |

### Explicitly Excluded Technologies (Prohibited)
* **NO Google Maps JavaScript SDK or Places API:** Prohibited due to pay-per-load pricing risks.
* **NO Heavy Component Libraries (Material UI, Ant Design, Chakra UI):** Prohibited due to excessive bundle size ($> 300\text{ KB}$) and slow mobile hydration.
* **NO Prisma / Heavy ORMs:** Supabase native client and typed SQL interfaces are utilized directly to keep serverless cold starts under $50\text{ms}$.
* **NO Complex Native Wrappers (Cordova/Capacitor):** The entire application operates strictly within standard mobile web viewports (PWA-compliant).

---

## 2. Monolith Directory Architecture

The repository is organized under a single Next.js project. Route groups `(group-name)` are utilized to isolate layout logic and visual contexts without altering the public URL paths.

```
project-root/
├── .env.example                       # Environment template with dummy variables
├── .env.local                         # Local secrets (never committed)
├── next.config.mjs                    # Next.js optimization & PWA configuration
├── package.json                       # Locked dependencies
├── postcss.config.mjs                 # PostCSS setup for Tailwind
├── tailwind.config.ts                 # Extended theme, tokens, and thumb-zone spacing
├── tsconfig.json                      # Strict TypeScript compiler options
├── public/                            # Static assets
│   ├── favicon.ico
│   ├── manifest.json                  # PWA Web App Manifest
│   ├── icons/                         # PWA icons (192x192, 512x512)
│   └── images/
│       └── placeholder-food.webp      # Fallback compressed dish asset
├── src/
│   ├── app/                           # Next.js App Router root
│   │   ├── layout.tsx                 # Root layout (Fonts, viewport metadata, toaster)
│   │   ├── globals.css                # Tailwind imports, custom resets & print styles
│   │   │
│   │   ├── (storefront)/              # Customer Facing Domain
│   │   │   ├── page.tsx               # Storefront: Menu, Category Tabs, Cart Dock
│   │   │   ├── checkout/              # Address picker, Leaflet Pin-drop, MoMo/Cash flow
│   │   │   │   └── page.tsx
│   │   │   └── orders/                # Living Order Tracker
│   │   │       └── [token]/
│   │   │           └── page.tsx       # Real-time tracking timeline & moving rider map
│   │   │
│   │   ├── (operations)/              # Internal Operational Interfaces
│   │   │   ├── kitchen/               # Kitchen Display System (KDS)
│   │   │   │   └── page.tsx           # Ticket grid, Audio unlock, 86 toggles, Busy mode
│   │   │   ├── rider/                 # Rider Fleet Portal
│   │   │   │   └── page.tsx           # Claim pool, Active delivery, 1-tap nav, PIN gate
│   │   │   └── admin/                 # Restaurant Management Hub
│   │   │       ├── page.tsx           # Operational overview & active orders
│   │   │       ├── menu/page.tsx      # Menu items, categories & modifier CRUD
│   │   │       ├── ledger/page.tsx    # End-of-day rider cash settlement ledger
│   │   │       └── settings/page.tsx  # Dynamic distance rates, MOV, open hours
│   │   │
│   │   └── api/                       # Edge & Serverless Route Handlers
│   │       ├── distance/route.ts      # Server-side OSRM routing proxy & calculator
│   │       ├── webhooks/
│   │       │   └── payment/route.ts   # Mobile Money (MTN/Airtel) & Card callbacks
│   │       └── print/
│   │           └── receipt/route.ts   # ESC/POS or raw print format renderer
│   │
│   ├── components/                    # Reusable React Components
│   │   ├── ui/                        # Low-level primitive design tokens
│   │   │   ├── button.tsx             # High-contrast thumb-accessible buttons
│   │   │   ├── badge.tsx              # Status pills (Paid, COD, Cooking, Delivered)
│   │   │   ├── input.tsx              # High-glance inputs with large touch targets
│   │   │   ├── bottom-sheet.tsx       # Native-feeling mobile drawers for cart/modifiers
│   │   │   └── modal.tsx              # Accessible dialog overlays
│   │   ├── map/                       # Mapping Subsystem (Leaflet)
│   │   │   ├── dynamic-map.tsx        # Client-only dynamic wrapper (SSR disabled)
│   │   │   ├── location-picker.tsx    # Customer pin-drop interface with crosshairs
│   │   │   └── live-tracker-map.tsx   # Moving motorcycle telemetry visualization
│   │   ├── storefront/                # Storefront specific UI
│   │   │   ├── menu-card.tsx          # Dish card with image, price, and add button
│   │   │   ├── modifier-modal.tsx     # Cooking styles, omissions, paid add-ons
│   │   │   ├── combo-builder.tsx      # 3-step meal bundle configurator
│   │   │   └── cart-dock.tsx          # Floating bottom sticky cart drawer
│   │   ├── kitchen/                   # KDS specific UI
│   │   │   ├── kds-ticket.tsx         # Physical-style ticket docket with timer
│   │   │   └── audio-banner.tsx       # "Tap to Enable Sound" browser audio banner
│   │   └── rider/                     # Rider specific UI
│   │       ├── claim-card.tsx         # Available delivery card in pool
│   │       └── pin-modal.tsx          # 4-digit handover proof verification gate
│   │
│   ├── lib/                           # Core Utilities, Clients & Helpers
│   │   ├── supabase/                  # Supabase clients
│   │   │   ├── client.ts              # Browser client (`createBrowserClient`)
│   │   │   ├── server.ts              # Server component client (`createServerClient`)
│   │   │   └── admin.ts               # Service-role bypass client (webhooks only)
│   │   ├── audio/                     # Web Audio API Sound Synthesizer
│   │   │   └── chimes.ts              # Programmatic order bell & urgent alert chimes
│   │   ├── utils.ts                   # `cn()` helper and string formatting
│   │   ├── currency.ts                # UGX currency formatters (e.g., `USh 25,000`)
│   │   ├── distance.ts                # Haversine fallback & OSRM response parsers
│   │   └── print-formatter.ts         # Plain text ESC/POS thermal slip generator
│   │
│   ├── hooks/                         # Custom React Hooks
│   │   ├── use-cart.ts                # Zustand cart hook with local persistence
│   │   ├── use-geolocation.ts         # HTML5 `watchPosition` rider telemetry tracker
│   │   ├── use-sound-alerts.ts        # KDS audio alert hook with user-gesture unlock
│   │   └── use-realtime-orders.ts     # Supabase Realtime channel subscription hook
│   │
│   ├── types/                         # Global TypeScript Definitions
│   │   ├── database.types.ts          # Auto-generated Supabase PostgreSQL types
│   │   ├── orders.ts                  # Order, OrderItem, and Modifier domain models
│   │   ├── menu.ts                    # MenuItem, Category, and Option interfaces
│   │   └── telemetry.ts               # Rider GPS payload & coordinate interfaces
│   │
│   └── actions/                       # Next.js Server Actions
│       ├── checkout.ts                # Server-validated order creation pipeline
│       ├── kitchen.ts                 # Order status progression & 86 toggling
│       ├── rider.ts                   # Concurrency-safe order claiming & PIN verification
│       └── admin.ts                   # Rate adjustments & cash ledger closing
```

---

## 3. Strict Coding Conventions & Quality Standards

To eliminate AI-generated anti-patterns, sloppy formatting, or non-deterministic code, builders must adhere to the following rules:

### 3.1 TypeScript & Type Safety
* **Strict Mode Active:** `strict: true` enabled in `tsconfig.json`.
* **Zero `any` Policy:** Explicit interfaces or types must be declared for all data structures. If a dynamic payload is returned (e.g., webhook body), it must be validated via a Zod schema before consumption:
  ```typescript
  // CORRECT: Schema-validated payload
  const payload = WebhookPayloadSchema.parse(await req.json());
  
  // PROHIBITED: Untyped bypass
  const payload = (await req.json()) as any;
  ```
* **Database Types Source of Truth:** Never manually write raw database row types. Types must strictly extend or match `database.types.ts` generated from PostgreSQL.

### 3.2 Server vs. Client Component Boundaries
* **Default to Server Components:** Every component in `src/app` must be a Server Component unless interactive state or browser APIs are required.
* **Granular `'use client'` Directives:** Do not mark entire pages as client components if only a single button or modal requires state. Isolate interactivity to dedicated leaf components:
  ```
  // CORRECT ARCHITECTURE:
  page.tsx (Server Component - fetches menu data directly from DB)
    └── MenuCategoryList.tsx (Server Component)
          └── AddToCartButton.tsx (Client Component - handles local click & Zustand store)
  ```
* **Client-Side Only Modules (Leaflet Dynamic Import):** Leaflet requires the browser `window` object. It must **never** be imported directly on the server. Always import using `next/dynamic` with SSR disabled:
  ```typescript
  import dynamic from "next/dynamic";

  export const DynamicLocationPicker = dynamic(
    () => import("@/components/map/location-picker"),
    { ssr: false, loading: () => <MapLoadingSkeleton /> }
  );
  ```

### 3.3 State Management & Data Fetching Patterns
* **Persistent Client State:** The shopping cart is managed via Zustand with `localStorage` synchronization so customer cart contents survive accidental page reloads.
* **Server Mutations:** All database mutations (order creation, status changes, claiming) must be executed via **Next.js Server Actions** (`actions/*.ts`) with atomic transactions.
* **Optimistic UI Updates:** Kitchen and rider status changes must use React's `useOptimistic` hook to render immediate visual confirmation while the background database write resolves over 3G/4G.

### 3.4 Currency & Formatting Standard
* All financial transactions and calculations occur as **integers** in Ugandan Shillings (`UGX`). There are no fractional cents.
* Standardized UI display helper:
  ```typescript
  // src/lib/currency.ts
  export function formatUGX(amount: number): string {
    return `USh ${new Intl.NumberFormat("en-UG").format(amount)}`;
  }
  ```

---

## 4. Realtime & Network Resilience Protocols

Given the network variability in outdoor urban markets, all data-fetching layers must implement automated resilience patterns:

```
[ Active Network Connection ]
             │
             ├──(Connection Lost)──> [ Local Queue / Cached View ]
             │                             │
             │                      (Exponential Backoff: 1s, 2s, 4s...)
             │                             │
             └──(Connection Restored)──────┴──> [ Instant Sync & State Reconciliation ]
```

### 4.1 Supabase Realtime Channel Lifecycle
Real-time listeners (Kitchen KDS, Rider Pool, Customer Tracker) must implement clean subscription lifecycles to prevent memory leaks and zombie WebSocket connections:
```typescript
// Standard Realtime Hook Pattern
useEffect(() => {
  const channel = supabase
    .channel("public:orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => handleOrderUpdate(payload)
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("Realtime disconnected. Retrying in 2s...");
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [supabase]);
```

### 4.2 Rider Background Telemetry Fallback
* When a rider is streaming coordinates, cellular signals may drop temporarily in basements or dense market alleys.
* The rider hook (`use-geolocation.ts`) must store the last known coordinate locally and dispatch batched updates the instant the network re-establishes connection.

---

## 5. Performance Budgets & Asset Optimization

The application must operate smoothly on budget Android devices (e.g., 2 GB RAM, MediaTek processors) running mobile browsers under bright ambient sunlight.

### 5.1 Image Optimization Matrix
* **Format:** 100% of dish images must be converted to **WebP** format.
* **Maximum File Size:** No dish image may exceed **`60 KB`**.
* **Dimensions:** Maximum rendered dimension on mobile is $600 \times 400\text{px}$ (displaying at $300 \times 200\text{px}$ on 2x retina viewports).
* **Next.js Config Enforcement:**
  ```javascript
  // next.config.mjs
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    images: {
      formats: ['image/avif', 'image/webp'],
      deviceSizes: [360, 480, 768, 1024],
      imageSizes: [64, 128, 256],
      minimumCacheTTL: 60 * 60 * 24 * 30, // 30-day edge cache
    },
  };
  export default nextConfig;
  ```

### 5.2 Bundle Size Limits
* Main application bundle (uncompressed): $< 500\text{ KB}$.
* Gzipped transfer bundle on initial page load: $< 150\text{ KB}$.
* Lucide icons must be imported as individual named imports; never import the full icon library:
  ```typescript
  // CORRECT: Tree-shaken import
  import { Bike, Clock, CheckCircle } from "lucide-react";

  // PROHIBITED: Full library import
  import * as Icons from "lucide-react";
  ```

---

## 6. Standardized Error Handling Architecture

All API routes and Server Actions must return a deterministic, structured error envelope. Never throw unhandled exceptions to the client:

```typescript
// Standard Unified Response Envelope
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };
```

### Standard Error Codes
* `AUTH_UNAUTHORIZED`: Staff or rider entered an invalid PIN.
* `MOV_NOT_MET`: Cart subtotal is below the required Minimum Order Value.
* `DISTANCE_OUT_OF_BOUNDS`: Pinned address exceeds the 15.0 km delivery ceiling.
* `ORDER_ALREADY_CLAIMED`: Concurrency lock failed; another rider claimed the delivery first.
* `INVALID_HANDOVER_PIN`: Rider input does not match customer's 4-digit verification token.
* `ITEM_OUT_OF_STOCK`: An item in the cart was 86'd while the customer was checking out.

---

## 7. Environment Variables & Secret Configuration

The application requires strict separation between public client variables and protected server secrets.

```bash
# ==============================================================================
# CLIENT-ACCESSIBLE VARIABLES (Exposed to browser via NEXT_PUBLIC_)
# ==============================================================================
NEXT_PUBLIC_APP_URL="https://bazaar-eats.com"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."
NEXT_PUBLIC_RESTAURANT_NAME="Bazaar Flame & Grill"
NEXT_PUBLIC_RESTAURANT_LAT="0.3136"
NEXT_PUBLIC_RESTAURANT_LNG="32.5811"
NEXT_PUBLIC_SUPPORT_WHATSAPP="+256700000000"

# ==============================================================================
# SECURE SERVER-ONLY VARIABLES (Never exposed to client)
# ==============================================================================
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsIn..."
PAYMENT_GATEWAY_SECRET="sec_key_live_..."
PAYMENT_WEBHOOK_SECRET="whsec_..."
ADMIN_DEFAULT_PIN="9988"
```

All environment variables must be validated at application startup using a strict `env.mjs` schema to fail early during deployment if any keys are missing.
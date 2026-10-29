# DESIGN_SYSTEM_AND_UI_SPEC.md

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved Design Specification
* **Target Audience:** Frontend Engineers & Antigravity Agentic Builders
* **Design Philosophy:** Tactile Realism, Outdoor High-Contrast, Ergonomic Thumb-Zone Architecture
* **Visual Theme:** *Bazaar Warmth* (Earthy, Appetizing, Functional, Anti-Generic)
* **Accessibility Standard:** WCAG 2.1 Level AAA for outdoor high-glare viewports

---

## 1. The Anti-AI-Slop Manifesto (Strict Negative Directives)

AI code generators possess strong default biases toward generic SaaS dashboard tropes. To guarantee a bespoke, world-class product, agentic builders must adhere strictly to these **negative constraints**. 

**Any violation of these rules represents an unacceptable build failure:**

```
❌ FORBIDDEN: SaaS Purple / Indigo (#6366F1, #8B5CF6)
❌ FORBIDDEN: Floating Pastel Blob Orbs & Mesh Gradients
❌ FORBIDDEN: Massive Diffuse Drop Shadows (e.g., shadow-2xl shadow-indigo-500/10)
❌ FORBIDDEN: Low-Contrast Gray Text (e.g., text-slate-400 on white backgrounds)
❌ FORBIDDEN: Center-Floating Modals on Mobile Viewports
❌ FORBIDDEN: Generic Stock Illustrations & Bouncy 3D Cartoon Avatars
❌ FORBIDDEN: Gratuitous Bouncy Transitions and Slow Spring Animations
```

### Approved Positive Counter-Principles
1. **Physical Materiality:** Interfaces mimic physical objects (kitchen dockets, printed tickets, perforated receipts, tactile toggle switches).
2. **Glanceability Under Sunlight:** Contrast ratios must exceed standard web norms. Motorcyclists on bumpy roads and cooks across a kitchen counter cannot squint at subtle gray borders.
3. **Bottom-Anchored Ergonomics:** Every critical interactive element (Checkout, Add to Cart, Confirm Pin, Claim Delivery) is pinned inside the natural sweep of a human thumb.

---

## 2. Visual Identity & Color System ("Bazaar Warmth")

The color palette is grounded in authentic culinary tones: smoked charcoal, clay brick, terracotta spices, and fresh herbs. It avoids the cold, clinical feel of corporate tech products.

```
       [ Surface Ground: Warm Linen #F9F8F6 ]
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
[ Smoked Charcoal ]  [ Brand Terracotta ] [ Forest Mint ]
     #1A1918              #D84A26             #1B5E3B
   (Primary Ink)      (Primary Action)    (Success / Paid)
```

### 2.1 The Master Palette Token Matrix

| Semantic Token | Hex Code | Tailwind Token | Contrast Ratio (vs Surface) | Usage Boundary |
| :--- | :--- | :--- | :--- | :--- |
| **Surface Ground** | `#F9F8F6` | `bg-surface-ground` | Base | Global application background (Warm Linen). Never use pure `#FFFFFF` as a full canvas. |
| **Surface Card** | `#FFFFFF` | `bg-surface-card` | 1.1:1 | Raised content containers, dish cards, and modal sheets. Elevated by clean 1px borders. |
| **Surface Inset** | `#EFECE6` | `bg-surface-inset` | 1.2:1 | Quantity counters, search inputs, and inactive toggle chips. |
| **Text Primary (Ink)** | `#1A1918` | `text-ink-primary` | 15.8:1 (AAA) | High-contrast smoked charcoal for all dish titles, prices, and critical headers. |
| **Text Secondary** | `#4A4744` | `text-ink-secondary`| 8.5:1 (AAA) | Dish descriptions, helper text, and secondary timestamps. Never drop below this lightness. |
| **Brand Terracotta** | `#D84A26` | `bg-brand-terracotta`| 4.6:1 (AA) | Primary CTA buttons, active radio dots, and living tracking accents. |
| **Brand Terracotta Hover**| `#B83817` | `bg-brand-terracotta-hover` | 5.8:1 (AAA) | Active button tap/press state. |
| **Success / Paid** | `#1B5E3B` | `text-status-success`| 7.2:1 (AAA) | "Paid Online", "Delivered", and in-stock indicator badges. |
| **Success Ground** | `#E8F5E9` | `bg-status-success-bg`| - | Soft mint background for success status pills. |
| **Urgent / COD / Alert**| `#B91C1C` | `text-status-danger` | 5.9:1 (AAA) | "Cash to Collect", "Out of Stock (86)", and late kitchen timers ($> 20\text{ mins}$). |
| **Urgent Ground** | `#FEE2E2` | `bg-status-danger-bg` | - | High-visibility warning badge container. |
| **Pending / In Prep** | `#B45309` | `text-status-warning`| 5.1:1 (AAA) | "Cooking in Kitchen", "Assigned to Rider" status badges. |
| **Pending Ground** | `#FEF3C7` | `bg-status-warning-bg`| - | Warm amber badge container. |
| **Border Structural** | `#E5E0D8` | `border-border-structural` | - | Crisp 1px borders separating sections. Replaces heavy diffuse drop-shadows. |

---

## 3. Typography & Numerical Systems

Typography is divided strictly between **characterful editorial display** for branding and **monospace/tabular figures** for numerical precision.

### 3.1 Font Pairing Rules
* **Brand & Section Headings:** `Plus Jakarta Sans` or `Outfit` (Bold, tight tracking `-0.02em`).
* **Interface & Body Copy:** `Inter` (Medium, relaxed line-height `1.5`).
* **Financial Amounts, Timers & Coordinates:** `JetBrains Mono` or tabular figures (`font-mono` / `tabular-nums`).

### 3.2 Strict Typography Scale

```
Display Large  ── 32px / Bold / Tracking -0.02em   ── Hero titles, KDS Big Timers
Display Medium ── 24px / Bold / Tracking -0.01em   ── Modal headers, Dish titles
Heading Bold   ── 18px / SemiBold                  ── Category titles, Docket totals
Body Regular   ── 15px / Normal / Leading 1.5      ── Dish descriptions, inputs
Caption Mono   ── 13px / Medium / Monospace        ── Prices (USh 25,000), Coordinates
Micro Label    ── 11px / Bold / Uppercase          ── Status pills (PAID, CASH, BUMP)
```

* **Zero Jumping Numbers Rule:** Every price, timer, and coordinate string must utilize `tabular-nums font-mono`. When elapsed seconds count upward on the Kitchen Display System or Living Tracker, the UI layout must never jitter or shake horizontally.

---

## 4. Spatial System & Mobile Thumb-Zone Ergonomics

Over 90% of customer interactions, 100% of rider actions, and all kitchen actions take place on touchscreen viewports. All layouts must respect the natural physical arc of the human thumb.

```
┌───────────────────────────────────────┐
│        [ Search & Filter Row ]        │ ◄── Top: Glance / Eye Scanning Only
├───────────────────────────────────────┤
│                                       │
│                                       │
│          Scrollable Content           │ ◄── Middle: Natural Scroll Area
│        (Dish Cards & Add Items)       │
│                                       │
│                                       │
├───────────────────────────────────────┤
│   ┌───────────────────────────────┐   │ ◄── Bottom Thumb Zone:
│   │ [Sticky Cart Dock: USh 32,000]│   │     Immediate Reachable Actions
│   └───────────────────────────────┘   │     Height: Min 56px
└───────────────────────────────────────┘
```

### 4.1 Touch Target Sizing Matrix
* **Customer Storefront Buttons:** Minimum height **`48px`** (e.g., `h-12`).
* **Motorcycle Rider Interface:** Minimum height **`56px`** (e.g., `h-14`) to accommodate gloved fingers or rough road vibrations.
* **Kitchen Line Bump Buttons:** Minimum height **`52px`** (e.g., `h-13`) spanning 100% of the ticket width.

### 4.2 The Bottom-Sheet Architecture
Center-floating dialogs (`<dialog>` or standard modals) are **strictly forbidden** on viewport widths $< 768\text{px}$.
* All modals (Modifier selection, Cart review, Address entry) must open as **Bottom Drawers** anchored to the bottom edge.
* Drawers must feature a visual pull-handle (`w-12 h-1.5 bg-border-structural rounded-full mx-auto my-2`).
* Drawers must accommodate mobile safe-area insets: `pb-[calc(1rem+env(safe-area-inset-bottom))]`.

---

## 5. Bespoke Component Kit Specifications

To eliminate generic boilerplate, the following custom components must be implemented exactly as specified:

---

### Component 1: The "Living Docket" (Physical Receipt Card)
Used in the checkout review, customer tracking view, and kitchen thermal docket preview.

```
┌────────────────────────────────────────────────────────┐
│  BAZAAR FLAME & GRILL                   ORDER #1042    │
│  Date: Oct 29, 2026 12:45 EAT          Table / Delivery│
├────────────────────────────────────────────────────────┤
│  1x Whole Grilled Tilapia                  USh 25,000  │
│     • [NO ONIONS]                                      │
│     • Extra Chili Sauce                     USh 2,000  │
│  1x Fresh Passion Juice                     USh  5,000  │
├────────────────────────────────────────────────────────┤
│  Subtotal:                                 USh 32,000  │
│  Delivery Fee (3.8 km):                        USh  0  │
│  TOTAL DUE:                                USh 32,000  │
│  STATUS: PAID VIA MTN MOMO                             │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ ◄── Perforated Border
│  HANDOVER PIN: [ 4 8 2 1 ]                             │
└────────────────────────────────────────────────────────┘
```

* **Styling Tokens:**
  * Background: `bg-surface-card` with an outer border `border-border-structural`.
  * Typography: `font-mono text-ink-primary text-xs leading-relaxed`.
  * The Perforated Divider: Built using a dashed stroke or a CSS zigzag mask:
    `border-b-2 border-dashed border-border-structural my-3`.
  * The Handover PIN Box: Inset box with high-contrast borders:
    `bg-surface-inset border-2 border-ink-primary font-mono text-xl font-bold tracking-widest text-center py-2`.

---

### Component 2: The "Modifier Chip" (Preferences & Add-ons)
Used in the item customization drawer to let customers pick cooking styles, free omissions, and paid extras.

```
[ Default Chip ]      [ Active Chip (Omission) ]      [ Active Chip (Paid Add-On) ]
┌────────────────┐    ┌────────────────────────┐      ┌──────────────────────────┐
│  No Onions     │    │  ✓ No Onions           │      │  ✓ Extra Sauce (+2,000)  │
└────────────────┘    └────────────────────────┘      └──────────────────────────┘
(Border: Subtle)      (Bg: Ink-Primary, Text: White)   (Bg: Brand-Terracotta, Text: White)
```

* **Default Inactive State:**
  * Container: `bg-surface-card border border-border-structural rounded-lg px-3 py-2.5 flex items-center justify-between`.
  * Text: `text-sm font-medium text-ink-primary`.
* **Active Omission State (`No Onions`, `No Salt`):**
  * Container: `bg-ink-primary border border-ink-primary text-white`.
  * Icon: Small `Check` icon rendered on the left.
* **Active Paid Add-On State (`Extra Sauce +USh 2,000`):**
  * Container: `bg-brand-terracotta border border-brand-terracotta text-white`.
  * Price Tag: `font-mono text-xs opacity-90`.

---

### Component 3: The High-Glance KDS Ticket (Kitchen Display System)
Optimized for high-temperature kitchen environments, steam, and distance viewing ($> 1.5\text{ meters}$).

```
┌────────────────────────────────────────────────────────┐
│  #1042                             [ 14:22 MINS ] ◄────┼── Elapsed Timer Badge
│  Delivery (Nakasero) ── Rider Pool                     │   (Green 0-10m, Amber 10-20m,
├────────────────────────────────────────────────────────┤    Flashing Red 20m+)
│  1x TILAPIA COMBO                                      │
│     * NO ONIONS * ◄────────────────────────────────────┼── High-Visibility Omission
│     * EXTRA PEPPER *                                   │
│  1x PASSION JUICE                                      │
├────────────────────────────────────────────────────────┤
│  [ BUMP TO READY FOR PICKUP ] ◄────────────────────────┼── Full-Width Bump Button
└────────────────────────────────────────────────────────┘   (Min-height: 52px)
```

* **Elapsed Timer Logic:**
  * $0 \text{ to } 10\text{ mins}:$ `bg-status-success-bg text-status-success`
  * $10 \text{ to } 20\text{ mins}:$ `bg-status-warning-bg text-status-warning`
  * $> 20\text{ mins}:$ `bg-status-danger-bg text-status-danger animate-pulse font-bold`
* **Crucial Allergy / Omission Styling:**
  * Any omission selected by the customer must render in **Uppercase Bold** surrounded by asterisks with an amber highlight badge:
    `bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-xs`.

---

### Component 4: The Rider "Glance-and-Go" Card
Engineered specifically for smartphone mounts on motorcycle handlebars under bright sunlight.

```
┌────────────────────────────────────────────────────────┐
│  NAKASERO ── 3.8 KM                                    │
│  Plot 14 Lumumba Avenue (Gate Code: 1234)              │
├────────────────────────────────────────────────────────┤
│  PAYMENT: COLLECT USH 35,600 CASH ◄────────────────────┼── High-Contrast Warning
│  (Customer needs change for 50,000)                    │   (Black on High-Vis Amber)
├────────────────────────────────────────────────────────┤
│  [ 🗺️ LAUNCH GOOGLE MAPS NAVIGATION ] ◄───────────────┼── 56px Tall Direct Action
├────────────────────────────────────────────────────────┤
│  [ 🔑 ENTER 4-DIGIT CUSTOMER PIN TO COMPLETE ]         │
└────────────────────────────────────────────────────────┘
```

* **Cash on Delivery Banner:**
  * Must be styled with an undeniable high-visibility yellow/amber background:
    `bg-[#FDE047] text-[#1E1B4B] border-2 border-[#CA8A04] p-3 rounded-lg font-bold text-base`.
* **Direct External Navigation Target:**
  * Must open native Google Maps via URI schema: `geo:0,0?q=lat,lng` (or `https://www.google.com/maps/dir/?api=1&destination=lat,lng`).

---

### Component 5: Custom Moving Rider Map Marker
A custom HTML-based Leaflet `divIcon` (never use the default generic blue balloon pin).

```
          ▲ (Directional Arrow Pointer)
      ┌───────┐
      │  🛵   │  ◄── Custom Round Icon Container
      └───────┘
     (• Pulse •) ◄── Subtle expanding radar ring
```

* **Icon Architecture:** An orange circle (`bg-brand-terracotta`) with white border and drop shadow, housing an SVG motorcycle icon.
* **Heading Pointer:** An attached small directional arrow rotating dynamically via CSS transform according to the rider's phone compass heading:
  `transform: rotate(${heading}deg);`.
* **Radar Pulse Effect:** A subtle CSS keyframe pulsing ring (`animate-ping`) underneath the icon to indicate an active real-time data connection.

---

## 6. Motion & Micro-Interaction Standards

All animations must be functional, mechanical, and instantaneous. 

* **Duration:** Strictly between **`150ms` and `220ms`**. Never exceed 300ms.
* **Easing Curve:** Standard snappy deceleration: `cubic-bezier(0.16, 1, 0.3, 1)`.
* **Zero Layout Shifts:** When quantity counters change (e.g., `1` to `2`), the width of the button must remain static (`tabular-nums` prevents expanding widths).
* **Haptic Feedback Hook:** On devices supporting `navigator.vibrate`, trigger micro-vibrations for critical actions:
  * Adding item to cart: `navigator.vibrate(10)` (10ms subtle tick).
  * Successful PIN confirmation: `navigator.vibrate([20, 50, 20])` (Double success pulse).
  * Error / Blocked checkout: `navigator.vibrate([60, 40, 60])` (Warning buzz).

---

## 7. Tailwind CSS Configuration Extension (`tailwind.config.ts`)

Builders must copy and paste this theme extension directly into the project's `tailwind.config.ts` to ensure exact design token binding:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          ground: "#F9F8F6",
          card: "#FFFFFF",
          inset: "#EFECE6",
        },
        ink: {
          primary: "#1A1918",
          secondary: "#4A4744",
          muted: "#76726E",
        },
        brand: {
          terracotta: "#D84A26",
          "terracotta-hover": "#B83817",
          amber: "#F39C12",
        },
        status: {
          success: "#1B5E3B",
          "success-bg": "#E8F5E9",
          warning: "#B45309",
          "warning-bg": "#FEF3C7",
          danger: "#B91C1C",
          "danger-bg": "#FEE2E2",
        },
        border: {
          structural: "#E5E0D8",
          strong: "#1A1918",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Plus Jakarta Sans", "sans-serif"],
        body: ["var(--font-body)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        tactile: "0 1px 3px 0 rgba(26, 25, 24, 0.08), 0 1px 2px -1px rgba(26, 25, 24, 0.08)",
        docket: "0 4px 6px -1px rgba(26, 25, 24, 0.1), 0 2px 4px -2px rgba(26, 25, 24, 0.05)",
      },
      borderRadius: {
        tactile: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
```
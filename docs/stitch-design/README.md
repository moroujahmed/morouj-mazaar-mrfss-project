# Stitch design package

Static HTML mockups for the Morouj Mazaar restaurant platform, covering the customer, kitchen, rider and admin experiences. These files are the reviewed visual and UX reference for the production build. They are **not** application code: there is no JavaScript framework, no API calls, and no persistence.

All numbers, order IDs, states and business rules come from the project specification in [`../`](../). Where a mockup and a specification disagree, the specification wins.

## Contents

```
docs/stitch-design/
├── README.md                 ← this file
├── AUDIT_RESOLUTION.md       ← how every audit finding was resolved
├── screens/                  ← 54 canonical screens (HTML + exported PNG previews)
├── assets/
│   ├── tailwind.css          ← compiled Tailwind 3.4.17, generated from screens/**/*.html
│   └── app.css               ← shared semantic components and responsive layout rules
└── _archive/original/        ← original Stitch exports, kept for provenance only
    └── SUPERSEDED.md         ← which originals are replaced and by what
```

## Run the mockups

Open any file in `screens/` directly in a browser. No server or build step is required. The Google Fonts request is the only external dependency.

To serve the folder locally:

```bash
cd docs/stitch-design
python -m http.server 8000
# then open http://localhost:8000/screens/customer-storefront.html
```

The PNG files next to the HTML are static previews of the same screens. They are not used by the HTML pages.

## Canonical scenarios

The mockups intentionally reuse one set of numbers so the same order reads consistently everywhere.

| Scenario | Order | Customer | Fulfilment | Payment | Total |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Delivery, prepaid | `#1042` | Sarah Namukasa, Nakasero, `1.562 km` | Delivery | MTN MoMo | **USh 35,000** (items 34,000 + packaging 1,000 + delivery 0) |
| Delivery, cash | `#1045` | Brian Kato, Ntinda, `8.093 km` | Delivery | Cash on delivery | **USh 38,000** (items 31,000 + packaging 1,000 + delivery 6,000), change from 50,000 = **12,000** |
| Dine-in | `#1044` | Alex Wandera, Table 4 | Dine-in | Airtel Money | **USh 8,000** |
| Completed cash ledger | `#1043` + `#1047` | Juma's drawer | Delivery | Cash | **USh 65,500** (38,000 + 27,500) |

Rules reflected in the screens:

- Store hours are **10:00–22:00 EAT**, every day.
- Delivery radius is **15.0 km**. Cash on delivery is capped at **8.1 km** (amended from 8.0 km so the canonical Ntinda order at 8.093 km is valid — see [`../SPEC_AMENDMENTS.md`](../SPEC_AMENDMENTS.md) §4.9).
- Free delivery within 5.0 km. Minimum delivery order is **USh 20,000** of items and modifiers.
- Dine-in has no delivery fee, no packaging fee and no minimum order.
- A rider completes a delivery only by entering the customer's 4-digit handover PIN. Completion requires a connection; offline completion is blocked, never queued or faked.
- One active delivery per rider. The next order can only be claimed after the current one is completed or released.
- There is no customer pickup or takeaway mode. Customers either order delivery or dine in at a table.
- There are no in-app tips, loyalty points, ratings, reviews, table reservations or catering flows.

## Screen catalogue

### Customer — ordering and payment

| Screen | Purpose |
| :--- | :--- |
| [`customer-storefront.html`](screens/customer-storefront.html) | Desktop menu, hero, dish cards, live 86 state, dine-in entry |
| [`customer-storefront-mobile.html`](screens/customer-storefront-mobile.html) | Mobile menu with search, filters and floating basket |
| [`customer-item-modifier.html`](screens/customer-item-modifier.html) | Item customiser bottom sheet with required modifiers |
| [`item-sold-out.html`](screens/item-sold-out.html) | 86'd dish state and available alternatives |
| [`customer-cart.html`](screens/customer-cart.html) | Basket with canonical `#1042` totals |
| [`cart-under-mov.html`](screens/cart-under-mov.html) | Basket below the USh 20,000 delivery minimum |
| [`cart-empty.html`](screens/cart-empty.html) | Empty basket |
| [`checkout.html`](screens/checkout.html) | Tier 1 checkout: address, slot, payment, COD change |
| [`checkout-tier2.html`](screens/checkout-tier2.html) | Tier 2 checkout at 8.093 km with COD enabled |
| [`checkout-cod-change.html`](screens/checkout-cod-change.html) | COD change calculator for the rider |
| [`checkout-cod-otp.html`](screens/checkout-cod-otp.html) | COD phone verification — error state |
| [`checkout-distance-calculator.html`](screens/checkout-distance-calculator.html) | Delivery fee and radius calculator |
| [`checkout-distance-error.html`](screens/checkout-distance-error.html) | Distance service unavailable, no straight-line fallback |
| [`checkout-out-of-range.html`](screens/checkout-out-of-range.html) | Address beyond the 15.0 km delivery radius |
| [`payment-pending.html`](screens/payment-pending.html) | Awaiting MoMo approval, 10-minute window |
| [`payment-success.html`](screens/payment-success.html) | Payment confirmed and order sent to kitchen |
| [`payment-failed.html`](screens/payment-failed.html) | Payment declined |
| [`payment-timeout.html`](screens/payment-timeout.html) | Payment prompt expired |
| [`refund-status.html`](screens/refund-status.html) | Refund requested and processed |
| [`store-closed.html`](screens/store-closed.html) | Ordering paused outside 10:00–22:00 EAT |

### Customer — tracking, dine-in, feedback

| Screen | Purpose |
| :--- | :--- |
| [`tracker.html`](screens/tracker.html) | Desktop order tracker |
| [`tracker-mobile.html`](screens/tracker-mobile.html) | Mobile order tracker |
| [`tracker-cancelled.html`](screens/tracker-cancelled.html) | Cancelled order state |
| [`tracker-delivery-failed.html`](screens/tracker-delivery-failed.html) | Failed delivery state |
| [`tracker-invalid-token.html`](screens/tracker-invalid-token.html) | Expired or invalid tracking link |
| [`tracker-feedback.html`](screens/tracker-feedback.html) | Post-delivery feedback form |
| [`tracker-feedback-submitted.html`](screens/tracker-feedback-submitted.html) | Feedback received |
| [`dine-in-table.html`](screens/dine-in-table.html) | Table 4 dine-in menu |
| [`dine-in-complete.html`](screens/dine-in-complete.html) | Dine-in order confirmed |
| [`dine-in-invalid-qr.html`](screens/dine-in-invalid-qr.html) | Invalid or expired table QR |

### Kitchen

| Screen | Purpose |
| :--- | :--- |
| [`kds.html`](screens/kds.html) | Kitchen display: New, Cooking and Ready lanes |
| [`kds-mobile-ticket.html`](screens/kds-mobile-ticket.html) | Mobile cook ticket for `#1042` |
| [`kds-late-ticket.html`](screens/kds-late-ticket.html) | Ticket over its SLA |
| [`kds-86-drawer.html`](screens/kds-86-drawer.html) | Mark an item 86'd |
| [`kds-audio-unlock.html`](screens/kds-audio-unlock.html) | Browser sound permission prompt |

### Rider

| Screen | Purpose |
| :--- | :--- |
| [`rider-shift.html`](screens/rider-shift.html) | Start shift and go online |
| [`rider-pool.html`](screens/rider-pool.html) | Unclaimed ready orders |
| [`rider-no-orders.html`](screens/rider-no-orders.html) | Empty pool state |
| [`rider-active.html`](screens/rider-active.html) | Active delivery `#1042` |
| [`rider-pin.html`](screens/rider-pin.html) | Customer handover PIN entry |
| [`rider-pin-locked.html`](screens/rider-pin-locked.html) | PIN locked after three failed attempts |
| [`rider-delivery-failed.html`](screens/rider-delivery-failed.html) | Delivery failed / customer unreachable |
| [`rider-earnings.html`](screens/rider-earnings.html) | Shift earnings and cash held |

### Admin

| Screen | Purpose |
| :--- | :--- |
| [`admin-orders.html`](screens/admin-orders.html) | Live order board |
| [`admin-order-detail.html`](screens/admin-order-detail.html) | Order timeline, payment, dispatch and override |
| [`admin-ledger.html`](screens/admin-ledger.html) | Cash ledger and rider handovers |
| [`admin-reconcile.html`](screens/admin-reconcile.html) | Per-rider cash reconciliation |
| [`admin-menu.html`](screens/admin-menu.html) | Menu, prices, modifiers and 86 state |
| [`admin-reports.html`](screens/admin-reports.html) | Sales and operations reporting |
| [`admin-staff.html`](screens/admin-staff.html) | Staff accounts and roles |
| [`admin-audit.html`](screens/admin-audit.html) | Append-only audit log |
| [`admin-settings.html`](screens/admin-settings.html) | Store settings, hours, radii and fees |

### Shared

| Screen | Purpose |
| :--- | :--- |
| [`staff-login.html`](screens/staff-login.html) | Staff sign-in with role and PIN |
| [`design-system.html`](screens/design-system.html) | Palette, type, components, states and retired-value warning |

## Conventions

- **One `h1` per page**, inside `<main id="main">`. Header brand names and context labels use `<span>`.
- **Skip link** is the first focusable element on every page.
- **No CDN Tailwind.** `assets/tailwind.css` is compiled locally from the class names used in `screens/**/*.html`.
- **No dead links.** Every `href` points to an existing screen or an approved external destination.
- Semantic components from `app.css` are preferred for new work: `.card`, `.card-pad`, `.btn`, `.pill`, `.notice`, `.table`, `.kpi`, `.phone`, `.timeline-step`.
- Status is never colour-only. Every pill pairs colour with a label.
- Touch targets are at least 48 × 48 px, and focus rings are visible.
- Currency is written as `USh` with an integer and thousands separators, for example `USh 35,000`.

## Colour and accessibility

The normative palette is defined in [`../ACCESSIBILITY.md`](../ACCESSIBILITY.md):

- Brand action `#B83817`, hover `#A63312`, decorative `#D84A26`.
- Page ground `#F9F8F6`, cards `#FFFFFF`, inset `#EFECE6`.
- Ink `#1A1918`, secondary `#4A4744`, muted `#6B6763`.

Do not use `#D84A26` as normal body text on the linen ground. Do not place white text on it at normal size. Full contrast tables and focus rules are in `ACCESSIBILITY.md`.

## Rebuilding the CSS

`assets/tailwind.css` is generated, not hand-edited. After changing class names in any screen, rebuild it from the repository root with the project Tailwind CLI (v3.4.17):

```bash
node <tailwind-cli> -c <generated-config> -i <input.css> -o docs/stitch-design/assets/tailwind.css --minify
```

The generated configuration must keep the normative colour map from `ACCESSIBILITY.md`, scan `screens/**/*.html`, and preserve the legacy token aliases used by existing screens.

## Validation

Before handing off, check every screen for:

1. A skip link, exactly one `h1`, both `../assets/tailwind.css` and `../assets/app.css`, and `<main id="main">`.
2. No `cdn.tailwindcss.com` and no `href="#"`.
3. Canonical totals, distances and order IDs (see the table above).
4. No retired values (`3.8 km`, `7.4 km`, `35,600`, `36,500`, `34,000` as a final total, `#1043` as an active order).
5. No unapproved features (pickup/takeaway, tips, loyalty, ratings, reservations, catering, POS or escrow).

## Provenance

The original Stitch exports are kept in [`_archive/original/`](_archive/original/) and listed in [`_archive/original/SUPERSEDED.md`](_archive/original/SUPERSEDED.md). They are retained only so reviewers can trace where a screen came from. Do not implement from the archive; implement from `screens/`.

The full audit and its resolution are documented in [`AUDIT_RESOLUTION.md`](AUDIT_RESOLUTION.md).

# Stitch design audit — resolution log

This document records how every finding from the Stitch feature audit was resolved. It covers the critical (C1–C7), high (H1–H20) and medium (M1–M20) findings. Nothing here changes application code: the deliverable is the remediated design package in [`screens/`](screens/) plus the specification updates listed at the end.

## Result

| Check | Result |
| :--- | :--- |
| Canonical screens | **54** HTML screens in `screens/` |
| Structural validation | **54 files, 0 issues** — skip link, one `h1`, `main#main`, both CSS links, no CDN Tailwind, no `href="#"` |
| Duplicate originals | Moved to [`_archive/original/`](_archive/original/) and listed in [`SUPERSEDED.md`](_archive/original/SUPERSEDED.md) |
| Canonical totals | Sarah `#1042` **35,000**; Brian `#1045` **38,000**; Alex `#1044` **8,000**; ledger `#1043` + `#1047` = **65,500** |
| COD ceiling | **8.1 km**, recorded in [`../SPEC_AMENDMENTS.md`](../SPEC_AMENDMENTS.md) §4.9 |
| Unapproved features | Removed from screens; no pickup/takeaway, tips, loyalty, reservations, catering, POS, escrow or reconcile-all flows |

---

## Critical findings

### C1 — Totals and money math contradicted the canonical examples

**Finding.** The original screens mixed retired totals (`34,000`, `35,600`, `36,500`, `4,500`) with the approved fixtures. Sarah's basket, the checkout, the tracker and the admin ledger did not agree; Brian's COD order was missing its 6,000 delivery fee and used the wrong order identity.

**Resolution.**

- Rebuilt every money-bearing screen around [`../CANONICAL_EXAMPLES.md`](../CANONICAL_EXAMPLES.md):
  - Sarah `#1042`: items 34,000 + packaging 1,000 + delivery 0 = **35,000**.
  - Brian `#1045`: items 31,000 + packaging 1,000 + delivery 6,000 = **38,000**; change from 50,000 = **12,000**.
  - Alex `#1044`: dine-in **8,000**, no packaging and no delivery.
  - Juma ledger: `#1043` 38,000 + `#1047` 27,500 = **65,500**.
- Corrected the COD change options in [`screens/checkout.html`](screens/checkout.html) and the full calculator in [`screens/checkout-cod-change.html`](screens/checkout-cod-change.html).
- Updated the fixture table in [`screens/design-system.html`](screens/design-system.html) and the samples in [`../ERD.md`](../ERD.md), [`../SECURITY_AND_VERIFICATION_PROTOCOLS.md`](../SECURITY_AND_VERIFICATION_PROTOCOLS.md) and [`../AUDIT_REPORT.md`](../AUDIT_REPORT.md).

**Evidence.** `35,000` appears as a final total on the basket, checkout, payment, tracker, KDS and admin screens; `38,000` on the tier-2 checkout, COD OTP, COD change, rider pool and ledger; `65,500` on the ledger, reconcile, rider earnings and design-system fixture. The retired totals appear only in the intentional warning note in `design-system.html`.

### C2 — The COD radius ceiling made the canonical Ntinda order invalid

**Finding.** Cash on delivery was capped at 8.0 km while the canonical Ntinda fixture is 8.093 km. The tier-2 checkout either disabled cash or contradicted the spec.

**Resolution.**

- Amended the ceiling to **8.1 km** in [`../SPEC_AMENDMENTS.md`](../SPEC_AMENDMENTS.md) §4.9 and aligned [`../CANONICAL_EXAMPLES.md`](../CANONICAL_EXAMPLES.md), [`../ERD.md`](../ERD.md) and [`../SECURITY_AND_VERIFICATION_PROTOCOLS.md`](../SECURITY_AND_VERIFICATION_PROTOCOLS.md).
- Enabled cash on delivery on [`screens/checkout-tier2.html`](screens/checkout-tier2.html) with explicit copy: 8.093 km is inside the 8.1 km ceiling.
- Aligned [`screens/checkout.html`](screens/checkout.html), [`screens/checkout-cod-change.html`](screens/checkout-cod-change.html), [`screens/customer-cart.html`](screens/customer-cart.html), [`screens/admin-settings.html`](screens/admin-settings.html) and the storefront footer.

**Evidence.** No active screen contains `8.0 km`; the canonical 8.093 km order is valid and the 15.0 km delivery radius is unchanged.

### C3 — Duplicate and divergent designs had no canonical source

**Finding.** The Stitch exports contained two batches with multiple near-duplicate variants of the storefront, KDS, ledger and rider portal. Reviewers could not tell which one was authoritative, and fixes drifted between copies.

**Resolution.**

- Promoted one canonical screen per state into `screens/`.
- Moved both original batches to `_archive/original/` without deleting them.
- Added [`_archive/original/SUPERSEDED.md`](_archive/original/SUPERSEDED.md) listing every superseded path and directing reviewers to `screens/`.
- Added [`README.md`](README.md) with the screen catalogue and provenance rules.

**Evidence.** `screens/` contains only canonical files; the archive is excluded from validation and implementation instructions.

### C4 — Unapproved features were present in the mockups

**Finding.** The originals included customer pickup/takeaway, tips, loyalty, reservations, catering/VIP, ratings and reviews on the storefront, POS/escrow language, a supervisor security bypass, and admin actions such as “Snooze”, “Transfer Pot”, “Sign Seal”, “Reconcile All Riders”, “FORCE READY” and “Net Margin 99.5%”.

**Resolution.** Removed or replaced every unapproved feature:

- Customer pickup/takeaway copy replaced with approved dine-in or delivery paths.
- No in-app tips; rider pay is a restaurant arrangement.
- No loyalty, VIP, catering, reservation or table-booking flows.
- No public rating/review count; post-delivery feedback remains the only rating capture.
- No escrow, POS or margin claims.
- Admin overrides are limited to reassign, cancel, force complete (with reason, audit and security flag) and request refund. There is no bypass, snooze, pot transfer, seal-signing or bulk reconcile.

**Evidence.** A full-text scan for the removed terms returns only approved uses of “margin” (CSS `margin`) and the documented force-complete override in [`screens/admin-order-detail.html`](screens/admin-order-detail.html).

### C5 — Order identities were reused and active orders collided with the ledger

**Finding.** `#1043` was used both as an active delivery and as a completed ledger entry. Rider, KDS and admin screens disagreed about which order Juma was carrying, and some screens showed Brian's COD order as `#1043` while the ledger also used `#1043`.

**Resolution.**

- Active orders are now `#1042` (Sarah, prepaid), `#1045` (Brian, COD) and `#1044` (Alex, dine-in).
- Completed cash ledger is `#1043` (38,000) + `#1047` (27,500) = 65,500.
- Replaced active `#1043` references in `admin-orders.html`, `kds.html`, `kds-late-ticket.html` and the `rider-pool.html` pool card; retained `#1043` only in completed-ledger contexts.

**Evidence.** A scan shows `#1043` only in the audit log, ledger, reconcile, completed earnings, cash-held summaries and the design-system fixture.

### C6 — Accessibility and document structure failed across the package

**Finding.** Screens used the Tailwind CDN, had two `h1` elements (brand in the header and page title), lacked a skip link or `<main id="main">`, contained `href="#"` dead links, and used an unapproved palette that did not match [`../ACCESSIBILITY.md`](../ACCESSIBILITY.md). The rider pool and earnings screens had no `main` landmark at all.

**Resolution.**

- Replaced the CDN with a locally compiled Tailwind 3.4.17 stylesheet at [`assets/tailwind.css`](assets/tailwind.css).
- Added [`assets/app.css`](assets/app.css) with semantic components, focus styles and responsive layout rules.
- Converted every header brand `h1` to a `span`; each page now has exactly one `h1` inside `main#main`.
- Added the skip link to every screen and fixed all dead links.
- Applied the normative palette: `#173F35` brand, `#F28C28` action with `#102E27` text, `#A65A0F` orange text, `#F2F4F3` canvas, `#102E27` ink.
- Added small-screen overrides for the admin, cart, checkout, tracker and calculator grid layouts.

**Evidence.** `validate.js` reports **54 files, 0 issues**. The checks are skip link, one `h1`, both CSS links, `main#main`, no `cdn.tailwindcss.com`, no `href="#"`.

### C7 — Rider completion violated the PIN, offline and one-active-order rules

**Finding.** The rider flow queued offline completions and reported them as pending/delivered, used a success path that returned the rider to the customer feedback screen, and allowed a second claim while a delivery was active. This contradicted the FSM and the “PIN is the proof of handover” rule.

**Resolution.**

- Offline completion is now **blocked** with an explicit message; it is never queued, never labelled delivered and never “synced” later. The design-system documentation was corrected to match.
- PIN success returns to [`screens/rider-pool.html`](screens/rider-pool.html), not to customer feedback.
- The pool locks claiming while `#1042` is active; the claim button states “finish #1042 first”.
- PIN lockout after three attempts is shown in [`screens/rider-pin-locked.html`](screens/rider-pin-locked.html).
- `DESIGN_SYSTEM_V2.md` no longer claims “offline-safe completion” or a queued retry.

**Evidence.** [`screens/rider-pin.html`](screens/rider-pin.html), [`screens/rider-pool.html`](screens/rider-pool.html), [`screens/rider-active.html`](screens/rider-active.html) and [`../DESIGN_SYSTEM_V2.md`](../DESIGN_SYSTEM_V2.md) all state the same rule.

---

## High-priority findings

| ID | Finding | Resolution and evidence |
| :--- | :--- | :--- |
| H1 | Desktop storefront advertised 11:30 PM closing and had dead footer links | Footer rewritten in [`screens/customer-storefront.html`](screens/customer-storefront.html); hours are 10:00–22:00 EAT daily; all footer/nav links resolve. |
| H2 | Storefront showed an unapproved 4.9 rating, 240+ reviews and “Daily Deals” | Removed the rating pill and deals badge; replaced with approved dish and prep copy. |
| H3 | Mobile storefront dish names did not match the canonical menu | Renamed to Whole Tilapia Flame Combo, Quarter Charcoal Grilled Chicken, Special Bazaar Rolex (2 pcs) and Smoked Beef Luwombo. |
| H4 | 86'd dishes were still orderable and `item-sold-out` named the wrong dish | Marked Smoked Pork Muchomo and Cold-Pressed Passion Juice sold out on the desktop storefront with disabled buttons; [`screens/item-sold-out.html`](screens/item-sold-out.html) now shows Smoked Pork Muchomo at 18,000. |
| H5 | COD change options included impossible denominations | Corrected [`screens/checkout.html`](screens/checkout.html) (40,000 → 5,000 change on 35,000) and [`screens/checkout-cod-change.html`](screens/checkout-cod-change.html) (50,000 → 12,000 change on 38,000). |
| H6 | COD phone verification had no error state | [`screens/checkout-cod-otp.html`](screens/checkout-cod-otp.html) is explicitly the error state: incorrect code, 2 attempts remaining, resend timer and Brian `#1045` summary. |
| H7 | Payment lifecycle states were missing | Added [`payment-pending.html`](screens/payment-pending.html), [`payment-success.html`](screens/payment-success.html), [`payment-failed.html`](screens/payment-failed.html), [`payment-timeout.html`](screens/payment-timeout.html) and [`refund-status.html`](screens/refund-status.html). |
| H8 | Tracker failure states were missing | Added [`tracker-invalid-token.html`](screens/tracker-invalid-token.html), [`tracker-cancelled.html`](screens/tracker-cancelled.html) and [`tracker-delivery-failed.html`](screens/tracker-delivery-failed.html). |
| H9 | Rider lifecycle states were missing | Added [`rider-shift.html`](screens/rider-shift.html), [`rider-no-orders.html`](screens/rider-no-orders.html), [`rider-pin-locked.html`](screens/rider-pin-locked.html), [`rider-delivery-failed.html`](screens/rider-delivery-failed.html) and [`rider-earnings.html`](screens/rider-earnings.html). |
| H10 | Admin operations screens were missing | Added order detail, ledger, reconcile, menu, reports, staff, audit and settings screens under `screens/admin-*.html`. |
| H11 | Kitchen states were missing | Added [`kds-late-ticket.html`](screens/kds-late-ticket.html), [`kds-86-drawer.html`](screens/kds-86-drawer.html), [`kds-audio-unlock.html`](screens/kds-audio-unlock.html) and [`kds-mobile-ticket.html`](screens/kds-mobile-ticket.html). |
| H12 | Dine-in states and fee rules were missing | Added [`dine-in-table.html`](screens/dine-in-table.html), [`dine-in-complete.html`](screens/dine-in-complete.html) and [`dine-in-invalid-qr.html`](screens/dine-in-invalid-qr.html); dine-in has no packaging, delivery or minimum order. |
| H13 | Cart edge states were missing | Added [`cart-empty.html`](screens/cart-empty.html) and [`cart-under-mov.html`](screens/cart-under-mov.html); the USh 20,000 minimum applies to items and modifiers only. |
| H14 | Store-closed state was missing and hours disagreed | Added [`store-closed.html`](screens/store-closed.html); every screen now uses 10:00–22:00 EAT daily. |
| H15 | Mobile KDS ticket claimed a dispatch, SMS alert and assigned rider | [`kds-mobile-ticket.html`](screens/kds-mobile-ticket.html) now says “Cook ticket #1042”, 12:36 EAT, “Unassigned”, “ready for pickup” and “appears in the rider pool; no SMS is sent”. |
| H16 | Staff login had a dead “Forgot PIN?” link | Replaced with non-interactive muted text in [`staff-login.html`](screens/staff-login.html). |
| H17 | Admin and checkout layouts broke on small screens | Added media queries in [`assets/app.css`](assets/app.css) for `data-layout="admin"`, `cart`, `checkout`, `tracker` and `calculator`, plus 520 px adjustments. |
| H18 | Distance service failure and out-of-range states were missing | Added [`checkout-distance-error.html`](screens/checkout-distance-error.html) with no straight-line fallback and [`checkout-out-of-range.html`](screens/checkout-out-of-range.html) with the 15.0 km block. |
| H19 | Feedback flow lacked a submitted state | Added [`tracker-feedback.html`](screens/tracker-feedback.html) and [`tracker-feedback-submitted.html`](screens/tracker-feedback-submitted.html); feedback is linked to the delivered order. |
| H20 | Status, timestamps and rider assignment drifted across screens | Aligned the order timeline: placed 12:35, accepted 12:36, ready 12:47, claimed 12:58, delivered 13:14. KDS, admin, rider and tracker now agree. |

---

## Medium and low findings

| ID | Finding | Resolution and evidence |
| :--- | :--- | :--- |
| M1 | Retired distances and totals still appeared in docs and site copy | Removed active `3.8 km`, `7.4 km`, `4,500`, `35,600` and `36,500`; the only remaining mention is the intentional warning in [`screens/design-system.html`](screens/design-system.html). |
| M2 | `site/assets/css/tokens.css` still used a retired palette | Remapped the token values to the normative green/orange palette while keeping the legacy token names. |
| M3 | `site/ui-kit.html` used the retired 34,000 total | Updated both occurrences to `USh 35,000`. |
| M4 | `DESIGN_SYSTEM_V2.md` had stale palette, fixtures and offline claims | Rewrote the palette, fixture and rider sections; removed the “offline-safe completion” and “queues and retries” claims. |
| M5 | Brand naming drifted between “Bazaar Flame”, “Bazaar Flame & Grill” and “Morouj Mazaar” | Standardised the restaurant brand to **Bazaar Flame & Grill**; `site/` keeps Morouj Mazaar as the umbrella portal brand by design. |
| M6 | Currency formatting was inconsistent | Standardised on `USh` plus integer thousands separators; fixed the rider-shift cash KPI. |
| M7 | Three screens lacked `data-portal` / `data-screen` metadata | Added metadata to the desktop storefront, mobile storefront and mobile KDS ticket. |
| M8 | Page titles and descriptions drifted from the screen purpose | Titles and descriptions now match the canonical state and, where present, the order number. |
| M9 | Header brand text competed with the page heading | All header `h1` elements converted to `span`; one `h1` per page. |
| M10 | Unsupported marketing and admin claims | Removed “Bank-Grade Escrow”, “Net Margin 99.5%”, “Target Demo”, “Supervisor Security Bypass”, “Snooze 2m”, “Transfer Pot”, “Sign Seal” and “Reconcile All Riders”. |
| M11 | Tracker invalid-link page linked back to itself | “Find my order” now goes to [`tracker.html`](screens/tracker.html). |
| M12 | Distance-error and out-of-range screens offered kitchen pickup | Replaced with approved dine-in and support paths. |
| M13 | Dine-in invalid QR offered a takeaway menu | Replaced with the delivery menu. |
| M14 | Store-closed screen used different Sunday hours | Unified to 10:00–22:00 EAT every day. |
| M15 | Rider PIN success returned to customer feedback | Returns to [`rider-pool.html`](screens/rider-pool.html). |
| M16 | No provenance for the duplicate originals | Added [`_archive/original/SUPERSEDED.md`](_archive/original/SUPERSEDED.md). |
| M17 | No package-level README or resolution log | Added [`README.md`](README.md) and this document. |
| M18 | Design-system fixture table was incomplete | Added the Sarah, Brian, Alex and Juma ledger rows with distances, component amounts and totals. |
| M19 | The retired-values warning could be mistaken for live content | The note in [`screens/design-system.html`](screens/design-system.html) is explicitly labelled “Retired values … must not appear”. |
| M20 | No package validation instructions | Added the validation checklist to [`README.md`](README.md); all 54 screens pass it. |

---

## Features removed

| Removed | Reason |
| :--- | :--- |
| Customer pickup / takeaway | Not an approved fulfilment mode; only delivery and dine-in are specified. |
| In-app tips | Rider pay is agreed with the restaurant; the app does not collect tips. |
| Loyalty, VIP lounge, catering, corporate meals | Not in the approved scope or business rules. |
| Table booking / reservations | Dine-in is opened by scanning the table QR, not by reservation. |
| Storefront ratings, review counts, “Daily Deals” | Social proof and promotions are unapproved; post-delivery feedback is the only rating capture. |
| POS, escrow, payment float, “Sign Seal” | No such feature in the specification. |
| Supervisor bypass, “FORCE READY”, snooze, pot transfer, bulk reconcile | Replaced with the audited admin overrides and per-rider settlement that the spec defines. |
| “Net Margin 99.5%” and similar financial claims | Not verifiable and not part of the admin contract. |

## Screens added by the remediation

Customer: `cart-empty`, `cart-under-mov`, `checkout-tier2`, `checkout-cod-change`, `checkout-cod-otp`, `checkout-distance-calculator`, `checkout-distance-error`, `checkout-out-of-range`, `customer-item-modifier`, `item-sold-out`, `payment-pending`, `payment-success`, `payment-failed`, `payment-timeout`, `refund-status`, `store-closed`, `tracker-mobile`, `tracker-cancelled`, `tracker-delivery-failed`, `tracker-invalid-token`, `tracker-feedback`, `tracker-feedback-submitted`, `dine-in-table`, `dine-in-complete`, `dine-in-invalid-qr`.

Kitchen: `kds-late-ticket`, `kds-86-drawer`, `kds-audio-unlock`, `kds-mobile-ticket`.

Rider: `rider-shift`, `rider-pool`, `rider-no-orders`, `rider-active`, `rider-pin`, `rider-pin-locked`, `rider-delivery-failed`, `rider-earnings`.

Admin: `admin-orders`, `admin-order-detail`, `admin-ledger`, `admin-reconcile`, `admin-menu`, `admin-reports`, `admin-staff`, `admin-audit`, `admin-settings`.

Shared: `staff-login`, `design-system`.

## Specification updates

| Document | Change |
| :--- | :--- |
| [`../CANONICAL_EXAMPLES.md`](../CANONICAL_EXAMPLES.md) | COD ceiling 8.1 km; canonical totals and ledger confirmed. |
| [`../SPEC_AMENDMENTS.md`](../SPEC_AMENDMENTS.md) | §4.9 records the 8.1 km COD amendment, version 1.1.1. |
| [`../ERD.md`](../ERD.md) | Settings defaults use 8.1 km; totals aligned. |
| [`../SECURITY_AND_VERIFICATION_PROTOCOLS.md`](../SECURITY_AND_VERIFICATION_PROTOCOLS.md) | COD radius and PIN rules aligned. |
| [`../AUDIT_REPORT.md`](../AUDIT_REPORT.md) | Canonical values and COD radius aligned. |
| [`../DESIGN_SYSTEM_V2.md`](../DESIGN_SYSTEM_V2.md) | Palette, fixtures, rider offline behaviour and accessibility limitations aligned. |
| [`../../site/assets/css/tokens.css`](../../site/assets/css/tokens.css) | Normative palette. |
| [`../../site/ui-kit.html`](../../site/ui-kit.html) | Canonical 35,000 total. |

## Verification command

The structural validator used for the final pass checks every file in `screens/`:

```text
54 files, 0 with issues
```

It verifies:

- a `skip-link` to `#main`;
- exactly one `<h1>`;
- `../assets/tailwind.css` and `../assets/app.css`;
- `<main id="main">`;
- no `cdn.tailwindcss.com`;
- no `href="#"`.

The final package also passes the canonical-value scan, the retired-value scan and the unapproved-feature scan described in [`README.md`](README.md).

# PORTALS AND UX SPECIFICATION

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.4.0 |
| **Date** | 2026-11-12 |
| **Supersedes** | v1.0 custom auth, terracotta palette, six-portal count, 4-digit staff PIN, background GPS, and stale fixtures |
| **Design authority** | [`DESIGN_SYSTEM_V2.md`](DESIGN_SYSTEM_V2.md) and [`ACCESSIBILITY.md`](ACCESSIBILITY.md) |
| **Behaviour authority** | [`STATE_MACHINES_AND_BUSINESS_RULES.md`](STATE_MACHINES_AND_BUSINESS_RULES.md), [`API_CONTRACTS.md`](API_CONTRACTS.md) |

The product has **four portals**: Customer, Kitchen, Rider, Admin. Dine-in is a customer mode; the order tracker is a customer subroute. Each staff portal has its own login route.

---

## 1. Route Map

```
src/app/
├── (storefront)/
│   ├── page.tsx                     /                  Storefront + dine-in mode
│   ├── checkout/page.tsx            /checkout          Pin-drop, fees, payment
│   └── orders/[token]/page.tsx      /orders/[token]    Tracker + PIN + feedback
└── (operations)/
    ├── kitchen/login/page.tsx       /kitchen/login     Staff login
    ├── kitchen/page.tsx             /kitchen           KDS
    ├── rider/login/page.tsx         /rider/login       Staff login
    ├── rider/page.tsx               /rider             Pool + active delivery
    └── admin/
        ├── login/page.tsx           /admin/login       Staff login
        ├── page.tsx                 /admin             Live orders
        ├── orders/page.tsx          /admin/orders      History + order actions
        ├── menu/page.tsx            /admin/menu        Menu/modifiers/combos
        ├── settings/page.tsx        /admin/settings    Commercial settings
        ├── ledger/page.tsx          /admin/ledger      Cash reconciliation
        ├── analytics/page.tsx       /admin/analytics   KPIs
        ├── audit/page.tsx           /admin/audit       Audit + settings history
        ├── staff/page.tsx           /admin/staff       Staff roster
        └── tables/page.tsx          /admin/tables      Table QR tokens
```

Canonical route handlers:

| Route | Purpose |
| :--- | :--- |
| `GET /api/distance?lat=&lng=` | OSRM proxy; returns integer metres |
| `POST /api/webhooks/flutterwave` | Verified payment webhook |
| `POST /api/notifications/dispatch` | Cron-only SMS outbox worker |
| `POST /api/cron/expire-orders` | Cron-only payment timeout |
| `POST /api/cron/close-shifts` | Cron-only shift close |
| `GET /api/print/receipt/[orderId]` | KITCHEN/ADMIN browser-printable receipt HTML; reprint audited |
| `GET /api/health` | Liveness; no secrets |

All mutations use Server Actions or the documented RPCs. There is no second route naming convention.

---

## 2. Customer Portal

### 2.1 Storefront `/`

- No account, no forced login.
- Header: restaurant name, search, store status.
- Category pills scroll horizontally; active pill uses the v2 green surface with accessible text.
- Dish cards show image, name, description, price, and **Customize** or **Add**.
- A sticky cart dock shows item count and total.
- Dine-in mode (`/?table=<qr-token>`) replaces delivery UI with a table banner and hides the map/address/fee controls.
- If the store is closed, show a closed screen with opening hours and support; checkout is disabled server-side as well.
- If the menu is empty or a category has no items, show an empty state, not a broken grid.

### 2.2 Item customization

- Bottom sheet with focus trap and labelled controls.
- Groups render as radio (single) or checkbox chips (multi), with min/max enforced.
- Omissions are free; paid add-ons show `+USh`.
- Required groups block **Add to cart** until satisfied.
- Sold-out items cannot be opened; an item that becomes sold out while the sheet is open shows a blocking message.
- The sticky CTA shows the computed line total.

### 2.3 Checkout `/checkout`

| Section | Behaviour |
| :--- | :--- |
| Delivery pin | Map with a fixed centre pin; debounced distance request; text fallback if tiles fail |
| Fee | Free-zone badge, excess breakdown, or out-of-zone block |
| Contact | Name, E.164-normalized phone, optional notes (≤500) |
| Payment | MTN, Airtel, card, or COD |
| COD | Change selector, OTP when required, COD-radius check |
| CTA | Server-computed total; disabled while invalid |

States that must exist:

- **Store closed:** `STORE_CLOSED`, no order is created.
- **Kitchen paused:** `KITCHEN_PAUSED`, checkout disabled while existing orders continue.
- **Outside zone:** `DISTANCE_OUT_OF_BOUNDS`, checkout disabled.
- **Routing down:** `DISTANCE_UNAVAILABLE`, retry action.
- **Item sold out:** `ITEM_OUT_OF_STOCK`, item named, cart editable.
- **Cart too large:** more than `max_cart_lines` distinct lines or `max_item_quantity` per line; explain the limit before submit.
- **Below MOV:** progress copy with the exact remaining amount; MOV comes from `app_settings`, never a hardcoded value.
- **COD change invalid:** requested change must cover the server total; show the minimum accepted amount.
- **COD unavailable:** outside radius, blacklisted phone, or SMS down.
- **OTP required/invalid/expired.**
- **Payment pending:** “Waiting for payment confirmation…” with no false success.
- **Payment failed:** reason if known, **Try again** using the same idempotency key, and a support link.
- **Duplicate submit:** same key returns the same order; a changed cart generates a new key.

Dine-in checkout removes delivery fields and sets delivery/packaging to `USh 0`; MOV is bypassed.

### 2.4 Tracker `/orders/[token]`

- Token is the bearer capability. An invalid, unknown, or expired token shows a not-found state with support; it never reveals whether an order exists.
- Shows order number, status, ETA, items, modifiers, fees, total, payment method/status, and the 4-digit handover PIN only while a delivery order is active. The PIN is hidden for dine-in and terminal orders.
- Map appears only during `OUT_FOR_DELIVERY`; if telemetry is stale, show “Last seen N minutes ago.”
- The safety-seal instruction appears before the PIN.
- Status changes are announced to screen readers.
- On `DELIVERED`, show the one-tap feedback form; feedback is accepted once.
- On `DELIVERY_FAILED`, show support and the reason category; no PIN.
- On `CANCELLED`, show the cancellation reason and refund status if paid.
- If the page is backgrounded, tracking pauses; on return it refreshes. SMS status updates are the fallback.

### 2.5 Dine-in mode

- QR token is validated server-side; a forged or inactive token does not enable dine-in.
- Banner: “Dine-in — Table T4”.
- No map, address, delivery fee, packaging fee, MOV, rider, or handover PIN.
- Kitchen bump marks the order `DELIVERED`; the customer sees the served state and feedback prompt.

---

## 3. Kitchen Portal

### 3.1 `/kitchen/login`

- Phone + 6-digit staff PIN.
- Loading, invalid credentials, locked account, inactive account, and network error states.
- Successful login redirects to `/kitchen`; non-kitchen roles are rejected.

### 3.2 `/kitchen`

- First load shows a **Start shift / Enable sound** overlay; a gesture unlocks Web Audio.
- Ticket columns or a responsive grid: new, preparing, ready/late.
- Ticket content: order number, type badge (delivery/dine-in), table, age timer, items, modifiers, notes, payment badge, cash/change warning.
- Timer is not colour-only: show elapsed minutes and a label (`New`, `Late`).
- Actions:
  - **Accept** only for `CONFIRMED_UNPAID` cash orders.
  - **Bump** for `PREPARING`: delivery → `READY_FOR_PICKUP`; dine-in → `DELIVERED`.
  - **Served to table** is the dine-in bump label.
  - **86** toggles item availability through `set_menu_item_availability`.
  - **Busy mode** sets `is_kitchen_busy` and a 0-60 minute buffer through `set_kitchen_busy`; each change is audited with a reason.
  - **Pause intake** sets `is_kitchen_paused` through `set_kitchen_paused`; new orders receive `KITCHEN_PAUSED` while queued orders continue; each change is audited with a reason.
  - **Print docket** uses browser print; a reprint is audited.
- Audio repeats every 15 seconds until `acknowledged_at` is set; stop on accept, cancel, or when the ticket leaves the new queue. Multiple tablets may chime; the shared state stops repeats.
- Offline banner: the KDS requires connectivity; do not imply tickets are syncing.
- Never show the handover PIN, customer phone, or payment reference.

### 3.3 Kitchen states

- Empty queue with shift status.
- New paid order.
- New cash order requiring accept.
- Late ticket.
- 86 confirmation and undo.
- Busy mode on/off with buffer.
- Kitchen intake paused/resumed.
- Printer failure with handwritten-docket fallback.
- Auth expired → login.

---

## 4. Rider Portal

### 4.1 `/rider/login`

- Phone + 6-digit staff PIN; inactive/locked/network states.
- Successful login redirects to `/rider`; other roles are rejected.

### 4.2 `/rider`

- Shift header: rider name, plate, shift status, cash summary link.
- **Start shift** records an opening float (0 or more); **End shift** closes the shift and points to settlement.
- Pool cards show order number, area (not exact address), distance, item count, payment type, and total. No phone, notes, PIN, or exact coordinates.
- **Claim** calls `claim_order_atomic`; exactly one rider wins; the loser sees “Order was just claimed by another rider.”
- Active order shows customer name, phone, address, notes, cash/change banner, navigation deep link, and **Start trip**.
- **Start trip** moves `CLAIMED → OUT_FOR_DELIVERY` and starts foreground telemetry.
- **PIN handover** opens a numeric keypad; the rider enters the customer's 4-digit PIN.
  - Wrong PIN: remaining attempts.
  - Locked: lock time and “contact the manager”; no offline completion.
  - Too far: distance and allowed radius.
  - Offline: block completion and explain that a connection is required to verify the PIN. Never queue the handover, never show “Delivered”, and never offer a “sync now” action.
- **Report failed delivery** records a reason and sets `DELIVERY_FAILED`.
- **Release** returns a claimed order to the pool with a reason.
- **End shift** shows expected cash and settlement status; the rider cannot self-settle.

### 4.3 Rider states

- No active shift.
- Empty pool.
- Active delivery.
- GPS permission denied/paused/stale.
- Offline queue with pending point count.
- PIN locked.
- Delivery failed.
- Auth expired.

---

## 5. Admin Portal

### 5.1 `/admin/login`

- Phone + 6-digit PIN; only `ADMIN` may enter.
- Locked/inactive/network states; successful login redirects to `/admin`.

### 5.2 `/admin` live orders

- Counts by status, oldest active tickets, stuck-order warnings, kitchen busy state, store open state.
- Order drawer: customer contact, items/modifiers, fees, payment, rider, status history.
- Actions with confirmation and reason:
  - Edit contact/notes/coordinates; a coordinate change recomputes distance and fee and audits the change.
  - Reassign rider; target must be an active rider without another active order, and a reason is required.
  - Cancel order; paid orders create a refund request.
  - Force complete with PIN override; audited and security-flagged.
  - Reset handover PIN; audited with reason; not available for terminal orders.
  - Approve or reject a refund with notes; approval stamps `approved_by`/`approved_at`.
- Destructive actions require typing a reason and a second confirmation; the confirm button is never the default focus.

### 5.3 `/admin/menu`

- Categories, items, modifier groups/options, combos/steps/options, images.
- Soft archive only; never hard-delete an item referenced by an order.
- Image upload validates type and size; preview and alt text are required.
- Price/availability changes are audited.

### 5.4 `/admin/settings`

- Free radius, excess rate, max radius, COD radius, delivery/dine-in MOV, packaging fees, cart limits, opening/closing hours, store open, kitchen busy, kitchen paused, PIN attempts/lock/geofence, staff session hours.
- Validation bounds and friendly errors.
- Every save writes `settings_history` and `admin_audit_log`.
- The store-open toggle explains that it overrides hours and is audited.

### 5.5 `/admin/ledger`

- Business-date picker defaults to today in `Africa/Kampala`.
- Row per rider: expected cash, counted cash, variance, status, linked order IDs.
- Reconcile with counted cash and notes; partial and overpayments are visible.
- A second reconciliation for the same rider/date updates the same settlement; no duplicates.
- Export/print of the day's ledger.

### 5.6 `/admin/analytics`

- Date-range filters and KPIs defined in [`ANALYTICS.md`](ANALYTICS.md).
- No customer PII in charts or exports beyond masked phone.

### 5.7 `/admin/audit`

- Admin audit log, settings history, PIN verification attempts, webhook events, refunds.
- Filter by actor, action, entity, and date.
- Read-only; export is audited.

### 5.8 `/admin/staff` and `/admin/tables`

- Staff: role, active flag, plate, last login; cannot demote or deactivate the last admin (`LAST_ADMIN_PROTECTED`).
- Tables: table number, label, QR token, active flag; regenerate token invalidates the old QR.

---

## 6. Shared UX Rules

- Every screen has loading, empty, error, offline, and auth-expired states.
- Errors map from API codes to human copy; never show raw database errors.
- Every destructive action names the object and requires a reason.
- Money is `USh` + grouped integer; time is EAT.
- Focus is visible; dialogs trap focus and restore it; Escape closes.
- Touch targets are at least 44×44 px; customer/admin controls are 48 px; kitchen primary actions are 52 px; rider primary actions are 56 px.
- No colour-only status; pair colour with text and icon.
- Reduced motion is respected.
- The v2 palette is mandatory: primary green `#173F35`, deep green `#102E27`, orange action `#F28C28` with green-900 text, orange text `#A65A0F`, red `#C62828`, success `#17603F`, warning `#8A4B00`.
- Never place white text on orange. See `DESIGN_SYSTEM_V2.md` for tokens and `ACCESSIBILITY.md` for contrast rules.

### 6.1 Error-code-to-copy map

Every API error code has one approved human message. Components render the copy from this table; they never render raw SQL, stack traces, or provider text.

| API code | Surface | Approved copy |
| :--- | :--- | :--- |
| `AUTH_UNAUTHORIZED` | Staff portals | “Your session has ended. Sign in again.” |
| `AUTH_LOCKED` | Staff login | “Too many attempts. Try again in 15 minutes.” |
| `VALIDATION_ERROR` | All forms | “Check the highlighted fields and try again.” |
| `MOV_NOT_MET` | Checkout | “Add USh {amount} more to reach the USh {minimum} minimum order.” |
| `DISTANCE_OUT_OF_BOUNDS` | Checkout | “This address is outside our {maxRadius} km delivery area. Choose another pin or dine in.” |
| `DISTANCE_UNAVAILABLE` | Checkout | “We cannot calculate the route right now. Retry in a moment.” |
| `STORE_CLOSED` | Storefront / checkout | "We are closed. Orders open at {opening time} EAT." |
| `KITCHEN_PAUSED` | Storefront / checkout | "The kitchen has paused new orders. Please try again in a few minutes." |
| `ITEM_OUT_OF_STOCK` | Menu / cart | “{Item} just ran out. Remove it to continue.” |
| `ITEM_NOT_FOUND` | Kitchen/admin menu | “That item no longer exists. Refresh the menu.” |
| `PAYMENT_METHOD_UNAVAILABLE` | Checkout | “That payment method is unavailable. Choose another.” |
| `COD_NOT_AVAILABLE` | Checkout | “Cash on delivery is not available for this address. Pay online or choose another pin.” |
| `OTP_REQUIRED` | Checkout | “Enter the 6-digit code we sent to {phone}.” |
| `OTP_INVALID` | Checkout | “That code is wrong or expired. Request a new one.” |
| `ORDER_ALREADY_CLAIMED` | Rider pool | “Another rider took this order. Pick another.” |
| `RIDER_HAS_ACTIVE_ORDER` | Rider pool | “Finish your active delivery before claiming another.” |
| `INVALID_HANDOVER_PIN` | Rider PIN sheet | “That PIN does not match. {n} attempts left.” |
| `PIN_LOCKED` | Rider PIN sheet | “Handover locked. Ask the admin to reset the PIN.” |
| `TOO_FAR_FROM_DESTINATION` | Rider PIN sheet | “Move closer to the delivery pin and try again.” |
| `ORDER_NOT_FOUND` | Tracker / orders | “We cannot find that order. Check the link or contact support.” |
| `ORDER_STATE_INVALID` | All portals | “This order has already moved on. Refresh to see its current state.” |
| `IDEMPOTENCY_CONFLICT` | Checkout | “We already received this order. Refresh your orders before trying again.” |
| `RATE_LIMITED` | All surfaces | “Too many attempts. Wait a minute and try again.” |
| `LAST_ADMIN_PROTECTED` | Admin staff | “Add another active admin before changing the last one.” |
| `INTERNAL_ERROR` | All surfaces | “Something went wrong. Try again or contact support on WhatsApp.” |

Admin and kitchen may append an operator reference (order number, correlation ID) but must not replace the approved message with raw provider or database text.

---

## 7. Static Prototype

The dependency-free prototype in `site/` is a design reference, not the production app. It must cover the four portals and the states above. Its fixtures are governed by `CANONICAL_EXAMPLES.md`.

The customer prototype demonstrates store-closed and kitchen-paused states with `?store=closed` or `?store=paused`, or with the in-page demo controls. `chicken-luwombo` and `matoke` are marked sold out; the delivery minimum (`USh 20,000`) and COD-change guard use the canonical values.

| Page | Purpose |
| :--- | :--- |
| `site/index.html` | Portal launcher and design-system overview |
| `site/customer.html` | Storefront, checkout, payment, tracker |
| `site/kitchen.html` | KDS, 86, busy mode, audio state |
| `site/rider.html` | Pool, active delivery, PIN, blocked offline completion |
| `site/admin.html` | Orders, menu, settings, ledger, analytics, audit |
| `site/design-system.html` | Tokens and components |

The canonical screen reference is `docs/stitch-design/screens/`. The original exports in `docs/stitch-design/_archive/` and `site/ui-kit.html` are non-normative and archived.

---

## 8. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.4.0 | 2026-11-12 | Added cart-line/COD-change states, settings-driven MOV/radius copy, PIN hiding for terminal orders, audit reasons, refund approval, `ITEM_NOT_FOUND`, and `LAST_ADMIN_PROTECTED`. |
| 1.3.0 | 2026-11-10 | Aligned route groups with the stack manifest, clarified Stitch status, added kitchen-pause and `KITCHEN_PAUSED`, and unified touch targets. |
| 1.2.0 | 2026-11-09 | Rewritten for four portals, Supabase Auth gates, schema-authoritative actions, canonical fixtures, v2 palette, and missing error/empty/destructive states. |
| 1.1.0 | 2026-10-29 | Amendment banner only. |
| 1.0.0 | 2026-10-27 | Original UX draft with six-portal count and terracotta palette. |

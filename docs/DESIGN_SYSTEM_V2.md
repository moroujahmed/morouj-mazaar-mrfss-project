# Morouj Mazaar design system v2

A static, dependency-free interface prototype for the three Morouj Mazaar portals:

- **Customer** — browse, customise, checkout, pay, track and give feedback.
- **Admin** — overview, orders, inventory, menu, delivery dispatch and reports.
- **Rider** — active delivery, cash handling and PIN handover with connection-required completion.

The prototype lives in [`site/`](../site/). It is intentionally not a Next.js application: it is a design and UX reference that can be opened directly in a browser, reviewed on a phone, and used to guide the production build.

---

## 1. Run the prototype

Open [`site/index.html`](../site/index.html) directly, or serve the folder:

```bash
cd site
python -m http.server 8000
```

Then open <http://localhost:8000>.

There is no build step and no package installation. The only external request is Google Fonts. All data, payments and sync states are local demo behaviour.

| Page | Purpose |
| :--- | :--- |
| [`site/index.html`](../site/index.html) | Portal launcher and palette overview |
| [`site/customer.html`](../site/customer.html) | Customer ordering and tracking |
| [`site/admin.html`](../site/admin.html) | Operations dashboard |
| [`site/rider.html`](../site/rider.html) | Rider delivery app |
| [`site/design-system.html`](../site/design-system.html) | Token and component reference |

---

## 2. Palette

The site prototype now uses the same palette as the normative design package (`docs/ACCESSIBILITY.md`). The legacy token names are kept so existing CSS keeps working; the values are terracotta and warm neutrals, not green and orange.

| Token | Hex | Role | Contrast decision |
| :--- | :--- | :--- | :--- |
| `--green-800` (brand action) | `#B83817` | Primary buttons, links, active state | White text = **5.81:1** |
| `--green-700` (action hover) | `#A63312` | Hover / pressed action | White text = 6.77:1 |
| `--orange-500` (decorative) | `#D84A26` | Borders, illustrations, large accents only | Not for normal text |
| `--orange-700` (brand text) | `#B83817` | Terracotta text on light surfaces | 5.47:1 on linen |
| `--gray-50` / `--surface-page` | `#F9F8F6` | Page ground (linen) | Ink text = 16.54:1 |
| `--surface-card` | `#FFFFFF` | Cards, sheets, reading surfaces | Ink text = 17.56:1 |
| `--gray-100` | `#EFECE6` | Inset and secondary surface | Ink text = 8.69:1 |
| `--gray-600` | `#4A4744` | Secondary text and metadata | 8.69:1 on linen |
| `--red-600` | `#B91C1C` | Errors and critical alerts | 6.47:1 on white |
| `--success-700` | `#1B5E3B` | Paid / delivered / in stock | 7.75:1 on white |
| `--warning-700` | `#92400E` | Attention states | 7.09:1 on white |

### Non-negotiable colour rules

1. **Primary actions use `#B83817` with white text.** Hover and pressed use `#A63312`.
2. **Never use `#D84A26` as body text on `#F9F8F6`.** Use `#B83817` for terracotta text.
3. Never place white text on `#D84A26` at normal size. Use it only for decorative fills, borders, icons, or text at 24 px / 18.66 px bold or larger.
4. Red is reserved for errors, destructive actions and critical alerts. Do not use it for ordinary "busy" states.
5. Status is never colour-only. Every badge and banner pairs colour with an icon and a word.

---

## 3. Typography

| Role | Family | Size / line-height |
| :--- | :--- | :--- |
| Display | Plus Jakarta Sans 800 | `clamp(2.6rem, 6vw, 3.75rem)` / 1.02 |
| H1 | Plus Jakarta Sans 800 | `2.25rem` / 1.15 |
| H2 | Plus Jakarta Sans 800 | `1.5rem` / 1.2 |
| H3 | Plus Jakarta Sans 800 | `1.125rem` / 1.25 |
| Body | Inter 400–600 | `1rem` / 1.55 |
| Small | Inter 400–600 | `0.875rem` / 1.55 |
| Tiny / eyebrow | Inter 800 | `0.75rem` / 1.5, uppercase and tracked |
| Money, IDs, PIN, time | JetBrains Mono 500–800 | Tabular numerals |

Headings use tight tracking (`-0.025em` to `-0.05em`). Use mono for anything a person might compare or read aloud.

---

## 4. Portal behaviour

### Customer

- Warm linen hero with food imagery and a clear "Browse the menu" action.
- Search and category filters with a result count announced politely.
- Dish sheet for modifiers and quantity; basket total stays visible.
- Checkout supports delivery and dine-in. Delivery areas use the canonical distances:
  - Nakasero `1.562 km` — free delivery
  - Ntinda `8.093 km` — `USh 6,000`
  - Table 4 — dine-in, no packaging or delivery fee
- Payment is simulated locally. The tracker shows a timeline, map, rider contact and a 4-digit handover PIN.

### Admin

- Sidebar navigation on desktop, off-canvas drawer on mobile.
- Overview KPIs, revenue chart, live pipeline and recent orders.
- Orders table with search, status filters, an order drawer and safe status transitions.
- Inventory with low-stock states, menu CRUD and availability toggles.
- Delivery dispatch, fleet status and cash reconciliation.
- Reports with period selection, payment mix, cash ledger and CSV export.

### Rider

- Header shows rider identity, vehicle plate and a persistent connection chip.
- Active order card puts the ETA, cash due, route, customer contact and distance first.
- Minimum touch target is **56px**; primary actions also appear in a sticky bottom bar on phones.
- Handover requires the 4-digit customer PIN (`4821` in the canonical demo) with a maximum of three attempts and a short lockout.
- Connection states:
  - **Online** — PIN verification completes immediately.
  - **Weak** — verification takes longer and the UI says so.
  - **Offline** — completion is blocked. The screen says the connection is required and keeps the PIN form; it never queues a delivery or reports a false success.
- There is no offline queue and no "sync now" action. A delivery can only be completed while the server can verify the PIN.
- The rider pool allows one active delivery at a time. Claiming is disabled until the active order is completed or released.

---

## 5. Components

Shared components live in [`site/assets/css/components.css`](../site/assets/css/components.css):

- Buttons: primary, dark, secondary, ghost, soft, danger; small through extra large.
- Icon buttons, badges, chips, cards, icon tiles, avatars.
- Inputs, selects, textareas, field errors, hints, choice cards, switches.
- Sheets (`<dialog>`), toasts, tables, timelines, progress bars and alerts.
- Empty states, key/value lists, section headings and connection dots.

Tokens live in [`site/assets/css/tokens.css`](../site/assets/css/tokens.css). Portal-specific layout lives in `customer.css`, `admin.css`, `rider.css` and `portal.css`.

The icon sprite is generated by [`site/assets/js/ui.js`](../site/assets/js/ui.js), which also provides formatting, storage, toasts, dialogs and tab keyboard handling.

---

## 6. Demo data

The active story is consistent across the customer, admin and rider pages:

| Fixture | Detail |
| :--- | :--- |
| Customer order A | Sarah Namukasa, `#1042`, Nakasero `1.562 km`, MTN MoMo, **USh 35,000** |
| Customer order B | Brian Kato, `#1045`, Ntinda `8.093 km`, COD, **USh 38,000**, change from `USh 50,000` = `USh 12,000` |
| Dine-in | Alex Wandera, `#1044`, Table 4, Airtel Money, **USh 8,000** |
| Rider active | Juma Mukasa, `#1042` Sarah Nakasero `1.562 km`, prepaid `USh 35,000`, cash to collect `USh 0` |
| Delivery pool | `#1045` Brian Kato, Ntinda `8.093 km`, COD `USh 38,000`, locked while `#1042` is active |
| Completed cash ledger | `#1043` `USh 38,000` + `#1047` `USh 27,500` = **USh 65,500** due to the drawer |
| Admin statuses | `#1044` PREPARING (dine-in); `#1045` PREPARING · unassigned; `#1042` CLAIMED by Juma |
| Dispatch queue | `#1045` is the only unassigned delivery |

All data is local. Refreshing the page resets the demo. No delivery completion is stored offline; the prototype never reports a delivery that the server has not verified.

---

## 7. Accessibility checklist

- WCAG 2.2 AA contrast for normal text and UI controls.
- Visible 3px focus ring; ink on light surfaces, linen on dark surfaces.
- Skip link on every page.
- Semantic landmarks and one `h1` per page.
- Minimum 48px targets on customer/admin screens, 56px on rider screens.
- No status, error or connection state relies on colour alone.
- Forms keep labels visible; errors use `aria-invalid`, `aria-describedby` and text.
- Sheets use native `<dialog>` with labelled headings and a close control.
- Toasts use `aria-live` and `role="alert"` for errors.
- `prefers-reduced-motion` collapses animation and smooth scrolling.
- Rider PIN supports touch and physical keyboard input.
- Rider offline completion is blocked with an explicit message; it never fakes success and never queues a delivery.

The production verification rules remain in [`docs/ACCESSIBILITY.md`](ACCESSIBILITY.md).

---

## 8. Validation

```bash
node --check site/assets/js/ui.js
node --check site/assets/js/customer.js
node --check site/assets/js/admin.js
node --check site/assets/js/rider.js
```

Manual checks:

1. Open each portal at 360px, 768px and 1280px widths.
2. Tab through the page and confirm focus is always visible.
3. In the rider app, switch to **Offline** and confirm completion is blocked with a clear message; reconnect and complete the PIN successfully.
4. Confirm the admin "Ready for dispatch" count matches the unassigned Ready orders.
5. Confirm the customer total remains `USh 35,000` for the preloaded Sarah basket and `USh 38,000` for the Brian COD demo.

---

## 9. Prototype limitations

- No production API, authentication, payment provider or map tiles.
- Admin and rider data are separate local fixtures, not a shared database.
- Images are static local assets; missing dish photos use the terracotta/linen placeholder SVG.
- CSV reports are generated in the browser.
- The prototype does not store delivery completion offline. Cash and order figures match [`CANONICAL_EXAMPLES.md`](CANONICAL_EXAMPLES.md): `#1043` `USh 38,000` + `#1047` `USh 27,500` = `USh 65,500`.
- Production must implement the security rules in [`README.md`](../README.md) and the API contracts in [`docs/API_CONTRACTS.md`](API_CONTRACTS.md).

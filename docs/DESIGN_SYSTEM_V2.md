# Morouj Mazaar design system v2

A static, dependency-free interface prototype for the three Morouj Mazaar portals:

- **Customer** — browse, customise, checkout, pay, track and give feedback.
- **Admin** — overview, orders, inventory, menu, delivery dispatch and reports.
- **Rider** — active delivery, cash handling, PIN handover and offline-safe completion.

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

| Token | Hex | Role | Contrast decision |
| :--- | :--- | :--- | :--- |
| `--green-800` | `#173F35` | Primary brand, headers, dark surfaces | White text = **11.67:1** |
| `--green-900` | `#102E27` | Deepest surface, text on orange | White text = 14.4:1 |
| `--green-700` | `#1D4F42` | Hover on dark surfaces | White text = 9.6:1 |
| `--green-50` | `#F2F7F5` | Tinted cards and rows | Ink text = 13.8:1 |
| `--orange-500` | `#F28C28` | Primary actions, highlights | Green-900 text = **4.76:1** |
| `--orange-700` | `#A65A0F` | Orange text on light surfaces | White = **5.13:1** |
| `--white` | `#FFFFFF` | Cards, sheets, reading surfaces | Ink text = 16.25:1 |
| `--gray-100` | `#F2F4F3` | Secondary page background | Ink text = 15.2:1 |
| `--gray-600` | `#52635D` | Muted text and metadata | White = **6.36:1** |
| `--red-600` | `#C62828` | Errors and critical alerts | White = **5.62:1** |
| `--success-700` | `#17603F` | Confirmed states | White = 7.2:1 |
| `--warning-700` | `#8A4B00` | Attention states | White = 7.4:1 |

### Non-negotiable colour rules

1. **Never place white text on `#F28C28`.** The ratio is 2.32:1. Use `--green-900` for text on orange.
2. **Never use `#F28C28` as body text on white.** Use `--orange-700` instead.
3. Red is reserved for errors, destructive actions and critical alerts. Do not use it for ordinary "busy" states.
4. Status is never colour-only. Every badge and banner pairs colour with an icon and a word.

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

- Warm dark-green hero with food imagery and a clear "Browse the menu" action.
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
- Handover requires the 4-digit PIN (`7310` in the demo) with a maximum of three attempts and a short lockout.
- Connection states:
  - **Online** — completion verifies immediately.
  - **Weak** — verification takes longer and the UI says so.
  - **Offline** — completion is queued on the device and shown as **Awaiting verification**. It is never reported as delivered.
- Returning online exposes a **Sync now** action. The queued completion is only marked delivered after the sync step.
- The delivery pool can queue one next job while the current delivery is active. Claiming needs a connection; completing the active job does not.

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
| Customer order A | Sarah Namukasa, Nakasero, MTN MoMo, **USh 35,000** |
| Customer order B | Brian Kato, Ntinda, COD, **USh 38,000**, change from `USh 50,000` = `USh 12,000` |
| Dine-in | Alex Wandera, Table 4, **USh 8,000** |
| Rider active | Juma Mukasa, `#1043` Brian Kato, Ntinda `8.093 km`, COD `USh 38,000` |
| Delivery pool | `#1045` Grace Achieng, Kololo, `USh 25,000` prepaid; `#1047` Miriam Nsubuga, Bugolobi, `USh 33,000` prepaid |
| Admin statuses | `#1042` and `#1043` On the way; `#1044` Cooking; `#1045` and `#1047` Ready; `#1046` Delivered |
| Dispatch queue | `#1045` and `#1047` are unassigned, matching the "2 waiting" badge |

All data is local. Refreshing the page resets the demo except for the rider connection, queue and pending-completion keys stored in `localStorage`.

---

## 7. Accessibility checklist

- WCAG 2.2 AA contrast for normal text and UI controls.
- Visible 3px focus ring; orange on dark surfaces, green on light surfaces.
- Skip link on every page.
- Semantic landmarks and one `h1` per page.
- Minimum 48px targets on customer/admin screens, 56px on rider screens.
- No status, error or connection state relies on colour alone.
- Forms keep labels visible; errors use `aria-invalid`, `aria-describedby` and text.
- Sheets use native `<dialog>` with labelled headings and a close control.
- Toasts use `aria-live` and `role="alert"` for errors.
- `prefers-reduced-motion` collapses animation and smooth scrolling.
- Rider PIN supports touch and physical keyboard input.
- Rider offline completion never fakes success; it queues and exposes retry.

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
3. In the rider app, switch to **Offline**, complete the PIN, confirm the queued state, reconnect, then use **Sync now**.
4. Confirm the admin "Ready for dispatch" count matches the unassigned Ready orders.
5. Confirm the customer total remains `USh 35,000` for the preloaded Sarah basket and `USh 38,000` for the Brian COD demo.

---

## 9. Prototype limitations

- No production API, authentication, payment provider or map tiles.
- Admin and rider data are separate local fixtures, not a shared database.
- Images are static local assets; missing dish photos use the green/orange placeholder SVG.
- CSV reports are generated in the browser.
- The rider queue and pending completion are stored with `localStorage`; they are not encrypted or synced.
- Order `#1047` uses `USh 33,000` prepaid on both the admin and rider screens so one order reads the same everywhere. [`CANONICAL_EXAMPLES.md`](CANONICAL_EXAMPLES.md) still lists it as `USh 27,500` COD for Juma's `USh 65,500` ledger example; the prototype keeps its own fixture ledger of `USh 64,000` for Juma.
- Production must implement the security rules in [`README.md`](../README.md) and the API contracts in [`docs/API_CONTRACTS.md`](API_CONTRACTS.md).

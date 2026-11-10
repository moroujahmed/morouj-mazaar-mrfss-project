# ACCESSIBILITY — WCAG 2.2 AA Verification

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.3.0 |
| **Date** | 2026-11-10 |
| **Standard** | WCAG 2.2 Level AA for all text and controls; body copy targets AAA where the palette permits |
| **Design authority** | [`DESIGN_SYSTEM_V2.md`](DESIGN_SYSTEM_V2.md) |
| **Verification** | axe-core, Playwright, manual keyboard/screen-reader/high-glare checks |

The v1.0 claim of WCAG 2.1 AAA with terracotta CTAs was false. The v2 palette replaces it. This document defines the target and the evidence required to claim it.

---

## 1. Target and non-negotiables

- **AA is the release gate** for every screen in all four portals.
- Body text and critical status text target AAA (7:1) where the palette permits; they are not required to exceed AA.
- No text, control, status, or error may rely on colour alone.
- The primary action token is orange `#F28C28` with **green-900 `#102E27` text**. White on orange is forbidden.
- Body text is at least 16 px; critical prices and CTA labels are at least 18 px semibold.
- Minimum target size is 44×44 px; customer/admin controls are 48 px; kitchen primary actions are 52 px; rider primary actions are 56 px.
- Focus is always visible with a 3 px ring and 2 px offset.
- `prefers-reduced-motion` is respected; no essential information is conveyed by motion.

---

## 2. Canonical Contrast Pairs

Measured against the v2 tokens:

| Pair | Ratio | AA normal text | AAA normal text | Use |
| :--- | ---: | :--- | :--- | :--- |
| White on green-800 `#173F35` | **11.67:1** | Pass | Pass | Dark headers, primary green surfaces |
| White on green-900 `#102E27` | **14.4:1** | Pass | Pass | Deep surfaces |
| Green-900 on orange-500 `#F28C28` | **4.76:1** | Pass | Fail | Primary action label |
| Orange-700 `#A65A0F` on white | **5.13:1** | Pass | Fail | Orange text/links on light surfaces |
| White on orange-500 `#F28C28` | **2.32:1** | **Fail** | **Fail** | **Forbidden** |
| Gray-600 `#52635D` on white | **6.36:1** | Pass | Fail | Metadata, secondary text |
| White on red-600 `#C62828` | **5.62:1** | Pass | Fail | Error/destructive surfaces |
| Red-600 `#C62828` on white | **5.62:1** | Pass | Fail | Error text |
| White on success-700 `#17603F` | **7.2:1** | Pass | Pass | Confirmed/paid |
| White on warning-700 `#8A4B00` | **7.4:1** | Pass | Pass | Warning |
| Green-900 on green-50 `#F2F7F5` | **13.8:1** | Pass | Pass | Tinted rows |
| Ink on white | **16.25:1** | Pass | Pass | Body copy |

### 2.1 Hard rules

1. Never place white text on `#F28C28`.
2. Never use `#F28C28` as body text on white; use `#A65A0F`.
3. Red is for errors, destructive actions, and critical alerts only. Do not use it for ordinary busy states.
4. Status badges combine colour, icon, and text.
5. A token change without a contrast test is a build failure.
6. Do not use pure white as the full-page canvas; use the gray-100 tint.

---

## 3. Component Requirements

### 3.1 Primary action

```tsx
<button className="min-h-12 rounded-xl bg-[#F28C28] px-5 text-lg font-semibold text-[#102E27] hover:bg-[#E07D1F] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#173F35] focus-visible:ring-offset-2 disabled:opacity-50">
  Pay USh 35,000
</button>
```

- The disabled state exposes `aria-disabled="true"` and a visible reason.
- The button label includes the amount and method.

### 3.2 Status pills

| Status | Background | Text | Example |
| :--- | :--- | :--- | :--- |
| Paid / Delivered | `#E8F5E9` | `#17603F` | Paid online |
| Cash due / 86'd / late | `#FEE2E2` | `#C62828` | Collect USh 38,000 |
| Cooking / assigned / busy | `#FEF3C7` | `#8A4B00` | Cooking in kitchen |
| Neutral / ready | `#F2F4F3` | `#173F35` | Ready for pickup |

### 3.3 KDS

- Ticket text ≥ 18 px; order number ≥ 24 px bold.
- Bump button is `h-[52px]`, not `h-13`.
- Timers show elapsed minutes plus a word (`New`, `Late`); colour is secondary.
- Audio alerts have a visual counterpart and can be muted; muting is visible in the header.
- The shift-start overlay is keyboard operable and explains why sound needs a gesture.

### 3.4 Rider

- Primary actions ≥ 56 px, reachable with gloves.
- PIN keypad has labelled keys and supports physical keyboard input.
- Offline state is text + icon; completion is blocked and never queued, faked, or labelled “Delivered”.
- Map has a text fallback with area, distance, and ETA.

### 3.5 Forms and errors

- Visible `<label>` for every input; placeholders are not labels.
- Errors use `role="alert"`, `aria-invalid`, and `aria-describedby`.
- Error text is red-600 on white or on the error tint, never red on a photograph.
- Required fields are marked in text.

### 3.6 Dialogs and sheets

- Use native `<dialog>` or an equivalent with focus trap and restore.
- Escape closes; the close control has an accessible name.
- Mobile uses bottom sheets; desktop may use a centred dialog.
- Destructive confirmations require a reason and never autofocus the destructive action.

### 3.7 Maps, charts, and status

- Rider marker has a distinct shape and label.
- Charts include a table or text summary; colour is not the only encoding.
- Status changes are announced through a polite live region.
- Toasts use `aria-live`; errors use `role="alert"`.

---

## 4. Verification Plan

| Check | Tool | Gate |
| :--- | :--- | :--- |
| axe scan on `/`, `/checkout`, `/orders/[token]`, `/kitchen`, `/rider`, `/admin`, `/admin/ledger` | `@axe-core/playwright` | Zero critical or serious violations |
| Contrast token test | CI script | All text pairs meet their declared target |
| Keyboard-only flows | Manual + Playwright | Checkout, kitchen bump, rider claim/PIN, admin reconcile complete without a mouse |
| 200% zoom / 320 px width | Playwright viewport + manual | No horizontal scroll; no clipped CTA |
| Screen reader | NVDA/VoiceOver | Controls named; status changes announced; PIN not read on staff screens |
| Reduced motion | Playwright `emulateMedia` | No essential animation |
| High-glare | Actual kitchen tablet and budget Android phone | PIN, price, and CTA remain legible |
| Touch targets | Script + manual | 44 px minimum; 48/52/56 px portal targets |

`npm run test:a11y` is a merge gate.

---

## 5. Manual Test Script

1. Complete checkout with the keyboard only, including the map pin (text fallback) and payment redirect.
2. On the tracker, confirm the PIN is announced only after the safety-seal instruction.
3. On the KDS, enable sound with the keyboard, accept a cash order, bump a delivery order, and 86 an item.
4. On the rider portal, claim, start, enter a wrong PIN, then the correct PIN; then switch offline and confirm completion is blocked with an explanation.
5. On the admin ledger, reconcile with keyboard only and confirm the variance is announced.
6. At 200% zoom, verify the sticky CTA does not cover form errors.
7. With reduced motion, verify no status relies on animation.

---

## 6. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.3.0 | 2026-11-10 | Unified touch targets and 3 px focus ring; clarified AA release gate with AAA only where the palette permits. |
| 1.2.0 | 2026-11-09 | Replaced terracotta palette with v2 green/orange tokens; corrected contrast evidence; added KDS/rider/dialog/chart rules and a manual script. |
| 1.1.0 | 2026-10-29 | Initial AA correction. |

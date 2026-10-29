# ACCESSIBILITY — WCAG 2.2 AA Baseline and Corrected Palette

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.1 amendment to `DESIGN_SYSTEM_AND_UI_SPEC.md` |
| **Standard** | WCAG 2.2 Level AA (the v1.0 claim of AAA is retired) |
| **Date** | 2026-10-29 |
| **Verification** | axe-core, Playwright, manual high-glare test |

---

## 1. Why the v1.0 claim was false

The v1.0 design document claimed:

- White text on `#D84A26` is `4.6:1`.
- The palette meets WCAG 2.1 **AAA**.

Measured values:

| Pair | Measured contrast | WCAG 2.2 AA result |
| :--- | ---: | :--- |
| White on `#D84A26` | **4.26:1** | Fails normal text (needs 4.5:1) |
| `#D84A26` on `#F9F8F6` | **4.02:1** | Fails normal text |
| `#D84A26` on `#FFFFFF` | **4.26:1** | Fails normal text |

`#D84A26` is still a valid **decorative** brand colour, but it cannot be the background of a primary button with white text, and it cannot be body text on the linen ground.

---

## 2. Corrected semantic palette

Use these tokens. The names in `tailwind.config.ts` must match this table.

| Token | Hex | Use | Contrast evidence |
| :--- | :--- | :--- | :--- |
| `surface.ground` | `#F9F8F6` | App background | Base |
| `surface.card` | `#FFFFFF` | Cards, sheets | Base |
| `surface.inset` | `#EFECE6` | Inputs, counters | Ink contrast 14.89:1 |
| `ink.primary` | `#1A1918` | Titles, prices, body | 16.54:1 on ground; 17.56:1 on white |
| `ink.secondary` | `#4A4744` | Descriptions, helper text | 8.69:1 on ground; 9.23:1 on white |
| `ink.muted` | `#6B6763` | Minimum small text | 5.28:1 on ground; 5.61:1 on white |
| `brand.action` | `#B83817` | Primary CTA background, active text | White text 5.81:1; on ground 5.47:1 |
| `brand.action-hover` | `#A63312` | Pressed/hover CTA | White text 6.77:1; on ground 6.37:1 |
| `brand.decorative` | `#D84A26` | Borders, illustrations, large accents | 4.02:1 on ground; **not for normal text** |
| `status.success` | `#1B5E3B` | Paid, delivered, in stock | 7.75:1 on white; 7.30:1 on ground |
| `status.success-bg` | `#E8F5E9` | Success pill background | Success text 6.89:1 |
| `status.danger` | `#B91C1C` | Cash due, 86'd, late timer | 6.47:1 on white; 6.10:1 on ground |
| `status.danger-bg` | `#FEE2E2` | Danger pill background | Danger text 5.30:1 |
| `status.warning` | `#92400E` | Cooking, assigned | 7.09:1 on white; 6.68:1 on ground |
| `status.warning-bg` | `#FEF3C7` | Warning pill background | Warning text 6.37:1 |
| `border.structural` | `#E5E0D8` | 1 px borders | Non-text only |
| `focus.ring` | `#1A1918` | Focus indicator | 16.54:1 on ground |

### 2.1 Hard rules

1. **Primary buttons** use `bg-brand-action` (`#B83817`) with white text. Hover/pressed uses `#A63312`.
2. **Never** place white text on `#D84A26` for normal-sized text. Use it only for decorative fills, borders, icons, or text at ≥ 24 px / ≥ 18.66 px bold (3:1 minimum).
3. **Never** use `#D84A26` as body text on `#F9F8F6`. Use `#B83817` for terracotta text.
4. Body text is at least **16 px**; critical prices and CTA labels are at least **18 px semibold**.
5. Minimum touch target is **48 × 48 px** with at least **8 px** spacing.
6. Never communicate status by colour alone. Pair colour with a label, icon, and/or pattern.
7. Focus must be visible on every interactive element: 2 px `#1A1918` ring with 2 px offset.
8. Respect `prefers-reduced-motion`; no essential information is conveyed by motion.
9. Do not use pure white as the full-page canvas; use `#F9F8F6`.
10. Re-run contrast checks whenever a token changes. A token change without a contrast test is a build failure.

---

## 3. Component-specific requirements

### 3.1 Primary CTA

```tsx
<button className="min-h-12 rounded-xl bg-brand-action px-5 text-lg font-semibold text-white hover:bg-brand-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-ground disabled:opacity-50">
  Pay USh 35,000 via MTN MoMo
</button>
```

- Do not use `bg-brand-decorative` for the button.
- The disabled state must also expose `aria-disabled="true"` and a reason.

### 3.2 Status pills

| Status | Background | Text | Example |
| :--- | :--- | :--- | :--- |
| Paid / Delivered | `#E8F5E9` | `#1B5E3B` | `Paid online` |
| Cash due / 86'd | `#FEE2E2` | `#B91C1C` | `Collect USh 38,000` |
| Cooking / Assigned | `#FEF3C7` | `#92400E` | `Cooking in kitchen` |
| Neutral | `#EFECE6` | `#4A4744` | `Ready for pickup` |

### 3.3 KDS and rider screens

- KDS ticket text is at least 18 px; order number at least 24 px bold.
- The 52 px bump button is written `h-[52px]`, not `h-13` (not a default Tailwind class).
- Rider cards use a light card on the linen ground, not white text on terracotta.
- The handover PIN box uses `#1A1918` text on `#FFFFFF` with a 2 px `#1A1918` border, and a monospace 32 px PIN.

### 3.4 Forms and errors

- Every input has a visible `<label>`; placeholders are not labels.
- Errors are announced with `role="alert"` and linked with `aria-describedby`.
- Error text uses `status.danger` on `surface.card`, not red on a red tint.
- Required fields are marked in text, not only with an asterisk.

### 3.5 Maps

- Do not rely on colour alone for the rider marker; use a distinct shape and label.
- Provide a text fallback with the delivery area and ETA.
- Map controls have text labels or `aria-label`.

---

## 4. Verification plan

| Check | Tool | Gate |
| :--- | :--- | :--- |
| Automated axe scan on every page | `@axe-core/playwright` | Zero critical/serious violations |
| Keyboard-only navigation | Manual | Every flow completes without a mouse |
| 200% zoom / 320 px width | Manual + Playwright viewport | No horizontal scroll; no clipped CTA |
| Screen reader labels | Manual (NVDA/VoiceOver) | All controls named; status changes announced |
| Contrast tokens | Script in CI | All text pairs ≥ 4.5:1; large text ≥ 3:1 |
| Outdoor glare | Manual on the actual kitchen tablet and a budget Android phone | PIN, price, and CTA remain legible |
| Reduced motion | Playwright `emulateMedia({ reducedMotion: 'reduce' })` | No essential animation |

Add `npm run test:a11y` to CI. A failing axe check blocks merge.

---

## 5. Changes to `DESIGN_SYSTEM_AND_UI_SPEC.md`

The original document remains as historical context. Apply these amendments:

1. Replace the accessibility standard with **WCAG 2.2 AA**.
2. Replace the palette rows for `Brand Terracotta`, `Brand Terracotta Hover`, `Urgent`, and `Pending` with the table in §2.
3. Rename `brand.terracotta` to `brand.decorative`; add `brand.action` and `brand.action-hover`.
4. Replace all `bg-brand-terracotta` primary buttons with `bg-brand-action`.
5. Replace `text-brand-terracotta` body text with `text-brand-action`.
6. Replace `h-13` with `h-[52px]`.
7. Add a `focus-visible` ring to every interactive component.
8. Delete the “AAA” claim and the unverified 4.6:1/5.8:1/5.9:1/5.1:1 labels.

---

## 6. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.1.0 | 2026-10-29 | Created; corrected palette, WCAG 2.2 AA, verification plan. |

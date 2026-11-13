# BROWSER AND DEVICE SUPPORT

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.5 |
| **Version** | 1.5.0 |
| **Date** | 2026-11-13 |
| **Owner** | Engineering |
| **Related** | `TECH_STACK_AND_CONVENTIONS.md`, `ACCESSIBILITY.md`, `OPERATIONS_RUNBOOK.md` §7 |

This document closes the P2 “no browser support matrix / no device matrix” findings. It is a support policy, not a promise that every feature works identically everywhere.

---

## 1. Supported matrix

| Portal | Primary target | Minimum supported | Notes |
| :--- | :--- | :--- | :--- |
| Customer | Chrome for Android (last 2 major versions), Safari iOS 16+ | Chrome 110+, Safari 16+, Edge 110+, Firefox 110+ on desktop | Mobile-first; checkout requires connectivity. |
| Kitchen | Chrome/Edge on the kitchen tablet or PC | Chrome 110+, Edge 110+ | Landscape, 1280×800 or larger; keyboard and printer access. |
| Rider | Chrome for Android (last 2 major versions), Safari iOS 16+ | Chrome 110+, Safari 16+ | Foreground tracking; Screen Wake Lock where supported. |
| Admin | Chrome/Edge/Firefox on desktop | Chrome 110+, Edge 110+, Firefox 110+, Safari 16+ | Minimum 1024 px width for dense tables. |
| Design system | Any supported browser | Same as above | Static reference; no production guarantees. |

Internet Explorer, Opera Mini, and Android WebView below Chrome 110 are **not supported**. Do not spend time on polyfills for them.

### 1.1 Device baseline

- Customer: 360 px-wide Android phone, 2 GB RAM, 3G or better.
- Rider: Android phone with GPS and a mount; battery saver may suspend background work.
- Kitchen: the actual tablet/PC model must be confirmed under founder gate F-62. Until then, test on a 1280×800 Chrome window and a 58 mm/80 mm print target.
- Admin: laptop at 1280×800 or larger.

Record the real device models, OS versions, and browser versions in the launch ticket.

---

## 2. Feature support and fallbacks

| Feature | Supported | Fallback / rule |
| :--- | :--- | :--- |
| Geolocation | All supported mobile browsers | Manual address/area selection; never fabricate coordinates. |
| Screen Wake Lock | Chromium browsers; Safari support varies | Show “Keep this screen open”; do not promise background GPS. |
| Web Bluetooth / USB printing | Not required for MVP | Browser print dialog to a 58/80 mm thermal printer. |
| Clipboard | Supported with user gesture | Manual copy field. |
| Vibration | Android Chromium | No-op on unsupported devices. |
| Service worker / PWA | Chromium and Safari 16+ with limitations | Menu browsing works offline; checkout and staff portals require connectivity. |
| `dialog` element | Supported | Local fallback in `ui.js` for older engines. |
| CSS `:has()` | Supported in targets | Do not use it for critical layout. |

Do not use Web Bluetooth for the MVP printer path. It is a Phase 2 enhancement only.

---

## 3. Performance targets

Measure with Lighthouse mobile throttling (“Slow 4G”, 4× CPU slowdown) and the production build:

| Metric | Target |
| :--- | :--- |
| Largest Contentful Paint (p75) | ≤ 2.5 s on the customer menu |
| Interaction to Next Paint (p75) | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Initial JS on customer menu | Keep under the Phase 1 budget; no component library |
| KDS ticket render | ≤ 1 s after poll/Broadcast on the kitchen device |

Report p75, not averages. Measure at least 20 runs per page. Do not claim performance from the static prototype.

---

## 4. Test matrix

At minimum, test these combinations before launch:

1. Android Chrome — customer checkout, COD OTP, rider claim/PIN, blocked offline completion.
2. iOS Safari — customer checkout, tracker, map fallback, PIN entry.
3. Desktop Chrome — kitchen board, print dialog, admin tables, CSV export.
4. Desktop Firefox — admin and customer read paths; note any print differences.
5. Kitchen tablet — actual device, landscape, printer connected, network drop.
6. Rider phone — GPS on, screen lock, battery saver, weak network.
7. 360 px width — no horizontal scroll, 48 px targets, sticky actions reachable.

Accessibility checks (axe + keyboard + screen reader) follow [`ACCESSIBILITY.md`](ACCESSIBILITY.md).

---

## 5. Known limitations

- Mobile browsers suspend JavaScript when backgrounded; rider tracking is foreground-first.
- iOS Safari may throttle timers and geolocation updates; the tracker shows the last known time.
- Print margins and paper width vary by driver; the docket CSS targets 58 mm and 80 mm but the founder must confirm the printer model.
- PWA install prompts are browser-specific; do not block ordering on installation.

---

## 6. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.5.0 | 2026-11-13 | Aligned the support matrix to v1.5; no browser or device requirement changed. |
| 1.2.0 | 2026-11-09 | Created; closes the P2 browser/device/performance-method gaps. |

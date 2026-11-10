# INTEGRATIONS AND HARDWARE APIS

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.3.0 |
| **Date** | 2026-11-10 |
| **Supersedes** | v1.0 generic HMAC contract, OTP prose, OSM tiles, ESC/POS assumptions, background-GPS promise |
| **Authority** | `DECISIONS.md` ADR-002/003/004/005/007/009/014/016, `API_CONTRACTS.md`, migration |

All providers are behind adapters. The application must keep working with a mock adapter in local/E2E mode and must fail closed when a production provider is unavailable.

---

## 1. Provider Matrix

| Capability | Production | Development / test |
| :--- | :--- | :--- |
| Payments | Flutterwave hosted checkout (MoMo, Airtel, card) | Mock adapter, no network |
| Webhook route | `POST /api/webhooks/flutterwave` | Same route with mock adapter |
| SMS/OTP | Africa's Talking | Console/mock adapter |
| Routing | Self-hosted OSRM | Mock fixtures or public demo, never a final-fee fallback |
| Map tiles | MapTiler (restricted key) | OSM standard tiles with attribution |
| Rate limits/cache | Upstash Redis REST | In-memory adapter allowed for local tests only |
| Printing | Browser print to 58/80 mm thermal printer | Browser print preview |
| Notifications | SMS via Africa's Talking; WhatsApp support link | Console/mock outbox |

Secrets live in the hosting secret manager or local `.env.local`. They are never committed, logged, or bundled.

---

## 2. Flutterwave Payments

### 2.1 Initiation

1. Server creates the order in `PENDING_PAYMENT` with integer totals and a unique `order_token`.
2. Server calls Flutterwave `POST https://api.flutterwave.com/v3/payments` with:
   - `tx_ref = orders.order_token`;
   - `amount` and `currency = "UGX"`;
   - customer name/phone/email placeholder;
   - `redirect_url` to the customer tracker return route;
   - approved payment options for MTN/Airtel/card.
3. Server stores the provider response reference in `payment_transactions` and returns the hosted-checkout URL.
4. The browser redirects to Flutterwave. No card data enters the app.

### 2.2 Webhook Authentication

Flutterwave sends a `verif-hash` header that is a **plain shared-secret comparison**, not an HMAC of the request body.

```ts
const expected = process.env.FLW_WEBHOOK_HASH!;
const received = request.headers.get("verif-hash") ?? "";
const ok = received.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
```

- Reject a missing/mismatched hash with `401` and no state change.
- Do not trust the webhook body's status alone.
- On a valid event, call `GET https://api.flutterwave.com/v3/transactions/{id}/verify` with the secret key.
- Compare the verified amount, currency, and `tx_ref` to the stored order.
- Only then mark the payment successful.

### 2.3 Idempotency and Late Events

- Insert the provider event into `webhook_events` with a unique `(provider, provider_event_id)`.
- If the event already exists and is processed, return `200` without reprocessing.
- A successful event for a `CANCELLED`, `DELIVERY_FAILED`, or already-`DELIVERED` order must **not** resurrect the order. Record the event and create a refund/manual-review task.
- A failed event for a paid order does not downgrade it; reconcile against the verification API.
- Payment success moves `PENDING_PAYMENT → PREPARING` exactly once and sets `acknowledged_at`.

### 2.4 Timeout, Retry, and Refund

- `expire_pending_orders()` runs every minute (Supabase `pg_cron` or Vercel Cron) and cancels digital orders still pending after 10 minutes.
- A failed or abandoned payment returns the customer to checkout with the existing idempotency key and a “Try again” action. A new key is generated only when the cart changes.
- Refunds are recorded in `refunds` with status `REQUESTED → PROCESSING → COMPLETED/FAILED`.
- Admin cancellation of a paid order creates a `REQUESTED` refund. The worker calls Flutterwave's refund endpoint and stores the provider reference. Cash refunds require an admin reason and audit row.
- Refund limits and approvers are founder policy (`F-34`, `F-41`).

### 2.5 Mock Mode

`PAYMENTS_MODE=mock` is allowed only when `NODE_ENV !== "production"`. It must be rejected at startup in production. Mock mode simulates success/failure/timeout and never contacts Flutterwave.

---

## 3. SMS and OTP (Africa's Talking)

- Use the approved sender ID and transactional templates.
- OTP: 6 digits, 10-minute expiry, 3 attempts, 3 sends per phone per hour.
- Store only a hash in `otp_verifications`; never log the code.
- First-time COD customers must verify. Returning customers with a delivered order may skip when the setting permits.
- If the provider is down, COD checkout is disabled with a clear message; do not silently bypass.
- Status notifications are written to the `notifications` outbox and dispatched with bounded retries and a dead-letter state. Dine-in orders do not receive delivery-status SMS.
- WhatsApp is a human support link in v1, not an automated channel.

Webhook/callback authentication for delivery receipts must be verified before updating a notification as `SENT`.

---

## 4. Routing and Distance

### 4.1 OSRM

- Production uses a self-hosted OSRM instance with a Uganda/OSM extract.
- Development uses a mock adapter or the public demo server.
- `/api/distance` accepts only validated coordinates, quantizes them for the cache key, and returns integer metres plus duration.
- Distance is measured from the restaurant coordinates to the destination. Prepaid delivery accepts routes up to `max_delivery_radius_km` (15.0 km); COD checkout additionally enforces `cod_max_radius_km` (8.1 km).
- Cache identical routes for 24 hours.
- If OSRM fails and no valid cache exists, return `DISTANCE_UNAVAILABLE` and block checkout. Never return a Haversine estimate as the final fee.
- Rate limit: 30 requests/minute/IP in production.

### 4.2 Request / Response

```http
GET /api/distance?lat=0.3245&lng=32.5782
```

```json
{
  "success": true,
  "data": {
    "distanceM": 1562,
    "distanceKm": 1.562,
    "durationSeconds": 212,
    "source": "OSRM",
    "cached": false
  }
}
```

Errors use `{ "success": false, "error": { "code": "DISTANCE_UNAVAILABLE" | "DISTANCE_OUT_OF_BOUNDS" | "VALIDATION_ERROR", "message": "..." } }`.

### 4.3 Map Tiles and Leaflet

- Production: MapTiler with a domain-restricted key and visible attribution.
- Development: OSM standard tiles with attribution.
- Leaflet CSS must be imported in the client map wrapper or global stylesheet.
- `next/dynamic` with `ssr: false` belongs inside a `"use client"` wrapper.
- The map skeleton has a text fallback and `aria-busy`.

---

## 5. Rider Telemetry

### 5.1 Permissions and Scope

- Foreground only. Do not promise background/locked-screen tracking.
- Ask for geolocation permission in context, explain why, and provide a manual fallback.
- Use the Screen Wake Lock API while the rider is on an active delivery, and show a “keep this screen open” instruction.
- `update_rider_telemetry(order_id, lat, lng, accuracy, heading, speed)` validates:
  - caller is a rider;
  - the order belongs to `auth.uid()`;
  - the order is `OUT_FOR_DELIVERY`;
  - coordinate bounds.
- Pool and customer payloads never include another rider's exact position.

### 5.2 Sampling and Offline Queue

- Send at most one point every 15 seconds or every 20 metres, whichever is later.
- Batch up to 10 points.
- Store unsent points in IndexedDB (not `localStorage`) with a bounded queue: at most 50 points or 10 minutes of history.
- Retry with exponential backoff and jitter. Drop the oldest points once the bound is reached.
- When reconnecting, replay in timestamp order; the server rejects points for a completed order.
- Show a visible “GPS paused/offline” state. Do not show a moving map when data is stale.

### 5.3 Customer Tracker

- Poll `get_order_telemetry(order_token)` every 10 seconds while the page is visible.
- Stop polling when hidden; resume on visibility.
- If stale by more than 60 seconds, show “Last seen N minutes ago” rather than a false live position.

---

## 6. Printing and Receipts

- MVP uses browser print (`window.print()` + `@media print`) to a 58 mm or 80 mm thermal printer.
- `GET /api/print/receipt/[orderId]` returns `text/html; charset=utf-8` docket markup for kitchen/admin, ready for the browser print dialog. ESC/POS is deferred per ADR-007.
- The print stylesheet defines roll width, margins, font size, and page breaks.
- Kitchen dockets show order number, time, type, items/modifiers, notes, and payment status. They never show the handover PIN.
- Customer receipts show masked phone, item totals, fees, total, order token/QR, and the legal footer from the founder-approved content.
- A reprint button is available to kitchen/admin and writes an audit row.
- ESC/POS over Web Bluetooth/USB is a future enhancement, not a launch dependency.
- If printing fails, the kitchen can use a handwritten docket; the order remains visible on the KDS.
- The HTML docket and print CSS must use the same totals as `CANONICAL_EXAMPLES.md`; the route never prints the handover PIN.

Canonical receipt totals must match `CANONICAL_EXAMPLES.md`; do not hardcode old values in templates.

---

## 7. Deep Links and Device Behaviour

| Action | Link |
| :--- | :--- |
| Call customer/rider | `tel:+256...` |
| WhatsApp support | `https://wa.me/256...?text=...` |
| Navigation | Provider-neutral geo URI or Maps URL with destination coordinates |
| Copy tracker | `https://{domain}/orders/{token}` |

- Phone numbers in links are E.164.
- Never put a PIN, token, or customer address in a WhatsApp prefilled case number.
- Handle `tel:` failure with a visible fallback number.
- Test on the actual kitchen tablet and rider phones before launch (`F-62`, `F-63`).

---

## 8. Hardware and Browser Matrix

| Device | Requirement |
| :--- | :--- |
| Kitchen tablet/PC | Chrome 110+ or Edge 110+, stable power, printer installed, sound enabled once per session |
| Rider phone | Android Chrome 110+ or iOS Safari 16+, GPS, data plan, mount, power bank |
| Admin laptop | Chrome 110+, Edge 110+, Firefox 110+, or Safari 16+ |
| Printer | 58 mm or 80 mm thermal, OS driver installed; browser print is the fallback |

KDS audio:

- Browsers block autoplay until a gesture. Show a “Enable sound” banner.
- After unlock, chime on a new ticket and repeat every 15 seconds until `acknowledged_at`.
- Stop repeating on accept, cancel, or when the ticket leaves the new queue.
- Multiple tablets may chime; acceptance in one is reflected through the shared state/polling.

---

## 9. Failure Modes

| Failure | Behaviour |
| :--- | :--- |
| Flutterwave down | Checkout shows retry; no order is marked paid; COD remains available within policy |
| Webhook backlog | Events are stored and retried; order stays pending until verification succeeds or timeout |
| OSRM down | Checkout blocked with `DISTANCE_UNAVAILABLE` |
| SMS down | COD checkout disabled; tracker and prepaid checkout continue |
| Map tiles down | Address form and distance still work; map shows a text fallback |
| Printer down | KDS remains authoritative; handwritten docket fallback |
| Rider GPS unavailable | Rider can call/navigate manually; admin can complete with reason |
| Supabase down | Read-only offline shell; mutations queue only where the contract permits |
| Upstash down | Fail closed on rate-limited public mutations; staff read paths continue |

---

## 10. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.0.0 | 2026-10-29 | Original integration draft. |
| 1.1.0 | 2026-10-29 | Amendment banner only. |
| 1.3.0 | 2026-11-10 | Aligned distance envelope and response, telemetry queue bounds, browser minimums, and HTML print route. |
| 1.2.0 | 2026-11-09 | Corrected Flutterwave, OTP, OSRM, telemetry, printing, deep-link, and failure contracts. |

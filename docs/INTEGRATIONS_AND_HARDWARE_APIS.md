# INTEGRATIONS_AND_HARDWARE_APIS.md

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved Technical Integration Specification
* **Target Environment:** Standard Mobile Web Browsers (Chrome for Android / Safari iOS)
* **Scope:** Geolocation Telemetry, Web Audio Synthesizer, Thermal Printing, Payment Webhooks, and Native URI Schemes
* **Regional Telecommunications:** Uganda (MTN Uganda, Airtel Uganda)

---

## 1. HTML5 Geolocation Telemetry Engine (Rider GPS Streaming)

To achieve live motorcycle tracking on customer screens without paid tracking SDKs (e.g., HyperTrack, Radar), the rider interface utilizes the browser-native **HTML5 Geolocation API** (`navigator.geolocation.watchPosition`).

```
[ Boda Rider Phone Browser: /rider ]
                 │
                 ├──(navigator.geolocation.watchPosition)
                 │
                 ▼
     [ Local Coordinate Buffer ] ──(Filter: Distance > 20m OR Elapsed > 12s)
                 │
                 ▼
  [ Supabase: UPSERT rider_telemetry ] ──(Realtime WebSocket)──> [ Customer Map: /orders/[token] ]
```

### 1.1 Watcher Configuration & Throttling
Continuous polling drains phone batteries rapidly under tropical heat and consumes excessive mobile data. Coordinates must be throttled before hitting the database:

* **High Accuracy Mode:** `enableHighAccuracy: true` (forces GPS hardware lock rather than cell-tower triangulation).
* **Timeout:** `10000` ($10\text{ seconds}$).
* **Maximum Age:** `0` (prevents serving stale cached coordinates).
* **Adaptive Push Filter:** Coordinates are dispatched to Supabase **only if**:
  1. The rider has moved more than **`20 meters`** from the last recorded point (calculated via Haversine), **OR**
  2. At least **`12 seconds`** have elapsed since the last transmission.

### 1.2 Telemetry Ingestion Contract (TypeScript)
```typescript
export interface RiderTelemetryPayload {
  rider_id: string;      // UUID referencing public.profiles
  order_id: string;      // UUID referencing active public.orders
  latitude: number;      // DECIMAL(10, 7) e.g., 0.3136123
  longitude: number;     // DECIMAL(10, 7) e.g., 32.5811456
  heading: number | null;// Degrees (0-360) from compass or motion vector
  speed: number | null;  // Speed in m/s (used to calculate moving/idle state)
  updated_at: string;    // ISO-8601 Timestamp
}
```

### 1.3 Telemetry Client Implementation Hook
```typescript
// src/hooks/use-geolocation.ts
"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useRiderTelemetry(riderId: string, activeOrderId: string | null) {
  const lastPushTime = useRef<number>(0);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!activeOrderId) return;

    if (!("geolocation" in navigator)) {
      console.error("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const { latitude, longitude, heading, speed } = position.coords;

        const timeElapsed = now - lastPushTime.current;
        const hasMovedSignificantly = lastCoords.current
          ? calculateDistanceMeters(
              lastCoords.current.lat,
              lastCoords.current.lng,
              latitude,
              longitude
            ) > 20
          : true;

        if (hasMovedSignificantly || timeElapsed > 12000) {
          lastPushTime.current = now;
          lastCoords.current = { lat: latitude, lng: longitude };

          await supabase.from("rider_telemetry").upsert({
            rider_id: riderId,
            order_id: activeOrderId,
            latitude,
            longitude,
            heading: heading || 0,
            updated_at: new Date().toISOString(),
          });
        }
      },
      (error) => console.warn(`GPS Telemetry error (${error.code}): ${error.message}`),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [riderId, activeOrderId, supabase]);
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

## 2. Web Audio API Alert Synthesizer (Kitchen Audio Engine)

To guarantee that kitchen cooks never miss incoming orders while eliminating external audio file dependencies (`.mp3` downloads that can fail over spotty 3G networks), audio alarms are **synthesized programmatically in real time via the Web Audio API**.

```
[ Browser User Gesture: "Tap to Enable Sound" ]
                        │
                        ▼
           [ Initialize AudioContext ]
                        │
      ┌─────────────────┴─────────────────┐
      ▼                                   ▼
[ New Order Chime ]              [ Urgent Overdue Pulse ]
Sine wave frequency ramp         Square wave alternating tone
587.33Hz (D5) -> 880Hz (A5)      440Hz <-> 880Hz (1Hz interval)
```

### 2.1 Browser Autoplay Policy Bypass Pattern
Modern browsers strictly forbid audio execution until a direct user gesture occurs. 
1. Upon loading `/kitchen`, the application checks `audioContext.state`.
2. If `state === 'suspended'`, a high-visibility modal covers the UI:
   `[ 🔔 TAP TO START SHIFT & ACTIVATE KITCHEN AUDIO ]`.
3. Tapping this button invokes `audioContext.resume()`, permanently enabling sound for that browser tab session.

### 2.2 Programmatic Chime Synthesizer
```typescript
// src/lib/audio/chimes.ts
class KitchenAudioEngine {
  private ctx: AudioContext | null = null;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Double-tone harmonic bell: Plays when a new order arrives
  public playNewOrderChime() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    // Pitch envelope: D5 (587.33Hz) jumping up to A5 (880.00Hz)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.0, now + 0.15);

    // Exponential decay (simulates physical brass bell strike)
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  // Urgent pulsed alarm: Fires if an order remains unbumped > 20 minutes
  public playUrgentWarning() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.1);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }
}

export const kitchenAudio = new KitchenAudioEngine();
```

---

## 3. Thermal Receipt Printing Subsystem (58mm & 80mm)

Kitchen staff and packaging lines rely on physical paper tickets. The platform provides native print output without specialized printer drivers using **CSS `@media print` rules** calibrated for standard $58\text{mm}$ and $80\text{mm}$ thermal paper roll profiles.

### 3.1 Browser Native Print Stylesheet (`globals.css`)
```css
@media print {
  /* Hide all interactive viewport UI */
  body * {
    visibility: hidden;
  }

  /* Expose only the print container */
  #thermal-print-container,
  #thermal-print-container * {
    visibility: visible;
  }

  #thermal-print-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 58mm; /* Defaults to 58mm roll; changes to 80mm via .format-80mm */
    margin: 0;
    padding: 2mm;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: "Courier New", Courier, monospace !important;
    font-size: 11pt;
    line-height: 1.2;
  }

  .format-80mm {
    width: 80mm !important;
  }

  @page {
    margin: 0;
    size: auto;
  }
}
```

### 3.2 Structured Plaintext Format (Raw Thermal Format)
When using direct Bluetooth serial printing, format the ticket text deterministically:

```
================================
     BAZAAR FLAME & GRILL       
   Plot 12, Bazaar Main Hub     
      Tel: +256 700 000000      
================================
ORDER: #1042       TYPE: DELIVERY
DATE: 29-OCT-2026 12:45 EAT
CUSTOMER: Sarah Namukasa
PHONE: +256 772 000 111
DROP: Plot 14 Lumumba Ave
--------------------------------
QTY  ITEM                  PRICE
--------------------------------
1x   Tilapia Flame Combo  32,000
     * NO ONIONS *
     * EXTRA CHILI *
1x   Passion Juice 500ml   5,000
--------------------------------
SUBTOTAL:             USh 37,000
DELIVERY FEE (3.8km):     USh  0
PACKAGING:            USh  1,000
TOTAL DUE:            USh 38,000
PAYMENT: PAID (MTN MOMO)
--------------------------------
   *** HANDOVER PIN: 4821 ***   
   CHECK SAFETY SEAL BEFORE PIN 
================================
```

---

## 4. Mobile Money & Payment Webhook Handlers

### 4.1 Inbound Webhook Specification (`/api/webhooks/payment`)
Payment aggregators (e.g., Flutterwave / Paystack) dispatch an HTTP `POST` event upon successful completion of a customer's USSD push prompt.

#### Security & Signature Validation:
1. Webhook payloads must be verified against an HMAC-SHA256 signature passed in the request header (`x-signature` or `verif-hash`).
2. Webhook execution must be **idempotent**: processing the same transaction ID twice must produce no duplicate state mutations.

### 4.2 Webhook Request Schema (Zod Validation)
```typescript
import { z } from "zod";

export const PaymentWebhookSchema = z.object({
  event: z.enum(["charge.completed", "payment.failed"]),
  data: z.object({
    id: z.string(),
    tx_ref: z.string().uuid(), // Maps directly to public.orders.order_token
    amount: z.number().int(),  // Amount in whole UGX
    currency: z.literal("UGX"),
    payment_type: z.enum(["mobilemoneyuganda", "card"]),
    status: z.enum(["successful", "failed"]),
    customer: z.object({
      phone_number: z.string(),
      name: z.string(),
    }),
  }),
});
```

### 4.3 Webhook Handler Implementation
```typescript
// src/app/api/webhooks/payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PaymentWebhookSchema } from "@/lib/schemas/payment";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");

    // 1. Cryptographic Signature Verification
    const secret = process.env.PAYMENT_WEBHOOK_SECRET!;
    const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Payload Parsing & Schema Validation
    const payload = PaymentWebhookSchema.parse(JSON.parse(rawBody));
    const { tx_ref, status, amount } = payload.data;

    // 3. Fetch Matching Order
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, order_status, payment_status")
      .eq("order_token", tx_ref)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 4. Idempotency Guard: Ignore if already processed
    if (order.payment_status === "PAID") {
      return NextResponse.json({ message: "Already processed" }, { status: 200 });
    }

    // 5. Amount Verification Guard (Anti-Tampering)
    if (amount !== order.total_amount) {
      console.error(`Fraud alert: Amount mismatch on order ${order.id}`);
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    // 6. Transition State: Shift to PREPARING
    if (status === "successful") {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "PAID",
          order_status: "PREPARING",
        })
        .eq("id", order.id);
    } else {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "FAILED",
          order_status: "CANCELLED",
        })
        .eq("id", order.id);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
```

---

## 5. External URI Schemes & WhatsApp Concierge Protocols

To maintain an ultra-low codebase size and avoid third-party mapping SDKs, all off-app integrations leverage standardized **Mobile Deep-Linking URI Schemes**.

### 5.1 One-Tap Google Maps Navigation (Rider Trigger)
When the motorcycle rider taps `[ 🗺️ Launch Navigation ]` on `/rider`, the phone opens native Google Maps with the destination coordinates pinned:

```typescript
// src/lib/navigation.ts
export function getNavigationUri(latitude: number, longitude: number, addressText: string): string {
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const encodedAddress = encodeURIComponent(addressText);

  if (isAndroid) {
    // Native Android Intent URI (Bypasses browser directly into Google Maps app)
    return `google.navigation:q=${latitude},${longitude}&mode=d`;
  }
  // Standard Cross-Platform Universal Link
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}
```

### 5.2 Contextual WhatsApp Concierge Generator
When a customer clicks `[ 💬 Help with Order ]`, WhatsApp opens with the order number, customer name, and order tracking link pre-populated:

```typescript
// src/lib/whatsapp.ts
export function generateWhatsAppHelpLink(
  supportNumber: string, // e.g., "+256700000000"
  orderNumber: number,   // e.g., 1042
  customerName: string,
  orderToken: string
): string {
  const cleanPhone = supportNumber.replace(/[^0-9]/g, "");
  const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderToken}`;

  const message = 
    `Hello Bazaar Flame & Grill! 👋\n` +
    `My name is ${customerName}. I have a question regarding Order #${orderNumber}.\n` +
    `Tracking Link: ${trackingUrl}`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
```
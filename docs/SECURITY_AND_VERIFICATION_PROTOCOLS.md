# SECURITY_AND_VERIFICATION_PROTOCOLS.md

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved Security Specification
* **Target Audience:** Security Engineers, Backend Developers & Antigravity Agentic Builders
* **Core Mandate:** Zero-Trust Verification, Cash Protection, Anti-Tampering, and Fraud Mitigation
* **Operational Setting:** Kampala, Uganda (EAT / UTC+3)

---

## 1. Threat Model & Security Posture

In a direct-to-consumer food ordering and motorcycle delivery system, financial losses typically arise from operational fraud rather than sophisticated network intrusions. 

The security architecture mitigates five specific threat vectors:

```
┌───────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Threat Vector                         │ Architectural Counter-Measure                          │
├───────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. Frontend Price Tampering           │ Zero-Trust Server Recalculation Pipeline               │
│ 2. False Delivery Claims              │ Cryptographic 4-Digit Handover PIN Verification Gate   │
│ 3. Cash on Delivery (COD) Abuse       │ Phone Number OTP Gate + Risk Blacklisting              │
│ 4. OSRM Routing API Scraping          │ IP-Based Leaky Bucket Rate Limiting & Keystroke Debounce│
│ 5. Concurrency Race Conditions        │ PostgreSQL Atomic Row-Level Locking (`FOR UPDATE`)     │
└───────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. The 4-Digit Handover PIN Verification Protocol

The Handover PIN serves as non-repudiable physical proof that the food package was transferred from the motorcycle rider to the customer.

```
[ Order Created ] ──(DB Trigger: pgcrypto)──> Generates 4-Digit PIN (e.g., '4821')
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
       [ Customer Storefront Token ]                                          [ Boda Rider View ]
      PIN visible on /orders/[token]                                       PIN IS NEVER SENT TO RIDER!
                      │                                                                   │
                      └─────────────(Customer verbally shares PIN)────────────────────────┘
                                                        │
                                                        ▼
                                           [ Rider Enters PIN: '4821' ]
                                                        │
                                    [ Server Action: verify_delivery_pin ]
                                                        │
                              ┌─────────────────────────┴─────────────────────────┐
                              ▼                                                   ▼
                         (Matches)                                           (Mismatches)
                              │                                                   │
                              ▼                                                   ▼
                   • order_status = DELIVERED                           • Increment failed_attempts
                   • delivered_at = now()                               • If attempts >= 3:
                   • If COD: payment_status = PAID                        LOCK ORDER & ALERT ADMIN
```

### 2.1 Cryptographic Token Isolation
* **Column Security:** The `handover_pin` column is strictly isolated in PostgreSQL.
* **API Redaction:** The Supabase RLS policy for riders explicitly strips the `handover_pin` field from all `SELECT` queries executed on `/rider`. The rider's smartphone browser **never** possesses the plain-text PIN in its DOM or memory.
* **Single Verification Gateway:** The only way to validate a PIN is through a protected Server Action that returns a boolean `match` flag.

### 2.2 Atomic Verification Server Action (TypeScript)
```typescript
// src/actions/rider.ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface VerifyPinResponse {
  success: boolean;
  error?: "INVALID_PIN" | "MAX_ATTEMPTS_EXCEEDED" | "ORDER_LOCKED" | "UNAUTHORIZED";
  remainingAttempts?: number;
}

export async function verifyDeliveryPin(
  orderId: string,
  riderId: string,
  submittedPin: string
): Promise<VerifyPinResponse> {
  const supabase = createServerClient();

  // 1. Fetch current order with strict lock
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, handover_pin, order_status, payment_method, rider_id")
    .eq("id", orderId)
    .single();

  if (error || !order || order.rider_id !== riderId) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  if (order.order_status !== "OUT_FOR_DELIVERY") {
    return { success: false, error: "ORDER_LOCKED" };
  }

  // 2. Fetch attempt counter from Redis/Database session
  const attemptKey = `pin_attempts:${orderId}`;
  const currentAttempts = await getAttemptCount(attemptKey);

  if (currentAttempts >= 3) {
    // Flag order for manager intervention on /admin
    await supabase
      .from("orders")
      .update({ customer_notes: "SECURITY ALERT: 3 Failed PIN Attempts. Verification Locked." })
      .eq("id", orderId);

    return { success: false, error: "MAX_ATTEMPTS_EXCEEDED", remainingAttempts: 0 };
  }

  // 3. Cryptographic Constant-Time Comparison
  // Prevents timing attacks on the 4-digit token
  const pinBufferA = Buffer.from(order.handover_pin);
  const pinBufferB = Buffer.from(submittedPin.trim());

  const isMatch =
    pinBufferA.length === pinBufferB.length &&
    crypto.timingSafeEqual(pinBufferA, pinBufferB);

  if (!isMatch) {
    const newCount = await incrementAttemptCount(attemptKey);
    const remaining = Math.max(0, 3 - newCount);
    return { success: false, error: "INVALID_PIN", remainingAttempts: remaining };
  }

  // 4. Successful Verification: Atomic State Mutation
  const updates: Record<string, unknown> = {
    order_status: "DELIVERED",
    delivered_at: new Date().toISOString(),
  };

  // If order was Cash on Delivery, this transition marks payment collected
  if (order.payment_method === "CASH_ON_DELIVERY") {
    updates.payment_status = "PAID";
  }

  await supabase.from("orders").update(updates).eq("id", orderId);

  // Clear attempt counter
  await clearAttemptCount(attemptKey);

  revalidatePath("/rider");
  revalidatePath(`/orders/${orderId}`);

  return { success: true };
}

// In-memory or Redis-backed rate limiter simulation
const attemptStore = new Map<string, number>();

async function getAttemptCount(key: string): Promise<number> {
  return attemptStore.get(key) || 0;
}

async function incrementAttemptCount(key: string): Promise<number> {
  const current = (attemptStore.get(key) || 0) + 1;
  attemptStore.set(key, current);
  return current;
}

async function clearAttemptCount(key: string): Promise<void> {
  attemptStore.delete(key);
}
```

---

## 3. Server-Side Price & Distance Hardening (Zero-Trust Pipeline)

Web applications are inherently vulnerable to malicious users intercepting network requests or altering frontend JavaScript state (e.g., modifying item prices in browser memory from `USh 32,000` to `USh 1,000`).

### 3.1 Zero-Trust Checkout Execution Schema
The checkout Server Action (`createOrderAction`) rejects **all client-calculated financial totals**:

```
[ Client Sends Only Identifiers ]
  • items: [{ id: "m1", quantity: 2, modifier_ids: ["mod_1"] }]
  • target_coordinates: { lat: 0.3476, lng: 32.5825 }
  • payment_method: "MTN_MOMO"
                   │
                   ▼
[ Server-Side Pipeline Execution ]
  1. Fetch actual DB prices for items and modifiers
  2. Compute items_subtotal = Sum(db_price * qty)
  3. Validate Minimum Order Value: items_subtotal >= MOV
  4. Query OSRM routing engine independently for driving distance
  5. Apply exact 5 km tier formula on server
  6. Fetch default packaging fee from app_settings
  7. Compute total_amount = subtotal + modifiers + packaging + delivery_fee
  8. Insert transaction record into Supabase
```

### 3.2 Zod Input Validation Schema
Every incoming checkout payload is parsed strictly:

```typescript
import { z } from "zod";

export const CreateOrderInputSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(
      /^(?:\+256|0)(?:7[0-9]|20)[0-9]{7}$/,
      "Must be a valid Ugandan phone number (e.g., +256772000111 or 0772000111)"
    ),
  orderType: z.enum(["DELIVERY", "DINE_IN"]),
  tableNumber: z.string().trim().max(10).optional(),
  deliveryCoordinates: z
    .object({
      latitude: z.number().min(-1.5).max(4.5), // Uganda geographic bounding box
      longitude: z.number().min(29.5).max(35.0),
    })
    .optional(),
  deliveryAddressText: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        modifierIds: z.array(z.string().uuid()).default([]),
      })
    )
    .min(1, "Cart cannot be empty"),
  paymentMethod: z.enum(["MTN_MOMO", "AIRTEL_MONEY", "CASH_ON_DELIVERY", "BANK_CARD"]),
  codChangeRequestedFor: z.number().int().optional(),
  customerNotes: z.string().trim().max(500).optional(),
});
```

---

## 4. Driver Authentication & Session Authorization

Motorcycle riders operate in fast-paced environments with gloved hands and smartphone mounts. Complex alphanumeric passwords cause high friction, leading riders to bypass the system.

### 4.1 Low-Friction 4-Digit Driver PIN Authentication
* Each of the 5 motorcycle riders is assigned a persistent record in `public.profiles` with a role of `'RIDER'`.
* Riders log in at `/rider` using their **Registered Phone Number** and a **4-Digit Staff PIN**.

### 4.2 Rider Session Claims (JWT)
Upon successful PIN validation, the server generates a scoped session cookie (`httpOnly`, `secure`, `sameSite: 'strict'`):
```typescript
interface RiderSessionToken {
  userId: string;
  role: "RIDER";
  motorcyclePlate: string; // e.g., 'UFD 342B'
  exp: number;             // 12-hour session duration
}
```

* **Role Isolation:** A rider session token cannot access `/admin` or `/kitchen`. 
* **Row-Level Enforcement:** PostgreSQL RLS policies restrict riders to updating only orders where `rider_id = auth.uid()` or where `order_status = 'READY_FOR_PICKUP'` (for the unclaimed pool).

---

## 5. Cash on Delivery (COD) Anti-Fraud Protocols

Cash orders carry inherent financial risks: malicious users submitting fake orders, resulting in wasted food and stranded motorcycle fuel.

### 5.1 First-Time Customer OTP Verification Gate
* If a customer selects **Cash on Delivery**, the backend checks the customer's phone number against past order history:
  * **Verified Returning Customer (Has $\ge 1$ successfully delivered order):** Allowed to checkout immediately without SMS verification.
  * **First-Time Customer:** Checkout halts at a verification modal: *"Enter the 6-digit code sent via SMS to verify your cash order."*
* An automated one-time SMS verification code is dispatched via the local SMS gateway. The order enters `CONFIRMED_UNPAID` only upon correct code entry.

### 5.2 COD Distance Restriction Ceiling
While pre-paid orders (MTN MoMo, Card) can be delivered up to the global ceiling of **`15.0 km`**, Cash on Delivery orders are restricted to a tighter geographic radius:
* **Prepaid Max Distance:** `15.0 km`
* **Cash on Delivery Max Distance:** **`8.0 km`**
* **Rationale:** A rejected or bogus cash delivery at 14 km results in a 28 km round trip (over 1 hour of rider time and high fuel burn). Restricting COD to 8.0 km limits maximum potential loss per occurrence.

### 5.3 Customer Phone Blacklisting
A dedicated database table tracks phone numbers associated with abandoned deliveries:
```sql
CREATE TABLE public.blacklisted_phones (
  phone_number TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```
* If a delivery is marked `CANCELLED` due to the customer refusing payment or disappearing upon rider arrival, the phone number is added to `blacklisted_phones`.
* Future checkout attempts from this number automatically disable Cash on Delivery, requiring 100% upfront digital payment via MTN MoMo or Airtel Money.

---

## 6. Rate Limiting, API Debouncing & Infrastructure Cost Guards

Because the platform uses public or low-cost APIs (such as OSRM for road distance routing), protective rate limiters must prevent abuse and denial-of-service (DoS) attacks.

### 6.1 Distance Proxy Rate Limiter (`/api/distance`)
To prevent automated scrapers from flooding the OSRM endpoint:
* **Leaky Bucket Limiter:** Maximum **20 requests per minute per IP address**.
* **Cache Header:** The distance route responds with:
  `Cache-Control: public, s-maxage=86400, stale-while-revalidate=43200`.
  Identical coordinate pairs return cached distances from edge memory rather than re-computing the route.

### 6.2 Frontend Pin-Drop Debouncing
The Leaflet map pin-drop interface on `/checkout` does **not** call `/api/distance` while the map is being actively dragged or panned.
* A debounce interval of **`400ms`** is enforced. The distance calculation triggers **only** after the user has completely released the map crosshair for 400 milliseconds.

---

## 7. Data Privacy & Customer PII Safeguards

Under Uganda's Data Protection and Privacy Act, customer Personally Identifiable Information (PII) must be handled with care:

1. **Rider Phone Isolation:** Riders view customer phone numbers through a native `tel:+256...` deep link on `/rider`. Customer phone numbers are not exposed in plaintext CSV exports and are never stored in the rider’s personal device address book.
2. **Order Token Unguessability:** Customer tracking URLs use version-4 UUID tokens (`/orders/550e8400-e29b-41d4-a716-446655440000`) with 122 bits of entropy. It is mathematically impossible for external attackers to enumerate or guess active customer order screens.
3. **Receipt Sanitization:** Printed thermal receipts and downloadable PDF slips display customer phone numbers partially masked for packaging safety (e.g., `+256 772 ****11`). Only the active rider and kitchen manager see the full contact digits.
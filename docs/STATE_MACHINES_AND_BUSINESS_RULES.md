# STATE_MACHINES_AND_BUSINESS_RULES.md

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Approved Core Engine Specification
* **Target Audience:** Backend Engineers, Full-Stack Developers & Antigravity Agentic Builders
* **Scope:** Deterministic State Transitions, Pricing Pipelines, Mathematical Formulas, and Concurrency Control
* **Currency Standard:** Ugandan Shillings (`UGX` / `USh`) — Whole Integers
* **Distance Metric:** Kilometers (`km`) — Road Network Calculation via OSRM

---

## 1. Master Order Lifecycle State Machine (FSM)

The lifecycle of an order is governed by a strict Finite State Machine. State transitions must occur through explicit server actions or database triggers. **Direct updates that bypass transition guards are strictly prohibited.**

### 1.1 State Transition Diagram

```
                             [ Customer Initiates Checkout ]
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
            (Digital Payment)                             (Cash on Delivery)
                     │                                             │
                     ▼                                             ▼
           [ PENDING_PAYMENT ]                            [ CONFIRMED_UNPAID ]
                     │                                             │
      (MoMo / Card Webhook Success)                                │
                     │                                             │
                     └──────────────────────┬──────────────────────┘
                                            │
                                            ▼
                                      [ PREPARING ] ◄── (Ticket enters KDS Queue)
                                            │
                                    (Cook Bumps Ticket)
                                            │
                                            ▼
                                   [ READY_FOR_PICKUP ] ◄── (Enters Rider Claim Pool)
                                            │
                                    (Rider Claims Order)
                                            │
                                            ▼
                                        [ CLAIMED ] ◄── (Rider at Kitchen Pickup)
                                            │
                                   (Rider Taps "Start Trip")
                                            │
                                            ▼
                                   [ OUT_FOR_DELIVERY ] ◄── (GPS Telemetry Active)
                                            │
                                (Valid 4-Digit PIN Entered)
                                            │
                                            ▼
                                      [ DELIVERED ] ◄── (Terminal Success State)
                                            ▲
                                            │
    [ CANCELLED ] ◄─────────────────────────┴──────── (Terminal Failure State)
```

---

### 1.2 State Transition Matrix & Permissions

| Current State | Next State | Permitted Actor | Trigger / Condition | Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `NULL` | `PENDING_PAYMENT` | Customer | Customer initiates MoMo / Card checkout. | Generates `order_token` and `handover_pin`. Triggers USSD Push. |
| `NULL` | `CONFIRMED_UNPAID` | Customer | Customer selects COD with valid phone verification. | Generates `order_token` and `handover_pin`. Kitchen ticket created. |
| `PENDING_PAYMENT` | `PREPARING` | System (Webhook) | Webhook receives confirmed `PAID` event. | Updates `payment_status = 'PAID'`. Plays audio alert on `/kitchen`. |
| `PENDING_PAYMENT` | `CANCELLED` | System (Timeout) | No payment confirmed within 10 minutes. | Voids transaction; notifies customer via UI. |
| `CONFIRMED_UNPAID` | `PREPARING` | Kitchen Cook | Cook acknowledges ticket on KDS. | Shifts ticket from New to Active cooking queue. |
| `PREPARING` | `READY_FOR_PICKUP` | Kitchen Cook | Cook taps `[ Ready for Pickup ]`. | Packages food; order appears in `/rider` unclaimed pool. |
| `READY_FOR_PICKUP` | `CLAIMED` | Boda Rider | Rider taps `[ Claim Delivery ]` in `/rider`. | Locks `rider_id = auth.uid()` via atomic transaction. |
| `CLAIMED` | `OUT_FOR_DELIVERY` | Assigned Rider | Rider taps `[ Start Trip ]` after picking up food. | Sets `dispatched_at = now()`. Begins HTML5 GPS streaming. |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Assigned Rider | Rider submits matching 4-digit `handover_pin`. | Sets `delivered_at = now()`. If COD, marks `payment_status = 'PAID'`. |
| `PREPARING` | `CANCELLED` | Admin | Customer cancels or severe kitchen emergency. | Alerts cook to stop; triggers refund if paid online. |
| `CLAIMED` | `READY_FOR_PICKUP` | Admin / Rider | Motorcycle breakdown / flat tire before dispatch. | Resets `rider_id = NULL`; returns order to unclaimed pool. |

---

## 2. Distance & Delivery Fee Calculation Engine

Delivery fees are determined strictly by **road network driving distance** (not straight-line Euclidean distance) between the restaurant coordinates and the customer's pinned coordinates.

### 2.1 Restaurant Reference Coordinates
* **Latitude:** `0.3136000`
* **Longitude:** `32.5811000`
* **Location:** Central Bazaar Hub, Kampala, Uganda

---

### 2.2 Mathematical Formula Specification

$$\text{Delivery Fee (UGX)} = \begin{cases} 0 & \text{if } d_{\text{road}} \le 5.0\text{ km} \\ \lceil d_{\text{road}} - 5.0 \rceil \times \text{Rate}_{\text{per\_km}} & \text{if } 5.0\text{ km} < d_{\text{road}} \le 15.0\text{ km} \\ \text{ORDER\_BLOCKED} & \text{if } d_{\text{road}} > 15.0\text{ km} \end{cases}$$

#### Step-by-Step Rule Engine:
1. **Tier 1 ($0.0\text{ km} \le d \le 5.0\text{ km}$):**
   * The fee is **`USh 0` (Free Delivery)**.
2. **Tier 2 ($5.01\text{ km} \le d \le 15.0\text{ km}$):**
   * Subtract the 5.0 km free allowance: $d_{\text{excess}} = d_{\text{road}} - 5.0$.
   * Apply ceiling rounding to the excess distance: $d_{\text{billable}} = \lceil d_{\text{excess}} \rceil$.
   * Multiply by the configured rate (Default: `USh 1,500` per km):
     $$\text{Fee} = d_{\text{billable}} \times 1,500$$
3. **Tier 3 ($d > 15.0\text{ km}$):**
   * The delivery engine throws a `DISTANCE_OUT_OF_BOUNDS` error. Order creation is blocked.

#### Concrete Calculation Examples:

| Pinned Road Distance ($d_{\text{road}}$) | Excess Distance ($d - 5.0$) | Billable Km ($\lceil d - 5 \rceil$) | Rate per Km | Final Delivery Fee |
| :--- | :--- | :--- | :--- | :--- |
| **3.8 km** (Nakasero) | $0.0\text{ km}$ | $0\text{ km}$ | USh 1,500 | **USh 0** (Free) |
| **5.0 km** (Kololo Border) | $0.0\text{ km}$ | $0\text{ km}$ | USh 1,500 | **USh 0** (Free) |
| **5.2 km** (Kamwokya) | $0.2\text{ km}$ | $1\text{ km}$ | USh 1,500 | **USh 1,500** |
| **7.4 km** (Ntinda) | $2.4\text{ km}$ | $3\text{ km}$ | USh 1,500 | **USh 4,500** |
| **11.1 km** (Kyanja) | $6.1\text{ km}$ | $7\text{ km}$ | USh 1,500 | **USh 10,500** |
| **15.2 km** (Entebbe Rd Exit) | $10.2\text{ km}$ | N/A | N/A | **BLOCKED (> 15 km)** |

---

### 2.3 OSRM Routing Integration & Fallback Protocol

Distance calculations are executed through an internal API route (`/api/distance`) that queries the Open Source Routing Machine (OSRM) driving profile.

```
[ Customer Pin Drop: (lat, lng) ]
               │
               ▼
   [ Query OSRM Driving API ] 
   router.project-osrm.org/route/v1/driving/32.5811,0.3136;lng,lat
               │
       ┌───────┴───────┐
       ▼               ▼
   (Success)       (Timeout > 3s or Network Failure)
       │               │
       │               ▼
       │      [ Fallback: Haversine Formula ]
       │      d_straight = Haversine(rest_coords, user_coords)
       │      d_road = d_straight * 1.35 (Urban Curvature Factor)
       │               │
       └───────┬───────┘
               ▼
   [ Apply 5 km Tier Formula ]
```

* **Urban Curvature Factor:** If the external OSRM service is unreachable, the system falls back to the Haversine equation multiplied by an urban road winding factor of **`1.35`** (calibrated for Kampala's road topology).

---

## 3. Minimum Order Value (MOV) & Cart Guardrails

To prevent financial loss on free or subsidized delivery runs, the system enforces strict order value minimums:

### 3.1 MOV Business Rules
1. **Global Delivery MOV:** Set to **`USh 20,000`** in `app_settings.minimum_order_value`.
2. **Evaluation Point:** Evaluated strictly against `items_subtotal + modifiers_total` (delivery fees and packaging fees do **not** count toward fulfilling the MOV).
3. **Dine-In Exception:** If `order_type == 'DINE_IN'` (Table QR scan), the MOV requirement is **bypassed completely (`MOV = USh 0`)**.

### 3.2 Dynamic Cart Math & UI States
* **Under MOV:**
  $$\text{Deficit} = \text{MOV} - (\text{items\_subtotal} + \text{modifiers\_total})$$
  * `is_checkout_allowed = false`
  * Cart Progress: $\text{Percent} = \frac{\text{Subtotal}}{\text{MOV}} \times 100$
  * Visual Display: *"Add USh [Deficit] more to unlock delivery."*
* **At or Above MOV:**
  * `is_checkout_allowed = true`
  * Visual Display: *"Delivery threshold reached!"*

---

## 4. Master Order Pricing Pipeline (Server-Side Recalculation)

Clients submit selected item IDs, quantities, modifier IDs, and target coordinates. **The client never dictates the final price.** The server executes this immutable recalculation pipeline:

```
[ Incoming Checkout Payload ]
               │
               ▼
 1. Fetch current menu item prices from DB (Ignore client-submitted prices)
 2. Fetch current modifier prices from DB
 3. Compute items_subtotal = Sum(item.base_price * qty)
 4. Compute modifiers_total = Sum(modifier.price_delta * qty)
 5. Validate: (items_subtotal + modifiers_total) >= app_settings.minimum_order_value
 6. Compute road_distance_km via OSRM
 7. Compute delivery_fee based on distance tier
 8. Fetch app_settings.packaging_fee_default (e.g., USh 1,000)
 9. Compute total_amount = Subtotal + Modifiers + Packaging + DeliveryFee
               │
               ▼
[ Commit to DB with order_status = PENDING_PAYMENT or CONFIRMED_UNPAID ]
```

$$\text{total\_amount} = \text{items\_subtotal} + \text{modifiers\_total} + \text{packaging\_fee} + \text{delivery\_fee}$$

---

## 5. Concurrency Control: The Rider Claim Lock

When an order enters `READY_FOR_PICKUP`, all 5 motorcycle riders see the order appear in their `/rider` pool simultaneously. 

To eliminate race conditions where two riders tap `[ Claim Delivery ]` at the exact same millisecond, the system enforces **atomic row-level locking**:

### 5.1 Atomic Claim Procedure (SQL)

```sql
-- Secure atomic claim executed via Next.js Server Action
CREATE OR REPLACE FUNCTION public.claim_order_atomic(
  p_order_id UUID,
  p_rider_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  -- Attempt atomic update: must be READY_FOR_PICKUP and rider_id must be NULL
  UPDATE public.orders
  SET 
    rider_id = p_rider_id,
    order_status = 'CLAIMED',
    claimed_at = timezone('utc'::text, now())
  WHERE id = p_order_id 
    AND order_status = 'READY_FOR_PICKUP' 
    AND rider_id IS NULL;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  -- Returns true if this rider won the lock, false if another rider claimed first
  RETURN v_updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2 Client-Side Concurrency Handling
* If `claim_order_atomic` returns `true`:
  * Rider UI immediately transitions to active navigation and GPS broadcasting.
* If `claim_order_atomic` returns `false`:
  * Rider UI displays a high-contrast toast: *"Order was just claimed by another rider."*
  * The order is removed from their available pool view without a page reload.

---

## 6. Proof-of-Delivery: The 4-Digit Handover PIN Gate

To prevent false claims of delivery or dropping food at an incorrect location, trip completion is gated by a **cryptographic proof-of-handover challenge**.

```
[ Customer Screen: /orders/[token] ]                [ Rider Screen: /rider ]
Displays PIN: [ 4 8 2 1 ]                            Requests: "Enter 4-Digit Customer PIN"
            │                                                         │
            └──────────(Customer verbally shares PIN)─────────────────┘
                                      │
                                      ▼
                      [ Server Action: verify_delivery_pin ]
                                      │
                  ┌───────────────────┴───────────────────┐
                  ▼                                       ▼
             (PIN Matches)                           (PIN Mismatches)
                  │                                       │
                  ▼                                       ▼
       • order_status = 'DELIVERED'           • Increment failed_attempts
       • delivered_at = now()                 • If attempts >= 3: Lock verification
       • If COD: payment_status = 'PAID'        and flag order for Admin intervention
       • Stop GPS broadcast                   • Return: "Invalid PIN. 2 attempts left."
```

### 6.1 PIN Security Constraints
1. **No Frontend Exposure:** The `handover_pin` column is **never** sent to the rider’s device in the `/rider` payload. The rider's client only submits an attempt to the server.
2. **Verification Server Action Logic:**
   ```typescript
   // Pseudo-logic for server-side PIN verification
   if (order.handover_pin !== submittedPin) {
     await incrementFailedPinAttempts(order.id);
     throw new Error("INVALID_HANDOVER_PIN");
   }
   // Transition to DELIVERED atomically
   await markOrderDelivered(order.id, riderId);
   ```

---

## 7. End-of-Day Rider Cash Settlement Engine

When riders collect Cash on Delivery (COD), they hold physical cash. The system tracks this liability continuously until verified by the restaurant manager at closing.

### 7.1 Rider Cash Balance Equation
At any point during a shift, a rider's outstanding cash liability is calculated as:

$$\text{Rider Cash Liability} = \sum_{i \in \text{Delivered Orders}} \text{orders}[i].\text{total\_amount}$$
$$\text{where } \text{payment\_method} = \text{'CASH\_ON\_DELIVERY'} \land \text{order\_status} = \text{'DELIVERED'} \land \text{is\_settled} = \text{false}$$

### 7.2 Settlement Procedure
1. At shift end, the manager navigates to `/admin/ledger`.
2. The system computes the exact cash total for each of the 5 motorcycle plates.
3. The rider presents physical paper money to the manager.
4. The manager confirms the count and clicks `[ Reconcile & Clear Rider ]`.
5. The system creates a record in `cash_settlements` and marks all included orders as settled:
   ```sql
   INSERT INTO public.cash_settlements (rider_id, admin_id, total_cash_collected, is_settled, settled_at)
   VALUES (p_rider_id, auth.uid(), v_cash_liability, true, now());
   ```
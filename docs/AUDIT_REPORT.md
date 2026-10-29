# PROJECT AUDIT REPORT — MRFSS / `PROJECT-BAZAAR-D2C`

| Field | Value |
| :--- | :--- |
| **Audit date** | 2026-10-29 |
| **Remediation date** | 2026-10-29 |
| **Repository** | `morouj-mazaar-mrfss-project` |
| **Scope** | v1.0 audit of the original 10 documents, followed by the v1.1 remediation and local database validation |
| **Auditor** | Big Pickle (OpenCode coding agent) |
| **Document status** | v1.1 — P0/P1 specification remediation complete; launch gated by founder inputs in §12 |
| **Code present** | No application code. Schema, migrations, seed, config, scripts, and docs are present. |

> **Version note.** §§2–11 and Appendices A–D preserve the original v1.0 audit as historical evidence. The current verdict is §1.1; the authoritative founder action register is §12; every file created or changed is in §13.

---

## 1. Executive Verdict

### 1.1 v1.1 remediation verdict (current)

The v1.0 documentation was **well above average** in product thinking, UX detail, business-rule clarity, and security intent. It was nevertheless **not build-ready**: it contained 10 P0 blockers and 50 P1 findings, including contradictions between authentication and RLS, unsafe public order access, a non-durable handover-PIN gate, a cash ledger that could not close, incorrect payment contracts, wrong distance/total fixtures, invalid seed UUIDs, and a false accessibility claim.

The v1.1 baseline now:

- Resolves **9 of the 10 P0 findings** fully in the specification/schema and **contracts P0-10** (operations, legal, compliance) with a runbook, compliance checklist, and founder register.
- Addresses **all 50 P1 findings** — 34 resolved in the specification/schema, 12 contracted to a named implementation phase, and 4 gated on founder accounts or hosting.
- Adds a validated PostgreSQL schema, storage migration, deterministic seed, local Supabase config, staff-provisioning script, canonical fixtures, API contracts, ERD, test plan, accessibility baseline, operations runbook, and Uganda compliance checklist.
- Removes the contradictions that would force rework in Phases 1–6.

**Build-readiness score: 9/10 — conditional.**

The score is conditional because the remaining gap is no longer specification ambiguity. It is **implementation plus founder inputs**: there is no Next.js application yet, no production credentials, no on-site verified coordinates, no approved menu/staff data, and no completed legal review. A competent team can start Phase 1 immediately without re-deciding the architecture, but checkout, payments, and launch cannot go live until §12 is closed.

#### Current scorecard

| Area | v1.0 | v1.1 | Evidence |
| :--- | :---: | :---: | :--- |
| Product vision & scope | 9/10 | 9/10 | `SYSTEM_OVERVIEW.md` + `DECISIONS.md`; scope is explicit and bounded. |
| UX & visual specification | 8/10 | 9/10 | `PORTALS_AND_UX_SPECIFICATION.md` + `ACCESSIBILITY.md`; false AAA claim removed. |
| Business rules & FSM | 7/10 | 9/10 | `ERD.md` §4, `CANONICAL_EXAMPLES.md`, migration triggers/RPCs. |
| Data model | 4/10 | 9/10 | `ERD.md` + validated migration + seed; all promised entities modeled. |
| Security design | 3/10 | 9/10 | Deny-by-default RLS, token-scoped RPCs, durable PIN state, audit tables. |
| Integration specifications | 4/10 | 9/10 | `API_CONTRACTS.md` + `DECISIONS.md` ADR-002/003/004/005/007. |
| Test specification | 3/10 | 9/10 | `TEST_PLAN.md`; corrected fixtures, RLS matrix, Playwright blueprint. |
| Documentation traceability | 5/10 | 9/10 | `SPEC_AMENDMENTS.md`, amendment banners, §13 change log. |
| Operations & compliance | 2/10 | 8/10 | `OPERATIONS_RUNBOOK.md` + `COMPLIANCE_AND_LEGAL.md`; legal review open. |
| **Specification / build readiness** | **2/10** | **9/10 (conditional)** | **Build can start; founder gates remain.** |
| **Launch readiness** | n/a | **4/10** | Credentials, verified data, legal review, and live provider certification outstanding. |

#### Why 9/10 and not 10/10

1. No application code exists yet; Phase 1 scaffolding is the next engineering task.
2. Production credentials and merchant accounts are not provisioned.
3. Restaurant coordinates, menu, modifiers, combos, staff roster, printer, and assets are not founder-verified.
4. The legal/tax/privacy documents are skeletons pending Ugandan counsel and accountant review.
5. Payment, SMS, OSRM, MapTiler, and Upstash integrations have not been certified against live/sandbox accounts.

None of these is a specification contradiction. They are execution and business-input gates, tracked in §12.

### 1.2 Historical v1.0 scorecard (superseded)

The original verdict was: **not build-ready**, because of internal contradictions, unsafe or unimplementable details, and missing inputs. The original scorecard is retained for traceability.

| Area | Score | Original assessment |
| :--- | :---: | :--- |
| Product vision & scope | 9/10 | Clear, specific, commercially grounded. |
| UX & visual specification | 8/10 | Strong and distinctive; accessibility claims are not met. |
| Business rules & FSM | 7/10 | Good baseline; several transitions and edge cases missing. |
| Data model | 4/10 | Core tables exist; critical domain tables and constraints missing. |
| Security design | 3/10 | Correct threats identified, but RLS/auth design is unsafe as written. |
| Integration specifications | 4/10 | Good direction; payment/OTP/print contracts incomplete or wrong. |
| Test specification | 3/10 | Excellent scenario thinking; fixtures and expected numbers are wrong. |
| Documentation traceability | 5/10 | Cross-references use filenames that do not exist; manifests drift. |
| **Build readiness** | **2/10** | **Not ready to build without the inputs in §9.** |

### 1.3 Short answer to "is there anything else we need to provide?"

**Yes — but the list is now finite, deduplicated, and tracked in §12.** Phase 1 can start now. Payments, checkout go-live, and public launch cannot start until the founder gates are closed.

The remaining founder inputs fall into seven groups:

- **Legal identity, tax, and regulatory** — entity, TIN, licences, VAT/EFRIS, PDPO registration, privacy/terms/refund policies.
- **Commercial rules** — final fee constants, COD policy, delivery zones, opening hours, refund authority.
- **Menu and content** — final menu, modifiers, combos, prices, allergens, photos, brand assets.
- **Staff and riders** — roster, PINs, contracts, plates, pay/float model, devices.
- **Accounts and infrastructure** — Supabase, Vercel, Flutterwave, Africa's Talking, MapTiler, Upstash, OSRM host, domain, monitoring.
- **Operations** — printer, kitchen tablet, rider phones, cash denominations, on-call rota.
- **Launch sign-off** — pilot orders, legal review, accessibility/UX sign-off, go/no-go authority.

The complete register, including the 15 decisions already recorded in `DECISIONS.md`, is **§12**. There are no remaining open engineering decisions that block Phase 1.

---

## 2. Scope and Method

> **Historical record (v1.0).** This section describes the repository and method as they were before remediation. Current repository state and every file created or changed are in §13. The findings in §§3–8 are retained as the evidentiary basis for the remediation, not as current status.

### 2.1 Files reviewed

| Document | Lines | Role |
| :--- | ---: | :--- |
| `SYSTEM_OVERVIEW.md` | 251 | Vision, economics, personas, topology |
| `TECH_STACK_AND_CONVENTIONS.md` | 328 | Stack, directory manifest, conventions |
| `DATABASE_SCHEMA_AND_RLS.md` | 568 | Schema, triggers, RLS, seed |
| `DESIGN_SYSTEM_AND_UI_SPEC.md` | 336 | Tokens, typography, components, motion |
| `PORTALS_AND_UX_SPECIFICATION.md` | 313 | Six portals and their screens |
| `STATE_MACHINES_AND_BUSINESS_RULES.md` | 298 | FSM, fee engine, MOV, pricing, claim lock |
| `INTEGRATIONS_AND_HARDWARE_APIS.md` | 453 | GPS, audio, print, webhooks, deep links |
| `SECURITY_AND_VERIFICATION_PROTOCOLS.md` | 316 | PIN, zero-trust, COD fraud, rate limits, PII |
| `STEP_BY_STEP_IMPLEMENTATION_PLAN.md` | 466 | 12-phase build plan |
| `TESTING_PERSONAS_AND_E2E_SCENARIOS.md` | 433 | Personas, scenarios A–G, Playwright blueprint |

### 2.2 Checks performed

- Cross-document consistency review.
- SQL DDL review: types, keys, constraints, indexes, triggers, RLS.
- Security review: auth, authorization, IDOR, PII, payment webhooks, abuse paths.
- Live verification of the claimed distances against the public OSRM API.
- Calculated WCAG contrast ratios for the declared palette.
- Verification of seed UUID validity.
- Repository inventory and Git status.

### 2.3 Repository state

```
morouj-mazaar-mrfss-project/
├── .git/
└── docs/        (10 specification files; no application code)
```

`git status` shows all 10 specification files as **untracked**, and `docs/mazaar.md` + `docs/readme.md` as **deleted from the working tree** but still tracked in the last commit. There is no `README.md`, `.gitignore`, `package.json`, `next.config.mjs`, `supabase/`, `public/`, or `tests/`.

**Implication:** Phase 1 cannot "initialize into" a clean project without first deciding how to handle the existing docs-only repository and the deleted tracked files.

---

## 3. Blocking Findings (P0)

> Severity definitions are in Appendix C. Each P0 must be resolved in the specification before implementation, because it changes the schema, auth model, or public contract.

### P0-01 — Authentication model is internally incompatible with RLS

**Evidence**

- `DATABASE_SCHEMA_AND_RLS.md` defines `profiles.id REFERENCES auth.users(id)` and all RLS helper functions use `auth.uid()`.
- `SECURITY_AND_VERIFICATION_PROTOCOLS.md §4.2` defines a **custom** JWT/session cookie (`RiderSessionToken`) issued after a phone + 4-digit PIN login.
- `profiles.pin_code` is a plaintext `VARCHAR(4)`.
- No login flow is specified for `/kitchen` or `/admin` at all.

**Impact**

A custom cookie does **not** populate Supabase's `auth.uid()`. Therefore every RLS policy will reject the rider, kitchen, and admin sessions. If the app instead uses the service-role key to bypass RLS, the entire security model collapses. There is no working path from "rider enters PIN" to "RLS authorizes this rider" as documented.

**Required resolution (choose one)**

1. **Recommended:** Use Supabase Auth for all staff. Sign in with phone/email + PIN-as-password (or magic link + PIN verification step). Riders get real JWTs. Remove the custom session cookie.
2. Sign custom JWTs with the Supabase JWT secret so `auth.uid()` is populated. This is fragile and not recommended.
3. Keep all writes server-side with the service role and enforce authorization in application code. Then RLS is defense-in-depth only, not the primary control.

Whichever is chosen, add:
- Kitchen/admin login UI and session lifecycle.
- `middleware.ts` route guards.
- Staff PIN hashing (Argon2/bcrypt), login rate limiting, lockout, session revocation.
- A documented `auth.users` provisioning process.

---

### P0-02 — RLS policies are unsafe and contradict the stated security guarantees

**Evidence**

| Finding | Location | Impact |
| :--- | :--- | :--- |
| `"Public Insert Orders" ... WITH CHECK (true)` | `DATABASE_SCHEMA_AND_RLS.md §5.2` | Anyone with the anon key can insert an order with `payment_status='PAID'`, `order_status='PREPARING'`, `total_amount=0`. This is a **free-food exploit** and a fake-order injection path. |
| `"Public Insert Order Items" ... WITH CHECK (true)` | Same | Anyone can attach line items to any order. |
| `"Read Order Modifiers" ... USING (true)` | Same | Leaks all modifier snapshots across all orders. |
| `"Rider Claim & Complete Orders" ... USING (is_rider()) WITH CHECK (is_rider())` | Same | **Any rider can update any order**, including `rider_id`, `total_amount`, `payment_status`, `handover_pin`, and customer PII. RLS is row-level, not column-level. |
| `"Kitchen Update Order Status" ... is_staff()` | Same | Kitchen can update every column, including financial and PIN fields, not just status. |
| No policies at all on `profiles` | Same | Authenticated staff cannot read their own profile; login and UI profile fetches break unless service role is used. |
| `"Public Read Telemetry" ... USING (true)` | Same | Every rider's live location is public. |
| Rider pool reads `READY_FOR_PICKUP` rows | Same | The unclaimed pool query can return full customer name, phone, coordinates, notes, and `handover_pin`. |
| `"Token Read Order"` uses `request.headers` + `x-order-token` | Same | Fragile, undocumented for this use, and **not usable by Supabase Realtime**, which authenticates via JWT. |
| No column-level `REVOKE` on `orders.handover_pin` | Same | The rider's browser can `select("handover_pin")` directly. The claim that "RLS strips the field" is impossible; RLS does not do column redaction. |
| Realtime `postgres_changes` on `orders` | `TECH_STACK_AND_CONVENTIONS.md §4.1` | Realtime pushes row payloads. A rider subscribed to the pool will receive `handover_pin` if the row is visible; a customer token session cannot authenticate the channel. |
| No `ALTER PUBLICATION supabase_realtime ADD TABLE ...` | Missing | Realtime will not emit changes at all. |
| `is_admin()`, `is_staff()`, `is_rider()` are `SECURITY DEFINER` without `SET search_path` | Same | Search-path hijack risk. Add `SET search_path = public, pg_temp`. |
| `claim_order_atomic(p_order_id, p_rider_id)` is `SECURITY DEFINER` with no caller check | `STATE_MACHINES_AND_BUSINESS_RULES.md §5.1` | Any caller can claim an order on behalf of any rider. |

**Required resolution**

- **Remove public direct writes.** Create orders only through a server action / RPC using the service role or a hardened `SECURITY DEFINER` function.
- **Revoke column privileges:** `REVOKE SELECT (handover_pin) ON public.orders FROM anon, authenticated;` Then expose PIN only through a token-scoped RPC.
- **Create safe views/RPCs:**
  - `orders_public_view` — by `order_token`, no internal/financial-adjustment fields.
  - `orders_rider_pool_view` — order number, area, distance, total, payment type; **no phone, no PIN, no exact address**.
  - `orders_rider_active_view` — full delivery details for the assigned rider only; **no PIN**.
  - `rider_location_for_order(order_token)` — scoped telemetry only.
- **Restrict updates with a status-transition trigger** and column-level grants. Riders should not have direct `UPDATE` on `orders`; use `claim_order_atomic` and `verify_delivery_pin` RPCs that validate `auth.uid()`.
- **Add RLS policies for `profiles`** (self-read; staff read via a safe view).
- **Realtime:** use Supabase Broadcast with server-authorized channels, or token-scoped RPC + polling. Do not rely on RLS + `postgres_changes` for the customer tracker or rider pool.
- **Add the Realtime publication** for the chosen tables.

---

### P0-03 — The handover PIN gate is not durable, and the sample code will fail

**Evidence**

- `SECURITY_AND_VERIFICATION_PROTOCOLS.md §2.2` stores attempts in an **in-memory `Map`**. On Vercel/serverless this resets on every cold start and is not shared across instances. The 3-attempt lockout is therefore cosmetic.
- There is **no `failed_pin_attempts` column, no `pin_locked_until`, and no attempt table** in the schema.
- The "lock" writes a security message into `customer_notes`, **overwriting the customer's real notes**, and does not actually block verification.
- `crypto.timingSafeEqual` is used without importing Node's `crypto` module. In the default Next.js server runtime, the global `crypto` is Web Crypto and does not provide `timingSafeEqual`; the call will throw. In Edge runtime, `Buffer` is also unavailable.
- The PIN trigger comment claims `pgcrypto`, but the function uses `RANDOM()` and produces only 9,000 possible values (1000–9999).
- The rider-active query path returns the full row, so the PIN is readable by the rider (see P0-02).
- No admin override, PIN regeneration, or audit path is defined for a lost/leaked PIN.

**Required resolution**

- Persist attempts in the database: `pin_failed_attempts INTEGER NOT NULL DEFAULT 0`, `pin_locked_until TIMESTAMPTZ`, or a `pin_verification_attempts` table with order, rider, IP, timestamp, result.
- Implement PIN verification as one atomic `SECURITY DEFINER` RPC that checks `auth.uid() = rider_id`, `order_status`, attempts, and match, then updates the order and clears/resets counters in one transaction.
- Use `pgcrypto` (`gen_random_bytes`) or a server-generated PIN, not `RANDOM()`.
- Hash the PIN at rest? At minimum, revoke column access and never expose it via Realtime or rider payloads. For a 4-digit PIN, hashing adds limited value against DB compromise, but column isolation is mandatory.
- Define an audited manager override with reason and actor.
- Add a geofence check at PIN submission (rider within N metres of the destination) as defense-in-depth.

---

### P0-04 — Cash settlement cannot close correctly

**Evidence**

- `STATE_MACHINES_AND_BUSINESS_RULES.md §7.1` computes liability where `orders.is_settled = false`, but **`orders` has no `is_settled` column**.
- `cash_settlements` has no link to the orders it covers. There is no `settlement_id` on `orders` and no join table.
- `settlement_date DATE DEFAULT CURRENT_DATE` uses the database timezone (UTC on Supabase), while the business day is **EAT (UTC+3)**. Late-evening settlements will land on the wrong day.
- No `UNIQUE` constraint prevents duplicate settlements for the same rider/date.
- No opening cash float, change float, or denomination count is modeled, even though riders must give change (e.g., USh 13,500 on a 50,000 note for a 36,500 order).
- No audit of which admin settled which orders at what time.

**Impact**

The ledger will keep counting already-settled cash, double-pay, or miss a day. "Zero cash discrepancies" is not achievable with this schema.

**Required resolution**

- Add `settlement_id UUID REFERENCES cash_settlements(id)` to `orders`, or a `cash_settlement_orders` join table.
- Settle inside a transaction: select all qualifying COD + DELIVERED + unsettled orders up to a cutoff, insert the settlement, link the orders, mark them settled.
- Store an explicit `business_date DATE` computed in `Africa/Kampala`.
- Add `UNIQUE (rider_id, business_date)` (or allow multiple with a sequence).
- Model rider floats and expected cash vs. counted cash; allow a discrepancy note.
- Add `settled_at`, `settled_by`, and an audit record.

---

### P0-05 — The payment lifecycle is incomplete and provider details are wrong

**Evidence**

- There is **no payment initiation endpoint** or contract. The docs describe a USSD push but never define the request to the aggregator, the response, the pending state, or polling.
- No `payment_transactions` / `payment_reference` / gateway transaction ID is stored. Only `payment_status` exists. Reconciliation and refunds are impossible.
- `INTEGRATIONS_AND_HARDWARE_APIS.md §4.1` says HMAC-SHA256 in `x-signature` or `verif-hash`. In reality:
  - Flutterwave's `verif-hash` is a **plain shared-secret comparison**, not an HMAC of the body.
  - Paystack signs with **HMAC-SHA512** in `x-paystack-signature`.
  - MTN/Airtel direct APIs have their own callback auth.
- No webhook event table or `provider_event_id` means idempotency is only inferred from `payment_status`. A late success callback on a `CANCELLED` order will currently set it to `PAID`/`PREPARING`, resurrecting a cancelled order.
- No payment timeout job. `PENDING_PAYMENT → CANCELLED` after 10 minutes is specified but nothing schedules it.
- No retry/resume flow for failed payments; no refund flow despite `REFUNDED` existing in the enum.
- `ADMIN_DEFAULT_PIN` is a production backdoor.
- Card checkout (hosted iframe/redirect) has no route, callback, or UX spec.
- The webhook uses `process.env...!` without the promised `env.mjs` validation.

**Required resolution**

- Choose one provider first (Flutterwave **or** Paystack **or** direct MTN/Airtel). Document its exact signature algorithm, headers, sandbox URLs, and callback payload.
- Add `payment_transactions` and `webhook_events` tables with unique provider event IDs.
- Add `/api/payments/initiate`, `/api/webhooks/payment`, and a refund endpoint.
- Add a scheduled job (Supabase `pg_cron` or Vercel Cron) for expiry.
- Reject late callbacks for `CANCELLED`/`DELIVERED` orders and trigger a refund/manual review.
- Add a mock payment mode for local/E2E testing, guarded by env and disabled in production.
- Remove `ADMIN_DEFAULT_PIN`; use a real auth flow.

---

### P0-06 — The domain model is missing features the documents promise

The following are specified in prose/UI but have **no schema representation**:

| Missing model | Promised in | Why it blocks |
| :--- | :--- | :--- |
| Combo components/steps/options | "3-step visual combo builder", `menu_items.is_combo` | A boolean cannot represent a combo. |
| Modifier groups, selection type (single/multi), min/max | Radio group vs multi-select chips | Nothing prevents "Mild" + "Extra Hot", or "No Onions" on a juice. |
| Item↔modifier applicability join | Global modifiers with `menu_item_id NULL` | Global "No Onions" appears on drinks. |
| Menu image storage/policies | Menu CRUD, WebP images | `image_url` points to files that do not exist; no upload pipeline. |
| Promotions/discounts | `Discount_promo` in `SYSTEM_OVERVIEW.md §2.3` | Formula includes a term with no table, state, or UI. |
| OTP codes/attempts/expiry | COD first-time verification | Cannot implement SMS verification. |
| `blacklisted_phones` | `SECURITY... §5.3` | Table is defined in prose but missing from the DDL/migration. |
| Tables / signed QR tokens | `/?table=[id]`, table QR mode | Table numbers are unvalidated; anyone can forge `?table=4`. |
| Order status history | "Strict FSM", audit | No way to prove who changed what/when. |
| Admin audit log | Live edits, settings, settlements | Financial controls are unauditable. |
| Delivery failure / return states | Real-world COD failure | Only `CANCELLED` exists; blacklisting depends on an undefined event. |
| ETA model | "22 mins remaining", prep estimates | No `eta_at`, travel duration, or formula. |
| Notifications | Customer not on tracker | No SMS/WhatsApp/push record or retry. |
| Analytics | Aggregators "withhold analytics" | Admin has no sales/ops analytics at all. |
| Rider shifts / floats | Cash ledger | Cannot reconcile a shift or change float. |
| Idempotency keys | Checkout double-submit | Duplicate orders on retry. |
| Refunds | `REFUNDED` enum, cancel flow | No refund record or gateway call. |
| Rider batching | Fleet throughput table | Single `rider_id` and one telemetry row per rider; batching unsupported. |

Full proposed schema additions are in **§7**.

---

### P0-07 — Distance fixtures and all dependent totals are wrong

This is verified against the live public OSRM API on 2026-10-29, using the coordinates in the docs.

| Claimed fixture | Documented | **Live OSRM** | Consequence |
| :--- | :--- | :--- | :--- |
| Restaurant → Nakasero (`0.3136,32.5811` → `0.3245,32.5782`) | **3.8 km**, fee `USh 0` | **1.56 km**, fee `USh 0` | Distance label is wrong; free-zone outcome is still 0. |
| Restaurant → Ntinda (`0.3136,32.5811` → `0.3542,32.6120`) | **7.4 km**, excess 2.4, billable 3, fee **4,500** | **8.09 km**, excess 3.09, billable 4, fee **6,000** | Fee is understated by 1,500; every downstream total and ledger example is wrong. |

Haversine straight-line distances are **1.25 km** (Nakasero) and **5.67 km** (Ntinda), so the documented numbers are not explainable by rounding.

**Impact**

- Phase 5 exit criteria cannot pass.
- The Playwright suite will fail.
- If the fixture distances are baked into tests as mocks, production pricing will still differ from the examples.
- The restaurant coordinates themselves may be wrong. `0.3136,32.5811` is roughly 3.8 km south of central Kampala; the "central bazaar hub" location should be verified on the ground.

**Required resolution**

- Confirm the restaurant pin with the owner (GPS reading on site).
- Recompute the fixture set with live OSRM or replace it with **mocked OSRM responses** that are clearly labelled as test fixtures.
- Do not assert exact kilometres in tests against the public OSRM service; assert tolerance and mock the network.

A corrected canonical example is proposed in **§8**.

---

### P0-08 — The seed script will fail, and assets are missing

**Evidence**

- Invalid UUID literals:
  - `m1111111-...` — `m` is not a hex digit. All five menu item IDs (`m1111...`, `m2222...`, etc.) are invalid.
  - `k1000000-...` (Kitchen) and `r1000000-...` / `r2000000-...` / `r3000000-...` (Riders) are invalid. `k` and `r` are not hex.
  - `a1000000-...` (Admin) and `c1111111-...` (categories) are valid.
- `profiles.id REFERENCES auth.users(id)`: inserting test profiles will violate the FK unless matching `auth.users` rows are created first. The seed does not do this.
- Seed inserts are not idempotent (no `ON CONFLICT`), so reruns fail.
- Menu image paths point to `/images/*.webp`, but the only documented image asset is `placeholder-food.webp`. None of the five dish images, PWA icons, or favicon exist.
- The seed uses "Extra Garlic Pepper Dip" while the test scenario says "Extra Garlic Dip".

**Impact**

Phase 2's exit criteria (`5 baseline dishes`) cannot be met by executing the provided seed.

**Required resolution**

- Replace all test IDs with valid UUIDv4 values.
- Provision `auth.users` via Supabase Admin API or a documented SQL seed for local development.
- Make the seed idempotent.
- Add real images or explicitly use the placeholder for MVP.
- Align modifier names between seed and tests.

---

### P0-09 — The accessibility claim is false as specified

Calculated WCAG 2.1 contrast ratios:

| Combination | Documented | **Measured** | Verdict |
| :--- | :--- | :--- | :--- |
| White text on Brand Terracotta `#D84A26` | implied AA/AAA CTA | **4.26:1** | Fails AA for normal text (needs 4.5:1); fails AAA (7:1). |
| Terracotta on Surface Ground `#F9F8F6` | **4.6:1** | **~3.96:1** | Fails both AA and AAA for normal text. |
| White on Terracotta Hover `#B83817` | **5.8:1** | **5.81:1** | Passes AA, fails AAA. |
| Status Warning `#B45309` on white | **5.1:1** | **5.02:1** | Passes AA, fails AAA. |
| Ink Primary `#1A1918` on ground | **15.8:1** | **16.54:1** | Passes AAA. |
| Text Secondary `#4A4744` on ground | **8.5:1** | **8.69:1** | Passes AAA. |

The spec declares **WCAG 2.1 Level AAA for outdoor high-glare viewports**, but primary CTAs (15–18 px) will fail AA. "AAA" is not achievable with the current terracotta CTA treatment.

**Required resolution**

- Pick a target: **AA for all text/controls, AAA for body and critical status text** is realistic and defensible.
- Darken the CTA background or use dark ink on terracotta; validate with automated axe + manual contrast checks.
- Add focus-visible styles, keyboard semantics, dialog/bottom-sheet focus trapping, screen-reader labels for the PIN keypad, and `prefers-reduced-motion` handling.
- Do not use color alone for timers; add icon/text.
- Update the document to state the measured ratios and the actual target.

---

### P0-10 — Operational, legal, and compliance gaps

- **Store closed / holidays:** `is_store_open`, `opening_time`, `closing_time` exist, but no UI or server rule enforces them. What happens at 22:31?
- **Delivery failure:** no "customer not home", "wrong address", "refused", "returned" state or flow.
- **COD change float:** riders need physical change; no float ledger.
- **Notifications:** no SMS/WhatsApp/push when the order is confirmed, ready, or out for delivery. The customer must keep the tracker open.
- **Tax:** Uganda VAT and **EFRIS fiscal receipting** are not addressed. If the business is VAT-registered, thermal receipts may need fiscal invoice data.
- **Data protection:** Uganda's Data Protection and Privacy Act requires lawful basis, retention, consent, and breach handling. The docs mention PII but no retention/consent policy.
- **Consumer terms:** no cancellation/refund policy, privacy policy, or terms of service.
- **Payment licensing:** aggregator onboarding, merchant codes, and settlement accounts are not specified.
- **Cost claim:** "zero ongoing third-party SaaS subscription costs" is not accurate. Supabase Pro, SMS, payment fees, domain, Vercel overages, and production map tiles all have costs.

---

## 4. High-Priority Findings (P1)

| ID | Finding | Evidence / impact | Recommended fix |
| :--- | :--- | :--- | :--- |
| P1-01 | **Kitchen cannot toggle Busy Mode** | KDS must write `app_settings.is_kitchen_busy`, but only `is_admin()` has UPDATE on `app_settings`. | Add a scoped RPC `set_kitchen_busy(boolean)` for `KITCHEN`/`ADMIN`, with audit. |
| P1-02 | **Menu pricing/CRUD privileges too broad** | `"Staff Manage Menu"` gives KITCHEN full `FOR ALL`, including price changes and deletes. | Admin-only for price/CRUD; kitchen only `is_available` via RPC. |
| P1-03 | **No one-active-order rule for riders** | A rider can claim multiple orders; batching is claimed but not modeled. | Partial unique index on `rider_id` for `CLAIMED`/`OUT_FOR_DELIVERY`, or design batching explicitly. |
| P1-04 | **Rider pool leaks PII** | Pool query returns full rows including phone, exact pin, notes, PIN. | Use `orders_rider_pool_view`; reveal contact only after claim via a safe RPC. |
| P1-05 | **Phone numbers are not normalized** | Zod accepts `0772...` and `+256772...`; blacklist/OTP/history can be bypassed by formatting. | Store canonical E.164 in `customer_phone_normalized`; unique/index it; normalize on input. |
| P1-06 | **Checkout schema allows invalid orders** | `deliveryCoordinates` optional for `DELIVERY`; `tableNumber` optional for `DINE_IN`. | Use a Zod discriminated union with `superRefine`. |
| P1-07 | **No checkout idempotency** | Double-tap/retry creates duplicate orders and duplicate kitchen tickets. | Client-generated `idempotency_key` unique per customer/session; server returns existing order. |
| P1-08 | **No total-integrity constraint** | `total_amount` is independent of its components; staff/rider updates can desync it. | Generated column or `BEFORE UPDATE` trigger that recomputes and validates. |
| P1-09 | **Discount formula orphaned** | `Total = ... - Discount_promo`, but no promo model or state-machine step. | Add promotions schema + rule, or remove the term from v1. |
| P1-10 | **Dine-in packaging contradiction** | `SYSTEM_OVERVIEW` includes packaging universally; Phase 11 hardcodes packaging 0. | Branch explicitly: DINE_IN packaging = 0, documented in one place. |
| P1-11 | **Dine-in FSM transition missing** | `PREPARING → DELIVERED` (served to table) is not in the transition matrix. | Add `PREPARING → DELIVERED` or a `SERVED` terminal state for dine-in. |
| P1-12 | **Prepaid ticket timing vs. KDS "Accept"** | Webhook moves `PENDING_PAYMENT → PREPARING`; Portals show `[Accept] → [Ready]`. | Add `acknowledged_at`/`ACCEPTED` state, or remove the accept step. |
| P1-13 | **Audio repeat logic unspecified** | Portals say chime repeats every 15s until acknowledged; integration code plays once. | Add an ack state, repeat timer, stop condition, and cross-tablet coordination. |
| P1-14 | **Background GPS claim is unrealistic** | `watchPosition` is suspended when the browser is backgrounded/locked on most mobile OSes. | Add Screen Wake Lock, foreground requirement, and an operational SOP; do not promise background tracking. |
| P1-15 | **Telemetry write scope unchecked** | Rider can upsert telemetry with any `order_id`, injecting fake positions into another customer's tracker. | RPC validates `order.rider_id = auth.uid()` and order status. |
| P1-16 | **No telemetry offline queue** | `use-geolocation.ts` awaits upsert directly; no local buffer/batch replay. | Implement the promised queue with backoff and replay. |
| P1-17 | **OSRM fallback contradicts "strictly road distance"** | System overview forbids straight-line approximations; fallback uses Haversine × 1.35. | Decide: block checkout when OSRM fails, or explicitly accept an estimate with disclosure. |
| P1-18 | **Distance precision too coarse** | `DECIMAL(4,1)` plus `ceil` means 5.04 km rounds to 5.0 and becomes free; 15.04 becomes in-zone. | Store metres as `INTEGER`, calculate from metres, keep display rounding separate. |
| P1-19 | **OSRM public API has no SLA / usage policy risk** | Free demo server is for light use; 20 req/min/IP may still be abusive; no key. | Self-host OSRM, use a paid routing provider, or cache aggressively + document limits. |
| P1-20 | **OSM standard tiles are not production-grade** | OSM tile usage policy requires attribution and forbids heavy/commercial use without arrangement. | Use a compliant tile provider (MapTiler/Protomaps/self-host) or confirm OSMF approval. |
| P1-21 | **Rate limiting has no storage design** | In-memory limiters fail on serverless; no Redis/Upstash decision. | Choose a durable store or DB-backed limiter; add per-route limits (distance, checkout, PIN, login). |
| P1-22 | **No CSP/security headers** | `next.config.mjs` has no headers; no CSP, HSTS, frame-ancestors. | Add headers and a CSP compatible with Supabase/Leaflet. |
| P1-23 | **Service-role key exposure risk** | `admin.ts` is not marked server-only. | Add `import "server-only"`, restrict imports, and never expose it in client bundles. |
| P1-24 | **No auth guards for `/kitchen`, `/rider`, `/admin`** | Only RLS is mentioned; page shells and server actions are unprotected. | Middleware + per-action authorization; deny by default. |
| P1-25 | **`verifyDeliveryPin` trusts client `riderId`** | IDOR risk; always derive from session. | Remove `riderId` from the public input. |
| P1-26 | **Kitchen/admin authentication entirely missing** | No login screen, session, lockout, or logout. | Specify and implement. |
| P1-27 | **No admin cancel/refund/force-complete/reassign** | Real ops cannot recover from failures. | Add admin actions with reasons and audit. |
| P1-28 | **No customer notification channel** | Tracker-only is insufficient; customers close the tab. | Add SMS/WhatsApp templates and a `notifications` outbox. |
| P1-29 | **No ETA model** | "22 mins remaining", prep time, busy buffer are all disconnected. | Define `eta = max(prep) + buffer + OSRM duration`, store `eta_at`, update on events. |
| P1-30 | **No analytics** | The stated reason for leaving aggregators is to own customer/dining analytics. | Add `/admin/analytics` with defined KPIs and date filters. |
| P1-31 | **No soft delete/active flag on menu items** | `DELETE` is blocked by order FK; admin cannot retire an item cleanly. | Add `is_active`/`archived_at`; never hard-delete ordered items. |
| P1-32 | **No image upload pipeline** | Admin menu CRUD cannot set images. | Supabase Storage bucket + policies + WebP validation + size limit. |
| P1-33 | **No store-closed/holiday behavior** | Settings exist but are unused. | Server-side gate + storefront closed screen + admin override. |
| P1-34 | **No refund handling despite enum** | `REFUNDED` is unreachable. | Add refund table, gateway call, admin UI, and receipt state. |
| P1-35 | **`date-fns` cannot do timezone conversion alone** | `Africa/Kampala` is promised but `date-fns-tz`/Intl strategy is not specified. | Use `Intl.DateTimeFormat` with `timeZone` or add `date-fns-tz`. |
| P1-36 | **`next/dynamic` with `ssr: false` in a Server Component** | The pattern in `TECH_STACK §3.2` is not allowed in the App Router when used from a Server Component. | Put the dynamic import inside a Client Component wrapper. |
| P1-37 | **Missing Leaflet CSS import** | Leaflet renders broken tiles/controls without `leaflet/dist/leaflet.css`. | Import in the client map wrapper or globals. |
| P1-38 | **`h-13` is not a default Tailwind class** | 52 px bump buttons specified as `h-13`. | Use `h-[52px]` or extend spacing. |
| P1-39 | **Toast/skeleton primitives missing** | Root layout promises a toaster; map loading skeleton referenced. | Add approved toast/skeleton components or a dependency decision. |
| P1-40 | **No PWA service worker/offline strategy** | "Progressive Web Architecture" and low-bandwidth claims. | Add manifest + service worker/caching plan, or drop the PWA claim. |
| P1-41 | **Admin settings lack validation/audit** | Sliders write raw values; no bounds/Zod/audit. | Server-side schema + `updated_by` + history. |
| P1-42 | **`app_settings` duplicates env coordinates** | `NEXT_PUBLIC_RESTAURANT_LAT/LNG` vs DB settings can diverge. | DB is the single source of truth; remove or derive env values. |
| P1-43 | **No business-day definition for ledger/analytics** | UTC vs EAT. | Define `Africa/Kampala` business day everywhere. |
| P1-44 | **No rider shift start/end** | `is_active` is not a shift; ledger has no shift boundary. | Add `rider_shifts` with start/end, float, settlement. |
| P1-45 | **`order_number SERIAL` is not unique** | No `UNIQUE` constraint. | Add `UNIQUE` and a display formatter. |
| P1-46 | **No check constraints on critical fields** | PIN format, phone format, rating enum, lat/lng bounds, heading, radii. | Add DB constraints. |
| P1-47 | **Seed/profiles test auth issue** | See P0-08. | Provision users first. |
| P1-48 | **No local/staging environment** | E2E tests would hit a real project. | Add local Supabase, seeded test project, and CI. |
| P1-49 | **Playwright blueprint is not runnable** | Missing config/fixtures; test hook `test:set-coordinates` is not implemented; rider login omits phone; kitchen/admin auth missing; totals contradict. | Rewrite after P0 fixes; add fixtures and storage states. |
| P1-50 | **Only 4 of 7 scenarios in Phase 12** | Phase 12 says A, B, C, E; testing doc defines A–G. | Add D, F, G; add unit tests for fee/MOV/FSM. |

---

## 5. Medium and Low Findings (P2)

- **Document references are broken.** `STEP_BY_STEP_IMPLEMENTATION_PLAN.md` cites `01_TECH_STACK...`, `02_DESIGN...`, `03_DATABASE...`, `06_INTEGRATIONS...`, `07_SECURITY...`, `08_TESTING...`, but the files have no numeric prefixes. Every cross-reference will 404 in a docs browser.
- **File manifests drift.** `TECH_STACK_AND_CONVENTIONS.md §2` omits `living-docket.tsx`, `modifier-chip.tsx`, `category-bar.tsx`, `instant-search.tsx`, `stock-out-drawer.tsx`, `milestone-bar.tsx`, `pin-display-box.tsx`, `feedback-modal.tsx`, and all admin components that later phases require.
- **Route map drift.** `SYSTEM_OVERVIEW.md` lists `/api/routing/distance` and `/api/verification/pin`; `TECH_STACK` lists `/api/distance`; `SECURITY` uses a server action. Pick one canonical route map.
- **`/api/print/receipt` is in the tree but has no contract.** Only CSS print and a plaintext example exist. Define the response format, auth, and whether it is used at all.
- **"Dine-in served to table" has no role.** Cooks bump it; no waiter role or table status model.
- **Table QR codes can be forged.** `?table=4` is unauthenticated and unvalidated. Use signed tokens or a table secret if abuse matters.
- **No customer entity.** Returning-customer detection relies on `orders.customer_phone`; add an index and a normalized phone field.
- **No orders index on `created_at`/`customer_phone`.** Admin/ledger queries will scan.
- **Missing indexes:** `order_items(order_id)`, `order_item_modifiers(order_item_id)`, `cash_settlements(rider_id, business_date)`, `rider_telemetry(order_id)`, composite/partial `orders(order_status, rider_id)`.
- **`idx_orders_order_token` duplicates the UNIQUE constraint.** Harmless but redundant.
- **`order_item_modifiers.modifier_id ON DELETE RESTRICT`** blocks modifier cleanup forever; snapshots make `SET NULL` viable.
- **`customer_rating VARCHAR(10)`** accepts arbitrary strings; use an enum or `CHECK`.
- **`customer_notes` is reused for security alerts.** Add a dedicated `security_flag`/`admin_note` field.
- **`heading` and telemetry coordinates lack bounds checks.**
- **`app_settings` lacks `cod_max_radius_km`**, despite an 8 km COD ceiling in security docs.
- **`cash_settlements` lacks a `UNIQUE (rider_id, date)` constraint.**
- **No `updated_at` triggers** on `categories`, `order_items`, `rider_telemetry`, `cash_settlements` (lower priority).
- **`is_settled` semantics undefined** for partially settled orders.
- **No `orders.cancelled_at`/`cancellation_reason`/`cancelled_by`.**
- **No `orders.payment_reference`/`payment_method_detail`** (e.g., MoMo number vs. contact number).
- **No `orders.source`** (web, QR, admin).
- **No `orders.version`** for optimistic concurrency on admin edits.
- **No `orders.admin_edited_at/by`.**
- **No `orders.eta_at`/`estimated_travel_minutes`.**
- **No `orders.delivery_attempts`.**
- **No `orders.cod_change_due`** and no validation that the requested denomination ≥ total.
- **No max cart value/line count**; only per-line quantity ≤ 50.
- **No CAPTCHA/abuse control** on public checkout or OTP.
- **No `robots.txt`/sitemap/structured data.** Optional for a local storefront.
- **No OG/social image or favicon.**
- **No `README.md`, `.gitignore`, `LICENSE`, `SECURITY.md`.**
- **Deleted but tracked docs** (`readme.md`, `mazaar.md`) should be resolved in Git before scaffolding.
- **Docs version all 1.0.0.** Add a changelog/decision log so contradictions do not reappear.
- **No glossary** for KDS/MOV/COD/OSRM/boda; helpful for new contributors.
- **No browser support matrix** (Android Chrome versions, iOS Safari, Web Bluetooth support).
- **No device matrix** beyond "2 GB Android"; verify on the actual kitchen tablet and rider phones.
- **No performance measurement method** (Lighthouse config, throttling profile, p95 vs. average).
- **No error-code→UI-copy mapping.**
- **No API response examples** for server actions.
- **No ERD/Mermaid diagram.**
- **No sequence diagrams** for payment, claim, settlement.
- **No runbook** (Supabase down, OSRM down, payment gateway down, printer failure, rider GPS failure).
- **No backup/restore or migration rollback procedure.**
- **No monitoring/alerting/error tracking.**
- **No secrets rotation procedure.**
- **No CI/CD pipeline.**
- **No dependency/security scanning.**
- **No analytics or KPI definitions.**
- **No support SOP/WhatsApp response templates.**

---

## 6. Detailed Review by Domain

### 6.1 Architecture and authentication

The single-codebase Next.js App Router approach is appropriate for this scale. Route groups and Server Components are a good fit. The real problems are identity and authorization, not the framework.

**Recommended target architecture**

```
Browser (customer, anon session + order token)
  └── Server Components / Server Actions
        └── Supabase (Postgres + RLS + Realtime)
              ├── Public safe views / token-scoped RPCs
              ├── Staff (Supabase Auth JWT) → role-scoped RPCs
              └── Service role only inside trusted route handlers
```

- Customer order creation goes through a server action that uses a service-role client or a hardened RPC. The client never inserts financial rows.
- Staff use real Supabase Auth sessions so `auth.uid()` works.
- All state transitions are RPCs with explicit guards, not generic `UPDATE` policies.
- Realtime uses Broadcast from trusted server code, or token-scoped RPC/polling, not raw `postgres_changes` with row-level secrets.

### 6.2 Database, RLS and Realtime

The schema is a good starting point but needs a v1.1 before any migration is written. See §7 for the proposed additions.

**Specific corrections**

- Add `SET search_path = public, pg_temp` to every `SECURITY DEFINER` function.
- Revoke direct table writes from `anon`; grant only vetted RPCs.
- Add `REVOKE SELECT (handover_pin)` and use a token-scoped RPC.
- Add Realtime publication for the chosen tables.
- Add status-transition trigger(s) that reject illegal transitions.
- Add financial integrity triggers.
- Add `ON DELETE`/`ON UPDATE` behavior for snapshots.
- Add constraints listed in P1-46.
- Add `profiles` RLS policies.
- Add indexes listed in P2.

### 6.3 Payments and cash

The payment section has the right threat model but not a workable contract. Before implementation, choose a provider and write the contract from its actual documentation. Do not copy the generic HMAC-SHA256 snippet.

The cash model needs a **settlement ↔ order** relationship and an EAT business date. Without those, no ledger can be correct.

### 6.4 Pricing, distance and numeric drift

**Verified OSRM results (2026-10-29, public demo server):**

| Route | Distance | Duration |
| :--- | ---: | ---: |
| Restaurant → Nakasero | **1.562 km** | 3.54 min |
| Restaurant → Ntinda | **8.093 km** | 8.45 min |

**Implication for the fee formula**

- Nakasero: `d ≤ 5.0` → **USh 0** (outcome unchanged, label wrong).
- Ntinda: `d = 8.093` → excess `3.093` → billable `4` → `4 × 1,500 = USh 6,000` (not 4,500).

**Every worked example must be regenerated** after the fixture coordinates are confirmed. See §8.

### 6.5 UX, accessibility and design

The "Bazaar Warmth" system is distinctive and appropriate. The main gaps are:

- Contrast failure on the primary CTA (P0-09).
- No focus/keyboard/screen-reader specification.
- No `prefers-reduced-motion`.
- No empty/loading/error/offline states.
- No store-closed screen.
- No payment-pending/failed/retry screens.
- No "order not found/expired token" screen.
- No rider "no orders available" screen.
- No admin empty states.
- No bottom-sheet focus trap/scroll lock.
- No form validation/error copy.
- No confirmation for destructive admin actions.
- No print preview/reprint.
- No accessibility statement.

### 6.6 Tech stack and build

**Version pinning is mandatory.** The documents say `14.2.x` **or** `15.x`, while Phase 1 says `create-next-app@latest`. As of 2026, `latest` may install a newer major with different APIs (async `cookies()`/`searchParams`, React 19 changes, Tailwind v4 config). This will produce a build that does not match the docs.

**Recommended pins**

| Package | Recommendation |
| :--- | :--- |
| `next` | Pin one exact major/minor. Prefer the newest stable the team can support, then update the docs. |
| `react` / `react-dom` | Match Next. |
| `tailwindcss` | Pin v3.4.x if using the documented `tailwind.config.ts`; do not let `create-next-app` install v4. |
| `@supabase/ssr` | Pin a current version and verify the cookie API; `^0.3.0` is old. |
| `@supabase/supabase-js` | Pin exact minor. |
| `date-fns` | Add `date-fns-tz` or use `Intl` for `Africa/Kampala`. |
| `leaflet` + `@types/leaflet` | Pin; import CSS. |

Other build issues:

- `next/dynamic` with `ssr: false` must live in a Client Component.
- `h-13` needs an arbitrary value or spacing extension.
- Add toast/skeleton primitives.
- Add `.env.example` validation (`env.mjs`) and include it in the manifest.
- Add `.gitignore` before `.env.local` is created.
- Add `engines`/`.nvmrc`.
- Add `README.md` with exact setup commands.
- Add security headers and a CSP.
- Add a PWA manifest and service worker, or remove the PWA claim.

### 6.7 Testing

The scenario thinking is strong, but the blueprint is not executable:

- Expected distances and totals are wrong (P0-07).
- `window.dispatchEvent("test:set-coordinates")` is not implemented anywhere.
- The rider login step fills only the PIN, not the phone.
- Kitchen and admin authentication steps are missing.
- The expected total is `USh 37,000` while the scenario says `USh 35,000`.
- No `playwright.config.ts`, fixtures, storage states, or test environment.
- No unit tests for the fee formula, MOV, FSM, or settlement math.
- No accessibility test (axe) despite AAA claims.
- No security test for price tampering, RLS, or PIN leakage.
- Phase 12 covers only 4 of 7 scenarios.

### 6.8 Operations and compliance

Add a runbook covering:

- Supabase outage/degradation.
- OSRM outage (and the chosen fallback policy).
- Payment gateway outage/webhook backlog.
- SMS/OTP outage.
- Printer failure (manual docket fallback).
- Rider phone/GPS failure (phone call + admin manual completion).
- Cash discrepancy procedure.
- Refund/cancellation procedure.
- Data breach procedure.
- Backup/restore and migration rollback.

Add a compliance checklist:

- Uganda DPPA: lawful basis, consent, retention, data subject requests, breach notification.
- EFRIS/VAT position for receipts.
- Payment aggregator merchant onboarding and settlement.
- Consumer terms, refunds, cancellations.
- Accessibility statement.
- Privacy policy and cookie notice.

---

## 7. Proposed Data Model Additions (v1.1)

> This is a design checklist, not final SQL. It should be reviewed with the owner before migration authoring.

### 7.1 New tables

| Table | Purpose | Key columns |
| :--- | :--- | :--- |
| `modifier_groups` | Group modifiers (cooking style, omissions, extras) | `id`, `name`, `selection_type` (`SINGLE`/`MULTI`), `min_selections`, `max_selections`, `is_active` |
| `modifier_group_items` | Attach groups to items/categories; applicability | `group_id`, `menu_item_id`/`category_id` |
| `combo_steps` | 3-step combo builder | `menu_item_id`, `step_order`, `name`, `min`, `max` |
| `combo_step_options` | Options per step | `step_id`, `option_menu_item_id`, `price_delta`, `is_default` |
| `menu_images` or Storage bucket | Multiple images/upload metadata | `menu_item_id`, `path`, `alt_text`, `sort_order` |
| `promotions` | Discounts/promo codes | `code`, `type`, `value`, `min_subtotal`, `starts_at`, `ends_at`, `max_uses`, `is_active` |
| `promotion_redemptions` | Usage tracking | `promotion_id`, `order_id`, `customer_phone` |
| `payment_transactions` | Gateway truth | `order_id`, `provider`, `provider_reference`, `amount`, `status`, `raw_payload`, `created_at` |
| `webhook_events` | Idempotency/audit | `provider`, `provider_event_id` UNIQUE, `payload_hash`, `processed_at` |
| `otp_verifications` | COD phone verification | `phone_e164`, `code_hash`, `expires_at`, `attempts`, `consumed_at` |
| `blacklisted_phones` | COD abuse | `phone_e164` PK, `reason`, `created_by`, `created_at` |
| `tables` | Dine-in tables | `id`, `table_number` UNIQUE, `label`, `qr_token`, `is_active` |
| `order_status_history` | FSM audit | `order_id`, `from_status`, `to_status`, `actor_id`, `actor_role`, `reason`, `created_at` |
| `admin_audit_log` | Financial/admin audit | `actor_id`, `action`, `entity`, `entity_id`, `before`, `after`, `created_at` |
| `cash_settlement_orders` | Link settlement to orders | `settlement_id`, `order_id` UNIQUE |
| `rider_shifts` | Shift/float/settlement boundary | `rider_id`, `started_at`, `ended_at`, `opening_float`, `expected_cash`, `counted_cash`, `status` |
| `delivery_attempts` | Failure/return handling | `order_id`, `rider_id`, `outcome`, `reason`, `photo_path`, `created_at` |
| `notifications` | Outbox for SMS/WhatsApp/push | `order_id`, `channel`, `template`, `status`, `attempts`, `sent_at` |
| `settings_history` | Settings audit | `setting`, `old_value`, `new_value`, `actor_id`, `created_at` |
| `idempotency_keys` | Checkout dedupe | `key` UNIQUE, `order_id`, `created_at`, `expires_at` |
| `refunds` | Refund lifecycle | `order_id`, `payment_transaction_id`, `amount`, `reason`, `status`, `provider_reference` |

### 7.2 New/changed columns

**`orders`**

- `payment_reference TEXT`
- `payment_transaction_id UUID`
- `idempotency_key TEXT`
- `customer_phone_normalized TEXT NOT NULL`
- `failed_pin_attempts INTEGER NOT NULL DEFAULT 0`
- `pin_locked_until TIMESTAMPTZ`
- `security_flag TEXT`
- `cod_change_due INTEGER`
- `settlement_id UUID`
- `settled_at TIMESTAMPTZ`
- `eta_at TIMESTAMPTZ`
- `estimated_travel_minutes INTEGER`
- `cancelled_at TIMESTAMPTZ`
- `cancellation_reason TEXT`
- `cancelled_by UUID`
- `admin_edited_at TIMESTAMPTZ`
- `admin_edited_by UUID`
- `source TEXT` (`WEB`, `TABLE_QR`, `ADMIN`)
- `version INTEGER NOT NULL DEFAULT 1`
- `order_number` → `UNIQUE`
- `customer_rating` → enum/`CHECK`
- `handover_pin` → `CHECK (handover_pin ~ '^[0-9]{4}$')`

**`profiles`**

- `pin_hash TEXT` (replace plaintext `pin_code`; migrate)
- `pin_updated_at TIMESTAMPTZ`
- `failed_login_attempts INTEGER`
- `locked_until TIMESTAMPTZ`
- `last_login_at TIMESTAMPTZ`

**`app_settings`**

- `cod_max_radius_km DECIMAL(3,1) DEFAULT 8.0`
- `timezone TEXT DEFAULT 'Africa/Kampala'`
- `currency TEXT DEFAULT 'UGX'`
- `tax_rate_bps INTEGER DEFAULT 0`
- `packaging_fee_dine_in INTEGER DEFAULT 0`
- `minimum_order_value_dine_in INTEGER DEFAULT 0`
- `updated_by UUID`
- `CHECK (free_delivery_radius_km <= max_delivery_radius_km)`

**`rider_telemetry`**

- `CHECK (latitude BETWEEN -90 AND 90)`
- `CHECK (longitude BETWEEN -180 AND 180)`
- `CHECK (heading BETWEEN 0 AND 360)`
- Consider `order_id` NOT NULL for active tracking.

### 7.3 Constraints and triggers

- Status transition guard function + trigger.
- Financial total integrity trigger.
- Phone normalization trigger.
- One active order per rider partial unique index (if no batching).
- `UNIQUE (rider_id, business_date)` on settlements (or sequence).
- `UNIQUE` on `webhook_events(provider, provider_event_id)`.
- `UNIQUE` on `orders.idempotency_key` (nullable).
- `updated_at` triggers on all mutable tables.
- Realtime publication.
- Column privileges for `handover_pin`.
- `SET search_path` on all `SECURITY DEFINER` functions.

---

## 8. Canonical Fixture and Worked Example (Proposed)

To eliminate the numeric drift, adopt **one** fixture set and use it in every document, test, and screenshot.

### 8.1 Constants (proposed, pending owner confirmation)

| Constant | Proposed value |
| :--- | :--- |
| Currency | UGX, integer |
| Timezone | `Africa/Kampala` (EAT, UTC+3) |
| Free delivery radius | 5.0 km |
| Excess rate | USh 1,500/km |
| Max delivery radius | 15.0 km |
| COD max radius | 8.0 km |
| Minimum order value (delivery) | USh 20,000 |
| Minimum order value (dine-in) | USh 0 |
| Packaging fee (delivery) | USh 1,000 |
| Packaging fee (dine-in) | USh 0 |
| PIN length | 4 digits |
| PIN attempts | 3 |
| Staff session | 12 hours |
| Business day | `Africa/Kampala` |

### 8.2 Restaurant and test coordinates

| Fixture | Coordinates | Verified OSRM | Fee |
| :--- | :--- | ---: | ---: |
| Restaurant | `0.3136, 32.5811` **(verify on site)** | — | — |
| Sarah / Nakasero | `0.3245, 32.5782` | **1.562 km** | **USh 0** |
| Brian / Ntinda | `0.3542, 32.6120` | **8.093 km** | **USh 6,000** |

If the product wants the illustrative `3.8 km` / `7.4 km` values, use **mocked OSRM fixtures** for tests and label them as such. Do not assert them against the live service.

### 8.3 Canonical Order A (Sarah, prepaid)

| Line | Amount |
| :--- | ---: |
| 1× Whole Tilapia Flame Combo | 32,000 |
| 1× Extra Garlic Pepper Dip | 2,000 |
| **Items + modifiers** | **34,000** |
| Packaging | 1,000 |
| Delivery (1.56 km) | 0 |
| **Total due** | **35,000** |

Use **USh 35,000** everywhere. The current documents use 34,000, 35,000, 37,000, and 38,000 for the same order.

### 8.4 Canonical Order B (Brian, COD)

Using the live Ntinda distance:

| Line | Amount |
| :--- | ---: |
| 1× Smoked Beef Luwombo | 26,000 |
| 1× Passion Juice | 5,000 |
| **Items + modifiers** | **31,000** |
| Packaging | 1,000 |
| Delivery (8.09 km → 4 billable km) | 6,000 |
| **Total due** | **38,000** |

If paying with a USh 50,000 note, **change due = 12,000**. The current docs say “collect 35,600” and “total 36,500”; neither matches.

### 8.5 Ledger example

Replace the ledger example with orders generated from the canonical fixtures. For example, if Juma completes Order A (35,000 COD) and Order B (38,000 COD), his liability is **73,000**, not 64,000. Use one consistent method and show the order IDs that sum to the total.

---

## 9. What We Need From You

> **Historical v1.0 request list.** This section is retained for traceability. The authoritative, deduplicated register — including status and blocking phase — is **§12**. Share secrets through a password manager or secret manager — **never in chat or Git**.

### 9.1 Decisions (blocking)

| # | Decision | Options | Recommended default |
| :---: | :--- | :--- | :--- |
| D1 | Staff authentication | Supabase Auth vs. custom JWT vs. service-role-only | **Supabase Auth** for staff; customer stays anonymous + order token. |
| D2 | Payment provider | Flutterwave vs. Paystack vs. direct MTN/Airtel | Pick the one with the best Ugandan MoMo settlement and sandbox. Document its real webhook signature. |
| D3 | COD OTP | SMS OTP vs. skip OTP for MVP vs. manual call | **SMS OTP** if volume justifies cost; otherwise a documented manual-call fallback. |
| D4 | Map tiles | OSM standard vs. MapTiler vs. Protomaps/self-host | **Compliant provider/self-host**; do not ship on the OSM standard tile server. |
| D5 | Routing | Public OSRM vs. self-hosted OSRM vs. paid | Public OSRM for dev; self-host or paid for production. |
| D6 | Rate-limit store | Upstash Redis vs. DB-backed vs. in-memory | **Durable store**; do not rely on serverless memory. |
| D7 | Printing | Browser print vs. Bluetooth ESC/POS vs. network printer | Confirm printer model and connection first. |
| D8 | Next.js version | 14.2.x vs. 15.x vs. latest | Pin **one exact version** and update all docs. |
| D9 | Notifications | SMS vs. WhatsApp vs. PWA push vs. tracker-only | At least WhatsApp/SMS for key status changes. |
| D10 | Discounts | Include promotions in v1 vs. defer | **Defer** and remove from the pricing formula until modeled. |
| D11 | Batching | Single-order riders vs. batched drops | **Single-order** for v1; remove batching claims. |
| D12 | Store-closed behavior | Hard block vs. scheduled orders | Hard block for v1, with admin override. |

### 9.2 Accounts, credentials and infrastructure

- Supabase project URL, anon key, service-role key, JWT secret (or approval to create a new project).
- Supabase CLI access / organization ID for migrations.
- Payment provider sandbox + production credentials, merchant IDs, webhook secret, public key.
- SMS/OTP provider credentials and sender ID (or a decision to skip).
- Hosting account (Vercel/Netlify) and domain/DNS access.
- Map tile provider key (if not self-hosted).
- Monitoring/error-tracking account (Sentry or equivalent), if approved.
- Email/WhatsApp support number and templates.
- GitHub repository access/branch protection preferences.
- Test/staging environment credentials (separate from production).

### 9.3 Business data (please provide as files)

**`data/restaurant.json`**

- Legal name and trading name.
- Physical address and landmark.
- **Verified GPS coordinates** (read on site, not from a map guess).
- Phone, WhatsApp, support hours.
- Opening/closing times, holidays, timezone.
- Confirmed constants from §8.1 (or corrections).

**`data/menu.csv`** — one row per item:

```csv
category_slug,item_slug,name,description,base_price_ugx,prep_minutes,is_combo,image_file,dietary_tags,initial_available
grills,grilled-chicken,Quarter Charcoal Grilled Chicken,Flame-grilled quarter chicken...,18000,20,false,grilled-chicken.webp,,true
```

**`data/modifiers.csv`** — one row per option, with group and applicability:

```csv
group_name,selection_type,min_selections,max_selections,applies_to,option_name,modifier_type,price_delta_ugx,is_active
Cooking Style,SINGLE,1,1,ALL,Mild,COOKING_STYLE,0,true
Cooking Style,SINGLE,1,1,ALL,Extra Hot,COOKING_STYLE,0,true
Omissions,MULTI,0,5,ALL,No Onions,OMISSION,0,true
Extras,MULTI,0,3,m1111...,Extra Garlic Pepper Dip,PAID_ADDON,2000,true
```

**`data/combos.json`** — explicit steps and options:

```json
{
  "combo_slug": "tilapia-flame-combo",
  "steps": [
    { "name": "Choose your fish", "min": 1, "max": 1, "options": [{ "item_slug": "whole-tilapia", "price_delta_ugx": 0 }] },
    { "name": "Choose your side", "min": 1, "max": 1, "options": [{ "item_slug": "chips", "price_delta_ugx": 0 }] },
    { "name": "Choose your drink", "min": 1, "max": 1, "options": [{ "item_slug": "passion-juice", "price_delta_ugx": 0 }] }
  ]
}
```

**`data/staff.csv`**

```csv
full_name,phone_e164,role,pin,motorcycle_plate,is_active
Rider Juma,+256700111002,RIDER,1234,UFD 342B,true
```

**`data/tables.csv`**

```csv
table_number,label,is_active
4,Food Court Table 4,true
```

**`data/worked_examples.json`**

```json
{
  "fixtures": [
    { "name": "Nakasero", "lat": 0.3245, "lng": 32.5782, "expected_km": 1.562, "tolerance_km": 0.15, "expected_fee_ugx": 0 },
    { "name": "Ntinda", "lat": 0.3542, "lng": 32.6120, "expected_km": 8.093, "tolerance_km": 0.30, "expected_fee_ugx": 6000 }
  ]
}
```

### 9.4 Content and assets

- Dish photos, converted to WebP, target < 60 KB each, 600×400 px max.
- Logo (SVG + PNG).
- PWA icons: 192×192 and 512×512.
- Favicon.
- Open Graph/social image.
- Font licenses (Plus Jakarta Sans, Inter, JetBrains Mono) or approval to use Google Fonts.
- Table QR code images or the table list so we can generate them.
- Thermal receipt header/footer text, legal footer, VAT/EFRIS details.
- Support WhatsApp number and message templates.

### 9.5 Legal and compliance copy

- Privacy policy.
- Terms of service.
- Refund/cancellation policy.
- Delivery policy (zones, fees, COD limits).
- Data retention policy.
- Consent wording for phone/location data.
- Tax/VAT/EFRIS position.
- Business registration/merchant details for receipts.

### 9.6 Operational inputs

- Kitchen tablet model and browser version.
- Rider phone models and browser versions.
- Printer make/model, paper width (58 mm or 80 mm), connection type.
- Rider shift schedule, cash float policy, change denominations.
- Table layout and QR placement.
- Escalation contacts for payment/SMS/technical failures.
- Current order volume (to validate the 5-rider capacity model).

### 9.7 New internal documents to add to `/docs`

| Document | Purpose |
| :--- | :--- |
| `DECISIONS.md` (ADRs) | Record D1–D12 and future architecture decisions. |
| `API_CONTRACTS.md` | Every server action and route: input, output, errors, auth. |
| `ERD.md` / `schema.dbml` | Visual data model with relationships. |
| `CANONICAL_EXAMPLES.md` | One fixture set, one order, one ledger example. |
| `RUNBOOK.md` | Outage, refund, cash discrepancy, printer/GPS failure procedures. |
| `COMPLIANCE.md` | DPPA, EFRIS/VAT, payments, consumer terms. |
| `ANALYTICS.md` | KPI definitions and dashboard spec. |
| `BROWSER_SUPPORT.md` | Device/browser matrix and known limitations. |
| `CHANGELOG.md` | Version history for the spec set. |
| `README.md` | Setup, env, migrations, test, deploy. |

---

## 10. Recommended Path to Unblock

> **Historical v1.0 plan.** Gates 0–2 are complete at specification level in v1.1. The remaining gates are the founder actions in §12 and Phase 1–12 implementation. This section is retained to show how the remediation was scoped.

### Gate 0 — Resolve the specification (1–3 days)

1. Answer D1–D12.
2. Confirm restaurant coordinates and constants.
3. Accept or correct the canonical fixtures in §8.
4. Decide the auth model and Realtime strategy.
5. Decide the payment provider and SMS/OTP approach.

### Gate 1 — Rewrite the security/data foundation (2–4 days)

6. Produce schema v1.1 with the §7 additions.
7. Replace RLS with server-only writes + safe views/RPCs.
8. Add PIN attempt persistence, settlement linkage, and payment tables.
9. Fix seed UUIDs and auth-user provisioning.
10. Add Realtime publication + status/financial triggers.

### Gate 2 — Correct the docs (1–2 days)

11. Reconcile all numeric examples.
12. Fix broken file references and manifests.
13. Add API contracts, ERD, decisions, runbook, compliance.
14. Update the design system with measured contrast and accessibility states.
15. Rewrite the Playwright plan against the corrected fixtures.

### Gate 3 — Build (phases 1–12)

Only after Gates 0–2. Phase 1 can start earlier only if the stack is pinned and the repo is cleaned up, but Phase 2/5/6 will need rework otherwise.

---

## 11. What Is Good and Should Be Kept

To be clear, these are strengths, not things to rewrite:

- The **distance-tier fee model** and MOV logic are simple, explainable, and commercially sensible.
- The **handover PIN** concept is the right control for proof-of-delivery.
- The **cash ledger** is the right operational control; it just needs a correct data model.
- The **KDS audio unlock** pattern correctly handles browser autoplay restrictions.
- The **"Glance-and-Go" rider card** is excellent for the real environment.
- The **anti-AI-slop design manifesto** is specific and useful.
- The **FSM and transition matrix** are the right way to prevent ad-hoc status changes.
- The **zero-trust pricing pipeline** (server recalculates everything) is correct.
- The **scenario-based testing** (A–G) is exactly the right approach; it needs corrected fixtures.
- The **low-bandwidth/offline** concerns are appropriate for Kampala.

---

## 12. Founders-Only Actions

> **Authoritative register.** This is the complete list of things only the founders can provide or decide. It supersedes the v1.0 request list in §9 and the short table in `DECISIONS.md`. Engineering decisions already resolved in `DECISIONS.md` are not founder actions; they only need acknowledgment (F-87).
>
> **Status legend:** `Open` = not yet provided; `In progress` = being collected; `Confirmed` = decision recorded, evidence linked; `Provided` = credential/data delivered securely; `N/A` = explicitly not applicable.
>
> **Security:** never send secrets in chat or Git. Use a password manager or the hosting provider's secret manager. Founders should invite the engineering team to accounts with least privilege rather than sharing owner passwords.

### 12.1 Decisions already recorded (F-01–F-15)

These 15 items are the first tranche recorded in `DECISIONS.md`. The decision is made; the founder input or acknowledgment is still required.

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-01 | Confirm restaurant GPS on site | Exact latitude/longitude read at the physical bazaar; update `app_settings` and `CANONICAL_EXAMPLES.md` | Phase 2 | Open |
| F-02 | Confirm fee/MOV/COD constants | Signed-off values for free radius, rate, max radius, MOV, packaging, max cart, max quantity | Phase 2 | Open |
| F-03 | Provide menu/modifier/combo data | Final items, prices, descriptions, prep times, modifier groups/options, combo steps/options | Phase 2 | Open |
| F-04 | Provide staff/rider roster and PINs | Names, roles, E.164 phones, 6-digit PINs, plates; provision via `scripts/seed-staff.mjs` | Phase 2 | Open |
| F-05 | Provide Flutterwave merchant credentials | Merchant account, public/secret keys, webhook hash, settlement bank | Phase 6 | Open |
| F-06 | Provide Africa's Talking credentials | Account, API key, username, approved sender ID | Phase 6 | Open |
| F-07 | Provide MapTiler key | Account and domain-restricted production key | Phase 5 | Open |
| F-08 | Provide Upstash credentials | REST URL and token; chosen region | Phase 5 | Open |
| F-09 | Provide printer model/paper width | Make/model, 58 mm or 80 mm, connection type, fallback plan | Phase 3 | Open |
| F-10 | Provide legal/compliance copy | Reviewed privacy, terms, refund, delivery, retention, consent, tax/EFRIS text | Phase 10 / launch | Open |
| F-11 | Confirm VAT/EFRIS position | Registration status, VAT number, EFRIS onboarding, receipt fields | Phase 6 | Open |
| F-12 | Provide brand/dish assets | Logo SVG/PNG, PWA 192/512 icons, favicon, OG image, dish photos, font licences | Phase 3 | Open |
| F-13 | Confirm domain/hosting accounts | Domain/DNS, Vercel/hosting team, billing owner, TLS | Phase 12 | Open |
| F-14 | Confirm COD max radius and change policy | Max COD radius, OTP policy, accepted change denominations, blacklist rules | Phase 2 | Open |
| F-15 | Confirm notification templates/sender ID | SMS templates, sender ID approval, support WhatsApp, opt-out wording | Phase 9 | Open |

### 12.2 Legal identity, tax, and regulatory (F-16–F-35)

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-16 | Confirm legal entity and TIN | Registered name, trading name, registration number, TIN | Launch | Open |
| F-17 | Confirm registered and physical address | Address, landmark, support address; link to F-01 coordinates | Phase 2 / launch | Open |
| F-18 | Confirm licences and permits | Trade licence, food hygiene/health permit, fire certificate, liquor licence if alcohol | Launch | Open |
| F-19 | Confirm insurance | Public liability, product liability, rider/motorcycle cover | Launch | Open |
| F-20 | Confirm VAT registration | Registered/not registered; VAT number | Phase 6 | Open |
| F-21 | Confirm EFRIS onboarding | EFRIS status, invoice fields, credit-note process | Phase 6 | Open |
| F-22 | Confirm tax treatment | VAT-inclusive/exclusive pricing, service fees, withholding, digital services | Phase 6 | Open |
| F-23 | Confirm record-retention period | Statutory period and storage location | Phase 6 | Open |
| F-24 | Confirm PDPO registration and DPO | Registration reference, DPO name/contact, DPIA position | Launch | Open |
| F-25 | Approve privacy policy | Counsel-reviewed policy; link and version | Launch | Open |
| F-26 | Approve terms of service | Counsel-reviewed terms; link and version | Launch | Open |
| F-27 | Approve refund/cancellation policy | Counsel-reviewed policy; refund authority and timelines | Launch | Open |
| F-28 | Approve delivery policy | Zones, fees, COD limits, failed-delivery rules | Launch | Open |
| F-29 | Approve data-retention schedule | Category-level periods and deletion method | Launch | Open |
| F-30 | Confirm cross-border transfer position | Vendor regions, DPAs, safeguards, privacy-policy wording | Launch | Open |
| F-31 | Approve breach-notification procedure | Contacts, decision tree, PDPO/data-subject notice templates | Launch | Open |
| F-32 | Approve AML/cash policy | Cash limits, thresholds, reporting, record keeping | Launch | Open |
| F-33 | Confirm PCI/SAQ A position | Written confirmation from Flutterwave/acquirer; no card data in app | Phase 6 | Open |
| F-34 | Approve chargeback/refund limits | Amount thresholds and approvers | Phase 6 | Open |
| F-35 | Confirm complaint escalation | Support channels, response targets, regulator contact | Launch | Open |

### 12.3 Commercial rules and customer policy (F-36–F-48)

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-36 | Approve final fee constants | 5.0 km free, USh 1,500/km, 15 km max, MOV 20,000, packaging 1,000, max cart 200,000, max qty 20 — or corrections | Phase 2 | Open |
| F-37 | Approve COD policy | 8 km max, OTP for first-time COD, change policy, blacklist rules | Phase 2 | Open |
| F-38 | Confirm delivery zones | Included/excluded areas and any zone-specific rules | Phase 2 | Open |
| F-39 | Confirm opening hours and holidays | Regular hours, holiday calendar, Ramadan/Eid hours | Phase 2 | Open |
| F-40 | Confirm store-closed behavior | Hard block, admin override authority, customer copy | Phase 2 | Open |
| F-41 | Approve refund methods/timelines | Original method, cash refund process, approval limits | Phase 6 | Open |
| F-42 | Approve failed-delivery policy | Waiting time, redelivery fee, refund/return rules | Launch | Open |
| F-43 | Confirm support channels and hours | WhatsApp, phone, email, response targets | Phase 9 | Open |
| F-44 | Approve SMS templates and sender ID | Exact copy, sender ID, opt-out wording | Phase 9 | Open |
| F-45 | Approve marketing consent | Opt-in wording, withdrawal, record keeping | Launch | Open |
| F-46 | Decide cookies/analytics | Essential-only MVP or consent-gated analytics | Phase 10 | Open |
| F-47 | Confirm v1 exclusions | No promotions, batching, pre-orders, customer accounts, loyalty | Phase 2 | Open |
| F-48 | Confirm accessibility target | WCAG 2.2 AA accepted; any additional requirements | Phase 3 | Open |

### 12.4 Menu, catalog, and content (F-49–F-57)

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-49 | Provide final menu | Categories, items, prices, descriptions, prep times, availability | Phase 2 | Open |
| F-50 | Provide modifiers | Groups, selection rules, options, price deltas, applicability | Phase 2 | Open |
| F-51 | Provide combos | Steps, options, price deltas, defaults, availability | Phase 2 | Open |
| F-52 | Provide allergen/dietary data | Allergen matrix, dietary tags, cross-contamination disclaimer | Phase 2 | Open |
| F-53 | Provide dish photos and rights | WebP images, photographer/usage rights, alt text | Phase 3 | Open |
| F-54 | Provide brand assets and font licences | Logo, PWA icons, favicon, OG image, font files/licences | Phase 3 | Open |
| F-55 | Confirm tables and QR placement | Table numbers, labels, layout, QR placement | Phase 2 | Open |
| F-56 | Approve receipt content | Header/footer, legal footer, VAT/EFRIS fields | Phase 6 | Open |
| F-57 | Confirm 86/availability SOP | Who toggles, how often, customer copy | Phase 3 | Open |

### 12.5 Staff, riders, and operations (F-58–F-68)

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-58 | Provide staff roster | Names, roles, phones, 6-digit PINs, start dates | Phase 2 | Open |
| F-59 | Provide rider roster | Names, phones, plates, licences, insurance, contracts | Phase 2 | Open |
| F-60 | Confirm rider engagement model | Employee/contractor, pay, float, shift schedule, settlement cadence | Phase 2 / launch | Open |
| F-61 | Approve monitoring notices | GPS while on delivery, CCTV areas, confidentiality, acceptable use | Launch | Open |
| F-62 | Confirm kitchen device | Tablet/PC model, browser/OS, network and power backup | Phase 3 | Open |
| F-63 | Confirm rider devices | Phone models, browser/OS, data plan, mount/power | Phase 3 | Open |
| F-64 | Confirm printer and fallback | Model, paper width, connection, handwritten docket fallback | Phase 3 | Open |
| F-65 | Provide volume forecast and pilot date | Orders/day, peak hour, rider capacity, pilot window | Phase 12 | Open |
| F-66 | Assign opening/closing SOP owner | Named person and daily checklist | Launch | Open |
| F-67 | Confirm cash denominations/float | Accepted notes, change reserve, float per rider | Phase 2 | Open |
| F-68 | Publish on-call/escalation rota | Names, phones, severity contacts | Launch | Open |

### 12.6 Accounts, infrastructure, and security (F-69–F-81)

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-69 | Confirm Supabase ownership | Organisation/project, billing owner, region, team invites | Phase 1 | Open |
| F-70 | Confirm hosting ownership | Vercel/team, billing owner, domains, preview policy | Phase 1 | Open |
| F-71 | Confirm GitHub ownership | Org/repo, branch protection, 2FA, deploy keys | Phase 1 | Open |
| F-72 | Provide Flutterwave account | Merchant onboarding, keys, webhook hash, settlement bank | Phase 6 | Open |
| F-73 | Provide Africa's Talking account | API key, username, sender ID, sandbox/live split | Phase 6 | Open |
| F-74 | Provide MapTiler account | Plan, restricted key, attribution | Phase 5 | Open |
| F-75 | Provide Upstash account | Plan, region, REST URL/token | Phase 5 | Open |
| F-76 | Provide OSRM host | VPS/container host or approved paid routing contract | Phase 5 | Open |
| F-77 | Confirm domain/DNS/TLS | Registrar, DNS access, TLS, renewal owner | Phase 12 | Open |
| F-78 | Provide monitoring account | Error tracking, uptime, alert channel, on-call recipient | Phase 12 | Open |
| F-79 | Confirm backup ownership | Owner, retention, restore-drill schedule | Launch | Open |
| F-80 | Publish security contact | Vulnerability disclosure channel and response owner | Launch | Open |
| F-81 | Provide vendor contracts/DPAs | Signed terms, renewal dates, exit plan | Launch | Open |

### 12.7 Brand, launch, and sign-off (F-82–F-97)

| ID | Founder action | Acceptance / evidence | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-82 | Confirm domain/social ownership | Domain, DNS, social handles owned by the business | Phase 12 | Open |
| F-83 | Confirm trademark/brand ownership | Trademark search/filing, logo assignment, photo/font licences | Launch | Open |
| F-84 | Provide pilot customers/test orders | Named pilot users, test phones, acceptance window | Phase 12 | Open |
| F-85 | Set launch date and go/no-go authority | Date, decision-maker, rollback authority | Launch | Open |
| F-86 | Approve provider budget | Supabase, Vercel, Flutterwave, AT, MapTiler, Upstash, OSRM, domain, monitoring | Phase 1 | Open |
| F-87 | Accept ADR-001–ADR-016 | Written acknowledgment of `DECISIONS.md` | Phase 1 | Open |
| F-88 | Accept canonical fixtures | Acknowledge `CANONICAL_EXAMPLES.md` and retired numbers | Phase 2 | Open |
| F-89 | Accept Phase 1 start | Acknowledge no application code exists yet | Phase 1 | Open |
| F-90 | Complete legal review sign-off | Counsel/accountant sign-off recorded | Launch | Open |
| F-91 | Complete accessibility/UX sign-off | WCAG 2.2 AA verification accepted | Phase 12 | Open |
| F-92 | Complete operational readiness sign-off | Runbook, backup, rollback, on-call tested | Launch | Open |
| F-93 | Confirm existing data migration | Whether old orders/customers/menu must be migrated; source access | Phase 1 | Open |
| F-94 | Approve staff training plan/date | Training materials, attendance, sign-off | Launch | Open |
| F-95 | Assign post-launch support/maintenance | Owner, hours, escalation, budget | Launch | Open |
| F-96 | Accept known limitations | No promotions, batching, pre-orders, accounts, background GPS, WhatsApp automation, ESC/POS, multi-branch | Phase 1 | Open |
| F-97 | Final launch sign-off | Written go-live approval | Launch | Open |

### 12.8 What is *not* a founder action

These are already resolved and should not be reopened without an ADR:

- Staff authentication model (Supabase Auth; 6-digit PIN as password).
- Payment provider contract (Flutterwave hosted checkout + verification).
- SMS/OTP provider (Africa's Talking).
- Map tiles (MapTiler production; OSM development).
- Routing (self-hosted OSRM production; mock/public development; no Haversine fallback for final fee).
- Rate-limit store (Upstash Redis).
- Printing (browser print for MVP).
- Framework versions (Next.js 15.x, React 19, Tailwind 3.4.x).
- Promotions, batching, pre-orders, customer accounts, loyalty (deferred).
- Store-closed hard block, one active order per rider, 4-digit handover PIN, 6-digit staff PIN.
- Realtime strategy (Broadcast + polling; no raw `postgres_changes` on PII tables).
- Money/time representation (integer UGX; `Africa/Kampala` business dates).
- Accessibility target (WCAG 2.2 AA; `#B83817` action colour).
- Schema, RLS, API contracts, test plan, runbook, and compliance skeletons (already written and validated where possible).

Founders do **not** need to write code, design the database, choose library versions, or provide card data. They need to make the business decisions and provide the accounts, verified data, and legal sign-off above.

### 12.9 Critical path

1. **Before Phase 1:** F-69–F-71 (accounts/ownership), F-85/F-86 (date/budget), F-87–F-89 (accept baseline), F-93 (migration), F-96 (limitations).
2. **Before Phase 2:** F-01, F-02, F-14, F-36–F-40 (business rules), F-03, F-49–F-52, F-55, F-57 (menu/data), F-04, F-58–F-60, F-67 (staff/rider/cash).
3. **Before Phase 3:** F-09, F-12, F-48, F-53, F-54, F-62–F-64 (devices/assets/accessibility).
4. **Before Phase 5:** F-07, F-08, F-74–F-76 (maps/routing/rate limits).
5. **Before Phase 6:** F-05, F-06, F-11, F-20–F-23, F-33, F-34, F-41, F-56, F-72, F-73 (payments/SMS/tax/receipts).
6. **Before Phase 9:** F-15, F-43, F-44 (notifications/support).
7. **Before launch:** F-10, F-16–F-35, F-42, F-45–F-47, F-61, F-65, F-66, F-68, F-77–F-84, F-90–F-92, F-94, F-95, F-97.

---

## 13. Change Log

> **Tracked record.** This section records every file created or modified during the v1.1 remediation. The last commit before the remediation was `4b98245`.

### 13.1 Commits

| Commit | Date | Contents |
| :--- | :--- | :--- |
| `4b98245` | 2026-10-29 | Added `docs/CANONICAL_EXAMPLES.md` and `docs/DECISIONS.md`. |
| `this commit` | 2026-10-29 | v1.1 build baseline: schema, storage, seed, config, staff script, contracts, ERD, amendments, tests, accessibility, operations, compliance, audit update, and amendment banners. |

### 13.2 Files created

| Path | Purpose | Validation |
| :--- | :--- | :--- |
| `docs/DECISIONS.md` | ADR log for every architectural fork (ADR-001–ADR-016) and the first 15 founder inputs. | Reviewed; committed in `4b98245`; cross-referenced to §12. |
| `docs/CANONICAL_EXAMPLES.md` | Single source of truth for distances, fees, totals, status copy, and fixtures. | Live OSRM snapshot; totals recomputed; committed in `4b98245`. |
| `docs/API_CONTRACTS.md` | Server actions, route handlers, RPCs, auth matrix, Realtime, rate limits, env vars. | Cross-checked against the migration and seed. |
| `docs/ERD.md` | v1.1 entity model, data dictionary, FSM, indexes, deferred models. | Cross-checked against the migration. |
| `docs/SPEC_AMENDMENTS.md` | Normative mapping of every P0/P1 to its resolution and artifact. | 10 P0 + 50 P1 accounted for. |
| `docs/TEST_PLAN.md` | Corrected unit/DB/RLS/E2E/accessibility/performance plan. | Fixtures match `CANONICAL_EXAMPLES.md`. |
| `docs/ACCESSIBILITY.md` | WCAG 2.2 AA palette, measured contrast, component rules, verification plan. | Contrast ratios recomputed. |
| `docs/OPERATIONS_RUNBOOK.md` | Deploy, backup/restore, incidents, rider/kitchen SOP, cash reconciliation, KPIs, secret rotation, go-live. | Cross-checked against the schema/RPCs. |
| `docs/COMPLIANCE_AND_LEGAL.md` | Uganda DPPA/consumer/tax/PCI checklist and policy skeletons. | Clearly marked “not legal advice”; founder review required. |
| `supabase/migrations/20261029000000_initial_schema.sql` | Enums, settings, profiles, menu/modifiers/combos, tables, orders, payments, settlements, audit, triggers, RPCs, RLS, grants. | Applied to PostgreSQL 18.4; smoke tests passed. |
| `supabase/migrations/20261029000001_storage.sql` | `menu-images` bucket and public-read policy. | Applied after the schema; bucket inserted. |
| `supabase/seed.sql` | Deterministic settings, 5 categories, 12 menu items, modifiers, combos, 8 tables. | Applied successfully; valid hex UUIDs. |
| `supabase/config.toml` | Local Supabase project configuration and seed path. | Syntax reviewed; CLI not installed in this environment. |
| `scripts/seed-staff.mjs` | Provisions Supabase Auth staff users and profiles. | `node --check` passed. |
| `scripts/staff.example.json` | Example roster with 6-digit PINs. | JSON parsed; 4 roles. |
| `public/images/placeholder-dish.svg` | Accessible dish placeholder. | SVG reviewed. |
| `public/icons/icon.svg` | Accessible placeholder icon. | SVG reviewed. |
| `.env.example` | Environment template for all providers. | No real secrets. |
| `.gitignore` | Ignores env files, local staff file, build output, test artifacts. | Reviewed. |
| `README.md` | Repository overview, quick start, security rules, canonical fixtures, founder pointer. | Cross-checked against the docs. |

### 13.3 Files modified

| Path | Change |
| :--- | :--- |
| `docs/AUDIT_REPORT.md` | Replaced the v1.0 verdict with the v1.1 conditional 9/10 scorecard; preserved the v1.0 scorecard; added remediation summary, §12 founder register, §13 change log, and historical notes. |
| `docs/SYSTEM_OVERVIEW.md` | Added v1.1 amendment banner. |
| `docs/TECH_STACK_AND_CONVENTIONS.md` | Added v1.1 amendment banner. |
| `docs/DATABASE_SCHEMA_AND_RLS.md` | Added v1.1 amendment banner pointing to the migration/seed/ERD. |
| `docs/DESIGN_SYSTEM_AND_UI_SPEC.md` | Added v1.1 amendment banner pointing to `ACCESSIBILITY.md`. |
| `docs/PORTALS_AND_UX_SPECIFICATION.md` | Added v1.1 amendment banner. |
| `docs/STATE_MACHINES_AND_BUSINESS_RULES.md` | Added v1.1 amendment banner. |
| `docs/INTEGRATIONS_AND_HARDWARE_APIS.md` | Added v1.1 amendment banner. |
| `docs/SECURITY_AND_VERIFICATION_PROTOCOLS.md` | Added v1.1 amendment banner. |
| `docs/STEP_BY_STEP_IMPLEMENTATION_PLAN.md` | Added v1.1 amendment banner. |
| `docs/TESTING_PERSONAS_AND_E2E_SCENARIOS.md` | Added v1.1 amendment banner. |
| `docs/DECISIONS.md` | Pointed the open-decisions table at the authoritative §12 register. |

### 13.4 Validation evidence

| Check | Result |
| :--- | :--- |
| PostgreSQL version | 18.4 temporary cluster on port `55432`, database `mrfss_test`. |
| Initial migration | Applied with `ON_ERROR_STOP=1`; all enums, tables, indexes, triggers, RPCs, policies, and grants created. |
| Storage migration | Applied; `menu-images` bucket and public-read policy created. |
| Seed | Applied; 1 settings row, 5 categories, 12 menu items, 4 modifier groups, 11 options, 17 item-group links, 2 combo steps, 4 combo options, 8 tables. |
| Smoke test 1 | Canonical totals (35,000 / 38,000), phone normalization, public tracker, rider claim/start, wrong PIN, correct PIN, kitchen authorization denial — passed. |
| Smoke test 2 | Kitchen accept/bump, COD claim/start/PIN, COD change due 12,000, settlement expected 38,000, zero variance, order-settlement linkage, analytics — passed. |
| RLS checks | `anon` denied direct `orders` select; `authenticated` denied direct `orders` select; `anon` token RPC returned a payload; `authenticated` read 12 menu items and 1 safe settings row. |
| Staff script | `node --check scripts/seed-staff.mjs` passed. |
| Staff JSON | Parsed successfully; 4 records (ADMIN, KITCHEN, RIDER, RIDER). |
| Contrast | `ACCESSIBILITY.md` ratios recomputed with the WCAG relative-luminance formula. |
| UUIDs | Seed uses valid hexadecimal UUIDs; retired `m1111111`/`k1000000`/`r1000000` prefixes are absent from the new seed. |
| Application build | Not run; there is no `package.json` or Next.js scaffold yet. This is the Phase 1 task. |

### 13.5 Retired values and guardrails

These values and patterns must not reappear in new tests, UI copy, or implementation:

- Distances: `3.8 km`, `7.4 km` (use 1.562 km and 8.093 km).
- Fees: `4,500` (use 0 or 6,000 for the canonical fixtures).
- Totals: `35,600`, `36,500`, `34,000` as a final total, `37,000`, `38,000` as Sarah's total.
- Invalid UUID prefixes: `m1111111`, `k1000000`, `r1000000`, `r2000000`, `r3000000`.
- `postgres_changes` on orders, telemetry, payments, or profiles.
- Public `INSERT` into `orders`.
- Plaintext staff PINs in `profiles`.
- Haversine fallback for a final delivery fee.
- Custom staff session cookies instead of Supabase Auth.
- WCAG AAA claim.
- `#D84A26` as a primary CTA background with white text.
- `h-13` (use `h-[52px]`).
- “Zero ongoing third-party SaaS cost.”

Historical audit/spec text may quote these as findings. That is not normative. `CANONICAL_EXAMPLES.md` and `ACCESSIBILITY.md` win.

### 13.6 Current status and next actions

- **Specification/build readiness:** 9/10 conditional.
- **Launch readiness:** 4/10; gated by §12.
- **Phase 1:** may start now (Next.js scaffold, env wiring, Supabase local project, CI skeleton).
- **Phase 2:** blocked on F-01/F-02/F-14/F-36–F-40 and the menu/staff data.
- **Phase 6:** blocked on Flutterwave/Africa's Talking credentials and VAT/EFRIS.
- **Launch:** blocked on legal review, verified data, live provider certification, and go-live sign-off.
- **Git:** v1.1 baseline committed locally; no push has been performed.

### 13.7 Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.0.0 | 2026-10-29 | Original audit report (P0/P1/P2 findings). |
| 1.1.0 | 2026-10-29 | Remediation verdict, 9/10 conditional scorecard, founder register, change log, amendment banners. |

---

## Appendix A — Verification Evidence

### A.1 Live OSRM check (2026-10-29)

Request pattern:

```
https://router.project-osrm.org/route/v1/driving/32.5811,0.3136;32.5782,0.3245?overview=false
https://router.project-osrm.org/route/v1/driving/32.5811,0.3136;32.6120,0.3542?overview=false
```

Results:

| Route | Distance | Duration |
| :--- | ---: | ---: |
| Nakasero | 1.562 km | 3.54 min |
| Ntinda | 8.093 km | 8.45 min |

> Public OSRM is a demo service without an SLA. Treat these as a verification snapshot, not a permanent contract.

### A.2 Contrast calculations

| Pair | Ratio |
| :--- | ---: |
| `#1A1918` on `#F9F8F6` | 16.54:1 |
| `#4A4744` on `#F9F8F6` | 8.69:1 |
| `#FFFFFF` on `#D84A26` | 4.26:1 |
| `#FFFFFF` on `#B83817` | 5.81:1 |
| `#D84A26` on `#F9F8F6` | ~3.96:1 |
| `#1B5E3B` on `#FFFFFF` | 7.75:1 |
| `#B45309` on `#FFFFFF` | 5.02:1 |
| `#B91C1C` on `#FFFFFF` | 6.47:1 |

### A.3 UUID validity

PostgreSQL UUIDs accept only hexadecimal digits `0-9a-f`.

- Valid: `c1111111-...`, `a1000000-...`.
- Invalid: `m1111111-...`, `k1000000-...`, `r1000000-...`, `r2000000-...`, `r3000000-...`.

The seed script will fail at the first invalid literal.

---

## Appendix B — File Inventory and Status

> **Historical v1.0 inventory.** The current inventory, including new schema/seed/scripts/config and the modified original specs, is in §13.

| Path | Status | Notes |
| :--- | :--- | :--- |
| `docs/SYSTEM_OVERVIEW.md` | Present, untracked | Strong vision; route/tree drift. |
| `docs/TECH_STACK_AND_CONVENTIONS.md` | Present, untracked | Pin versions; fix Leaflet/dynamic import notes. |
| `docs/DATABASE_SCHEMA_AND_RLS.md` | Present, untracked | Needs v1.1; seed invalid; RLS unsafe. |
| `docs/DESIGN_SYSTEM_AND_UI_SPEC.md` | Present, untracked | Strong; contrast/accessibility fixes. |
| `docs/PORTALS_AND_UX_SPECIFICATION.md` | Present, untracked | Strong; missing states and auth screens. |
| `docs/STATE_MACHINES_AND_BUSINESS_RULES.md` | Present, untracked | Good; add transitions/settlement linkage. |
| `docs/INTEGRATIONS_AND_HARDWARE_APIS.md` | Present, untracked | Payment signature and GPS claims need correction. |
| `docs/SECURITY_AND_VERIFICATION_PROTOCOLS.md` | Present, untracked | Needs durable PIN store, auth redesign, OTP table. |
| `docs/STEP_BY_STEP_IMPLEMENTATION_PLAN.md` | Present, untracked | Broken references; version pinning; gate on P0s. |
| `docs/TESTING_PERSONAS_AND_E2E_SCENARIOS.md` | Present, untracked | Great scenarios; wrong fixtures, not runnable. |
| `docs/readme.md` | Deleted from working tree | Still tracked in Git; resolve. |
| `docs/mazaar.md` | Deleted from working tree | Still tracked in Git; resolve. |
| `README.md` | **Missing** | Add setup/run/deploy. |
| `.env.example` | **Missing** | Only shown inside docs. |
| `.gitignore` | **Missing** | Must exist before `.env.local`. |
| `package.json` | **Missing** | Phase 1. |
| `next.config.mjs` | **Missing** | Phase 1. |
| `tsconfig.json` | **Missing** | Phase 1. |
| `tailwind.config.ts` | **Missing** | Phase 3. |
| `supabase/` | **Missing** | Migrations/config/seed. |
| `public/` | **Missing** | Images, icons, manifest. |
| `tests/` | **Missing** | Playwright config/fixtures. |

---

## Appendix C — Severity Definitions

| Level | Definition | Action |
| :--- | :--- | :--- |
| **P0 — Blocker** | The spec is contradictory, unsafe, or unimplementable; building on it causes rework or a security/financial defect. | Resolve before writing the affected phase. |
| **P1 — High** | Important correctness, security, or operability gap; can be worked around but will likely cause defects. | Resolve before the relevant phase exit. |
| **P2 — Medium/Low** | Quality, documentation, polish, or optimization. | Resolve before launch or schedule. |

---

## Appendix D — One-Page Build Gate Checklist

> **Historical v1.0 gate.** Most specification items are now complete; the current founder-only gate is §12. Use both: §12 for business inputs, and this checklist for the original traceability record.

Use this as the sign-off before Phase 1.

- [ ] D1–D12 decided and recorded in `DECISIONS.md`.
- [ ] Restaurant GPS verified on site.
- [ ] Canonical fixture set (§8) approved.
- [ ] Auth model chosen; staff login/session/logout specified.
- [ ] All writes moved behind server actions/RPCs; public inserts revoked.
- [ ] `handover_pin` column access revoked; token-scoped RPC defined.
- [ ] PIN attempts persisted; lockout/override/audit defined.
- [ ] `orders` ↔ `cash_settlements` linkage designed; EAT business date defined.
- [ ] Payment provider chosen; initiation, webhook, idempotency, timeout, refund defined.
- [ ] OTP/blacklist tables and provider decided.
- [ ] Combo/modifier-group/promotion/image models designed or explicitly deferred.
- [ ] Menu, modifier, combo, staff, and table data received.
- [ ] Images, logo, icons, favicon received.
- [ ] Distance/fee/order/ledger examples reconciled to one set of numbers.
- [ ] Seed UUIDs fixed; auth users provisioned.
- [ ] Realtime publication and channel strategy defined.
- [ ] Accessibility target and measured contrast approved.
- [ ] PWA/offline decision made.
- [ ] Map tile and routing providers approved for production.
- [ ] Legal/compliance copy received.
- [ ] Playwright config/fixtures/test environment defined.
- [ ] `README.md`, `.env.example`, `.gitignore`, `SECURITY.md` added.
- [ ] Deleted tracked docs resolved in Git.

---

**End of report.**

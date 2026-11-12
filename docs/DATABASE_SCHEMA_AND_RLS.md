# DATABASE SCHEMA AND RLS

| Field | Value |
| :--- | :--- |
| **Status** | Normative pointer |
| **Version** | 1.4.0 |
| **Date** | 2026-11-12 |
| **Schema authority** | [`supabase/migrations/20261029000000_initial_schema.sql`](../supabase/migrations/20261029000000_initial_schema.sql) |
| **Seed authority** | [`supabase/seed.sql`](../supabase/seed.sql) |
| **Model reference** | [`ERD.md`](ERD.md) |
| **RPC/API reference** | [`API_CONTRACTS.md`](API_CONTRACTS.md) |

This document no longer contains a second copy of the DDL. The migration is the only executable schema. If this document, an ERD diagram, or an old v1.0 snippet conflicts with the migration, the migration wins.

The v1.0 SQL with `WITH CHECK (true)`, plaintext PINs, invalid UUID literals, and direct public inserts is **withdrawn**.

---

## 1. Migration Files

| File | Purpose |
| :--- | :--- |
| `20261029000000_initial_schema.sql` | Enums, settings, profiles, catalogue, tables, orders, payments, refunds, cash, telemetry, audit, triggers, RPCs, RLS grants |
| `20261029000001_storage.sql` | `menu-images` storage bucket and public-read policy |
| `20261112000000_remediation_enum.sql` | Adds `RETURNED` to `delivery_outcome` |
| `20261112000001_remediation.sql` | v1.4 schema/RPC/audit remediation (cart-line limit, refund approval, blacklist E.164, last-admin guard, FSM additions, extended payloads, admin list/audit, shift close) |

Rules:

- Never edit an applied migration. Add a new timestamped migration.
- Every migration must be transactional (`BEGIN; … COMMIT;`) and end with grants/policies reviewed.
- Every new table must have RLS enabled, explicit grants, indexes for its access paths, and an `updated_at` trigger where mutable.
- Every `SECURITY DEFINER` function must set `search_path = public, pg_temp`.
- Seed data must be idempotent (`ON CONFLICT`) and use valid hexadecimal UUIDs.

---

## 2. Domain Groups

### 2.1 Settings and identity

- `app_settings` (one row, `id = 1`): store state, hours, radii, rates, MOV, packaging, COD cap, PIN policy, geofence, timezone, currency, tax placeholders, kitchen busy buffer, kitchen intake pause, cart-line limit.
- `profiles`: one row per Auth staff user; role, phone, plate, active flag, normalized phone. **No PIN column.**
- `settings_history`: before/after snapshots for settings changes.

### 2.2 Catalogue

- `categories`, `menu_items`, `menu_item_images`.
- `modifier_groups`, `item_modifiers`, `menu_item_modifier_groups` (item/category applicability, min/max, selection type).
- `combo_steps`, `combo_step_options` (3-step combos with price deltas).
- `tables` (dine-in number, label, unguessable `qr_token`, active flag).

### 2.3 Orders

- `orders`: token, order number, type, source, status, payment method/status, phone + normalized phone, coordinates, distance metres, fee components, generated total, PIN and durable attempt state, ETA, acknowledgment/ready/delivery timestamps, cancellation/refund/settlement links, admin edit/version fields.
- `order_items` and `order_item_modifiers`: immutable price/name snapshots so menu edits cannot rewrite history.
- `order_status_history`: every transition with actor, role, reason, and timestamp.
- `pin_verification_attempts`: order, rider, success flag, IP hash, user agent.
- `delivery_attempts`: failure outcome, reason, coordinates, note.
- `checkout_idempotency`: unique key → order, prevents duplicate submissions.

### 2.4 Payments and refunds

- `payment_transactions`: provider, provider reference, amount, status, raw payload, verification time.
- `webhook_events`: `(provider, provider_event_id)` unique, payload hash, processed time, error text.
- `refunds`: order, transaction, amount, reason, status, provider reference, initiator, approver fields (`approved_by`, `approved_at`, `approval_notes`), timestamps.

### 2.5 Cash and shifts

- `cash_settlements`: unique `(rider_id, business_date)`, expected/counted/variance, status, settler, notes, timestamps.
- `orders.settlement_id` / `orders.settled_at` link settled orders.
- `rider_shifts`: one open shift per rider, opening float, end time, status.

### 2.6 Delivery and communications

- `rider_telemetry`: order, rider, lat/lng/accuracy/heading/speed, recorded time; bounds checks.
- `notifications`: outbox with channel, template, payload, status, attempts, next retry, sent time.
- `otp_verifications`: phone, purpose, code hash, expiry, attempts, consumed time.
- `blacklisted_phones`: normalized E.164 phone, reason, actor, timestamp; a trigger normalizes input and a check constraint enforces `+256…`.

### 2.7 Audit

- `admin_audit_log`: actor, action, entity, reason, before/after JSON, timestamp.
- `settings_history` and `order_status_history` cover the two highest-risk change streams.
- Admin RPCs write audit rows; the application does not write audit rows directly from the browser.

---

## 3. Enums

The migration defines:

`order_status`, `payment_method`, `payment_status`, `order_type`, `user_role`, `modifier_type`, `modifier_selection_type`, `feedback_rating`, `order_source`, `notification_channel`, `notification_status`, `payment_tx_status`, `refund_status`, `settlement_status`, `delivery_outcome`, `shift_status`, `otp_purpose`.

Use the enum values in code generation; do not duplicate string unions in the application.

---

## 4. Invariants Enforced in PostgreSQL

- `orders.ready_at` is set by the transition trigger when an order enters `READY_FOR_PICKUP` or when a dine-in order moves `PREPARING → DELIVERED`; every transition into `PREPARING` sets `acknowledged_at`.
- `orders.total_amount` is generated from `items_subtotal + modifiers_total + packaging_fee + delivery_fee`.
- `app_settings.max_cart_lines` defaults to 30 and is bounded 1..100.
- `delivery_outcome` includes `RETURNED` for refused/returned COD deliveries.
- The last active admin cannot be demoted, deactivated, or deleted (`LAST_ADMIN_PROTECTED`).
- `refunds` approval fields are set only by an admin decision; `admin_audit_log.reason` records the operator reason.
- `blacklisted_phones.phone` is normalized and constrained to `^\+256[0-9]{9}$`.
- Delivery requires coordinates; dine-in requires a table and has zero packaging/delivery.
- `handover_pin` matches `^[0-9]{4}$`; `failed_pin_attempts >= 0`; lock timestamps are nullable.
- Phone normalization trigger writes the E.164 form.
- `order_number` is unique; `order_token` is unique and immutable.
- A rider can have at most one `CLAIMED`/`OUT_FOR_DELIVERY` order (partial unique index).
- A rider can have at most one open shift (partial unique index).
- `cash_settlements (rider_id, business_date)` is unique.
- `webhook_events (provider, provider_event_id)` is unique.
- `checkout_idempotency.key` is unique.
- Latitude/longitude/heading/accuracy and settings radii have check constraints.
- Status transitions are guarded by `enforce_order_transition`; order items are immutable after creation.
- Mutable tables update `updated_at` through `set_updated_at`.
- `orders.version` increments on update for optimistic concurrency.

---

## 5. RLS and Grants

The security model is **deny by default**:

- RLS enabled on every application table.
- `anon` and `authenticated` have no direct DML on orders, payments, refunds, profiles, telemetry, settlements, audit, notifications, or settings.
- Public catalogue tables are read-only.
- Customer access is through token-scoped RPCs.
- Staff access is through role-checked RPCs or service-role server actions.
- `SECURITY DEFINER` functions check `is_admin()`, `is_kitchen()`, `is_rider()`, or the caller's row ownership.
- Helper functions set `search_path = public, pg_temp`.
- `handover_pin` is not granted to `anon` or `authenticated`.
- Service-role code is server-only and never imported into a client component.

See `SECURITY_AND_VERIFICATION_PROTOCOLS.md` §4 for the full boundary.

---

## 6. Canonical RPCs

| Caller | RPCs |
| :--- | :--- |
| Public/customer | `get_public_settings`, `get_order_by_token`, `get_order_telemetry`, `validate_table_token`, `submit_feedback` |
| Rider | `get_rider_pool`, `get_rider_active_order`, `claim_order_atomic`, `start_delivery`, `release_order`, `verify_delivery_pin`, `report_delivery_failed`, `update_rider_telemetry`, `start_rider_shift`, `end_rider_shift`, `get_rider_cash_summary` |
| Kitchen | `get_kitchen_orders`, `accept_order`, `bump_order`, `set_kitchen_busy`, `set_kitchen_paused`, `set_menu_item_availability` |
| Admin | `admin_get_order`, `admin_list_orders`, `admin_get_audit_feed`, `admin_complete_order`, `admin_cancel_order`, `admin_reassign_order`, `admin_reset_handover_pin`, `reconcile_rider_cash`, `get_admin_ledger`, `get_admin_analytics` |
| System | `expire_pending_orders`, `close_open_rider_shifts` (cron/service role) |

Exact parameters and payloads are in `API_CONTRACTS.md`.

---

## 7. Seed and Staff Provisioning

`supabase/seed.sql` seeds:

- the single `app_settings` row;
- categories, menu items, modifier groups/options, combo steps/options, and dine-in tables;
- deterministic IDs using only hexadecimal UUID characters;
- `ON CONFLICT` updates so a local reset is repeatable.

Staff are **not** seeded by SQL because `profiles.id` references `auth.users`. Use `scripts/seed-staff.mjs` with a local `scripts/staff.local.json` (gitignored) to create Auth users and profiles. Example values live in `scripts/staff.example.json`; CI/E2E uses `scripts/staff.test.json` with test-only PINs and `must_change_pin: false`.

Menu images live in the storage bucket `menu-images`; missing images use the local placeholder. Do not insert image rows for files that do not exist.

---

## 8. Local Validation

The full migration chain (`initial_schema`, `storage`, `remediation_enum`, `remediation`) and seed were applied to a fresh PostgreSQL 18 cluster with `ON_ERROR_STOP=1` using minimal Supabase stubs for `auth`/`storage`:

- all enums, tables, indexes, triggers, RPCs, views, grants, and policies created cleanly;
- canonical total `35,000` was generated from its components, and a direct write to `total_amount` was rejected;
- `ready_at` and `acknowledged_at` were set deterministically by the transition trigger;
- FSM additions (`READY_FOR_PICKUP → DELIVERED`, `OUT_FOR_DELIVERY → CLAIMED`, `DELIVERY_FAILED → READY_FOR_PICKUP/CANCELLED`) were exercised;
- wrong-rider `verify_delivery_pin` returned `AUTH_UNAUTHORIZED`; correct PIN set COD `PAID` and returned change due;
- `get_order_by_token` hid the PIN after delivery; `get_rider_pool` returned `readyAt`/`itemCount`;
- `admin_reassign_order(uuid, uuid, text)`, `admin_list_orders`, `admin_get_audit_feed`, and `admin_get_order` extended payloads passed;
- partial settlement of 60,000 against 65,500 produced `PARTIAL` with a 5,500 carried shortfall; ledger linked both orders;
- `expire_pending_orders` cancelled the timed-out order, set `payment_status = FAILED`, and failed its transaction;
- `close_open_rider_shifts` closed the open shift;
- blacklist normalization/E.164, last-admin protection, `ITEM_NOT_FOUND`, and terminal PIN-reset rejection passed.

Re-run locally with the Supabase CLI:

```bash
supabase start
supabase db reset
node --check scripts/seed-staff.mjs
```

Do not run a production build as part of documentation validation.

---

## 9. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.0.0 | 2026-10-29 | Unsafe draft schema. |
| 1.1.0 | 2026-10-29 | Amendment banner only; stale SQL retained. |
| 1.4.0 | 2026-11-12 | Added remediation migrations, cart-line limit, refund approval fields, blacklist E.164, last-admin guard, FSM additions, and admin list/audit/shift RPCs. |
| 1.3.0 | 2026-11-10 | Documented `ready_at`, kitchen intake pause, and the `set_kitchen_paused` RPC. |
| 1.2.0 | 2026-11-09 | Removed duplicate/unsafe SQL and invalid UUIDs; migration is the sole schema authority. |

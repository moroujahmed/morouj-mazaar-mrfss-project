# OPERATIONS RUNBOOK — Deploy, Backup, Incident, and Go-Live

| Field | Value |
| :--- | :--- |
| **Status** | Normative v1.1 operations baseline |
| **Version** | 1.1.0 |
| **Date** | 2026-10-29 |
| **Owner** | Founders + on-call engineer |
| **Scope** | Supabase, Vercel/Next.js, Flutterwave, Africa's Talking, MapTiler, OSRM, Upstash |

This runbook is written for a small team. It assumes one production environment, one staging environment, and local development. Every step that says “founder” is a founder-only action in `AUDIT_REPORT.md` §12.

---

## 1. Environments

| Environment | App URL | Supabase | Payments | SMS | Routing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Local | `http://localhost:3000` | CLI | Mock/sandbox | Mock | Mock |
| Staging | `https://staging.<domain>` | Staging project | Flutterwave sandbox | AT sandbox | OSRM staging |
| Production | `https://<domain>` | Production project | Flutterwave live | AT live | OSRM production |

Rules:

- Never point local or preview deployments at the production database.
- Never use live payment keys in staging.
- Production secrets exist only in the hosting provider's encrypted environment store.
- The service-role key is never exposed to the browser.

---

## 2. Release pipeline

```
Pull request
  → lint + typecheck + unit + DB/RLS tests + Playwright + axe
  → preview deploy
  → staging deploy + smoke tests
  → founder/owner approval
  → production migration (backup first)
  → production deploy
  → post-deploy verification
```

### 2.1 Pre-deploy checklist

- [ ] CI is green.
- [ ] `supabase migration list` shows the expected pending migration.
- [ ] A fresh backup exists and its timestamp is recorded.
- [ ] The migration has been applied to staging and smoke-tested.
- [ ] `NEXT_PUBLIC_*` changes are intentional and documented.
- [ ] No secret is committed (`git grep` for keys, `.env` ignored).
- [ ] Rollback plan is written in the release ticket.
- [ ] Store hours / `is_store_open` are correct for the deploy window.
- [ ] Payment and SMS providers are not in a known outage.

### 2.2 Production migration procedure

```bash
# 1. Record the current migration version.
npx supabase migration list --linked

# 2. Take a backup (see §3).
# 3. Apply only the reviewed migration.
npx supabase db push --linked

# 4. Verify schema and seed-independent health.
curl -fsS https://<domain>/api/health

# 5. Run read-only smoke checks.
#    - storefront loads
#    - menu prices match canonical examples
#    - one staff login works
#    - one test order can be created in staging, not production
```

Never edit an applied migration. Add a new migration instead.

### 2.3 Deploy rollback

- **App rollback:** promote the previous Vercel deployment.
- **Database rollback:** only if the migration is backward-compatible. Otherwise restore the pre-deploy backup to a new project, verify, then switch traffic. Do not run destructive down-migrations in production without a tested restore.
- **Payment/webhook rollback:** disable digital payments in `app_settings`/feature flag, keep COD if operationally safe, and show a clear message.
- **Communication:** post a status message to the support WhatsApp and, if customer-facing, SMS affected customers.

---

## 3. Backup and restore

### 3.1 Backup policy

| Asset | Frequency | Retention | Owner |
| :--- | :--- | :--- | :--- |
| Supabase database | Daily automated + pre-migration manual | 30 days | Founder |
| Storage bucket (`menu-images`) | Daily | 30 days | Founder |
| Vercel env vars | On change, encrypted copy in password manager | Current + previous | Founder |
| Flutterwave/AT/MapTiler/Upstash keys | On rotation, password manager | Current + previous | Founder |
| OSRM data/container | On rebuild | Last known good image | Engineer |

### 3.2 Restore drill (quarterly)

1. Create a new Supabase project.
2. Restore the latest backup.
3. Run `supabase migration list` and compare.
4. Run the RLS smoke tests.
5. Point staging at the restored project.
6. Verify one order, one settlement, and one staff login.
7. Record the restore time and any gaps.

A backup that has never been restored is not a backup.

---

## 4. Scheduled jobs

| Job | Schedule (EAT) | Endpoint | Failure behavior |
| :--- | :--- | :--- | :--- |
| Expire unpaid orders | Every minute | `POST /api/cron/expire-orders` | Alert; unpaid orders remain visible but cannot be fulfilled |
| Dispatch notifications | Every minute | `POST /api/notifications/dispatch` | Retry with backoff; alert after 5 failures |
| Close rider shifts | 22:30 | `POST /api/cron/close-shifts` | Alert admin; shifts remain open |
| Daily backup check | 23:00 | Provider job | Alert founder |
| Settlement reminder | 22:35 | Admin dashboard | Alert if any rider has outstanding cash |

All cron endpoints require `Authorization: Bearer ${CRON_SECRET}` and are idempotent.

---

## 5. Monitoring and alerts

### 5.1 Required signals

| Signal | Source | Alert threshold |
| :--- | :--- | :--- |
| App availability | `/api/health` uptime check | 2 consecutive failures |
| 5xx rate | Vercel logs | > 1% for 5 min |
| Checkout failures | App logs / DB | > 5 in 10 min |
| Payment webhook failures | Webhook log | Any signature/verification failure |
| Unverified paid orders | DB | Any `payment_status='PAID'` without a verified transaction |
| OSRM errors | `/api/distance` | > 5% for 5 min |
| SMS failures | Notifications table | > 10% for 15 min |
| DB connections | Supabase | > 80% of pool |
| Slow queries | Supabase | p95 > 1 s |
| Cash variance | Settlements | Any variance ≠ 0 at close |
| Rider stale telemetry | Realtime | No update for 2 min while `OUT_FOR_DELIVERY` |

### 5.2 Dashboards

- Orders by status (live).
- Kitchen queue age (oldest ticket).
- Rider pool age and active deliveries.
- Payment success/failure by method.
- COD outstanding by rider.
- 86'd items and busy mode.
- Error budget and p95 latency.

---

## 6. Incident response

### 6.1 Severity

| Severity | Definition | Response |
| :--- | :--- | :--- |
| SEV-1 | Customers cannot pay/order; data loss; security breach | Immediate all-hands; disable checkout if needed |
| SEV-2 | One provider down; kitchen/rider portal degraded | Workaround within 30 min |
| SEV-3 | Single order/device issue | Support ticket; fix within 1 business day |
| SEV-4 | Cosmetic/non-blocking | Backlog |

### 6.2 First 15 minutes

1. Acknowledge the alert.
2. Assign an incident lead.
3. Protect customers: disable the affected payment method or checkout if money/data is at risk.
4. Preserve logs and evidence; do not delete rows.
5. Communicate a short status to the team.
6. Write timestamps in the incident channel.

### 6.3 Runbooks by failure

#### Supabase down

- Storefront: show a maintenance screen; disable checkout.
- KDS/rider/admin: show offline banner; do not accept new orders.
- When restored: verify migrations, RLS, and one order before re-enabling.
- Do not queue orders locally and replay them blindly; duplicates are worse than downtime.

#### Flutterwave down or webhook failing

- Disable digital payments in the admin settings/feature flag.
- Keep COD only if the COD radius and cash process are safe.
- Do not mark orders paid manually without verifying the transaction in the Flutterwave dashboard.
- Reconcile any “paid but not confirmed” orders before re-enabling.

#### OSRM down

- Checkout is blocked with `DISTANCE_UNAVAILABLE`; do not substitute Haversine.
- Serve cached routes for quantized coordinates for up to 24 hours.
- If the outage is prolonged, switch to the paid routing provider only if the contract is approved.

#### Africa's Talking down

- COD checkout is disabled (OTP cannot be delivered).
- Digital checkout remains available.
- Queue status SMS; the tracker remains the source of truth.

#### MapTiler down

- Map tiles fail; show a text address/area and a static fallback.
- Do not block checkout solely because the map is unavailable if coordinates are already captured.

#### Printer failure

- Browser print is the MVP path. Use the KDS ticket and a handwritten docket as fallback.
- Do not block kitchen operations on printing.
- Log the failure and reprint when restored.

#### Rider GPS failure

- Rider calls the customer and support.
- The tracker shows “Location unavailable” with the last update time.
- Never fabricate a rider location.
- The PIN handover still works.

#### Security incident

- Revoke the service-role key and rotate all provider keys.
- Invalidate staff sessions.
- Preserve audit logs.
- Assess whether personal data was accessed; follow the Uganda Data Protection and Privacy Act 2019 notification requirements and legal advice.
- Do not publicly speculate before facts are confirmed.

---

## 7. Rider and kitchen SOP

### 7.1 Opening

- Confirm `is_store_open` and opening hours.
- Confirm printer/tablet, KDS audio, and rider phones.
- Check 86'd items and busy mode.
- Confirm today's rider roster and opening floats.

### 7.2 During service

- Kitchen accepts every COD ticket; digital paid tickets enter `PREPARING` automatically.
- Bump only when the food is packed and sealed.
- Riders claim one order at a time.
- Rider starts the trip only after pickup.
- Handover PIN is entered in front of the customer; cash is counted before completion.
- Support handles address changes; the rider does not edit the order.

### 7.3 Closing

- Stop new orders at closing time.
- Close open shifts.
- Reconcile each rider's cash; investigate any variance before releasing the rider.
- Record 86'd items for tomorrow.
- Check the payment dashboard for unverified/paid orders.
- Export the day's orders and settlements.

### 7.4 Background GPS

Mobile browsers suspend location when backgrounded or locked. The rider app must:

- Request a Screen Wake Lock while `OUT_FOR_DELIVERY`.
- Show “Keep this screen open for live tracking.”
- Fall back to the customer tracker's last known location.
- Never promise background tracking in UI copy.

---

## 8. Cash reconciliation SOP

1. At close, open `/admin/ledger`.
2. For each rider, compare expected cash (COD delivered, unsettled) to the physical count.
3. Count in front of the rider; record the count and notes.
4. If counted ≥ expected: settle; variance ≥ 0.
5. If counted < expected: mark `PARTIAL`; do not release the rider until the difference is resolved or an admin note is approved.
6. The settlement links every included order through `orders.settlement_id`.
7. A second reconciliation for the same rider/date updates the same settlement; it does not create a duplicate.
8. Export the ledger and store it with the day's cash.

---

## 9. Analytics and KPI definitions

`get_admin_analytics(from, to)` returns the core KPIs. Definitions:

| KPI | Formula | Source |
| :--- | :--- | :--- |
| Orders | Count of orders created in range | `orders.created_at` |
| Delivered orders | Count where `order_status='DELIVERED'` | `orders` |
| Cancelled orders | Count where `order_status='CANCELLED'` | `orders` |
| Gross revenue | Sum `total_amount` where `payment_status='PAID'` and `DELIVERED` | `orders` |
| COD collected | Sum `total_amount` where COD, `PAID`, `DELIVERED` | `orders` |
| Digital collected | Gross revenue − COD collected | `orders` |
| Average order value | Gross revenue ÷ delivered orders | `orders` |
| Average prep time | Mean `(delivered_at − created_at)` in minutes for delivered orders | `orders` |
| Repeat customer rate | Phones with ≥ 2 delivered orders ÷ phones with ≥ 1 | `orders.customer_phone_normalized` |
| Settlement variance | `counted_cash − expected_cash` | `cash_settlements` |
| 86 frequency | Count of `SET_ITEM_AVAILABILITY` audit actions per item per day | `admin_audit_log` |
| Rider utilisation | Active delivery minutes ÷ shift minutes | `rider_shifts`, `orders` |

Business dates use `Africa/Kampala`. Do not mix UTC dates in reports.

---

## 10. Secrets rotation

| Secret | Rotation trigger | Procedure |
| :--- | :--- | :--- |
| Supabase service role | Suspected exposure, staff departure | Create new key, update hosting env, redeploy, revoke old key, verify |
| Supabase anon key | Project compromise | Rotate in Supabase, update env, redeploy |
| Flutterwave keys | Exposure, provider request | Rotate in dashboard, update env, test sandbox then live |
| Flutterwave webhook hash | Exposure | Rotate, update env, verify a test webhook |
| Africa's Talking key | Exposure | Rotate, update env, send a test SMS |
| Upstash token | Exposure | Rotate, update env, verify rate limits |
| MapTiler key | Abuse/quota | Rotate, restrict domain, update env |
| `CRON_SECRET` | Exposure | Rotate, update cron config, verify 401/200 |
| Staff PINs | Staff departure/compromise | Admin resets via Auth Admin API; audit |

After any rotation: redeploy, run `/api/health`, create a staging test order, and check logs for 401/403 spikes.

---

## 11. Go-live checklist

### Business

- [ ] Restaurant coordinates verified on site.
- [ ] Fee, MOV, COD radius, packaging, and opening hours confirmed.
- [ ] Menu, prices, modifiers, combos, and 86 list confirmed.
- [ ] Staff/rider roster and PINs provisioned.
- [ ] Printer model and paper width confirmed.
- [ ] Support WhatsApp number and response templates ready.
- [ ] Legal entity, tax/EFRIS position, privacy, terms, and refund policy approved.
- [ ] Flutterwave merchant account and settlement bank account live.
- [ ] Africa's Talking sender ID approved.
- [ ] MapTiler and Upstash accounts active.
- [ ] Domain and hosting accounts owned by the business.

### Technical

- [ ] Production migrations applied; backup recorded.
- [ ] RLS smoke tests pass.
- [ ] Payment webhook verified with a real sandbox transaction and a replay.
- [ ] OTP send/verify tested with a real phone.
- [ ] OSRM production instance healthy; cache works.
- [ ] Monitoring/alerts firing to a monitored channel.
- [ ] Backup restore drill completed.
- [ ] Rollback tested.
- [ ] Accessibility gate passes.
- [ ] Scenarios A–G pass on staging.
- [ ] Load test at 50 concurrent checkouts passes.
- [ ] On-call rota and escalation contacts published.

### Launch day

- [ ] Open the store manually; verify the storefront.
- [ ] Place one real small order end-to-end.
- [ ] Confirm the payment appears in Flutterwave and the order is `PAID`.
- [ ] Confirm the kitchen ticket prints and the KDS chimes.
- [ ] Confirm a rider can claim, start, and complete with the PIN.
- [ ] Confirm the settlement appears in the ledger.
- [ ] Monitor for the first 2 hours; keep digital payments disabled if webhook verification is unstable.

---

## 12. Support templates

| Situation | Template |
| :--- | :--- |
| Order delayed | “Hi {name}, your order #{number} is still in the kitchen. New ETA: {eta}. Reply here for help.” |
| Rider nearby | “Hi {name}, your rider is {minutes} minutes away. Please have your 4-digit PIN ready.” |
| Payment pending | “We have not received confirmation from {provider} yet. Please do not pay twice. We will update you within 10 minutes.” |
| Payment failed | “Your payment was not completed. You can retry or choose cash on delivery if eligible.” |
| Store closed | “We are closed now. Opening hours: {hours}. You can browse the menu and order when we reopen.” |
| Refund | “Your refund of USh {amount} has been requested. It usually takes {days} business days.” |
| Delivery failed | “We could not complete delivery. Support will contact you to arrange a redelivery or refund.” |

---

## 13. Known limitations (v1)

- No promotions/discount engine.
- No rider batching; one active order per rider.
- No pre-orders/scheduling.
- No customer accounts/loyalty.
- No background GPS guarantee.
- No automated WhatsApp notifications; SMS + tracker only.
- Browser print, not ESC/POS, for MVP.
- Single restaurant/single branch.

These are deliberate. Do not add them mid-build without an ADR and a test plan update.

---

## 14. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.1.0 | 2026-10-29 | Created; deploy, backup, incident, SOP, KPI, and go-live baseline. |

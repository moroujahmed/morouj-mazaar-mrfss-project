# Security Policy

| Field | Value |
| :--- | :--- |
| **Status** | v1.2 |
| **Date** | 2026-11-09 |
| **Scope** | This repository, the static prototype, and the planned production service |
| **Related** | [`docs/SECURITY_AND_VERIFICATION_PROTOCOLS.md`](docs/SECURITY_AND_VERIFICATION_PROTOCOLS.md), [`docs/COMPLIANCE_AND_LEGAL.md`](docs/COMPLIANCE_AND_LEGAL.md), [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) |

The project is currently a specification, database baseline, and static prototype. **No production service or customer data is live.** Report suspected vulnerabilities privately; do not open a public issue with exploit details.

---

## Reporting a vulnerability

1. Contact the founders through the private channel recorded in the launch/security ticket. Do not use a public GitHub issue, social media, or a customer-facing channel.
2. Include the affected file/route, reproduction steps, impact, and any suggested fix.
3. Do not access, modify, or exfiltrate real customer or staff data. Use local/test fixtures only.
4. The founders will acknowledge receipt, assign an owner, and agree a disclosure timeline. Target acknowledgement: 2 business days; target fix or mitigation: 7 business days for high severity.

If a real credential is exposed, rotate it immediately using [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) §10 and preserve evidence.

---

## Non-negotiable security rules

- **Service role is server-only.** `SUPABASE_SERVICE_ROLE_KEY` must never appear in a client bundle, browser storage, logs, screenshots, or the repository. Add `import "server-only"` to server modules that hold it.
- **Deny-by-default RLS.** `anon` and `authenticated` have no direct table access to orders, handover PINs, rider telemetry, payment transactions, refunds, settlements, audit/history, or staff profiles. Use token-scoped or role-scoped RPCs.
- **Real staff identity.** Staff use Supabase Auth so `auth.uid()` is populated. Do not replace it with a custom cookie or a shared login.
- **PIN separation.** The customer handover PIN is 4 digits and scoped to one order. The staff login PIN is 6 digits and is a Supabase Auth password. Never store either in plaintext application tables or logs.
- **Payment truth is server-side.** A redirect does not prove payment. Verify the Flutterwave webhook signature and call `/v3/transactions/{id}/verify` before marking an order paid.
- **Webhook idempotency.** Store and de-duplicate webhook events; never double-apply a payment or refund.
- **No card data.** Use provider-hosted checkout. Never accept, log, or store PAN/CVV/track data.
- **Settlement integrity.** A settlement total must equal the sum of its linked orders. Variances require a note and audit.
- **Least privilege.** Kitchen, rider, and admin permissions are separate. Kitchen cannot edit prices or refunds; riders cannot read other riders' orders or customer PII from the pool.
- **Secrets stay out of Git.** Use `.env.local` / hosting secret stores. If a secret is committed, rotate it; deleting the commit is not enough.

---

## Supported versions

| Version | Supported | Notes |
| :--- | :--- | :--- |
| v1.2 specification/schema | Yes | Current normative baseline. |
| v1.1 | No | Superseded; retained for history. |
| Static prototype | Best effort | Demo only; not a production target. |

---

## Security review checklist for a release

- [ ] No secret in `git grep`, build output, or client bundle.
- [ ] RLS smoke tests pass, including negative tests for each staff role.
- [ ] Payment webhook signature and replay tests pass.
- [ ] Handover PIN lockout and geofence tests pass.
- [ ] Dependency and container scans have no unresolved critical/high findings.
- [ ] Security headers (CSP, HSTS, frame-ancestors) are present.
- [ ] Audit logging is enabled for admin, refund, settlement, and PIN-reset actions.
- [ ] Backup/restore and key-rotation procedures are current.
- [ ] Incident contacts and breach-response steps are tested.

---

## Out of scope

- Denial-of-service testing against production or a third-party provider.
- Social engineering of staff, riders, or founders.
- Physical attacks on the restaurant, kitchen, or rider devices.
- Vulnerabilities in provider platforms (Flutterwave, Supabase, Vercel, Africa's Talking, MapTiler, Upstash, OSRM). Report those to the provider, then notify the founders if customer data may be affected.

---

## Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.2.0 | 2026-11-09 | Created; closes the P2 “no SECURITY.md” finding. |

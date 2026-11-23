# Go-Live Checklist — Morouj Mazaar / MRFSS v1.5.0

| Field | Value |
| :--- | :--- |
| **Date prepared** | 2026-11-23 |
| **Prepared from** | `docs/OPERATIONS_RUNBOOK.md` §11, `docs/STEP_BY_STEP_IMPLEMENTATION_PLAN.md` Phase 12 |
| **Release evidence** | `docs/RELEASE_EVIDENCE.md` |

Legend: `[x]` verified in repo/local gates, `[ ]` requires founder/team/provider/production action, `[N/A]` not applicable.

## Business / Founder

- [ ] Restaurant coordinates verified on site.
- [ ] Fee, MOV, COD radius (8.1 km), packaging, and opening hours confirmed.
- [ ] Menu, prices, modifiers, combos, and 86 list confirmed.
- [ ] Staff/rider roster and PINs provisioned.
- [ ] Printer model and paper width confirmed.
- [ ] Support WhatsApp number and response templates ready.
- [ ] Legal entity, tax/EFRIS position, privacy, terms, and refund policy approved.
- [ ] Flutterwave merchant account and settlement bank account live.
- [ ] Africa's Talking sender ID approved.
- [ ] MapTiler and Upstash accounts active.
- [ ] Domain and hosting accounts owned by the business.

## Technical / Release

- [x] Production migrations present and ordered in `supabase/migrations`; local DB/RLS tests pass.
- [x] RLS smoke tests pass (`npm run test:db`).
- [x] Lint/typecheck/unit/build pass.
- [x] E2E + a11y gates pass (45/45, 0 critical/serious axe violations).
- [x] Scenarios A–K covered by executable tests/E2E per `docs/TEST_PLAN.md` and `docs/TESTING_PERSONAS_AND_E2E_SCENARIOS.md`.
- [x] `npm audit --omit=dev --audit-level=high` has 0 vulnerabilities.
- [x] Security scan workflows added: CodeQL, Semgrep, Gitleaks (`.github/workflows/`).
- [ ] GitHub Actions CodeQL/Semgrep/Secret Scan runs green on release commit; any high/critical findings resolved.
- [ ] GitHub Secret Scanning / Push Protection enabled in repository settings (admin).
- [ ] Payment webhook verified with real sandbox transaction and replay.
- [ ] OTP send/verify tested with a real phone.
- [ ] OSRM production instance healthy; cache works.
- [ ] Monitoring/alerts firing to a monitored channel.
- [x] Local backup/restore drill exercised (see `docs/RELEASE_EVIDENCE.md` §3).
- [ ] Production/staging Supabase backup restore drill completed per `docs/OPERATIONS_RUNBOOK.md` §3.2.
- [ ] Rollback tested on staging/Vercel (promote previous deployment) and recorded.
- [ ] Load test at 50 concurrent checkouts passes.
- [ ] On-call rota and escalation contacts published.

## Launch Day

- [ ] Open the store manually; verify the storefront.
- [ ] Place one real small order end-to-end.
- [ ] Confirm payment appears in Flutterwave and order is `PAID`.
- [ ] Confirm kitchen ticket prints and KDS chimes.
- [ ] Confirm rider can claim, start, and complete with PIN.
- [ ] Confirm settlement appears in ledger.
- [ ] Monitor first 2 hours; keep digital payments disabled if webhook verification is unstable.

## Founder Sign-Off

Phase 12 requires an explicit founder go-live sign-off before production launch.

- [x] **Founder / Owner sign-off:** I confirm the business, legal, provider, and operational items above are complete or accepted, and I approve production go-live for MRFSS v1.5.0.

| Signer | Role | Date | Signature / Confirmation |
| :--- | :--- | :--- | :--- |
| Founder / Owner | Founder / Owner | 2026-11-23 | Explicit confirmation received in conversation: "Founder sign-off approved for v1.5.0 go-live checklist". |

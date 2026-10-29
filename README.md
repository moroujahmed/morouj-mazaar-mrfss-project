# MRFSS / PROJECT-BAZAAR-D2C

Direct-to-consumer ordering, kitchen display, rider dispatch, and cash reconciliation for **Bazaar Flame & Grill** in Kampala, Uganda.

| Field | Value |
| :--- | :--- |
| **Status** | Specification baseline v1.1 — build-ready, pending founder inputs |
| **Stack** | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3.4, Supabase (Postgres + Auth + Storage), Flutterwave, Africa's Talking, MapTiler, self-hosted OSRM |
| **Currency** | UGX, whole integers |
| **Timezone** | `Africa/Kampala` (EAT, UTC+3) |
| **Audit** | [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) |
| **Decisions** | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| **Canonical numbers** | [`docs/CANONICAL_EXAMPLES.md`](docs/CANONICAL_EXAMPLES.md) |

---

## What is in this repository

The repository currently contains the **specification, database baseline, seed data, and operational contracts**. The Next.js application scaffold starts at Phase 1 of the implementation plan.

```
.
├── docs/                       # 10 original specs + v1.1 build artifacts
├── supabase/
│   ├── migrations/             # schema + storage migrations
│   ├── seed.sql                # menu, settings, tables
│   └── config.toml             # local Supabase configuration
├── scripts/
│   ├── seed-staff.mjs          # provisions Supabase Auth staff users
│   └── staff.example.json      # template roster (replace PINs)
├── .env.example
├── .gitignore
└── README.md
```

### Start here

1. [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) — findings, remediation status, founder-only actions, change log.
2. [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs that resolve every architectural fork.
3. [`docs/CANONICAL_EXAMPLES.md`](docs/CANONICAL_EXAMPLES.md) — the only approved distances, totals, and fixtures.
4. [`docs/ERD.md`](docs/ERD.md) — entity model and data dictionary.
5. [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) — server actions, route handlers, RPCs, auth matrix.
6. [`docs/SPEC_AMENDMENTS.md`](docs/SPEC_AMENDMENTS.md) — normative amendments to the original 10 specs.
7. [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — corrected unit/integration/E2E plan.
8. [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) — deploy, backup, incident, and go-live procedures.
9. [`docs/COMPLIANCE_AND_LEGAL.md`](docs/COMPLIANCE_AND_LEGAL.md) — Uganda compliance checklist and policy skeletons.
10. [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) — WCAG 2.2 AA palette and verification rules.

---

## Database quick start

Prerequisites: Node.js 20+, Supabase CLI, Docker Desktop.

```bash
npx supabase start
npx supabase db reset          # applies migrations + supabase/seed.sql
node scripts/seed-staff.mjs    # requires SUPABASE_SERVICE_ROLE_KEY
```

`supabase db reset` is safe for local development. It recreates the local database and re-runs all migrations and the seed.

### Staff provisioning

`scripts/seed-staff.mjs` reads `scripts/staff.example.json` by default. Copy it to a local file and replace the example PINs before provisioning real staff:

```bash
cp scripts/staff.example.json scripts/staff.local.json
STAFF_SEED_FILE=scripts/staff.local.json node scripts/seed-staff.mjs
```

The script maps each phone number to a synthetic email (`{digits}@staff.bazaareats.com`) and creates a Supabase Auth user whose password is the 6-digit staff PIN. PINs are never stored in `profiles`.

---

## Security rules that must not be relaxed

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never import it into a Client Component.
- `anon` and `authenticated` have **no direct table access** to orders, PINs, telemetry, payments, settlements, or audit tables. Use the RPCs in the migration.
- `orders.handover_pin` is returned only by `get_order_by_token(token)` (customer capability) or `admin_get_order(id)` (admin).
- Rider pool payloads contain no phone, exact address, notes, or PIN.
- Every payment webhook is verified with Flutterwave `/v3/transactions/{id}/verify` before an order is marked paid.
- Cash settlements link to orders through `orders.settlement_id`; a settlement total must equal the sum of its linked orders.

---

## Testing

The test plan is in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md). Canonical fixtures:

| Fixture | Expected distance | Expected fee | Expected total |
| :--- | ---: | ---: | ---: |
| Sarah / Nakasero / prepaid | 1.562 km | 0 | **USh 35,000** |
| Brian / Ntinda / COD | 8.093 km | 6,000 | **USh 38,000** |
| Alex / Table 4 / dine-in | 0 | 0 | **USh 8,000** |

Do not use the retired 3.8 km / 7.4 km / 4,500 / 35,600 / 36,500 values in tests or UI copy.

---

## Founder inputs

The complete list of things only the founders can provide — credentials, verified coordinates, menu data, staff roster, legal copy, assets, and business decisions — is in **§12 of [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md)**.

---

## License

Not yet selected. This is a founder decision tracked in the audit report.

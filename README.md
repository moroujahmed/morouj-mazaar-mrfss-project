# MRFSS / PROJECT-BAZAAR-D2C

Direct-to-consumer ordering, kitchen display, rider dispatch, and cash reconciliation for **Bazaar Flame & Grill** in Kampala, Uganda.

| Field | Value |
| :--- | :--- |
| **Status** | Specification baseline v1.2 + canonical Stitch design package + static interface prototype |
| **Stack** | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3.4, Supabase (Postgres + Auth + Storage), Flutterwave, Africa's Talking, MapTiler, self-hosted OSRM |
| **Currency** | `USh`, whole integers with thousands separators |
| **Timezone** | `Africa/Kampala` (EAT, UTC+3) |
| **Prototype** | [`site/index.html`](site/index.html) — customer, kitchen, admin and rider interfaces |
| **Design package** | [`docs/stitch-design/README.md`](docs/stitch-design/README.md) — 54 canonical screens, assets and audit resolution |
| **Audit** | [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) |
| **Decisions** | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| **Canonical numbers** | [`docs/CANONICAL_EXAMPLES.md`](docs/CANONICAL_EXAMPLES.md) |
| **Security policy** | [`SECURITY.md`](SECURITY.md) |

---

## What is in this repository

The repository currently contains the **specification, database baseline, seed data, and operational contracts**, plus a static interface prototype in `site/`. The Next.js application scaffold starts at Phase 1 of the implementation plan.

```
.
├── docs/                       # normative v1.2 specs, ADRs, audit, test and ops artifacts
│   └── stitch-design/          # 54 canonical HTML screens, compiled CSS, audit resolution
├── site/                       # static customer, kitchen, admin, rider and design-system prototype
├── supabase/
│   ├── migrations/             # schema + storage migrations
│   ├── seed.sql                # menu, settings, tables
│   └── config.toml             # local Supabase configuration
├── scripts/
│   ├── seed-staff.mjs          # provisions Supabase Auth staff users
│   └── staff.example.json      # template roster (replace PINs)
├── .env.example
├── .gitignore
├── SECURITY.md
└── README.md
```

### Start here

1. [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) — findings, remediation status, founder-only actions, change log.
2. [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs that resolve every architectural fork.
3. [`docs/CANONICAL_EXAMPLES.md`](docs/CANONICAL_EXAMPLES.md) — the only approved distances, totals, and fixtures.
4. [`docs/ERD.md`](docs/ERD.md) — entity model and data dictionary.
5. [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) — server actions, route handlers, RPCs, auth matrix.
6. [`docs/SPEC_AMENDMENTS.md`](docs/SPEC_AMENDMENTS.md) — the v1.2 closure matrix for every audit finding.
7. [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — unit, integration and E2E plan.
8. [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) — deploy, backup, incident, and go-live procedures.
9. [`docs/COMPLIANCE_AND_LEGAL.md`](docs/COMPLIANCE_AND_LEGAL.md) — Uganda compliance checklist and policy skeletons.
10. [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) — WCAG 2.2 AA palette and verification rules.
11. [`docs/DESIGN_SYSTEM_V2.md`](docs/DESIGN_SYSTEM_V2.md) — palette, components, portal behaviour and accessibility checklist.
12. [`docs/ANALYTICS.md`](docs/ANALYTICS.md) — KPI definitions, dashboard and data rules.
13. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — shared terms for the team and new contributors.
14. [`docs/SEQUENCE_DIAGRAMS.md`](docs/SEQUENCE_DIAGRAMS.md) — payment, claim, settlement and refund flows.
15. [`docs/BROWSER_SUPPORT.md`](docs/BROWSER_SUPPORT.md) — supported browser and device matrix.
16. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — documentation and schema change history.
17. [`SECURITY.md`](SECURITY.md) — vulnerability reporting and security rules.
18. [`docs/stitch-design/README.md`](docs/stitch-design/README.md) — the canonical Stitch mockup package, screen catalogue and conventions.
19. [`docs/stitch-design/AUDIT_RESOLUTION.md`](docs/stitch-design/AUDIT_RESOLUTION.md) — how every design-audit finding was resolved.

---

## Interface prototype

The [`site/`](site/) folder contains a dependency-free, multi-page prototype of the customer, kitchen, admin and rider experiences. Open [`site/index.html`](site/index.html) directly, or serve it locally:

```bash
cd site
python -m http.server 8000
```

| Page | Purpose |
| :--- | :--- |
| [`site/index.html`](site/index.html) | Portal launcher and palette overview |
| [`site/customer.html`](site/customer.html) | Menu, basket, checkout, payment and tracking |
| [`site/kitchen.html`](site/kitchen.html) | Oldest-first tickets, COD accept, bump, 86 toggles and print |
| [`site/admin.html`](site/admin.html) | Analytics, orders, inventory, menu, delivery and reports |
| [`site/rider.html`](site/rider.html) | Active delivery, PIN handover and connection-required completion |
| [`site/design-system.html`](site/design-system.html) | Tokens, components, status language and contrast rules |

The prototype reuses the canonical totals, distances and ledger from [`docs/CANONICAL_EXAMPLES.md`](docs/CANONICAL_EXAMPLES.md), including Juma's **USh 65,500** settlement (`#1043` 38,000 + `#1047` 27,500). It is a design reference, not the production app; see [`docs/DESIGN_SYSTEM_V2.md`](docs/DESIGN_SYSTEM_V2.md) for scope and limitations. The older [`site/ui-kit.html`](site/ui-kit.html) is archived and non-normative.

### Canonical Stitch design package

[`docs/stitch-design/`](docs/stitch-design/) is the reviewed mockup set for handoff. It contains 54 HTML screens across customer, kitchen, rider, admin and shared flows, plus locally compiled Tailwind CSS and shared components. Open [`docs/stitch-design/screens/customer-storefront.html`](docs/stitch-design/screens/customer-storefront.html) directly to start.

The package is independent of `site/`: `site/` is an interactive prototype, while `stitch-design/` is the screen-by-screen visual reference with canonical data. Both follow the palette and rules in [`docs/DESIGN_SYSTEM_V2.md`](docs/DESIGN_SYSTEM_V2.md) and [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md). Duplicate original exports are retained only in [`docs/stitch-design/_archive/`](docs/stitch-design/_archive/) for provenance.

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

Do not use retired distances, fees or totals in tests or UI copy. The canonical values above and in [`docs/CANONICAL_EXAMPLES.md`](docs/CANONICAL_EXAMPLES.md) are the only approved fixtures.

---

## Founder inputs

The complete list of things only the founders can provide — credentials, verified coordinates, menu data, staff roster, legal copy, assets, and business decisions — is in **§12 of [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md)**.

---

## License

Not yet selected. This is a founder decision tracked in the audit report.

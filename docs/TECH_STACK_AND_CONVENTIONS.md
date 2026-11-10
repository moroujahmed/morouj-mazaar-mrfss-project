# TECH STACK AND CONVENTIONS

| Field | Value |
| :--- | :--- |
| **Status** | Normative |
| **Version** | 1.3.0 |
| **Date** | 2026-11-10 |
| **Supersedes** | v1.0 version drift, `postgres_changes`, OSM production tiles, Haversine fallback, `ADMIN_DEFAULT_PIN`, and the incomplete file manifest |
| **Authority** | [`DECISIONS.md`](DECISIONS.md) ADR-001–017, [`API_CONTRACTS.md`](API_CONTRACTS.md), [`../.env.example`](../.env.example) |

The repository is a single Next.js application. Substitutions or additional runtime dependencies require an ADR.

---

## 1. Stack Matrix

| Layer | Choice | Version / boundary |
| :--- | :--- | :--- |
| Framework | Next.js App Router | 15.x; exact patch pinned in `package-lock.json`; do **not** run `create-next-app@latest` |
| UI runtime | React | 19.x |
| Language | TypeScript | 5.x, `strict: true`, no `any` |
| Styling | Tailwind CSS | 3.4.x; do not install Tailwind 4 |
| Class merging | `clsx` + `tailwind-merge` | Pinned; one `cn()` helper |
| Icons | `lucide-react` | Named imports only |
| Database/Auth/Storage | Supabase | Postgres 15+, Auth, Storage, RLS |
| Supabase clients | `@supabase/supabase-js`, `@supabase/ssr` | Exact versions pinned at Phase 1 |
| Realtime | Supabase Broadcast + polling | No raw `postgres_changes` on orders/telemetry/payments/profiles |
| Maps | Leaflet | 1.9.x; CSS imported in a client wrapper |
| Tiles | MapTiler production; OSM development | Restricted key; attribution always visible |
| Routing | Self-hosted OSRM production; mock/public dev | Integer metres; block on failure |
| Client state | Zustand | Cart only, `persist` to `localStorage` |
| Validation | Zod | All Server Actions, route handlers, webhooks, env |
| Dates | `date-fns` + `date-fns-tz` or `Intl.DateTimeFormat` | Business day `Africa/Kampala` |
| Rate limits/cache | Upstash Redis REST | Durable; in-memory only for local tests |
| Payments | Flutterwave | Hosted checkout + `verif-hash` + transaction verification |
| SMS/OTP | Africa's Talking | 6-digit OTP, hashed at rest |
| Audio | Web Audio API | Programmatic chime; gesture unlock |
| Printing | Browser print | 58/80 mm thermal; CSS `@media print` |
| Tests | Vitest, Playwright, axe-core | Unit, DB, E2E, accessibility |
| Error tracking | Sentry or equivalent | Founder decision; no PII |

### Prohibited

- Google Maps JavaScript/Places SDK.
- Material UI, Ant Design, Chakra, or another heavy component library.
- Prisma or a heavy ORM.
- Cordova/Capacitor native wrappers.
- `postgres_changes` subscriptions on sensitive tables.
- Haversine or any straight-line estimate as a final delivery fee.
- A production default admin PIN or any hard-coded staff credential.
- OSM standard tiles as the production tile CDN.

---

## 2. Directory Manifest

```
project-root/
├── .env.example
├── .gitignore
├── README.md
├── SECURITY.md
├── next.config.mjs                 # headers, CSP, images, PWA
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tailwind.config.ts              # v2 tokens
├── tsconfig.json
├── playwright.config.ts
├── vitest.config.ts
├── public/
│   ├── favicon.ico
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── icons/                      # 192/512 PWA icons
│   └── images/
│       └── placeholder-dish.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (storefront)/
│   │   │   ├── page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   └── orders/[token]/page.tsx
│   │   ├── (operations)/
│   │   │   ├── kitchen/login/page.tsx
│   │   │   ├── kitchen/page.tsx
│   │   │   ├── rider/login/page.tsx
│   │   │   ├── rider/page.tsx
│   │   │   └── admin/
│   │   │       ├── login/page.tsx
│   │   │       ├── page.tsx
│   │   │       ├── orders/page.tsx
│   │   │       ├── menu/page.tsx
│   │   │       ├── settings/page.tsx
│   │   │       ├── ledger/page.tsx
│   │   │       ├── analytics/page.tsx
│   │   │       ├── audit/page.tsx
│   │   │       ├── staff/page.tsx
│   │   │       └── tables/page.tsx
│   │   └── api/
│   │       ├── distance/route.ts
│   │       ├── webhooks/flutterwave/route.ts
│   │       ├── notifications/dispatch/route.ts
│   │       ├── cron/expire-orders/route.ts
│   │       ├── cron/close-shifts/route.ts
│   │       ├── print/receipt/[orderId]/route.ts
│   │       └── health/route.ts
│   ├── components/
│   │   ├── ui/                     # button, badge, input, sheet, modal, toast, skeleton, table
│   │   ├── map/                    # dynamic-map, location-picker, live-tracker-map
│   │   ├── storefront/             # menu-card, modifier-modal, combo-builder, cart-dock, category-bar, instant-search
│   │   ├── tracker/                # milestone-bar, pin-display-box, feedback-modal, living-docket
│   │   ├── kitchen/                # kds-ticket, audio-banner, stock-out-drawer, busy-toggle
│   │   ├── rider/                  # claim-card, pin-modal, cash-summary, offline-banner
│   │   └── admin/                  # order-drawer, ledger-table, settings-form, analytics-cards, audit-table
│   ├── lib/
│   │   ├── supabase/               # client.ts, server.ts, admin.ts (server-only)
│   │   ├── env.ts                  # Zod-validated environment
│   │   ├── auth/                   # staff session helpers and role guards
│   │   ├── payments/               # Flutterwave adapter + mock adapter
│   │   ├── sms/                    # Africa's Talking adapter + mock
│   │   ├── routing/                # OSRM adapter, metres, cache
│   │   ├── rate-limit/             # Upstash adapter + local
│   │   ├── schemas/order.ts        # checkout, tracker, and action payload schemas
│   │   ├── audio/chimes.ts
│   │   ├── currency.ts
│   │   ├── time.ts                 # Africa/Kampala helpers
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── use-cart.ts
│   │   ├── use-geolocation.ts      # foreground + IndexedDB queue + Wake Lock
│   │   ├── use-sound-alerts.ts
│   │   └── use-realtime-orders.ts  # Broadcast + polling fallback
│   ├── types/                      # database.types.ts and domain types
│   ├── actions/                    # checkout, payments, otp, auth, kitchen, rider, admin
│   └── middleware.ts               # deny-by-default route guards
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── scripts/
│   ├── seed-staff.mjs
│   └── staff.example.json
├── tests/
│   ├── e2e/
│   ├── db/
│   └── unit/
└── site/                           # static design prototype (non-production)
```

---

## 3. Conventions

### 3.1 TypeScript

- `strict: true`; no implicit `any`; no non-null assertions in new code without a comment.
- Webhook and form payloads are parsed with Zod before use.
- Database row types come from generated `database.types.ts`, not hand-written duplicates.
- Prefer discriminated unions for order type, payment method, and API results.

### 3.2 Server/client boundaries

- Default to Server Components.
- Isolate interactivity in leaf Client Components.
- A Server Component cannot use `next/dynamic` with `ssr: false`. Put the dynamic import inside a `"use client"` wrapper.
- Leaflet CSS is imported in the client map wrapper or `globals.css`.
- `src/lib/supabase/admin.ts` starts with `import "server-only"`.
- Never pass the service-role key, PIN, or raw order row to a Client Component.

### 3.3 Mutations

- All writes go through Server Actions or documented RPCs.
- Order creation is idempotent and recomputes every price server-side.
- State changes call the RPC that owns the transition; do not `UPDATE orders` directly.
- Use `useOptimistic` only for reversible UI; confirm with the server response.
- Audit every admin mutation with actor, reason, before/after.

### 3.4 Money and time

- Money is integer UGX; no floats or decimals.
- Distance is integer metres; fee uses `ceil((metres - 5000) / 1000)` when metres > 5000.
- Display may round, but calculation never uses the rounded value.
- Timestamps are UTC; business dates and display are `Africa/Kampala`.
- Use one `formatUGX` helper; no ad-hoc currency strings.

### 3.5 Realtime

- Customer: Broadcast `order:{order_token}` + poll `get_order_by_token` every 10 s while visible.
- Kitchen: Broadcast `kitchen` + poll `get_kitchen_orders` every 10 s.
- Rider pool: Broadcast `rider-pool` + poll `get_rider_pool` every 15 s.
- Assigned rider: Broadcast `rider:{rider_id}` + poll `get_rider_active_order` every 10 s.
- Never broadcast PIN, phone, exact address, or payment reference.
- Unsubscribe on unmount; reconnect with backoff.

### 3.6 Errors

Use the envelope from `API_CONTRACTS.md` §1.1. Map database/RPC errors to documented codes; never expose SQL text or stack traces. UI copy for every code lives in the portal spec.

### 3.7 Code style

- ESLint + Prettier; no unused exports.
- Named exports for components; default exports only where Next.js requires them.
- Comments explain *why*, not *what*.
- No `console.log` in production paths; use a structured logger.
- No secrets in client bundles, source maps, or logs.

### 3.8 Performance

- Storefront FCP < 1.5 s on throttled 3G.
- Initial compressed JS < 150 KB.
- Menu API p95 < 300 ms; checkout p95 < 800 ms excluding redirect.
- Dish images WebP/AVIF, ≤60 KB each, responsive sizes.
- Import icons individually.
- Charts and maps are lazy-loaded.
- Test on a 2 GB Android device, not only a desktop.

### 3.9 Git and review

- Small commits with a clear scope.
- A PR cannot merge with failing lint, typecheck, unit, DB, E2E, or a11y gates.
- Do not commit `.env.local`, `scripts/staff.local.json`, screenshots with PII, or real customer data.
- Update `docs/AUDIT_REPORT.md` and `docs/CHANGELOG.md` for behavior changes.

### 3.10 CI/CD and dependency security

- GitHub Actions runs on every pull request: `npm ci`, lint, typecheck, unit, DB/RLS, Playwright smoke, axe, and `npm audit --omit=dev --audit-level=high`.
- A pull request cannot merge with a failing required check; branch protection enforces review.
- Dependabot (or equivalent) opens weekly grouped updates for npm and GitHub Actions; security updates are triaged within two business days.
- Enable provider secret scanning and push protection; run CodeQL or Semgrep on changed code once the Phase 1 scaffold exists.
- Production deploys use the same gates plus manual approval; migrations run only after a recorded backup (`OPERATIONS_RUNBOOK.md` §3).
- `robots.txt`, `sitemap.xml`, and Restaurant/Menu structured data are Phase 10 storefront-hardening items. They are optional for launch and never block checkout.

---

## 4. Environment

Canonical template: [`../.env.example`](../.env.example). Validate with Zod in `src/lib/env.ts` at startup.

```bash
# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPPORT_WHATSAPP=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STAFF_EMAIL_DOMAIN=staff.bazaareats.com

# Flutterwave
FLW_PUBLIC_KEY=
FLW_SECRET_KEY=
FLW_WEBHOOK_HASH=
FLW_BASE_URL=https://api.flutterwave.com/v3
PAYMENTS_MODE=mock

# Africa's Talking
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
AFRICASTALKING_SENDER_ID=

# Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Maps/routing
NEXT_PUBLIC_MAPTILER_KEY=
OSRM_BASE_URL=

# Cron
CRON_SECRET=
```

Rules:

- Only `NEXT_PUBLIC_*` values may reach the browser.
- Restaurant coordinates, hours, fees, and statuses live in `app_settings`, not env.
- `PAYMENTS_MODE=mock` is allowed only outside production and must fail startup in production.
- No `ADMIN_DEFAULT_PIN`, no default staff password, no committed webhook secret.
- Rotate secrets per `OPERATIONS_RUNBOOK.md`; never log them.

---

## 5. Security Headers

Configure at Phase 1 (see `SPEC_AMENDMENTS.md` §4.2):

- HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`.
- `Permissions-Policy` with geolocation self-only.
- CSP allowing Supabase, Flutterwave checkout, MapTiler, and self; no `unsafe-eval`.
- Tighten `script-src` with nonces once the shell is stable.

---

## 6. Revision History

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.3.0 | 2026-11-10 | Added `src/lib/schemas/order.ts` and the browser-print receipt route to the manifest. |
| 1.2.0 | 2026-11-09 | Rewritten: pinned stack, no `postgres_changes`, MapTiler/OSRM production rules, complete manifest, IndexedDB telemetry queue, canonical env names, no default PIN, CI/dependency gates, storefront discovery deferral. |
| 1.1.0 | 2026-10-29 | Amendment banner. |
| 1.0.0 | 2026-10-27 | Original stack draft. |

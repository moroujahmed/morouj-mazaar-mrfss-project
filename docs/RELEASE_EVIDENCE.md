# Release Evidence — Phase 12

| Field | Value |
| :--- | :--- |
| **Date** | 2026-11-24 |
| **Branch/commit** | `main` (includes the 2026-11-24 documented-endpoint completion commit) |
| **Scope** | Phase 12 launch gates plus completion of the documented `/api/health`, `/api/cron/close-shifts`, and `/api/notifications/dispatch` handlers |

## 1. Automated quality gates

Re-verified on 2026-11-24 after the endpoint-completion work:

| Gate | Result |
| :--- | :--- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass (204/204) |
| `npm run test:tokens` | Pass |
| `npm run build` | Pass |
| `npm run test:e2e` | Pass (45/45 Chromium, 0 critical/serious axe violations) |
| `npm audit --omit=dev --audit-level=high` | Pass (0 vulnerabilities) |
| `npm run test:db` | Pass on 2026-11-23; **not re-run on 2026-11-24** (see caveat) |
| `npm run test:db:race` | Pass on 2026-11-23; **not re-run on 2026-11-24** (see caveat) |

**DB caveat:** the local PostgreSQL 18 cluster could not be restarted on 2026-11-24 because Windows returned `0xC0000142` / shared-memory error 487 and stale `postgres.exe` processes could not be terminated without a reboot. No migration or database-code changes were made after the 2026-11-23 pass, so the last verified DB result remains 2026-11-23. The production/staging Supabase drill in §7 is still required.

### 1.1 Live endpoint probes (production build, fixture/demo mode)

| Probe | Result |
| :--- | :--- |
| `GET /api/health` | `200 {"status":"ok","time":"…","version":"1.5.0"}` |
| `POST /api/cron/close-shifts` with secret | `200 {"ok":true,"closed":0}` |
| `POST /api/notifications/dispatch` with secret | `200 {"ok":true,"pending":0,"sent":0,"retried":0,"failed":0}` |
| Cron routes without the secret | `401 {"ok":false,"error":"UNAUTHORIZED"}` |
| `POST /api/cron/expire-orders` with secret | `200 {"ok":true,"expired":0}` |

These probes exercise the deployed route handlers in the local production build. Dispatch was empty because the demo outbox has no rows; the worker's send/retry/dead-letter paths are covered by unit tests.

## 2. Security scanning

| Scan | Status | Evidence / notes |
| :--- | :--- | :--- |
| `npm audit --omit=dev --audit-level=high` | Pass (local) | 0 vulnerabilities after `zod@4.6.7` and `postcss` override `8.5.33`. |
| CodeQL | Workflow added | `.github/workflows/codeql.yml` runs `github/codeql-action` for `javascript-typescript` on push/PR/schedule/manual. No local CodeQL CLI installed; first execution and SARIF review happen in GitHub Actions. |
| Semgrep | Workflow added | `.github/workflows/semgrep.yml` runs Semgrep (`auto`, OWASP Top Ten, TypeScript, React, Next.js) and uploads SARIF. No local Semgrep installed; first execution happens in GitHub Actions. |
| Secret scanning (provider/GitHub) | Workflow added + repo setting required | `.github/workflows/secret-scan.yml` runs Gitleaks on push/PR/manual. GitHub Secret Scanning / Push Protection must also be enabled in repository settings (admin action). |
| Local tracked-secret scan | Pass (best-effort) | `git grep` for common key patterns found only env var names/placeholders/test fixtures; no `.env` files tracked; `.gitignore` ignores `.env*` except `.env.example`. |

**Residual action:** Confirm GitHub Actions security workflows are green on the pushed commit and enable GitHub Secret Scanning/Push Protection in repo settings if not already enabled. Resolve any high/critical findings before launch.

## 3. Backup/restore drill (local exercise)

**Date:** 2026-11-23  
**Environment:** Local PostgreSQL 18 (`127.0.0.1:55433`, data dir `C:\Users\USER\AppData\Local\Temp\opencode\pg-ridertest`)  
**Source DB:** `mrfss_final`

Procedure executed:

1. Started local Postgres cluster (stale postmaster.pid removed; `pg_ctl start`).
2. `pg_dump -Fc -f mrfss_restore_drill.dump mrfss_final`
3. `createdb mrfss_restore_drill`
4. `pg_restore --no-owner --no-privileges -d mrfss_restore_drill mrfss_restore_drill.dump`
5. Smoke verification on restored DB:
   - `public_tables = 29`
   - `rls_enabled_tables = 29`
   - Key functions present: `create_order`, `get_admin_analytics`, `validate_table_token`
   - Extensions present: `pgcrypto`
6. Dropped `mrfss_restore_drill` and removed dump file.
7. Stopped local Postgres cluster.

**Result:** Pass. Restore completed and smoke checks succeeded.

**Production caveat:** This is a local drill proving dump/restore mechanics and schema integrity. The production Supabase backup restore drill still requires running the runbook procedure against a staging/restored Supabase project per `docs/OPERATIONS_RUNBOOK.md` §3.2.

## 4. Rollback exercise

| Rollback type | Status | Evidence / notes |
| :--- | :--- | :--- |
| App rollback (procedure) | Documented | Runbook: promote previous Vercel deployment; keep last known good commit (`03c8186` is current, `567a6c7` previous). No Vercel production deployment mutated during local exercise. |
| DB rollback (procedure) | Documented | Runbook: backward-compatible migration only; otherwise restore pre-deploy backup to new project, verify, switch traffic. No destructive down-migration. |
| Local build rollback sanity | Pass (current) | Current commit builds and passes all gates. Previous commits are retained in git history for revert/promote. A full previous-commit worktree build was not executed in this session to avoid long duplicate build time; Vercel promote-previous-deployment remains the operational rollback path. |

**Residual action:** Execute staging/Vercel rollback promotion drill and record deployment IDs before production go-live.

## 5. Go-live checklist

See `docs/GO_LIVE_CHECKLIST.md`. Technical items verifiable in-repo are checked; operational/founder/legal/provider items require founder/team completion and explicit sign-off.

## 6. Overall status

- **Code/automated gates:** complete and verified locally on 2026-11-24 (unit, token, build, E2E, audit); DB suites last verified 2026-11-23 due to the local cluster caveat above.
- **Documented endpoints:** `/api/health`, `/api/cron/close-shifts`, and `/api/notifications/dispatch` are implemented and probed on the production build.
- **Local restore drill:** exercised and verified locally on 2026-11-23.
- **Security workflow coverage:** workflows added; GitHub-hosted execution/results are pending.
- **Engineering-complete (locally verifiable scope):** verified locally on 2026-11-24. This is not production deployment or commercial go-live approval.
- **Production deployment / commercial go-live approval:** **NOT granted**. Founder explicitly did not authorize production deployment or commercial go-live.

## 7. Outstanding external release gates (required from founder/team/admin)

These remain required before any production release approval:

1. **GitHub-hosted security scan verification:** Run and confirm green results for CodeQL, Semgrep, and Gitleaks workflows on the release commit; resolve any high/critical findings.
2. **GitHub repository security settings:** Enable GitHub Secret Scanning and Push Protection in repository settings (admin action); verify provider secret-scanning coverage.
3. **Supabase production backup-restore testing:** Execute backup restore drill against staging/restored Supabase project per `docs/OPERATIONS_RUNBOOK.md` §3.2; record timestamps, restore target, and smoke-check results.
4. **Vercel staging rollback testing:** Execute rollback promotion drill on staging/Vercel (promote previous deployment, verify, restore current), record deployment IDs and outcome.
5. **Founder go-live sign-off:** Explicit founder/owner sign-off in `docs/GO_LIVE_CHECKLIST.md` after business/legal/provider/operational items are complete. This is separate from engineering acknowledgement and has not been granted.

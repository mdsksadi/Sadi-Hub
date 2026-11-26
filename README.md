# Sadi Hub

A single-owner personal hub built as a modular Next.js 16 application and deployed to Cloudflare Workers with `@opennextjs/cloudflare`. Supabase provides Postgres, Auth (email + TOTP MFA), and Storage.

## Implementation status

This repository implements **all phases (0–8) of [`docs/PLAN.md`](docs/PLAN.md)**:

- [x] Next.js 16 / React 19 / TypeScript strict / Tailwind 4 bootstrap
- [x] OpenNext Cloudflare build with dynamic rendering on free-tier bindings (no R2/D1/DO)
- [x] Supabase migrations for identity, settings, audit data, currencies/rates and all portfolio tables
- [x] Single-owner RLS, `public_profiles_v`, private/public storage buckets
- [x] `getClaims()`-based authorization, `requireOwner()`, MFA-gated admin routes
- [x] Public navigation: Home, Blog, About (portfolio hub with Experience, Education, Skills, Projects + detail, Resume), Contact
- [x] Admin dashboard, profile editing, uploads, MFA enrollment, portfolio CRUD
- [x] Blog CMS: markdown editor, categories, tags, search, draft/publish/schedule, RSS and sitemap
- [x] Finance core: accounts, categories, append-only ledger, income/expense/transfer RPCs, exchange-rate snapshots, balance and cashflow views
- [x] Lending and borrowing: contacts, loans, repayments, overpayment guards and status views
- [x] Donations: immutable records, corrections, recipient summaries and finance reports
- [x] Property records, 100% ownership trigger, valuation history, unit conversions, private document manager
- [x] Dashboard aggregates with net worth, date/country/currency filters, audit-log UI and CSV/PDF exports
- [x] Backup/restore scripts, retention workflow and scheduled publishing automation
- [x] Metadata, Open Graph, canonical URLs, structured data, sitemap, robots
- [x] Unit, component, and E2E smoke tests; CI workflow and Dependabot

Production migration and Worker deployment remain operator actions because live credentials are intentionally excluded from the repository. See [`docs/DATABASE.md`](docs/DATABASE.md) for the schema/security model, [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for release steps and [`docs/BACKUP.md`](docs/BACKUP.md) for backup/restore operations.

## Architecture

```text
src/app/(site)/*   public dynamic pages (rendered per request)
src/app/admin/*    private dynamic pages, MFA + owner checks
src/app/api/*      contact, resume and utility route handlers
src/components/    presentational, form and chart components
src/lib/auth/      verified claims and owner guards
src/lib/data/      thin Supabase query adapters
src/lib/domain/    pure money, ledger, property and reporting helpers
src/lib/security/  KV-backed rate limiting and Origin checks
src/lib/services/  contact, blog, finance, property and export orchestration
src/lib/supabase/  browser/server/proxy/storage clients
src/lib/validation/ Zod schemas and FormData helpers
src/proxy.ts       cookie refresh, security headers, no-store admin policy
```

Authorization never trusts `getSession()` on the server. `getVerifiedClaims()` uses `supabase.auth.getClaims()`, and every private Server Component and mutation calls `requireOwner()`. Database access is additionally constrained by RLS policies keyed to `auth.uid()` and `public.is_owner()`.

## Requirements

- Node.js 26 or newer (Node 22+ may work, but CI uses 26)
- npm 11+
- Docker, for local Supabase
- Cloudflare account, for Worker deployment
- Supabase CLI is used through `npx`; no global install is required

## Local setup

```bash
npm ci
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SITE_URL and the Supabase URL/publishable key in .env.local.
npm run db:start
npm run db:reset
npm run dev
```

`supabase/seed.sql` is **local only**. It creates a fixed placeholder Auth user (`owner@example.com`, password `ChangeMe-123456789`) and placeholder portfolio content so the UI can be developed without production data. Never run that seed against a hosted project.

Open <http://127.0.0.1:3000>. The seeded owner signs in at `/admin/login`. On first sign-in the app redirects to `/mfa/setup` so a TOTP factor can be enrolled before any `/admin/*` route becomes accessible; existing factors are managed at `/admin/settings`.

### Environment variables

| Variable                                                     | Required        | Purpose                                                                       |
| ------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                       | Yes             | Canonical URLs, sitemap, Open Graph                                           |
| `NEXT_PUBLIC_SUPABASE_URL`                                   | Yes             | Supabase project URL                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                       | Yes             | Browser/server publishable key                                                |
| `CONTACT_WEBHOOK_URL`                                        | No              | Receives validated contact submissions; otherwise redacted metadata is logged |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | CI/backups/cron | Never used by application runtime or client bundles                           |
| `SUPABASE_DB_URL`, `VERIFY_DB_URL`                           | Backups only    | Source and disposable verification databases for `pg_dump`/restore            |
| `AGE_RECIPIENT`, `AGE_PRIVATE_KEY_FILE`                      | Backups only    | age public recipient and private key file for encrypted backups               |
| `R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Backups only    | Private R2 destination for encrypted backups                                  |
| `SUPABASE_URL`                                               | Cron only       | GitHub secret used by the scheduled publishing workflow                       |

`NEXT_PUBLIC_*` values are inlined during `next build`. Set them in `.env.local` or in the CI build environment before `npm run build` / `npm run cf:build`; the `vars` block in `wrangler.jsonc` is not a substitute for build-time public env values.

### Common scripts

| Script                            | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| `npm run dev`                     | Next.js development server                            |
| `npm run build`                   | Production Next.js build                              |
| `npm run typecheck`               | TypeScript strict check                               |
| `npm run lint`                    | ESLint                                                |
| `npm test`                        | Vitest unit/component tests                           |
| `npm run test:e2e`                | Playwright smoke tests (starts the app automatically) |
| `npm run verify`                  | Format, lint, typecheck, tests, build                 |
| `npm run db:start` / `db:stop`    | Local Supabase stack                                  |
| `npm run db:reset`                | Reapply migrations and local seed                     |
| `npm run db:push`                 | Apply migrations to a linked hosted project           |
| `npm run db:types`                | Regenerate `types/supabase.ts` from local schema      |
| `npm run cf:build`                | Build the Cloudflare Worker bundle                    |
| `npm run cf:deploy`               | Deploy the Worker                                     |
| `npm run check:size`              | Enforce Cloudflare's 64 MiB uncompressed Worker limit |
| `npm run check:secrets`           | Scan client assets for secrets/JWTs                   |
| `npm run backup` / `backup:prune` | Encrypted nightly backup and retention pruning        |
| `npm run backup:verify`           | Restore an encrypted backup into a disposable DB      |

## Routes

Top-level navigation (in order): `/` (Home), `/blog`, `/about`, `/contact`.

About portfolio hub: `/about` sections `#experience`, `#education`, `#skills`, `#projects`, `#resume`. Standalone deep links remain at `/experience`, `/education`, `/skills`, `/projects`, `/projects/[slug]` and `/resume`; blog posts are at `/blog/[slug]`. Feeds/utilities: `rss.xml`, `sitemap.xml`, `robots.txt`.

Private/setup: `/admin/login`, `/mfa/setup`, `/admin/dashboard`, `/admin/profile`, `/admin/portfolio`, `/admin/blog`, `/admin/finance` (plus `accounts`, `categories`, `transactions`, `transfers`, `contacts`, `lending`, `borrowing`, `donations`, `reports`, `rates`), `/admin/property`, `/admin/property/[id]`, `/admin/documents`, `/admin/audit-logs`, `/admin/settings`.

Exports: `/api/exports/csv?resource=ledger` (allow-listed ledger/loan/donation/property/document views) and `/api/exports/pdf?report=monthly|yearly`. Private document downloads go through `/api/documents/[id]`, which mints a short-lived signed URL after an owner check.

Admin and setup responses are explicitly `private, no-store`, including redirects and auth-refresh responses. The proxy also checks `Origin`/`Sec-Fetch-Site` on mutations, applies security headers, and rate-limits login, MFA setup, and contact submissions using `RATE_LIMIT_KV`. Production fails closed if that binding is missing. In `next dev`, an in-memory fallback is used; it is per-isolate and not safe for multiple Workers.

## Content and files

- Profile text, avatar, and resume are edited from `/admin/profile`.
- Portfolio CRUD for projects, experience, education, skills, certifications, and social links lives at `/admin/portfolio`.
- Every portfolio table has `is_published`, `sort_order`, and (except social links) `deleted_at`. Only published, non-archived rows are publicly visible.
- Avatars and project images use the public `portfolio` bucket. Resume PDFs use the private `documents` bucket and are streamed through `/api/resume` so raw storage URLs are not rendered into public HTML.
- Markdown is sanitized with `rehype-sanitize` before rendering. Draft and future-scheduled posts are invisible publicly; due scheduled posts can be published from `/admin/blog`.
- Every cash movement is written by an atomic `SECURITY INVOKER` RPC into the append-only `financial_transactions` ledger. The owner cannot update or delete ledger, donation, or repayment rows through PostgREST.
- Accounts keep their original currency. Consolidated figures use snapshotted `exchange_rates` and are labelled as translated; EUR and BDT are never summed directly. If no rate covers a date, the mutation fails until a rate is added under `/admin/finance/rates`.
- Lending/borrowing repayments check the remaining principal with row locks plus a database trigger. Donations are immutable; corrections create separate ledger rows.
- Finance and dashboard charts are server-rendered bars rather than a client chart library, keeping the Worker bundle small.
- Properties preserve original regional area units; ownership rosters must total `100.00`, conversions are dated and sourced, and valuations are an append-only history labelled ESTIMATED.
- Private documents are uploaded to the `documents` bucket, linked to business records, and downloaded only through expiring signed URLs.
- The dashboard uses `get_dashboard_summary()` and `get_net_worth()` with snapshotted rates; EUR and BDT figures stay separate and missing rates are disclosed.
- CSV exports are owner-gated with formula-injection protection; PDF reports are generated with `pdf-lib` in a lazy route chunk.

## Testing and CI

GitHub Actions runs formatting, lint, typecheck, Vitest, a Next.js build, Playwright smoke tests, the OpenNext Worker build, Worker size/security scans, a dependency audit, a local Supabase migration/RPC smoke test, a nightly encrypted backup, and scheduled publishing.

Local Supabase and RLS integration tests require Docker. The migration smoke test in CI verifies that all tables and views (including property, documents and `net_worth_v`) exist, have RLS enabled where required, keep append-only tables free of UPDATE/DELETE grants, grant only the intended anonymous reads, keep private identity fields out of `public_profiles_v`, seed the donation categories, create exactly one owner, and enforce the ownership-share trigger. It also rolls back test transactions covering property creation, valuation history and rejected over-allocation. Playwright checks the privacy and cache headers of every private area, including the new property, document, audit and export routes.

## Known deviations from the original plan

- The plan calls for an Edge-runtime `proxy.ts`. Next.js 16 runs `proxy.ts` on the Node.js runtime by default; OpenNext Edge runtime support is still experimental, so this app intentionally omits a runtime export and pins the adapter version.
- The plan's 3 MiB compressed Worker gate is obsolete: Cloudflare removed compressed caps on 2026-09-04 and now enforces 64 MiB uncompressed on all plans. `check:size` uses the current limit.
- First-time TOTP enrollment happens at `/mfa/setup`, outside `/admin`, so a new owner cannot be locked out by the MFA guard.
- The resume is streamed through `/api/resume` using a narrowly scoped storage read policy and an RPC for the object path. The service-role key is never used at runtime.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is used instead of the older anon-key name, as specified in the plan.
- The public profile view exposes only presentation fields. Internal profile fields remain private.
- Ownership totals are enforced by a deferred constraint trigger checked at transaction commit; this allows the full owner roster to be replaced atomically through `add_property_owner()`.
- Contact submissions are forwarded to an optional webhook; without one, only redacted delivery metadata is logged, because the Phase 2 contact design never persisted public submissions.
- The plan suggests Recharts. Charts are server-rendered bars to avoid client bundle weight; scheduled posts are now published by a GitHub cron calling a service-role-only RPC, with manual publishing still available at `/admin/blog`.
- Financial RPCs are `SECURITY INVOKER` as the plan requires; therefore insert privileges on append-only tables are granted to `authenticated` for the RPC call, while UPDATE/DELETE remain ungranted and triggers/views enforce the business invariants.
- Backups and the scheduled publisher use `service_role` from GitHub Secrets only. It is never used by the Worker runtime or any client bundle, and the cron RPC re-checks the service-role JWT claim.

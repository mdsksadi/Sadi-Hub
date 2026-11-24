# Database and security model (Phases 1–6)

This document describes the Supabase schema implemented by the migrations in `supabase/migrations/`. The model covers identity, settings, audit scaffolding, currencies/rates, public portfolio/blog content, and the private finance, lending, borrowing and donations modules. Property, documents and final backups remain later phases.

## Files

| File                                                | Purpose                                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261124000001_foundation.sql` | Profiles, settings, audit logs, currencies, exchange rates, owner helpers, RLS, storage buckets/policies                                  |
| `supabase/migrations/20261124000002_portfolio.sql`  | Portfolio tables, indexes, RLS policies, updated-at triggers                                                                              |
| `supabase/migrations/20261124000003_blog.sql`       | Blog taxonomies, posts, tags, scheduled publishing RPC, RLS                                                                               |
| `supabase/migrations/20261125000001_finance.sql`    | Accounts, finance categories, append-only ledger, transfers, rate/reporting helpers, balance/cashflow views, income/expense/transfer RPCs |
| `supabase/migrations/20261125000002_lending.sql`    | Contacts, loans given/taken, repayments, overpayment trigger, status/contact views, lending RPCs                                          |
| `supabase/migrations/20261125000003_donations.sql`  | Donation categories, immutable donations, corrections, recipient summary view, donation RPCs                                              |
| `supabase/seed.sql`                                 | **Local only** placeholder owner, content, accounts, contacts and inverse seed rate                                                       |
| `supabase/config.toml`                              | Local CLI settings: signups disabled, 12-character passwords, TOTP enabled                                                                |
| `d1/migrations/0001_revalidations.sql`              | Cloudflare D1 tag cache used by OpenNext                                                                                                  |
| `types/supabase.ts`                                 | Hand-maintained Phase 1–6 types; CI applies migrations and smoke-checks the schema and grants                                             |

## Identity and public content

- Exactly one active `profiles` row has `role = 'owner'`. Identity/status fields are protected by a trigger; public fields are read through `public_profiles_v`.
- `user_settings.reporting_currency` drives translated financial reports. `audit_logs` is append-only and populated by `audit_mutation()` triggers and explicit business events.
- `currencies` is seeded with EUR and BDT. `exchange_rates` rows are immutable once recorded and are looked up by `effective_date`, including an inverse fallback, so historical translations cannot drift.
- Portfolio tables and `posts` expose only published/non-archived rows to anonymous readers; blog posts also require `published_at <= now()`.
- `public.get_resume_path()` is a narrowly scoped `SECURITY DEFINER` RPC used by `/api/resume`; the matching `storage.objects` policy allows that exact object and nothing else in the private bucket.

## Financial core

`financial_transactions` is an append-only, typed cash ledger. Every business module writes its ledger rows inside the same RPC transaction as the business row, so a loan or donation can never exist without its cash movement and cash can never move twice. The owner has SELECT/INSERT through RPCs but no UPDATE or DELETE grant.

| Table                    | Purpose                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `accounts`               | Named account with original currency, opening balance and country                                                      |
| `finance_categories`     | Income/expense categories, optionally nested                                                                           |
| `financial_transactions` | Append-only ledger with direction, amount, currency, business date, reporting snapshot and optional business reference |
| `account_transfers`      | Source/destination legs, rate, fee and the three ledger row ids                                                        |

Finance categories are seeded for every owner by an AFTER INSERT profile trigger and a backfill for profiles created before the migration.

Two `SECURITY INVOKER` helpers are shared by later modules:

- `resolve_reporting_rate(from, to, date)` returns 1 for same-currency rows, otherwise the newest snapshot at or before the business date, otherwise the inverse of an existing snapshot. It raises when no snapshot exists; the UI directs the owner to `/admin/finance/rates`.
- `record_ledger_movement(...)` derives the account currency and reporting currency, snapshots the rate and amount into the ledger row, and returns the ledger id.

Views are created with `security_invoker = true`, so RLS on the underlying tables still applies:

- `account_balances_v` = opening balance plus the sum of `direction * amount`.
- `monthly_cashflow_v` classifies rows by ledger direction: `income` and donation refunds are income; `expense`, `donation` and donation adjustments are expense. Transfers and loan principal movements are cash-only and neutral.

## Lending and borrowing

`contacts` is shared by loans and donations. Loans given are receivables; loans taken are payables. Both have a principal row and immutable repayment rows. `record_ledger_movement()` creates `loan_disbursed`, `loan_repayment_received`, `borrowing_received` and `borrowing_repayment_paid` rows.

`loans_given_status_v` and `loans_taken_status_v` derive `total_repaid`, `outstanding` and a status of Cancelled / Fully Repaid / Partially Repaid / Overdue / Pending (or Active for borrowing). `contact_lending_summary_v` aggregates per contact and currency, including an `overdue_amount` for past-due outstanding principal.

Two protections prevent overpayment: RPCs lock the account and loan rows with `SELECT ... FOR UPDATE`, and a `BEFORE INSERT OR UPDATE` trigger on both repayment tables sums non-cancelled repayments and rejects any amount that would exceed the principal. Repayment currency must match the loan currency; mixed currencies are never summed.

## Donations

`donation_categories` is seeded per owner by an AFTER INSERT profile trigger and a backfill, with these slugs: charity, mosque, orphanage, education, medical_support, family_assistance, disaster_relief, religious, community, other.

`donations` is immutable: no UPDATE/DELETE grant, no policy allowing writes, and a BEFORE UPDATE OR DELETE trigger that raises. All writes go through `create_donation()`, which inserts the snapshot recipient details and a `donation` ledger row. `correct_donation()` never changes the original row; a reversal adds a positive `reversal` ledger row and an adjustment adds a negative `correction` expense row. Reversals are capped at the original gift plus adjustments minus earlier reversals, so recipient totals cannot go negative.

`contact_donation_summary_v` groups by recipient and currency/country, so EUR and BDT totals remain separate.

## Owner checks and RPC rules

`public.is_owner()` is `SECURITY DEFINER` with a pinned `search_path`, granted only to `authenticated`, and checks that the JWT subject matches an active owner profile. `public.require_owner()` is `SECURITY INVOKER` and raises SQLSTATE `42501` for non-owners; every financial/business RPC calls it first.

Application code performs a second check: `src/lib/auth/claims.ts` verifies JWTs with `getClaims()` and `src/lib/auth/owner.ts` calls `requireOwner()` before rendering or mutating private data. `getSession()` is never used as an authorization decision.

Every financial RPC is `SECURITY INVOKER`, so RLS applies. It locks affected rows, checks balance/remaining principal, inserts the business row, ledger row(s) and audit entries atomically, then returns the created id. Audit triggers use the existing `audit_mutation()` helper.

## RLS matrix

| Object                         | `anon`                                | `authenticated` non-owner             | Active owner                                          |
| ------------------------------ | ------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `public_profiles_v`            | SELECT active owner row               | SELECT                                | SELECT                                                |
| `profiles`, `user_settings`    | none                                  | none                                  | ALL for own row                                       |
| `audit_logs`                   | none                                  | none                                  | SELECT only                                           |
| `currencies`, `exchange_rates` | currencies SELECT                     | currencies/rates SELECT               | rates SELECT/INSERT; currencies ALL with owner checks |
| Portfolio/blog tables          | SELECT published, non-archived rows   | same                                  | ALL for own rows                                      |
| Finance tables and views       | none                                  | none                                  | SELECT; RPC-driven writes only on append-only tables  |
| Contacts, loans, donations     | none                                  | none                                  | owner-scoped CRUD/RPC as described above              |
| Public `portfolio` bucket      | SELECT                                | SELECT                                | ALL for own folder                                    |
| Private `documents` bucket     | none, except the exact current resume | none, except the exact current resume | ALL for own folder                                    |

Private object paths are `<owner_id>/<uuid>-<filename>`; owner storage policies check `(storage.foldername(name))[1] = auth.uid()::text` and `public.is_owner()`. Public tables and views have explicit `GRANT SELECT` for `anon` so reads still work when default table exposure is disabled.

## Provisioning a hosted owner

Never run `supabase/seed.sql` against production. After applying migrations, create the single Auth user in the Supabase dashboard (or with the Admin API), then link its Auth ID to a profile as described in `docs/DEPLOYMENT.md`. The donation-category trigger seeds categories when the profile is inserted; a backfill in the migration covers profiles created before it.

Restrict the profile INSERT to the intended account and verify the single-owner index before proceeding. Then sign in at `/admin/login`. A brand-new owner is redirected to `/mfa/setup` to enroll the first TOTP factor; afterwards `/mfa/setup`, all other `/admin` routes, and all private mutations require an `aal2` claim.

## Local development

```bash
npm run db:start
npm run db:reset    # migrations + local seed
npm run db:types    # optional: refresh types after schema changes
```

The local seed uses the fixed owner UUID `00000000-0000-4000-8000-000000000001`, password `ChangeMe-123456789`, placeholder content, two accounts, two contacts and a BDT→EUR snapshot rate. It exists only to make local UI work possible.

## Migration rules

- Schema changes belong in a new timestamped migration; never edit an applied migration in a shared environment.
- Every table holding private data needs `owner_id`, an index, RLS enabled, and owner-scoped policies.
- Public reads must go through explicit policies or a narrow view; never grant blanket SELECT on tables containing private columns.
- Financial tables are append-only and mutated only through `SECURITY INVOKER` RPCs. UPDATE/DELETE are never granted to `authenticated`.
- `service_role` is reserved for CI migrations and encrypted backups. It is never used by the Worker runtime or client bundle.

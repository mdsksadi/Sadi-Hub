# Database and security model (Phases 1–2)

This document describes the Supabase schema introduced by the two migrations in `supabase/migrations/`. The schema is intentionally limited to identity, settings, audit scaffolding, currencies/rates, and public portfolio content.

## Files

| File                                                | Purpose                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261124000001_foundation.sql` | Profiles, settings, audit logs, currencies, exchange rates, owner helpers, RLS, storage buckets/policies |
| `supabase/migrations/20261124000002_portfolio.sql`  | Six portfolio tables, indexes, RLS policies, updated-at triggers                                         |
| `supabase/seed.sql`                                 | **Local only** placeholder owner and content                                                             |
| `supabase/config.toml`                              | Local CLI settings: signups disabled, 12-character passwords, TOTP enabled                               |
| `d1/migrations/0001_revalidations.sql`              | Cloudflare D1 tag cache used by OpenNext                                                                 |
| `types/supabase.ts`                                 | Hand-maintained Phase 1–2 types; regenerate in CI after local migrations                                 |

## Tables

### Foundation

- `profiles`: one row per Auth user, with a unique partial index allowing exactly one `role = 'owner'`. Public fields are read through `public_profiles_v`; `email` and `resume_path` are not part of the public view. A trigger prevents the owner from changing identity/status fields and locking itself out.
- `user_settings`: reporting currency, theme, locale, date format, MFA-enforced flag.
- `audit_logs`: append-only. A trigger writes before/after JSON; clients have SELECT only.
- `currencies`: active ISO codes, currently seeded with EUR and BDT.
- `exchange_rates`: snapshotted rates with a unique `(from, to, effective_date)` key. Rates are insert-only once recorded so historical translations stay stable. Later financial modules must use these instead of summing different currencies.

`public.get_resume_path()` is a narrowly scoped `SECURITY DEFINER` RPC that returns only the active owner's current resume object path. `/api/resume` uses it, and the `storage.objects` read policy requires an exact match; no other private-bucket object is anonymously readable.

### Portfolio

| Table                | Public fields                                              | Notes                                                |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| `portfolio_projects` | title, slug, descriptions, tech stack, links, image, dates | Unique slug per owner; `is_featured`                 |
| `experiences`        | company, position, dates, responsibilities, technologies   | `is_current`                                         |
| `education`          | institution, degree, field, dates, description             |                                                      |
| `skills`             | name, category, proficiency, icon                          | Proficiency checked 1–5                              |
| `certifications`     | name, issuer, dates, credential URL                        | `document_id` is nullable and gets its FK in Phase 7 |
| `social_links`       | platform, URL                                              | Unique platform per owner                            |

All portfolio tables have `owner_id`, `is_published`, and `sort_order`. All except `social_links` also have `deleted_at` for archiving.

## Owner checks

`public.is_owner()` is `SECURITY DEFINER` with a pinned `search_path`, granted only to `authenticated`, and checks that the JWT subject matches an active owner profile. `public.require_owner()` is `SECURITY INVOKER` and raises SQLSTATE `42501` for non-owners; later financial RPCs will call it inside a single transaction.

Application code performs a second check: `src/lib/auth/claims.ts` verifies JWTs with `getClaims()` and `src/lib/auth/owner.ts` calls `requireOwner()` before rendering or mutating private data. `getSession()` is never used as an authorization decision.

## RLS matrix

| Object                             | `anon`                                | `authenticated` non-owner             | Active owner                                          |
| ---------------------------------- | ------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `public_profiles_v`                | SELECT active owner row               | SELECT                                | SELECT                                                |
| `profiles`, `user_settings`        | none                                  | none                                  | ALL for own row                                       |
| `audit_logs`                       | none                                  | none                                  | SELECT only                                           |
| `currencies`, `exchange_rates`     | currencies SELECT                     | currencies/rates SELECT               | rates SELECT/INSERT; currencies ALL with owner checks |
| Portfolio tables                   | SELECT published, non-archived rows   | same                                  | ALL for own rows                                      |
| Public `portfolio` bucket objects  | SELECT                                | SELECT                                | ALL for own folder                                    |
| Private `documents` bucket objects | none, except the exact current resume | none, except the exact current resume | ALL for own folder                                    |

Private object paths are `<owner_id>/<uuid>-<filename>`; owner storage policies check `(storage.foldername(name))[1] = auth.uid()::text` and `public.is_owner()`. The single public exception requires `name = public.get_resume_path()`. Public tables and views have explicit `GRANT SELECT` for `anon` so reads still work when default table exposure is disabled.

## Provisioning a hosted owner

Never run `supabase/seed.sql` against production. After applying migrations, create the single Auth user in the Supabase dashboard (or with the Admin API), then link its Auth ID to a profile:

```sql
insert into public.profiles (id, email, display_name, role, status, timezone)
select id, email, 'Sadi', 'owner', 'active', 'UTC'
from auth.users
where email = 'you@example.com';

insert into public.user_settings (user_id, reporting_currency)
select id, 'EUR'
from public.profiles
where email = 'you@example.com';
```

Restrict the INSERT to the intended account (`where email = ...`) and verify the single-owner index before proceeding. Then sign in at `/admin/login`. A brand-new owner is redirected to `/mfa/setup` to enroll the first TOTP factor; afterwards `/mfa/setup`, all other `/admin` routes, and all private mutations require an `aal2` claim. Existing factors can be managed from `/admin/settings`.

## Local development

```bash
npm run db:start
npm run db:reset    # migrations + local seed
npm run db:types    # optional: refresh types after schema changes
```

The local seed uses the fixed owner UUID `00000000-0000-4000-8000-000000000001`, password `ChangeMe-123456789`, and placeholder content. It exists only to make local UI work possible.

## Migration rules

- Schema changes belong in a new timestamped migration; never edit an applied migration in a shared environment.
- Every table holding private data needs `owner_id`, an index, RLS enabled, and owner-scoped policies.
- Public reads must go through explicit policies or a narrow view; never grant blanket SELECT on tables containing private columns.
- Financial tables in later phases will be append-only and mutated only through `SECURITY INVOKER` RPCs.
- `service_role` is reserved for CI migrations and encrypted backups. It is never used by the Worker runtime or client bundle.

# Deployment guide

This guide covers the complete Phase 0–8 stack: Next.js 16 on Cloudflare Workers via `@opennextjs/cloudflare`, Supabase Auth/Postgres/Storage, the R2 + Durable Object + D1 ISR cache, CSV/PDF exports, backups and scheduled publishing.

## 1. Supabase project

1. Create a new Supabase project.
2. In **Authentication → Providers**, keep email enabled.
3. In **Authentication → Settings**:
   - Disable public signups.
   - Set minimum password length to 12 and require mixed case plus digits.
   - Set the site URL and redirect URLs to the deployed origin.
   - Enable TOTP MFA.
4. Apply migrations:

   ```bash
   npx supabase link --project-ref <project-ref>
   npm run db:push
   ```

   Alternatively paste each migration into the SQL editor in filename order: foundation, portfolio, blog, finance, lending, donations, property/documents, then reporting. Do **not** run `supabase/seed.sql` in production.

5. Create the single owner Auth user and profile as shown in [`docs/DATABASE.md`](DATABASE.md#provisioning-a-hosted-owner). Donation categories are seeded by the profile trigger. Before recording a transaction in a currency other than the reporting currency, add an `exchange_rates` snapshot from `/admin/finance/rates` (or SQL) covering its business date; mutations fail closed rather than summing mixed currencies.
6. Sign in at `/admin/login`; the first sign-in redirects to `/mfa/setup` to enroll a TOTP factor. Afterwards the proxy denies all `/admin/*` routes and `/mfa/setup` itself until the `aal2` claim is present. Existing factors are managed under `/admin/settings`.
7. Add properties and their owners from `/admin/property`; the ownership roster must total exactly `100.00`. Store property deeds, khatian, maps and other PDFs under `/admin/documents`; every object is private and downloaded through a short-lived signed URL from `/api/documents/[id]`. Add dated `unit_conversions` only when an actual source factor is known; the original area unit is always preserved.
8. For automatic scheduled publishing, set the GitHub repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and ensure the cron workflow has permission to run. The service-role key stays in GitHub Secrets and is never present in the Worker or a `NEXT_PUBLIC_*` value. Manual publishing from `/admin/blog` remains available without this job.

The migration creates the `portfolio` (public) and `documents` (private) buckets. Upload limits are 5 MiB for images and 20 MiB for documents; the app additionally caps avatar uploads at 5 MiB and resumes at 10 MiB.

## 2. Cloudflare resources

Set your account in Wrangler, then create the resources referenced by `wrangler.jsonc`:

```bash
npx wrangler login

npx wrangler r2 bucket create sadi-hub-opennext-cache
npx wrangler kv namespace create RATE_LIMIT_KV
npx wrangler d1 create sadi-hub-tag-cache
```

Copy the returned KV namespace ID and D1 database ID into `wrangler.jsonc`, replacing:

- `REPLACE_WITH_KV_NAMESPACE_ID`
- `REPLACE_WITH_D1_DATABASE_ID`

Apply the D1 tag-cache migration:

```bash
npx wrangler d1 migrations apply sadi-hub-tag-cache --remote
```

`d1/migrations` is configured as the migrations directory for the `NEXT_TAG_CACHE_D1` binding. The Durable Object class `DOQueueHandler` is registered by the `migrations` block in `wrangler.jsonc` and is created on first deploy.

Update `vars` in `wrangler.jsonc` to the real site URL and Supabase URL/publishable key. Also set them in the build environment, because `NEXT_PUBLIC_*` values are inlined into client bundles at build time.

Optional server-only configuration:

```bash
npx wrangler secret put CONTACT_WEBHOOK_URL
```

Never add `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or Cloudflare API tokens to the Worker, `wrangler.jsonc`, or a `NEXT_PUBLIC_*` variable.

## 3. Build and deploy

Use Node.js 26:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run cf:build
npm run check:size
npm run check:secrets
npm run cf:deploy
```

`check:size` runs `wrangler deploy --dry-run` and enforces Cloudflare's current 64 MiB **uncompressed** Worker limit (the old 3/10 MiB compressed caps were removed on 2026-09-04). Gzip size is reported for information only. If the limit is exceeded, move large assets or generated data out of the Worker bundle.

`RATE_LIMIT_KV` is required in production: login, MFA setup, and contact rate limiting fail closed when the binding is unavailable. The in-memory fallback is only for `next dev`.

For a preview deployment, change the `name` and `workers.dev` route in `wrangler.jsonc` (or pass `--env`) before building/deploying. Point the preview Supabase Auth site URL at the preview origin.

## 4. Caching behavior

- Public pages use `export const revalidate = 300`; the sitemap uses one hour.
- `/projects/[slug]` is generated on demand and revalidated with the same policy.
- Admin pages and API routes are dynamic; `/admin/*` (including all `/admin/finance/*` screens), `/mfa/setup`, `/api/contact`, auth redirects, and refreshed sessions include `private, no-store, max-age=0`.
- The ISR cache uses R2 for incremental cache data, the Durable Object queue for revalidation, and D1 for tag invalidation.
- Server Actions call `revalidatePath()` for affected public routes after profile or portfolio edits.

If you prefer not to create R2/D1/DO resources, remove the overrides from `open-next.config.ts` and the corresponding bindings from `wrangler.jsonc`; public routes then need explicit dynamic rendering instead of ISR.

## 5. Post-deploy checklist

- [ ] `/`, `/about`, `/experience`, `/education`, `/skills`, `/projects`, `/resume`, `/contact` return 200.
- [ ] `sitemap.xml` and `robots.txt` use the production origin.
- [ ] A draft portfolio row is not visible publicly; publishing it appears within the revalidation window.
- [ ] `/admin/dashboard` redirects unauthenticated visitors to `/admin/login`.
- [ ] A new owner is redirected from `/admin/login` to `/mfa/setup` and cannot reach `/admin/*` before verification.
- [ ] Password sign-in without a verified TOTP factor cannot access `/admin/*`.
- [ ] `/api/resume` returns the PDF bytes with `application/pdf`, and no storage URL or private object path appears in page HTML.
- [ ] Contact form rejects invalid input and respects rate limits; server logs contain no sender PII when no webhook is configured.
- [ ] `/admin/finance`, `accounts`, `transactions`, `transfers`, `contacts`, `lending`, `borrowing`, `donations`, `reports`, `rates`, `/admin/property`, `/admin/documents` and `/admin/audit-logs` redirect unauthenticated visitors and return `Cache-Control: private, no-store`.
- [ ] An income, an expense and a transfer produce the expected account balances; loan repayments cannot exceed principal; donations are immutable and corrections add separate ledger rows.
- [ ] A missing exchange-rate snapshot fails the mutation with a clear message; after adding a rate the translated amount appears with its original currency and rate.
- [ ] A property with owners totalling `100.00` is created; a roster totalling `99.99` is rejected; a valuation appears in history and updates the ESTIMATED current value.
- [ ] A private document uploads, is listed only for the owner, downloads through an expiring signed URL, and cannot be fetched directly by an anonymous user.
- [ ] `/admin/dashboard` shows date/country/currency filters, per-currency values, translated net worth with disclosed rates, and missing-rate warnings where applicable.
- [ ] `/api/exports/csv?resource=ledger` and `/api/exports/pdf?report=monthly` require the owner, return `private, no-store`, and never include storage paths or secrets.
- [ ] Admin, setup, contact, finance, property, documents, audit, export and auth-redirect responses include `Cache-Control: private, no-store`.
- [ ] `npm run check:size` and `npm run check:secrets` pass in CI.

## 6. Operational notes

- Supabase free projects pause after inactivity. Use a keep-alive job or upgrade if the site must always be warm.
- Rotate Supabase and Cloudflare credentials from their providers; never commit replacement values.
- The current application does not use a custom domain by default; Cloudflare assigns a `workers.dev` URL.
- Nightly encrypted backups, retention, restore verification and key rotation are documented in [`docs/BACKUP.md`](BACKUP.md). The nightly workflow needs `SUPABASE_DB_URL`, `AGE_RECIPIENT`, `R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets; restore verification additionally needs `AGE_PRIVATE_KEY_FILE` and a disposable `VERIFY_DB_URL`.
- Scheduled posts are published every 15 minutes by the `publish.yml` workflow only after the Phase 8 migration adds the service-role-only RPC. If the secrets are absent, publishing remains manual from `/admin/blog`.

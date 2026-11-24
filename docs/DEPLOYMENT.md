# Deployment guide

This guide covers the Phase 0–2 stack: Next.js 16 on Cloudflare Workers via `@opennextjs/cloudflare`, Supabase Auth/Postgres/Storage, and the R2 + Durable Object + D1 ISR cache.

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

   Alternatively paste each migration into the SQL editor in filename order. Do **not** run `supabase/seed.sql` in production.

5. Create the single owner Auth user and profile as shown in [`docs/DATABASE.md`](DATABASE.md#provisioning-a-hosted-owner).
6. Sign in at `/admin/login`; the first sign-in redirects to `/mfa/setup` to enroll a TOTP factor. Afterwards the proxy denies all `/admin/*` routes and `/mfa/setup` itself until the `aal2` claim is present. Existing factors are managed under `/admin/settings`.

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
- Admin pages and API routes are dynamic; `/admin/*`, `/mfa/setup`, `/api/contact`, auth redirects, and refreshed sessions include `private, no-store, max-age=0`.
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
- [ ] Admin, setup, contact, and auth-redirect responses include `Cache-Control: private, no-store`.
- [ ] `npm run check:size` and `npm run check:secrets` pass in CI.

## 6. Operational notes

- Supabase free projects pause after inactivity. Use a keep-alive job or upgrade if the site must always be warm.
- Rotate Supabase and Cloudflare credentials from their providers; never commit replacement values.
- The current application does not use a custom domain by default; Cloudflare assigns a `workers.dev` URL.
- Backup/restore tooling and the remaining business modules are part of later plan phases and are not included in this deployment.

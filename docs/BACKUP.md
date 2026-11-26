# Backup and recovery guide

This guide covers the Phase 8 backup tooling for the same stack described in [`docs/DEPLOYMENT.md`](DEPLOYMENT.md): Next.js 16 on Cloudflare Workers, Supabase Postgres/Auth/Storage, and a private Cloudflare R2 bucket. Nightly backups are logical `pg_dump` custom-format dumps, encrypted with [age](https://age-encryption.org/) before they leave the CI runner. The age recipient key may be public; the private key never enters the repository or the Worker.

## 1. Prerequisites

- Node.js 22+ (CI uses 26) and npm.
- PostgreSQL client tools on the machine or runner: `pg_dump`, `pg_restore`, `psql`.
- The `age` CLI (`sudo apt-get install -y age` on Ubuntu).
- An age keypair. Store the public recipient in a repository secret (`AGE_RECIPIENT`); keep the private key only in the owner's password manager or secure offline storage. Backups cannot be recovered without it.
- A **private** R2 bucket with versioning enabled. Never make it public and never put a bucket URL in a `NEXT_PUBLIC_*` variable.
- A Cloudflare API token scoped to the account with **Account → R2:Edit** (object read/write/delete/list). The token is a repository secret only.
- Docker and the local Supabase stack (`npm run db:start`) for restore verification.
- For verification, a disposable database on a **different host/port** from production. The scripts refuse to restore when `VERIFY_DB_URL` and `SUPABASE_DB_URL` point at the same server.

## 2. Environment variables

Store all values in GitHub repository secrets or in the owner's local shell. Do not commit them, add them to `wrangler.jsonc`, or set them as Worker secrets.

| Variable                | Required for           | Purpose                                                                 |
| ----------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `SUPABASE_DB_URL`       | backup, verify         | Production connection string. `DATABASE_URL` is accepted as a fallback. |
| `AGE_RECIPIENT`         | backup                 | age public key (`age1...`) used as the encryption recipient.            |
| `R2_BUCKET`             | all scripts            | Name of the private backup bucket.                                      |
| `CLOUDFLARE_ACCOUNT_ID` | all scripts            | Cloudflare account that owns the bucket.                                |
| `CLOUDFLARE_API_TOKEN`  | all scripts            | Token with R2 object read/write/delete permissions.                     |
| `AGE_PRIVATE_KEY_FILE`  | verify, manual restore | Path to a `chmod 600` file containing the age private key.              |
| `VERIFY_DB_URL`         | verify                 | Connection string for the disposable verification database.             |

The scripts pass database credentials to libpq through `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` rather than command-line arguments, and redact known secret values from any error output. They never echo connection strings or tokens.

## 3. Creating a backup

The scheduled workflow runs at 03:17 UTC and on `workflow_dispatch`:

```bash
npm run backup           # daily/<YYYY-MM-DD>.dump.age
npm run backup -- --monthly  # monthly/<YYYY-MM>.dump.age
```

Each run:

1. Creates a temporary directory under `/tmp/opencode` (or the OS temp dir).
2. Runs `pg_dump --format=custom --no-owner --no-privileges` against the whole database, including Auth/Storage schemas.
3. Encrypts with `age -r "$AGE_RECIPIENT"`.
4. Uploads to `<bucket>/daily/<YYYY-MM-DD>.dump.age` (or `monthly/<YYYY-MM>.dump.age`) via Wrangler with `--remote`.
5. Removes all temporary files in a `finally` block.

Only non-sensitive progress lines are printed; a missing variable fails with exit code 1 before anything runs. A successful job does **not** mean the dump is restorable — see verification below.

## 4. Retention

Two retention classes are kept: **30 daily** keys and **12 monthly** keys. Older keys are deleted by:

```bash
npm run backup:prune               # delete expired keys
npm run backup:prune -- --dry-run  # list what would be deleted
```

Pruning lists objects through the Cloudflare REST API (`accounts/:id/r2/buckets/:bucket/objects`, following every cursor) and accepts only keys shaped like `daily/YYYY-MM-DD.dump.age` or `monthly/YYYY-MM.dump.age`. This avoids relying on `wrangler r2 object list`, which is unavailable in current Wrangler releases. An unreadable, truncated or unexpected listing is a hard failure (fail closed): no key is deleted. It also refuses to act when the plan would delete every recognised key, and a failed individual delete does not stop the remaining ones. Deletes themselves still use `wrangler r2 object delete`.

## 5. Verifying a backup

The workflow verifies automatically when both `VERIFY_DB_URL` and the age private key secret are configured. Manually:

```bash
export AGE_PRIVATE_KEY_FILE="$HOME/secrets/sadi-hub.age.key"
chmod 600 "$AGE_PRIVATE_KEY_FILE"
export VERIFY_DB_URL="postgresql://postgres@localhost:54322/postgres" # local Supabase, not production

npm run backup:verify                              # latest daily key
npm run backup:verify -- --key daily/2026-11-25.dump.age
```

Verification downloads the encrypted object, decrypts it, restores it with `pg_restore --clean --if-exists --no-owner --no-privileges`, and runs small `psql` queries checking that `profiles`, `financial_transactions`, `donations`, `properties`, and `documents` exist and meet minimum row counts (`profiles` ≥ 1, the others ≥ 0). It reports the counts and exits non-zero on any mismatch. Temporary files are always removed. Never point `VERIFY_DB_URL` at the production database, even with different credentials.

## 6. Full restore

### Into local Supabase

```bash
npm run db:start
npx wrangler r2 object get "$R2_BUCKET/daily/YYYY-MM-DD.dump.age" --file "$TMPDIR/backup.dump.age" --remote
age -d -i "$AGE_PRIVATE_KEY_FILE" -o "$TMPDIR/backup.dump" "$TMPDIR/backup.dump.age"

PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
  pg_restore --clean --if-exists --no-owner --no-privileges "$TMPDIR/backup.dump"

npm run db:reset # only if you want to discard the restored data and start fresh
```

Do not run `supabase/seed.sql` after a restore; it would overwrite real owner content. Use `npx supabase stop` to discard the local environment when finished.

### Into a fresh hosted Supabase project

1. Create a new project and disable public signups, set the site URL/redirects, password policy and TOTP MFA as in [`docs/DEPLOYMENT.md`](DEPLOYMENT.md#1-supabase-project). Do **not** apply migrations from `npm run db:push` first: the dump already contains the schema.
2. Download and decrypt the chosen object as above.
3. Restore with the project's direct database connection supplied through `PG*` variables (never in argv or shell history):

   ```bash
   PGHOST=... PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=... \
     pg_restore --clean --if-exists --no-owner --no-privileges "$TMPDIR/backup.dump"
   ```

4. Verify with the same table/count queries described in §5 against the new project, then point the app's `NEXT_PUBLIC_SUPABASE_URL` and publishable key at it and redeploy the Worker. Keep the old project until the new one has been checked.

A custom-format dump taken without `--schema` includes the `auth` and `storage` schemas, so Auth users, factors and private storage objects are restored with the application data. Storage object files live in Supabase Storage, not in Postgres: mirror the private `documents` bucket separately to the same encrypted R2 location (with versioning) if you need to restore file contents, not just their metadata.

## 7. Post-restore checks

After any restore, confirm the security model before reopening access:

```sql
-- Key tables must have RLS enabled.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'financial_transactions', 'donations', 'properties', 'documents');

-- Exactly one active owner, and public signups disabled in Auth settings.
select id, email, role, status from public.profiles where role = 'owner';

-- Append-only tables must not grant UPDATE/DELETE to authenticated.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_name in ('financial_transactions', 'donations', 'loan_given_repayments', 'loan_taken_repayments')
  and privilege_type in ('UPDATE', 'DELETE');
```

The first query should report `rowsecurity = true` for every table; the second should return one `active` owner; the third should return no rows. Also check `auth.users` for the owner, confirm the private `documents` bucket and its `storage.objects` policies, sign in with MFA, and run `npm test` plus the CI migration smoke test. Only then switch production DNS/traffic.

## 8. Key rotation

1. Generate a new age keypair: `age-keygen -o new-key.txt` (store the private file with `chmod 600` outside the repository).
2. Add the new public recipient as a repository secret and set `AGE_RECIPIENT` to it; future backups use the new key.
3. Keep the old private key available until every backup you still want to restore has been re-encrypted: decrypt with the old key, encrypt with the new recipient, and upload under a new key. Do not overwrite an object you may still need for rollback.
4. Rotate `CLOUDFLARE_API_TOKEN` and the database password in their providers when they may have been exposed. Never commit replacement values or add them to `.env.example`.

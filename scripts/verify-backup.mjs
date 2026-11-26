import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Restore an encrypted backup into a disposable verification database and
 * check that the key tables exist with at least the expected row counts.
 * The production connection string is used only to prove the two targets differ.
 */

const productionUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const verifyUrl = process.env.VERIFY_DB_URL;
const missing = [
  !productionUrl && "SUPABASE_DB_URL (or DATABASE_URL)",
  !verifyUrl && "VERIFY_DB_URL",
  !process.env.AGE_PRIVATE_KEY_FILE && "AGE_PRIVATE_KEY_FILE",
  !process.env.R2_BUCKET && "R2_BUCKET",
  !process.env.CLOUDFLARE_ACCOUNT_ID && "CLOUDFLARE_ACCOUNT_ID",
  !process.env.CLOUDFLARE_API_TOKEN && "CLOUDFLARE_API_TOKEN",
].filter(Boolean);
if (missing.length > 0) {
  console.error(`Verification not started. Missing: ${missing.join(", ")}.`);
  process.exit(1);
}
if (!existsSync(process.env.AGE_PRIVATE_KEY_FILE)) {
  console.error(
    "Verification not started. AGE_PRIVATE_KEY_FILE does not point to a readable file.",
  );
  process.exit(1);
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    console.error("Verification not started. A database URL is malformed.");
    process.exit(1);
  }
}

const production = parseUrl(productionUrl);
const verify = parseUrl(verifyUrl);
const target = (url) =>
  `${url.hostname.toLowerCase()}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`;
if (target(production) === target(verify)) {
  console.error(
    "Verification not started. VERIFY_DB_URL must be a different database server from the production URL.",
  );
  process.exit(1);
}

const keyArg = process.argv.findIndex((arg) => arg === "--key");
const requestedKey = keyArg >= 0 ? process.argv[keyArg + 1] : null;
const VALID_KEY =
  /^(?:daily\/\d{4}-\d{2}-\d{2}|monthly\/\d{4}-\d{2})\.dump\.age$/;
if (keyArg >= 0 && (!requestedKey || !VALID_KEY.test(requestedKey))) {
  console.error(
    "Verification not started. --key must be a recognised backup key.",
  );
  process.exit(1);
}

const secrets = [
  productionUrl,
  verifyUrl,
  decodeURIComponent(production.password),
  decodeURIComponent(verify.password),
  process.env.CLOUDFLARE_API_TOKEN,
].filter((value) => typeof value === "string" && value.length > 3);

function safeDetail(output) {
  let text = String(output ?? "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/(postgres(?:ql)?:\/\/[^\s"']+)/gi, "[redacted-url]")
    .replace(/AGE-SECRET-KEY-[A-Z0-9]+/gi, "[redacted-key]");
  for (const value of secrets) text = text.split(value).join("[redacted]");
  return text.trim().slice(0, 400);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) {
    throw new Error(
      `${command} could not be started (${result.error.code ?? "unknown"}).`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with status ${result.status}. ${safeDetail(result.stderr || result.stdout)}`,
    );
  }
  return result.stdout ?? "";
}

function pgEnvironment(urlString) {
  const url = new URL(urlString);
  const env = { ...process.env };
  env.PGHOST = url.hostname;
  env.PGPORT = url.port || "5432";
  env.PGDATABASE = decodeURIComponent(url.pathname.slice(1)) || "postgres";
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const tempBase = existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir();
let tempDir;

try {
  tempDir = mkdtempSync(path.join(tempBase, "sadi-hub-verify-"));
  const encryptedPath = path.join(tempDir, "download.dump.age");
  const dumpPath = path.join(tempDir, "dump.custom");

  let key = requestedKey;
  if (!key) {
    // Current Wrangler versions have no `r2 object list`; use the REST API and
    // follow every cursor so "latest" is never chosen from a partial listing.
    const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/r2/buckets/${encodeURIComponent(process.env.R2_BUCKET)}/objects`;
    const daily = [];
    let cursor = null;
    let pages = 0;
    do {
      if (++pages > 1000) {
        throw new Error(
          "R2 listing exceeded the page limit; refusing to guess a backup.",
        );
      }
      const url = new URL(base);
      url.searchParams.set("maxKeys", "1000");
      if (cursor) url.searchParams.set("cursor", cursor);
      let payload;
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        payload = await response.json();
      } catch (error) {
        throw new Error(
          `Could not list R2 objects (${safeDetail(error?.message ?? error)}); refusing to guess a backup.`,
        );
      }
      if (
        payload?.success !== true ||
        !payload.result ||
        !Array.isArray(payload.result.objects)
      ) {
        throw new Error(
          "R2 listing response was malformed; refusing to guess a backup.",
        );
      }
      for (const entry of payload.result.objects) {
        if (
          typeof entry?.key === "string" &&
          VALID_KEY.test(entry.key) &&
          entry.key.startsWith("daily/")
        ) {
          daily.push(entry.key);
        }
      }
      cursor = payload.result.truncated ? payload.result.cursor : null;
      if (payload.result.truncated && !cursor) {
        throw new Error(
          "R2 listing was truncated without a cursor; refusing to guess a backup.",
        );
      }
    } while (cursor);
    daily.sort();
    key = daily.at(-1);
    if (!key) throw new Error("No daily backup was found to verify.");
  }

  console.log(`Downloading backup ${key}...`);
  run(npx, [
    "wrangler",
    "r2",
    "object",
    "get",
    `${process.env.R2_BUCKET}/${key}`,
    "--file",
    encryptedPath,
    "--remote",
  ]);

  console.log("Decrypting and restoring into the verification database...");
  run("age", [
    "-d",
    "-i",
    process.env.AGE_PRIVATE_KEY_FILE,
    "-o",
    dumpPath,
    encryptedPath,
  ]);
  run(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", dumpPath],
    { env: pgEnvironment(verifyUrl) },
  );

  console.log("Checking key tables and minimum row counts...");
  const tables = [
    ["profiles", 1],
    ["financial_transactions", 0],
    ["donations", 0],
    ["properties", 0],
    ["documents", 0],
  ];
  const values = tables.map(([name]) => `('${name}')`).join(", ");
  const existenceSql = `select table_name, to_regclass('public.' || table_name) is not null from (values ${values}) as t(table_name);`;
  const existence = run(
    "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", existenceSql],
    { env: pgEnvironment(verifyUrl) },
  );
  const present = new Map(
    existence
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, flag] = line.split("\t");
        return [name, flag === "t" || flag === "true"];
      }),
  );

  const countsSql = `select table_name, count(*)::bigint from (
    ${tables
      .map(
        ([name]) =>
          `select '${name}'::text as table_name, count(*)::bigint as row_count from public.${name}`,
      )
      .join(" union all ")}
  ) as checks;`;
  const counts = run(
    "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", countsSql],
    { env: pgEnvironment(verifyUrl) },
  );
  const actual = new Map(
    counts
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, count] = line.split("\t");
        return [name, Number(count)];
      }),
  );

  const problems = [];
  for (const [name, minimum] of tables) {
    if (!present.get(name)) {
      problems.push(`${name} is missing`);
      continue;
    }
    const count = actual.get(name);
    if (!Number.isFinite(count) || count < minimum) {
      problems.push(
        `${name} has ${count ?? "no"} rows (expected at least ${minimum})`,
      );
    } else {
      console.log(`${name}: ${count} rows`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Verification failed: ${problems.join("; ")}`);
  }
  console.log(`Verification passed for ${key}.`);
} catch (error) {
  console.error(`Verification failed. ${safeDetail(error?.message ?? error)}`);
  process.exitCode = 1;
} finally {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup failures must not hide the verification result.
    }
  }
}

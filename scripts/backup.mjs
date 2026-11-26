import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Nightly logical backup: pg_dump (custom format) -> age -> private R2.
 * Credentials are read from the environment and are never printed.
 */

const required = [
  "AGE_RECIPIENT",
  "R2_BUCKET",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
];
const missing = required.filter((name) => !process.env[name]);
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) missing.push("SUPABASE_DB_URL (or DATABASE_URL)");
if (missing.length > 0) {
  console.error(`Backup not started. Missing: ${missing.join(", ")}.`);
  process.exit(1);
}

let dbPassword = "";
try {
  dbPassword = decodeURIComponent(new URL(dbUrl).password);
} catch {
  console.error("Backup not started. The database URL is malformed.");
  process.exit(1);
}

const sensitive = [
  dbUrl,
  dbPassword,
  process.env.CLOUDFLARE_API_TOKEN,
  process.env.AGE_RECIPIENT,
].filter((value) => typeof value === "string" && value.length > 3);

function safeDetail(output) {
  let text = String(output ?? "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/(postgres(?:ql)?:\/\/[^\s"']+)/gi, "[redacted-url]")
    .replace(/AGE-SECRET-KEY-[A-Z0-9]+/gi, "[redacted-key]");
  for (const value of sensitive) text = text.split(value).join("[redacted]");
  return text.trim().slice(0, 400);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) {
    throw new Error(
      `${command} could not be started (${result.error.code ?? "unknown"}).`,
    );
  }
  if (result.status !== 0) {
    const detail = safeDetail(result.stderr || result.stdout);
    throw new Error(
      `${command} failed with status ${result.status}. ${detail}`,
    );
  }
  return result.stdout ?? "";
}

/** libpq environment avoids placing the connection string in argv. */
function pgEnvironment() {
  const url = new URL(dbUrl);
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

const tempBase = existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir();
let tempDir;

try {
  tempDir = mkdtempSync(path.join(tempBase, "sadi-hub-backup-"));
  const dumpPath = path.join(tempDir, "dump.custom");
  const encryptedPath = path.join(tempDir, "dump.age");
  const now = new Date().toISOString();
  const monthly = process.argv.includes("--monthly");
  const key = monthly
    ? `monthly/${now.slice(0, 7)}.dump.age`
    : `daily/${now.slice(0, 10)}.dump.age`;

  console.log(`Creating ${monthly ? "monthly" : "daily"} logical backup...`);
  run(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath],
    { env: pgEnvironment() },
  );

  console.log("Encrypting backup with age...");
  run("age", ["-r", process.env.AGE_RECIPIENT, "-o", encryptedPath, dumpPath]);

  console.log("Uploading encrypted backup to the private R2 bucket...");
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  run(npx, [
    "wrangler",
    "r2",
    "object",
    "put",
    `${process.env.R2_BUCKET}/${key}`,
    "--file",
    encryptedPath,
    "--remote",
  ]);

  console.log(`Backup complete: ${key}`);
} catch (error) {
  console.error(`Backup failed. ${safeDetail(error?.message ?? error)}`);
  process.exitCode = 1;
} finally {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup failures must not hide the original result.
    }
  }
}

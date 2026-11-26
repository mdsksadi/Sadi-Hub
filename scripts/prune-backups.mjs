import { spawnSync } from "node:child_process";

/**
 * Retention: keep the newest 30 daily and 12 monthly encrypted dumps.
 * Listing uses the Cloudflare REST API because current Wrangler versions no
 * longer expose `r2 object list`. Listing/parsing is fail-closed: an
 * unreadable, truncated or partial response never becomes an empty list that
 * would justify deleting everything.
 */

const missing = [
  "R2_BUCKET",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Prune not started. Missing: ${missing.join(", ")}.`);
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const bucket = process.env.R2_BUCKET;
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

function safeDetail(output) {
  const sensitive = [token, accountId, bucket].filter(Boolean);
  let text = String(output ?? "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .trim()
    .slice(0, 400);
  for (const value of sensitive) text = text.split(value).join("[redacted]");
  return text;
}

function run(args) {
  const result = spawnSync(npx, args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(
      `wrangler could not be started (${result.error.code ?? "unknown"}).`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `wrangler exited with status ${result.status}. ${safeDetail(result.stderr || result.stdout)}`,
    );
  }
  return result.stdout ?? "";
}

const DAILY_KEY = /^daily\/\d{4}-\d{2}-\d{2}\.dump\.age$/;
const MONTHLY_KEY = /^monthly\/\d{4}-\d{2}\.dump\.age$/;

/** Fetch every object key, following cursors. Throws on any bad page. */
async function listObjectKeys() {
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/objects`;
  const keys = [];
  let cursor = null;
  let pages = 0;

  do {
    if (++pages > 1000) {
      throw new Error("R2 listing exceeded the page limit; refusing to prune.");
    }
    const url = new URL(base);
    url.searchParams.set("maxKeys", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);

    let payload;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      payload = await response.json();
    } catch (error) {
      throw new Error(
        `Could not list R2 objects (${safeDetail(error?.message ?? error)}); refusing to prune.`,
      );
    }

    if (
      payload?.success !== true ||
      !payload.result ||
      !Array.isArray(payload.result.objects)
    ) {
      throw new Error("R2 listing response was malformed; refusing to prune.");
    }
    for (const entry of payload.result.objects) {
      if (entry && typeof entry.key === "string") keys.push(entry.key);
    }
    cursor = payload.result.truncated ? payload.result.cursor : null;
    if (payload.result.truncated && !cursor) {
      throw new Error(
        "R2 listing was truncated without a cursor; refusing to prune.",
      );
    }
  } while (cursor);

  return keys;
}

function expirations(keys, pattern, keep) {
  return keys
    .filter((key) => pattern.test(key))
    .sort()
    .reverse()
    .slice(keep);
}

try {
  const keys = await listObjectKeys();
  const recognized = keys.filter(
    (key) => DAILY_KEY.test(key) || MONTHLY_KEY.test(key),
  );
  const stale = [
    ...expirations(recognized, DAILY_KEY, 30),
    ...expirations(recognized, MONTHLY_KEY, 12),
  ];

  if (stale.length === 0) {
    console.log("No backups exceed the retention policy.");
    process.exit(0);
  }

  // A successful listing that asks us to remove every recognised key is a
  // strong signal that the response was truncated or misparsed.
  if (recognized.length > 0 && stale.length === recognized.length) {
    console.error(
      "Refusing to delete every listed backup; retention listing looks incomplete.",
    );
    process.exit(1);
  }

  for (const key of stale) {
    if (dryRun) {
      console.log(`Dry run: would delete ${key}`);
      continue;
    }
    try {
      run(["wrangler", "r2", "object", "delete", bucket, key, "--remote"]);
      console.log(`Deleted expired backup: ${key}`);
    } catch (error) {
      console.error(
        `Could not delete ${key}. ${safeDetail(error?.message ?? error)}`,
      );
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(`Prune stopped. ${safeDetail(error?.message ?? error)}`);
  process.exitCode = 1;
}

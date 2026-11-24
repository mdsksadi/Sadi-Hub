import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

if (!existsSync(path.join(process.cwd(), ".open-next", "worker.js"))) {
  console.error("No .open-next/worker.js found. Run `npm run cf:build` first.");
  process.exit(1);
}

const outdir = mkdtempSync(path.join(tmpdir(), "sadi-hub-worker-size-"));
const wrangler = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
const result = spawnSync(
  wrangler,
  ["deploy", "--dry-run", "--outdir", outdir],
  { encoding: "utf8" },
);

try {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.replace(
    /\x1b\[[0-9;]*m/g,
    "",
  );
  if (result.error || result.status !== 0) {
    console.error(output.trim() || result.error?.message || "wrangler failed");
    process.exit(1);
  }

  const match = output.match(
    /Total Upload:\s*([\d,.]+)\s*(B|KiB|MiB|GiB)\s*\/\s*gzip:\s*([\d,.]+)\s*(B|KiB|MiB|GiB)/,
  );
  if (!match) {
    console.error("Could not parse the Wrangler dry-run size output:");
    console.error(output.trim());
    process.exit(1);
  }

  const units = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 };
  const bytes = (value, unit) =>
    Number.parseFloat(value.replace(/,/g, "")) * units[unit];
  const upload = bytes(match[1], match[2]);
  const gzip = bytes(match[3], match[4]);
  // Cloudflare removed the compressed 3/10 MiB caps on 2026-09-04. The current
  // gate is 64 MiB uncompressed on every plan.
  const limit = 64 * 1024 * 1024;

  console.log(
    `Worker upload (uncompressed): ${(upload / 1024).toFixed(1)} KiB / 65536.0 KiB limit`,
  );
  console.log(
    `Worker upload (gzip, informational): ${(gzip / 1024).toFixed(1)} KiB`,
  );

  if (upload > limit) {
    console.error(
      "Worker exceeds Cloudflare's 64 MiB uncompressed bundle limit. Move large assets/data out of the Worker bundle.",
    );
    process.exit(1);
  }
} finally {
  rmSync(outdir, { recursive: true, force: true });
}

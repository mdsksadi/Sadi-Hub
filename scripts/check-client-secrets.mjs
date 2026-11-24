import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const roots = [".next/static", ".open-next/assets"].map((p) =>
  path.join(process.cwd(), p),
);
const secretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "CLOUDFLARE_API_TOKEN",
  "BACKUP_ENCRYPTION_KEY",
];
const secrets = secretNames
  .map((name) => ({ name, value: process.env[name] }))
  .filter(({ value }) => value && value.length > 8);

// Legacy Supabase anon/publishable keys are intentionally public and may be
// JWT-shaped. Allowlist the configured value so CI does not flag itself.
const publicKeyNames = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const publicKeys = publicKeyNames
  .map((name) => process.env[name])
  .filter((value) => value && value.length > 8);

const jwt = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(js|mjs|css|html|json)$/.test(full)) files.push(full);
  }
  return files;
}

const files = roots.flatMap((root) => walk(root));
let failures = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const { name, value } of secrets) {
    if (source.includes(value)) {
      console.error(`Leaked ${name} in ${path.relative(process.cwd(), file)}`);
      failures += 1;
    }
  }
  let clientSource = source;
  for (const key of publicKeys) clientSource = clientSource.split(key).join("");

  if (jwt.test(clientSource)) {
    console.error(
      `Possible hardcoded JWT in ${path.relative(process.cwd(), file)}`,
    );
    failures += 1;
  }
}

if (failures > 0) process.exit(1);
console.log(`Scanned ${files.length} client assets: no secrets found.`);

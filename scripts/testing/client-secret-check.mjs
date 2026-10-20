import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
const root = path.resolve(process.argv[2] || ".next-review/static");
const sensitive = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SESSION_HASH_PEPPER", "TEST_TOOLS_GATE_SECRET", "TEST_ACCOUNT_PASSWORD", "STAGING_ACCESS_PASSWORD", "WEBHOOK_SIGNING_SECRET", "API_KEY_PEPPER", "INTEGRATION_ENCRYPTION_KEY", "INTEGRATION_WORKER_SECRET", "OPERATIONS_CRON_SECRET", "CRON_SECRET"];
const values = [];
for (const source of [".env.local", ".env.e2e.local"]) {
  let env; try { env = parseEnv(await readFile(source, "utf8")); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  for (const key of sensitive) if (env[key]?.length >= 12) values.push({ key, value: env[key] });
}
for (const key of sensitive) if (process.env[key]?.length >= 12) values.push({ key, value: process.env[key] });
assert(values.length, "Không có giá trị secret local để kiểm tra; không tuyên bố pass");
const leaks = []; let scanned = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|json|map)$/.test(entry.name)) {
      const text = await readFile(file, "utf8"); scanned++;
      for (const { key, value } of values) if (text.includes(value) || text.includes(JSON.stringify(value).slice(1, -1))) leaks.push({ key, file: path.relative(root, file) });
    }
  }
}
await scan(root); assert(scanned, "Build client trống");
await mkdir("test-results/security", { recursive: true });
await writeFile("test-results/security/client-secrets.json", JSON.stringify({ at: new Date().toISOString(), scanned, secretNames: [...new Set(values.map((row) => row.key))], leaks }, null, 2));
console.log(`${leaks.length ? "FAIL" : "PASS"} ${scanned} client artifacts; ${leaks.length} secret matches (không in giá trị secret)`);
if (leaks.length) process.exitCode = 1;

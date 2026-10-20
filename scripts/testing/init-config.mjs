import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { configuredUrl } from "../../src/lib/testing/policy.mjs";
import { assertTestConfigFilename, assertTestConfiguration, reportTestingError, TestConfigurationError } from "./config.mjs";
async function main() {
  const filename = process.env.TEST_ENV_FILE || ".env.e2e.local";
  assertTestConfigFilename(filename);
  const template = await readFile(".env.e2e.example", "utf8");
  const existing = await readFile(filename, "utf8").catch(() => "");
  const config = { ...parseEnv(template), ...parseEnv(existing) };
  const production = parseEnv(await readFile(".env.local", "utf8").catch(() => ""));
  const digest = (value) => value ? createHash("sha256").update(value).digest("hex") : "";
  config.APP_ENV ||= "test"; config.RELEASE_ENVIRONMENT ||= "test"; config.TEST_TOOLS_ENABLED ||= "true";
  config.PRODUCTION_SUPABASE_URL ||= production.NEXT_PUBLIC_SUPABASE_URL || "";
  config.PRODUCTION_SERVICE_KEY_SHA256 ||= digest(production.SUPABASE_SECRET_KEY || production.SUPABASE_SERVICE_ROLE_KEY);
  config.PRODUCTION_SESSION_SECRET_SHA256 ||= digest(production.SESSION_HASH_PEPPER);
  for (const key of ["TEST_TOOLS_GATE_SECRET", "SESSION_HASH_PEPPER", "STAGING_ACCESS_PASSWORD", "API_KEY_PEPPER", "INTEGRATION_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET", "INTEGRATION_WORKER_SECRET", "OPERATIONS_CRON_SECRET"]) config[key] ||= randomBytes(32).toString("base64url");
  config.TEST_ACCOUNT_PASSWORD ||= `Ct${randomBytes(24).toString("base64url")}9`;
  if (config.NEXT_PUBLIC_SUPABASE_URL) {
    config.TEST_SUPABASE_URL ||= config.NEXT_PUBLIC_SUPABASE_URL;
    config.E2E_SUPABASE_URL ||= config.NEXT_PUBLIC_SUPABASE_URL;
    let hostname;
    try { hostname = configuredUrl(config, "NEXT_PUBLIC_SUPABASE_URL").hostname; }
    catch (error) { throw new TestConfigurationError(filename, [error.message]); }
    config.TEST_SUPABASE_PROJECT_ID ||= ["localhost", "127.0.0.1"].includes(hostname) ? "local" : hostname.split(".")[0];
  }
  delete config.E2E_PASSWORD;
  await writeFile(filename, Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
  console.log(`Đã lưu ${filename}; giữ nguyên giá trị đã cấu hình và sinh secrets còn thiếu. Không tạo project Supabase.`);
  assertTestConfiguration(config, filename);
  console.log("Cấu hình file hợp lệ; chưa kiểm tra kết nối database/marker/server.");
}

try { await main(); } catch (error) { reportTestingError(error); }

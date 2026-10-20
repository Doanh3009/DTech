import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import path from "node:path";
import { assertTestEnvironment, configuredUrl } from "../../src/lib/testing/policy.mjs";

// Define absent test fields as empty before Next reads .env.local. Credentials,
// targets and environment flags must belong to the selected test file.
export const TEST_CONFIG_KEYS = [
  "E2E_DATABASE_KIND", "E2E_SUPABASE_URL", "E2E_BASE_URL", "APP_BASE_URL", "APP_TIMEZONE",
  "APP_ENV", "RELEASE_ENVIRONMENT", "TEST_TOOLS_ENABLED", "TEST_SUPABASE_URL", "TEST_SUPABASE_PROJECT_ID",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PRODUCTION_SUPABASE_URL",
  "PRODUCTION_SERVICE_KEY_SHA256", "PRODUCTION_SESSION_SECRET_SHA256", "TEST_TOOLS_GATE_SECRET",
  "TEST_ACCOUNT_PASSWORD", "SESSION_HASH_PEPPER", "API_KEY_PEPPER", "INTEGRATION_ENCRYPTION_KEY",
  "WEBHOOK_SIGNING_SECRET", "INTEGRATION_WORKER_SECRET", "OPERATIONS_CRON_SECRET",
  "STAGING_ACCESS_USER", "STAGING_ACCESS_PASSWORD", "SEED_TEST_PASSWORD", "E2E_PASSWORD", "E2E_ENV"
];
const requiredKeys = [
  "APP_ENV", "RELEASE_ENVIRONMENT", "TEST_TOOLS_ENABLED", "E2E_DATABASE_KIND",
  "NEXT_PUBLIC_SUPABASE_URL", "TEST_SUPABASE_URL", "E2E_SUPABASE_URL", "TEST_SUPABASE_PROJECT_ID",
  "APP_BASE_URL", "E2E_BASE_URL", "TEST_TOOLS_GATE_SECRET", "TEST_ACCOUNT_PASSWORD", "SESSION_HASH_PEPPER",
  "API_KEY_PEPPER", "INTEGRATION_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET", "INTEGRATION_WORKER_SECRET", "OPERATIONS_CRON_SECRET"
];
const present = (value) => typeof value === "string" && Boolean(value.trim());

export class TestConfigurationError extends Error {
  constructor(filename, details) {
    super(`Cấu hình test chưa hợp lệ: ${filename}\n${details.map((detail) => `- ${detail}`).join("\n")}`);
    this.name = "TestConfigurationError";
  }
}

export function assertTestConfigFilename(filename) {
  const allowed = [".env.e2e.local", ".env.staging.local", ".env.development.local"].map((name) => path.resolve(name));
  if (!allowed.includes(path.resolve(filename))) throw new TestConfigurationError(filename, ["Chỉ dùng .env.e2e.local, .env.staging.local hoặc .env.development.local tại gốc workspace"]);
}

export function assertTestConfiguration(config, filename = ".env.e2e.local") {
  const missing = requiredKeys.filter((key) => !present(config[key]));
  if (!present(config.NEXT_PUBLIC_SUPABASE_ANON_KEY) && !present(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!present(config.SUPABASE_SERVICE_ROLE_KEY) && !present(config.SUPABASE_SECRET_KEY)) missing.push("SUPABASE_SERVICE_ROLE_KEY hoặc SUPABASE_SECRET_KEY");
  if (missing.length) throw new TestConfigurationError(filename, missing.map((key) => `Thiếu ${key}`));
  for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) {
    if (config[key] && /\s/.test(config[key])) throw new TestConfigurationError(filename, [`${key} không được chứa khoảng trắng`]);
  }
  try {
    if (config.E2E_DATABASE_KIND !== "test") throw new Error("E2E_DATABASE_KIND phải là test");
    const target = assertTestEnvironment(config);
    if (configuredUrl(config, "E2E_SUPABASE_URL").href !== target.databaseUrl) throw new Error("E2E_SUPABASE_URL phải trùng NEXT_PUBLIC_SUPABASE_URL và TEST_SUPABASE_URL");
    if (target.projectId === "local" && config.TEST_SUPABASE_PROJECT_ID !== "local") throw new Error("TEST_SUPABASE_PROJECT_ID phải là local với Supabase local");
    const baseUrl = configuredUrl(config, "E2E_BASE_URL");
    const appUrl = configuredUrl(config, "APP_BASE_URL");
    for (const [key, url] of [["E2E_BASE_URL", baseUrl], ["APP_BASE_URL", appUrl]]) {
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error(`${key} phải là URL gốc HTTP/HTTPS, không kèm thông tin đăng nhập`);
    }
    if (baseUrl.origin !== appUrl.origin) throw new Error("E2E_BASE_URL phải cùng origin với APP_BASE_URL");
    if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname) && (config.APP_ENV !== "staging" || baseUrl.protocol !== "https:")) throw new Error("E2E remote cần APP_ENV=staging và website HTTPS");
    for (const key of ["API_KEY_PEPPER", "INTEGRATION_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET", "INTEGRATION_WORKER_SECRET", "OPERATIONS_CRON_SECRET"]) {
      if (config[key].length < 32) throw new Error(`${key} cần tối thiểu 32 ký tự`);
    }
    return { target, baseUrl };
  } catch (error) {
    throw new TestConfigurationError(filename, [error.message]);
  }
}

export async function loadTestConfiguration({ filename = process.env.TEST_ENV_FILE || ".env.e2e.local", inheritedEnv = process.env } = {}) {
  assertTestConfigFilename(filename);
  let contents;
  try { contents = await readFile(filename, "utf8"); }
  catch (error) {
    throw new TestConfigurationError(filename, [error.code === "ENOENT" ? "Không tìm thấy file; chạy npm run test:config:init" : "Không đọc được file cấu hình"]);
  }
  let config;
  try { config = parseEnv(contents); }
  catch { throw new TestConfigurationError(filename, ["Không đọc được định dạng .env"]); }
  const validated = assertTestConfiguration(config, filename);
  const env = { ...inheritedEnv, ...Object.fromEntries(TEST_CONFIG_KEYS.map((key) => [key, ""])), ...config };
  return { ...validated, config, env, filename };
}

export function reportTestingError(error) {
  console.error(error instanceof TestConfigurationError ? error.message : `Không thể chạy lệnh test: ${error.message}`);
  if (error instanceof TestConfigurationError) {
    console.error("Điền credentials Supabase test riêng trong file trên; không dùng khóa production.");
    console.error("test:config:init chỉ sinh secrets và bổ sung alias; không tạo project Supabase.");
    console.error("Hướng dẫn: docs/testing/DEV_STAGING_TESTING.md. Kiểm tra lại: npm run test:config:check");
  }
  process.exitCode = 1;
}

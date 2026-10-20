// @vitest-environment node
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const workspace = process.cwd();
const secret = "synthetic-private-value-that-must-not-be-logged";
let cwd;
const run = (script, args = [], extraEnv = {}) => spawnSync(process.execPath, [path.join(workspace, script), ...args], {
  cwd, env: { ...process.env, TEST_ENV_FILE: ".env.e2e.local", ...extraEnv }, encoding: "utf8", windowsHide: true, timeout: 10_000
});
const output = (result) => `${result.stdout}${result.stderr}`;

beforeEach(async () => { cwd = await mkdtemp(path.join(tmpdir(), "ct-test-config-")); });
afterEach(async () => {
  expect(path.resolve(cwd).startsWith(path.resolve(tmpdir()) + path.sep + "ct-test-config-")).toBe(true);
  await rm(cwd, { recursive: true, force: true });
});

describe("test command preflight", () => {
  it.each([
    ["scripts/testing/cli.mjs", "seed"], ["scripts/testing/cli.mjs", "verify"],
    ["scripts/e2e/environment.mjs", "run"], ["scripts/e2e/environment.mjs", "build"],
    ["scripts/e2e/environment.mjs", "start"], ["scripts/e2e/environment.mjs", "dev"],
    ["scripts/testing/check-config.mjs", undefined]
  ])("%s %s stops on an incomplete file without an uncaught URL error", async (script, action) => {
    await writeFile(path.join(cwd, ".env.e2e.local"), "NEXT_PUBLIC_SUPABASE_URL=\nE2E_SUPABASE_URL=\n");
    const result = run(script, action ? [action] : [], { NEXT_PUBLIC_SUPABASE_URL: "https://inherited-production.example.invalid", SUPABASE_SECRET_KEY: secret });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(output(result)).toContain("Cấu hình test chưa hợp lệ: .env.e2e.local");
    expect(output(result)).toContain("Thiếu NEXT_PUBLIC_SUPABASE_URL");
    expect(output(result)).toContain("Thiếu E2E_SUPABASE_URL");
    expect(output(result)).toContain("test:config:check");
    expect(output(result)).not.toMatch(/ERR_INVALID_URL|AssertionError|at assertTestEnvironment|fetch failed/);
    expect(output(result)).not.toContain(secret);
    expect(output(result)).not.toContain("inherited-production");
  });
  it("reports a missing file with its actual dedicated filename", () => {
    const result = run("scripts/testing/check-config.mjs", [], { TEST_ENV_FILE: ".env.staging.local" });
    expect(result.status).toBe(1);
    expect(output(result)).toContain(".env.staging.local");
    expect(output(result)).toContain("Không tìm thấy file");
  });
  it("init generates private secrets, retains configured values and reports missing database credentials", async () => {
    await writeFile(path.join(cwd, ".env.e2e.example"), await readFile(path.join(workspace, ".env.e2e.example"), "utf8"));
    await writeFile(path.join(cwd, ".env.e2e.local"), `TEST_ACCOUNT_PASSWORD=${secret}9\n`);
    const result = run("scripts/testing/init-config.mjs");
    expect(result.status).toBe(1);
    expect(output(result)).toContain("Đã lưu .env.e2e.local");
    expect(output(result)).toContain("Không tạo project Supabase");
    expect(output(result)).toContain("Thiếu SUPABASE_SERVICE_ROLE_KEY hoặc SUPABASE_SECRET_KEY");
    const config = parseEnv(await readFile(path.join(cwd, ".env.e2e.local"), "utf8"));
    expect(config.TEST_ACCOUNT_PASSWORD).toBe(`${secret}9`);
    expect(config.TEST_TOOLS_GATE_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(config.SESSION_HASH_PEPPER).not.toBe(config.TEST_TOOLS_GATE_SECRET);
    expect(config.NEXT_PUBLIC_SUPABASE_URL).toBe("");
    expect(output(result)).not.toContain(config.TEST_TOOLS_GATE_SECRET);
    expect(output(result)).not.toContain(secret);
    const repeated = run("scripts/testing/init-config.mjs");
    expect(repeated.status).toBe(1);
    expect(parseEnv(await readFile(path.join(cwd, ".env.e2e.local"), "utf8"))).toEqual(config);
  });
  it("init refuses to write the production environment file", async () => {
    const original = `SUPABASE_SECRET_KEY=${secret}\n`;
    await writeFile(path.join(cwd, ".env.local"), original);
    const result = run("scripts/testing/init-config.mjs", [], { TEST_ENV_FILE: ".env.local" });
    expect(result.status).toBe(1);
    expect(output(result)).toContain("Chỉ dùng .env.e2e.local");
    expect(await readFile(path.join(cwd, ".env.local"), "utf8")).toBe(original);
    expect(output(result)).not.toContain(secret);
  });
  it("init fills URL aliases and project ID and checks a complete local file without network", async () => {
    await writeFile(path.join(cwd, ".env.e2e.example"), await readFile(path.join(workspace, ".env.e2e.example"), "utf8"));
    await writeFile(path.join(cwd, ".env.e2e.local"), `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=unit-public-key\nSUPABASE_SERVICE_ROLE_KEY=${secret}\n`);
    const result = run("scripts/testing/init-config.mjs");
    expect(result.status).toBe(0);
    expect(output(result)).toContain("chưa kiểm tra kết nối database/marker/server");
    const config = parseEnv(await readFile(path.join(cwd, ".env.e2e.local"), "utf8"));
    expect(config.E2E_SUPABASE_URL).toBe(config.NEXT_PUBLIC_SUPABASE_URL);
    expect(config.TEST_SUPABASE_URL).toBe(config.NEXT_PUBLIC_SUPABASE_URL);
    expect(config.TEST_SUPABASE_PROJECT_ID).toBe("local");
    expect(run("scripts/testing/check-config.mjs").status).toBe(0);
    expect(output(result)).not.toContain(secret);
  });
});

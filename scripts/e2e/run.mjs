import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";
import { createFixture, sealFixture } from "./fixture.mjs";
import { registerBusinessCases } from "./workflows.mjs";
import { registerBrowserCases } from "./browser.mjs";
import { registerReadOnlyCases } from "./read-only.mjs";
import { registerTesterCases } from "./tester.mjs";
import { registerPlatformCases } from "./platform-workflows.mjs";
import { registerConcurrencyCases } from "./concurrency.mjs";
import { observePage } from "./page-ready.mjs";

nextEnv.loadEnvConfig(process.cwd());
const runId = new Date().toISOString().slice(0, 10).replaceAll("-", "") + randomBytes(3).toString("hex");
const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3200").replace(/\/$/, "");
const output = path.resolve("test-results/e2e", runId);
await mkdir(output, { recursive: true });
const report = { runId, startedAt: new Date().toISOString(), baseUrl, environment: process.env.APP_ENV || process.env.E2E_ENV || "production", cases: [], timings: [] };
const cases = [];
const contexts = new Map();
const readOnly = process.argv.includes("--read-only");
const state = {};
let fixture, browser;
class BlockedError extends Error {}
const scope = {
  assert, state, report, output, baseUrl, uuid: randomUUID,
  test(id, name, fn, kind = "API") { cases.push({ id, name, fn, kind }); },
  need(...keys) { for (const key of keys) if (!state[key]) throw new BlockedError(`Thiếu dữ liệu từ bước ${key}`); },
  get fixture() { return fixture; },
  get browser() { return browser; },
  newContext(options = {}) { return browser.newContext({ httpCredentials: process.env.APP_ENV === "staging" ? { username: process.env.STAGING_ACCESS_USER, password: process.env.STAGING_ACCESS_PASSWORD } : undefined, ...options }); },
  get people() { return fixture.people; },
  context(role) { assert(contexts.has(role), `Chưa đăng nhập ${role}`); return contexts.get(role); },
  async api(role, method, route, data, statuses = [200, 201]) {
    assert(!readOnly || method === "GET" || route === "/api/v1/auth/login", "Chế độ chỉ đọc chặn thay đổi dữ liệu nghiệp vụ");
    const started = performance.now();
    const response = await scope.context(role).request.fetch(baseUrl + route, { method, data, timeout: 30_000 });
    const body = await response.json().catch(() => ({}));
    report.timings.push({ route, method, role, ms: Math.round(performance.now() - started), status: response.status() });
    assert(statuses.includes(response.status()), `${method} ${route}: HTTP ${response.status()} ${body.error?.message || JSON.stringify(body).slice(0, 160)}`);
    return body.data;
  },
  async create(role, route, data, table) {
    const result = await scope.api(role, "POST", route, data);
    if (table) await fixture.track(table, result.id);
    return result;
  },
  async page(role, route, width = 1440) {
    const page = await scope.context(role).newPage();
    const observer = observePage(page);
    try {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.goto(baseUrl + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await observer.ready();
      return page;
    } catch (error) { await page.close(); throw error; }
  }
};
if (process.argv.includes("--list")) {
  registerBusinessCases(scope);
  registerConcurrencyCases(scope);
  registerPlatformCases(scope);
  registerTesterCases(scope);
  await registerBrowserCases(scope);
  await writeFile(path.join(output, "catalog.json"), JSON.stringify(cases.map(({ id, name, kind }) => ({ id, name, kind })), null, 2));
  for (const test of cases) console.log(`${test.id}\t${test.kind}\t${test.name}`);
  console.log(`Total: ${cases.length}. Catalog: ${output}`);
  process.exit(0);
}
async function execute(test) {
  const started = performance.now();
  const result = { id: test.id, name: test.name, kind: test.kind, status: "PASS" };
  try { await test.fn(); }
  catch (error) { result.status = error instanceof BlockedError ? "BLOCKED" : "FAIL"; result.error = error.stack || String(error); }
  result.ms = Math.round(performance.now() - started);
  report.cases.push(result);
  console.log(`${result.status} ${result.id} ${result.name}${result.error ? `: ${result.error.split("\n")[0]}` : ""}`);
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
}
try {
  if (!readOnly) {
    assert.equal(process.env.E2E_DATABASE_KIND, "test", "Luồng ghi cần database test riêng (E2E_DATABASE_KIND=test); audit/sổ kho không thể xóa sau test");
    assert.equal(new URL(process.env.E2E_SUPABASE_URL).href, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).href, "E2E_SUPABASE_URL phải xác nhận đúng database của ứng dụng đang chạy");
  }
  fixture = readOnly ? {
    manifest: { runId, readOnly: true }, password: process.env.SEED_TEST_PASSWORD || process.env.TEST_ACCOUNT_PASSWORD,
    people: { employee: { username: "test.user02" }, accountant: { username: "test.user01" }, hr: { username: "test.user47" }, supervisor: { username: "test.supervisor" } },
    setup: async () => undefined
  } : await createFixture(runId, path.join(output, "fixture.json"), process.argv.includes("--allow-remote"));
  report.readOnly = readOnly;
  await execute({ id: "SETUP", name: readOnly ? "Đăng nhập tài khoản test có sẵn, chỉ đọc nghiệp vụ" : "Dữ liệu riêng và phiên đăng nhập theo vai trò", kind: "SETUP", fn: async () => {
    await fixture.setup();
    assert(fixture.password, "Thiếu mật khẩu trong biến môi trường của tài khoản test; không dùng mật khẩu mặc định");
    browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
    for (const [role, person] of Object.entries(fixture.people)) {
      const context = await scope.newContext({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh", reducedMotion: "reduce" });
      contexts.set(role, context);
      await scope.api(role, "POST", "/api/v1/auth/login", { username: person.username, password: fixture.password });
    }
    state.ready = true;
  }});
  if (state.ready) {
    if (readOnly) registerReadOnlyCases(scope);
    else { registerBusinessCases(scope); registerConcurrencyCases(scope); registerPlatformCases(scope); registerTesterCases(scope); await registerBrowserCases(scope); }
    const filter = process.env.E2E_FILTER;
    for (const test of cases.filter((test) => !filter || filter.split(",").some(prefix=>test.id.includes(prefix.trim())))) await execute(test);
  }
} catch (error) { report.cases.push({ id: "RUNNER", name: "Khởi động", status: "BLOCKED", error: error.message }); }
finally {
  for (const context of contexts.values()) await context.close().catch(() => undefined);
  if (browser) await browser.close();
  if (fixture && !readOnly) await execute({ id: "SEAL", name: "Khóa tài khoản E2E, giữ chứng từ và audit trên database test", kind: "SETUP", fn: () => sealFixture(fixture) });
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(["PASS", "FAIL", "BLOCKED"].map((status) => [status, report.cases.filter((test) => test.status === status).length]));
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  const rows = report.cases.map((test) => `| ${test.id} | ${test.name.replaceAll("|", "/")} | ${test.kind || ""} | ${test.status} | ${test.ms ?? 0} |`).join("\n");
  await writeFile(path.join(output, "report.md"), `# E2E ${runId}\n\n${report.startedAt} · ${report.environment} · ${baseUrl}\n\n${JSON.stringify(report.summary)}\n\n| Mã | Tình huống | Loại | Kết quả | ms |\n|---|---|---|---|---|\n${rows}\n\n${report.cases.filter((test) => test.error).map((test) => `## ${test.id}\n\n\`\`\`text\n${test.error}\n\`\`\``).join("\n\n")}\n`);
  console.log(`Report: ${output} ${JSON.stringify(report.summary)}`);
  process.exitCode = report.summary.FAIL || report.summary.BLOCKED ? 1 : 0;
}

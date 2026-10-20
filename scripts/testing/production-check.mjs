import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = (process.env.SMOKE_BASE_URL || "http://localhost:3400").replace(/\/$/, "");
const output = "test-results/production-boundaries";
await mkdir(output, { recursive: true });
const results = [];
let browser;
async function test(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); }
  catch (error) { results.push({ name, status: "FAIL", error: error.message }); }
  console.log(`${results.at(-1).status} ${name}`);
}
for (const [method, route, body] of [
  ["GET", "/api/testing/accounts"],
  ["POST", "/api/testing/access", { secret: "invalid-production-probe" }],
  ["POST", "/api/testing/login", { username: "admin.test", role: "admin" }]
]) await test(`${method} ${route} bị khóa trên production`, async () => {
  const response = await fetch(base + route, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 404);
  assert(!response.headers.get("set-cookie"), "Endpoint test không được cấp cookie");
});
try {
  browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  for (const width of [1440, 390]) await test(`Đăng nhập production ${width}px không có công cụ test`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      assert((await page.goto(base + "/login", { waitUntil: "networkidle" }))?.ok());
      assert.equal(await page.locator('[aria-label="Tài khoản kiểm thử"]').count(), 0);
      assert.equal(await page.locator('input[name="testerSecret"]').count(), 0);
      const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
      assert(size.content <= size.width + 1); assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/login-${width}.png`, fullPage: true });
    } finally { await context.close(); }
  });
} catch (error) { results.push({ name: "Khởi động trình duyệt", status: "FAIL", error: error.message }); }
finally { if (browser) await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2));
if (results.some((result) => result.status !== "PASS")) process.exitCode = 1;

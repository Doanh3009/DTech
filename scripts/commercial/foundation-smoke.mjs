import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright-core";

const baseUrl = process.env.ERP_SITE_BASE_URL || "http://localhost:3100";
const output = process.env.ERP_AUDIT_OUTPUT || ".tmp/erp-p1-browser";
const credentials = parseEnv(await readFile(process.env.ERP_AUDIT_CREDENTIALS_FILE || ".env.admin.local", "utf8"));
const username = process.env.ERP_AUDIT_USERNAME || credentials.BOOTSTRAP_ADMIN_USERNAME;
const password = process.env.ERP_AUDIT_PASSWORD || credentials.BOOTSTRAP_ADMIN_PASSWORD;
if (!username || !password) throw new Error("Cần tài khoản kiểm tra ERP.");
await mkdir(output, { recursive: true });
const report = { generatedAt: new Date().toISOString(), results: [], checks: {} };
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true
});
let context;
try {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", reducedMotion: "reduce" });
  const login = await context.newPage();
  await login.goto(`${baseUrl}/login`);
  await login.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor();
  assert.equal(await login.locator('.erp-login__modules, a[href="/applications"]').count(), 0);
  report.checks.loginWithoutModuleList = true;
  assert.equal((await context.request.get(`${baseUrl}/api/v1/integrations/openapi`)).status(), 401);
  report.checks.anonymousOpenApiDenied = true;
  await login.locator('input[name="username"]').fill(username);
  await login.locator('input[name="password"]').fill(password);
  const authentication = login.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST");
  await login.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  assert.equal((await authentication).status(), 200);
  await login.waitForURL("**/applications", { waitUntil: "domcontentloaded" });
  await login.getByRole("heading", { name: "Không gian làm việc", exact: true }).waitFor();
  assert.equal(await login.getByRole("button", { name: "Tất cả", exact: true }).count(), 0);
  assert.equal(await login.getByRole("link", { name: "Dashboard", exact: true }).count(), 0);
  report.checks.hubWithoutCategoryFilterOrDashboard = true;
  await login.close();

  const configuration = await context.request.get(`${baseUrl}/api/v1/system-settings`);
  assert.equal(configuration.status(), 200);
  const settings = (await configuration.json()).data.settings;
  const modules = await context.request.get(`${baseUrl}/api/v1/system-settings/modules`);
  assert.equal(modules.status(), 200);
  assert.deepEqual((await modules.json()).data.value, settings.modules);
  const openApi = await context.request.get(`${baseUrl}/api/v1/integrations/openapi`);
  assert.equal(openApi.status(), 200);
  assert.equal(openApi.headers()["cache-control"], "no-store");
  assert.equal((await openApi.json()).info.title, `${settings.branding.systemName} External API`);
  report.checks.configurationApiConsistent = true;
  report.checks.openApiMatchesCustomerBranding = true;

  for (const route of ["/applications", "/employees", "/warehouse/inventory", "/system-admin/modules", "/system-admin/design-dna"]) {
    const page = await context.newPage();
    const errors = [];
    const apiFailures = [];
    page.on("pageerror", () => errors.push("runtime error"));
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (response.url().startsWith(`${baseUrl}/api/`) && response.status() >= 400
        && !(pathname === "/api/v1/workspace/avatar" && response.status() === 404)) {
        apiFailures.push({ path: pathname, status: response.status() });
      }
    });
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor();
    await page.locator("h1").first().waitFor({ state: "attached" });
    await page.waitForTimeout(700);
    assert.equal(response.status(), 200);
    assert.equal(new URL(page.url()).pathname, route);
    assert.equal(await page.getByRole("heading", { name: "Ứng dụng của tôi", exact: true }).count(), 0);
    assert.equal(await page.getByText(/Application error|Internal Server Error|Đã có lỗi xảy ra/).count(), 0);
    if (route === "/warehouse/inventory") {
      const hrefs = await page.locator("#desktop-navigation a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      assert.equal(await page.locator('.app-rail__brand a[aria-label="Tất cả module"][href="/applications"]').count(), 1);
      assert(hrefs.every((href) => href === "/applications" || href.startsWith("/warehouse") || href.startsWith("/settings/warehouse")));
      report.checks.warehouseNavigationFocused = true;
    }
    const viewports = [];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      const viewport = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.equal(viewport.horizontalOverflow, false);
      viewports.push(viewport);
      await page.screenshot({ path: path.join(output, `${route.slice(1).replaceAll("/", "-")}-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(apiFailures, []);
    report.results.push({ route, destination: route, status: response.status(), ok: true, errors, apiFailures, viewports });
    await page.close();
  }
  assert.equal((await context.request.get(`${baseUrl}/ui-preview/erp`)).status(), 404);
  assert.equal((await context.request.get(`${baseUrl}/testing`)).status(), 404);
  report.checks.productionToolsHidden = true;
  assert.equal((await context.request.post(`${baseUrl}/api/v1/auth/logout`)).status(), 200);
  assert.equal((await context.request.get(`${baseUrl}/api/v1/system-settings/modules`)).status(), 401);
  report.checks.anonymousConfigurationDenied = true;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checkedRoutes: report.results.length, passed: report.results.length, checks: report.checks }));
} finally {
  // Revoke this audit's session even when an assertion fails.
  if (context) await context.request.post(`${baseUrl}/api/v1/auth/logout`).catch(() => undefined);
  await browser.close();
}

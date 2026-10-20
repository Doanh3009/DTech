import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3200";
const output = path.resolve("docs/ui-evidence/production-ui");
const password = process.env.SEED_TEST_PASSWORD;
assert(password, "Set SEED_TEST_PASSWORD for the disposable QA accounts before running this check.");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const scenarios = [
  { username: "test.employee", routes: ["/dashboard", "/attendance/history", "/leave", "/leave/new", "/profile"] },
  { username: "test.supervisor", routes: ["/dashboard", "/employees", "/employees/90000000-0000-4000-8000-000000000001/history", "/projects", "/projects/b0000000-0000-4000-8000-000000000001/progress", "/projects/b0000000-0000-4000-8000-000000000001/team", "/projects/b0000000-0000-4000-8000-000000000001/documents", "/worker-attendance"] },
  { username: "test.payroll", routes: ["/dashboard", "/accounting/payroll", "/accounting/payslips"] }
];

try {
  const publicContext = await browser.newContext();
  try {
    for (const route of ["/api/health/live", "/api/health/ready", "/login"]) {
      const response = await publicContext.request.get(`${baseUrl}${route}`);
      assert.equal(response.status(), 200, `Production ${route} must be healthy`);
      assert.equal(response.headers()["x-frame-options"], "DENY");
      assert.equal(response.headers()["x-content-type-options"], "nosniff");
      assert(!response.headers()["content-security-policy"]?.includes("unsafe-eval"), "Development CSP must not reach production");
    }
    for (const route of ["/ui-preview", "/ui-preview/golden", "/__ui"]) {
      const response = await publicContext.request.get(`${baseUrl}${route}`);
      assert.equal(response.status(), 404, `Development preview ${route} must be hidden`);
    }
    console.log("PASS production health, security headers and hidden previews");
  } finally { await publicContext.close(); }
  for (const scenario of scenarios) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      const context = await browser.newContext({ viewport, locale: "vi-VN", reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => {
          if (response.status() >= 500 && new URL(response.url()).pathname.startsWith("/api/")) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
        });
        await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
        await page.getByLabel(/Tên tài khoản/).fill(scenario.username);
        await page.getByLabel(/^Mật khẩu/).fill(password);
        await Promise.all([
          page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 }),
          page.getByRole("button", { name: "Đăng nhập", exact: true }).click()
        ]);
        const mobile = viewport.width < 768;
        if (mobile) assert.equal(new URL(page.url()).pathname, "/personal", "Phone login must open personal home");
        const routes = mobile ? ["/personal", ...scenario.routes] : scenario.routes;
        for (const route of routes) {
          const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
          assert(response && response.status() < 400, `${scenario.username} ${route} HTTP ${response?.status()}`);
          assert.equal(new URL(page.url()).pathname, route, `Unexpected redirect from ${route}`);
          await page.locator("#main-content").waitFor();
          if (route === "/dashboard") await page.locator('.dashboard-page section[aria-label^="Tổng quan"]').waitFor();
          await page.waitForFunction(() => !document.querySelector("#main-content .state-box--loading-pattern"));
          assert.equal(await page.locator("#main-content .state-box--error").count(), 0, `Failed data load on ${route}`);
          await page.evaluate(() => document.fonts.ready);
          await page.locator('#main-content h1:visible').first().waitFor();
          assert.equal(await page.locator('#main-content h1:visible').count(), 1, `One visible page title is required on ${route}`);
          const layout = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            width: document.documentElement.scrollWidth,
            headerTop: document.querySelector(".app-header")?.getBoundingClientRect().top,
            headerBottom: document.querySelector(".app-header")?.getBoundingClientRect().bottom,
            mainTop: document.querySelector("#main-content")?.getBoundingClientRect().top,
            viewportHeight: window.innerHeight
          }));
          assert(layout.width <= layout.viewport + 1, `${scenario.username} ${route} overflows at ${viewport.width}px`);
          assert(layout.headerTop >= 0 && layout.headerTop <= 1 && layout.headerBottom < layout.viewportHeight / 2 && layout.mainTop < layout.viewportHeight / 2, `${scenario.username} ${route} shell pushes content below the viewport at ${viewport.width}px: ${JSON.stringify(layout)}`);
          assert.equal(await page.getByRole("heading", { name: "Không thể tải trang" }).count(), 0, `Error boundary on ${route}`);
          const tables = await page.locator('.data-table-shell[data-view="desktop"] table').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
          assert(tables.every((height) => height > 0), `Desktop records are hidden on ${route} at ${viewport.width}px`);
          const filterWidths = await page.locator('.filter-bar__desktop :is(.input, .select)').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
          assert(filterWidths.every((width) => width >= 100), `Filter fields are clipped on ${route} at ${viewport.width}px: ${filterWidths}`);
          if (mobile) {
            assert.equal(await page.locator('.mobile-bottom-nav a[aria-current="page"]').count(), 1, `Ambiguous navigation on ${route}`);
            const targets = await page.locator(".mobile-bottom-nav a").evaluateAll((links) => links.map((link) => ({ width: link.getBoundingClientRect().width, height: link.getBoundingClientRect().height })));
            assert(targets.length > 0 && targets.length <= 5 && targets.every((target) => target.width >= 44 && target.height >= 44), `Invalid mobile touch targets on ${route}`);
          }
          await page.screenshot({ path: path.join(output, `${scenario.username}-${route.replaceAll("/", "_")}-${viewport.width}.png`) });
          console.log(`PASS ${scenario.username} ${route} ${viewport.width}x${viewport.height}`);
        }
        assert.deepEqual(errors, [], `${scenario.username} runtime/API errors`);
      } finally { await context.close(); }
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 568 } });
  try {
    const page = await context.newPage();
    await page.route("**/api/v1/auth/login", (route) => route.fulfill({ status: 503, contentType: "text/html", body: "Unavailable" }));
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel(/Tên tài khoản/).fill("test.employee");
    await page.getByLabel(/^Mật khẩu/).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const alert = page.locator('form [role="alert"]');
    await alert.waitFor();
    assert(await alert.evaluate((element) => document.activeElement === element), "Login errors must receive focus");
    assert((await alert.innerText()).includes("tạm thời gián đoạn"), "Do not expose JSON parse errors");
    assert.equal(await page.getByLabel(/Tên tài khoản/).inputValue(), "test.employee");
    assert(await page.getByRole("button", { name: "Đăng nhập", exact: true }).isEnabled());
    await page.screenshot({ path: path.join(output, "login-retry-390.png") });
    console.log("PASS login recovery and retained credentials");
  } finally { await context.close(); }
} finally { await browser.close(); }

import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const output = path.resolve("docs/ui-evidence/polish-20261005");
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 }
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});
const reports = [];

try {
  const context = await browser.newContext({ locale: "vi-VN", reducedMotion: "reduce" });
  const login = await context.request.post(`${baseUrl}/api/v1/auth/login`, {
    data: { username: "test.supervisor", password: getTestPassword() }
  });
  assert(login.ok(), `QA login failed: ${login.status()}`);
  const authenticatedPage = await context.newPage();
  const previewPage = await context.newPage();
  const failures = [];
  for (const page of [authenticatedPage, previewPage]) {
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);
    page.on("pageerror", (error) => failures.push(error.message));
  }
  await context.route("**/api/**", async (route) => {
    assert(["GET", "HEAD", "OPTIONS"].includes(route.request().method()), "UI QA must not mutate application data");
    await route.continue();
  });

  for (const viewport of viewports) {
    for (const route of ["/dashboard", "/employees", "/ui-preview/timesheets"]) {
      const page = route.startsWith("/ui-preview/") ? previewPage : authenticatedPage;
      await page.setViewportSize(viewport);
      const start = performance.now();
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      assert(response?.ok(), `Route failed: ${route}`);
      assert.equal(new URL(page.url()).pathname, route, `Auth redirect: ${route}`);
      await page.locator("#main-content h1").first().waitFor();
      if (route === "/dashboard") await page.locator("[data-dashboard-metric]").first().waitFor();
      if (route === "/employees") await page.locator(".employee-roster").waitFor();
      if (route === "/ui-preview/timesheets") await page.locator(".data-table-shell").waitFor();
      await page.waitForFunction(() => !document.querySelector("#main-content .state-box--loading-pattern"));
      await page.evaluate(() => document.fonts.ready);
      const readyMs = Math.round(performance.now() - start);
      const metrics = await page.evaluate(() => {
        const main = document.querySelector("#main-content");
        const cardHeading = main.querySelector(".card h2, [data-dashboard-panel] h2, .employee-roster__heading h2");
        const launcherLabel = main.querySelector(".module-icon-card strong");
        const surface = main.querySelector(".data-surface--workspace");
        const innerTable = surface?.querySelector(".data-table-scroll");
        return {
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          fontSize: getComputedStyle(document.body).fontSize,
          cardHeading: cardHeading ? { size: getComputedStyle(cardHeading).fontSize, weight: getComputedStyle(cardHeading).fontWeight } : null,
          launcherLabel: launcherLabel ? { size: getComputedStyle(launcherLabel).fontSize, weight: getComputedStyle(launcherLabel).fontWeight } : null,
          surfaceHeight: surface ? Math.round(surface.getBoundingClientRect().height) : null,
          nestedBorderWidth: innerTable ? getComputedStyle(innerTable).borderTopWidth : null,
          errors: [...main.querySelectorAll('[role="alert"]')].map((element) => element.textContent.trim())
        };
      });
      assert(metrics.scrollWidth <= metrics.width, `${route} overflow at ${viewport.width}: ${metrics.scrollWidth}`);
      assert.deepEqual(metrics.errors, [], `${route} error state: ${metrics.errors.join("; ")}`);
      if (metrics.nestedBorderWidth !== null) assert.equal(metrics.nestedBorderWidth, "0px");
      const fileName = `${route.split("/").at(-1)}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(output, fileName), fullPage: true });
      reports.push({ route, viewport, readyMs, metrics, screenshot: fileName });
      console.log(`PASS ${route} ${viewport.width}x${viewport.height}: ${readyMs}ms, body ${metrics.fontSize}, no overflow/errors`);
    }
  }
  assert.deepEqual(failures, [], "Browser runtime errors");
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(`${baseUrl}/employees`, { waitUntil: "domcontentloaded" });
  await anonymousPage.waitForURL((url) => url.pathname === "/login");
  assert.equal(await anonymousPage.locator(".employee-roster").count(), 0, "Protected records appeared before login");
  await anonymousContext.close();
  console.log("PASS anonymous redirect: protected records remain behind authentication");
  await writeFile(path.join(output, "report.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), environment: "development", baseUrl, reports, failures, anonymousRedirect: true }, null, 2)}\n`);
  await context.close();
} finally {
  await browser.close();
}

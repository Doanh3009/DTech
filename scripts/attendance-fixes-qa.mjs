import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const evidence = path.resolve("docs/ui-evidence/attendance-fixes");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const reports = [];

try {
  for (const username of ["test.employee", "test.supervisor", "test.payroll"]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "vi-VN" });
    const login = await context.request.post(`${baseUrl}/api/v1/auth/login`, { data: { username, password: getTestPassword() } });
    assert(login.ok(), `QA login ${username}: ${login.status()}`);
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(60_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const routes = username === "test.supervisor" ? ["/projects", "/projects/b0000000-0000-4000-8000-000000000001/today"] : username === "test.payroll" ? ["/accounting/payroll", "/accounting/payslips"] : ["/dashboard", "/attendance/me", "/profile"];
    for (const route of routes) {
      await page.goto(baseUrl + route, { waitUntil: "networkidle" });
      await page.locator("#main-content").waitFor();
      await page.locator('[data-ui="loading-spinner"]').waitFor({ state: "detached", timeout: 30_000 });
      if (username === "test.supervisor") await page.getByText("Bảo trì hệ thống ray Cảng ABC", { exact: true }).first().waitFor();
      if (route === "/dashboard") await page.locator("[data-dashboard-metric]").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const navigation = document.querySelector(".page-context-navigation");
        const header = document.querySelector("#main-content .page-header, #main-content .entity-context-header");
        const card = document.querySelector("#main-content .form-section, #main-content .detail-section, #main-content .data-surface, #main-content [class*='packageWorkspace']");
        return {
          width: innerWidth, pageWidth: document.documentElement.scrollWidth,
          backLeft: navigation?.getBoundingClientRect().left ?? null,
          headerLeft: header?.getBoundingClientRect().left ?? null,
          cardLeft: card?.getBoundingClientRect().left ?? null,
          cardPadding: card ? getComputedStyle(card).paddingInlineStart : null,
          hrLauncher: Boolean(document.querySelector('a[href="/employees"]')),
          loadErrors: [...document.querySelectorAll("#main-content [role='alert']")].map(node => node.textContent)
        };
      });
      assert(metrics.pageWidth <= metrics.width + 1, `${username} ${route} overflow`);
      if (metrics.backLeft !== null && metrics.cardLeft !== null) assert(Math.abs(metrics.backLeft - metrics.cardLeft) <= 1, `Back control differs from card gutter on ${route}`);
      if (username === "test.employee") assert(!metrics.hrLauncher, "Employee still sees HR launcher");
      assert.equal(metrics.loadErrors.length, 0, `${username} ${route}: ${metrics.loadErrors.join("; ")}`);
      reports.push({ username, route, viewport: "1920x1080", ...metrics });
      await page.screenshot({ path: path.join(evidence, `${username}-${route.replaceAll("/", "_")}-1920.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      const phone = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth }));
      assert(phone.pageWidth <= phone.width + 1, `${username} ${route} phone overflow`);
      await page.screenshot({ path: path.join(evidence, `${username}-${route.replaceAll("/", "_")}-390.png`) });
      await page.setViewportSize({ width: 1920, height: 1080 });
      console.log(`PASS ${username} ${route} desktop/mobile`);
    }
    if (username === "test.employee") {
      for (const api of ["/api/v1/employees", "/api/v1/attendance/admin/today", "/api/v1/attendance/records?scope=all"]) {
        const response = await context.request.get(baseUrl + api);
        assert.equal(response.status(), 403, `HR endpoint must deny employee: ${api}`);
      }
      // Delay an actual navigation response to verify the spinner appears before
      // the destination arrives, and is removed when the navigation finishes.
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      const link = page.locator('.app-rail__link[href="/attendance/me"]').first();
      await link.waitFor();
      await page.route(/\/attendance\/me\?.*_rsc=/, async route => {
        const response = await route.fetch();
        await new Promise(resolve => setTimeout(resolve, 1800));
        await route.fulfill({ response });
      });
      await link.click();
      const loader = page.locator('[data-ui="loading-spinner"]').first();
      await loader.waitFor({ state: "visible" });
      const center = await loader.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { dx: Math.abs(rect.left + rect.width / 2 - innerWidth / 2), dy: Math.abs(rect.top + rect.height / 2 - innerHeight / 2), animation: getComputedStyle(node.querySelector("svg")).animationName };
      });
      assert(center.dx < 1 && center.dy < 1, `Spinner must be centered in viewport: ${JSON.stringify(center)}`);
      assert.notEqual(center.animation, "none", "Spinner must rotate with normal motion preferences");
      await page.screenshot({ path: path.join(evidence, "spinner-loading-1920.png") });
      await page.waitForURL(/\/attendance\/me/);
      await loader.waitFor({ state: "detached" });
      await page.getByRole("button", { name: "Mở chat", exact: true }).click();
      await page.getByRole("complementary", { name: "Chat nội bộ" }).waitFor();
      await page.getByRole("button", { name: "Đóng chat", exact: true }).click();
      await page.getByRole("button", { name: "Mở chat", exact: true }).click();
      await page.getByRole("complementary", { name: "Chat nội bộ" }).waitFor();
      await page.getByRole("button", { name: "Đóng chat", exact: true }).click();
      reports.push({ username, loader: center });
      console.log("PASS centered loading spinner + employee HR denied + lazy chat reopen");
    }
    assert.equal(errors.length, 0, `${username}: ${errors.join("; ")}`);
    await context.close();
  }
  await writeFile(path.join(evidence, "results.json"), JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}

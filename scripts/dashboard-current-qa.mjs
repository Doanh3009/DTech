import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const output = "docs/ui-evidence/dashboard-module-analytics";
await mkdir(output, { recursive: true });
const errors = [];
try {
  for (const account of ["test.supervisor", "test.payroll", "test.employee"]) {
    const context = await browser.newContext({ locale: "vi-VN" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3000/login");
    await page.locator('[name="username"]').fill(account);
    await page.locator('[name="password"]').fill(getTestPassword());
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/login");
    await page.goto("http://localhost:3000/dashboard");
    await page.getByRole("heading", { name: "Chỉ số tổng quan" }).waitFor();
    const response = await context.request.get("http://localhost:3000/api/v1/dashboard");
    assert(response.ok());
    const model = (await response.json()).data;
    console.log(account, "widgets:", model.widgets.map((widget) => widget.key).join(", "));
    if (account === "test.payroll") {
      assert.equal(model.profile, "accounting", "Payroll account did not resolve to the accounting dashboard");
      assert.deepEqual(model.widgets.map((widget) => widget.key), ["accounting_summary"], "Payroll-only account received another module");
      await page.getByRole("heading", { name: "Kế toán", exact: true, level: 1 }).waitFor();
      await page.getByRole("heading", { name: "Tình trạng kỳ lương" }).waitFor();
    }
    if (account === "test.employee") {
      assert.equal(model.profile, "employee", "Employee account did not resolve to the employee dashboard");
      assert(!model.widgets.some((widget) => widget.key === "accounting_summary"), "Employee dashboard mixed in another role's analytics");
    }
    assert.equal(await page.getByRole("navigation", { name: "Dashboard theo phân hệ" }).count(), 0, "Dashboard switcher should not be rendered");
    const verticalOrder = await page.evaluate(() => ({
      launcher: document.querySelector(".module-launcher")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      analytics: document.querySelector('[class*="analytics"]')?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY
    }));
    assert(verticalOrder.launcher < verticalOrder.analytics, "Application launcher must be above dashboard analytics");
    for (const width of account === "test.supervisor" ? [1440, 1920, 1280, 1024, 768, 430, 390, 375, 320] : [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        charts: document.querySelectorAll('[class*="chartPanel"]').length,
        chartHeight: Math.max(...[...document.querySelectorAll('[class*="chartPanel"]')].map((panel) => panel.getBoundingClientRect().height)),
        clippedAxis: [...document.querySelectorAll('svg[role="img"] text')].some((label) => { const bounds = label.getBoundingClientRect(); const chart = label.closest("svg").getBoundingClientRect(); return bounds.left < chart.left - 1 || bounds.right > chart.right + 1; }),
        cards: [...document.querySelectorAll(".module-icon-card")].map((card) => { const rect = card.getBoundingClientRect(); return { width: rect.width, height: rect.height, fits: card.scrollHeight <= card.clientHeight + 1 }; }),
        metrics: document.querySelectorAll('[class*="metrics"] > *').length
      }));
      assert(!layout.overflow, account + " overflow at " + width);
      assert(layout.charts >= 1 && layout.charts <= 2, "Expected one or two charts");
      assert(layout.metrics <= 4);
      assert(layout.chartHeight < 340, "Sparse charts should not reserve oversized blank panels");
      assert(!layout.clippedAxis, "Chart axis labels clipped at " + width);
      for (const card of layout.cards) {
        assert(Math.abs(card.width - card.height) < 2, "Application card is not square");
        assert(card.fits, "Application label clipped");
      }
      assert.equal(await page.getByRole("heading", { name: "Ghi chú nhanh" }).count(), 0);
      assert.equal(await page.getByRole("heading", { name: "Cần xử lý", exact: true }).count(), 0);
      await page.screenshot({ path: output + "/" + account + "-" + width + ".png", fullPage: true });
      console.log("PASS", account, width);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.keyboard.press("Tab");
    await page.locator(".module-icon-card").first().focus();
    assert(await page.locator(".module-icon-card").first().evaluate((element) => element === document.activeElement && getComputedStyle(element).outlineStyle !== "none"));
    assert.equal(await page.getByRole("button", { name: "Làm mới Dashboard" }).count(), 0, "Dashboard should update automatically without a refresh button");
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3200";
const password = getTestPassword();
const output = path.resolve("docs/ui-evidence/erp-redesign");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });

async function session(username, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "vi-VN", reducedMotion: "reduce" });
  const response = await context.request.post(`${baseUrl}/api/v1/auth/login`, { data: { username, password } });
  assert(response.ok(), `QA login failed for ${username}`);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Interaction checks must never create or modify business records.
  await page.route("**/api/**", (route) => {
    if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    throw new Error(`Unexpected mutation in UI QA: ${route.request().method()} ${new URL(route.request().url()).pathname}`);
  });
  return { context, page, errors };
}

async function insideViewport(locator, page) {
  const bounds = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, "Floating controls must stay in the viewport");
}

try {
  for (const width of [320, 390, 430, 1440]) {
    const { context, page, errors } = await session("test.supervisor", width);
    try {
      await page.goto(`${baseUrl}/employees`, { waitUntil: "load" });
      await page.getByRole("heading", { name: "Nhân viên", exact: true }).waitFor();
      if (width < 768) {
        const headerBounds = await page.locator('.app-header :is(.app-header__mobile-leading, .app-header__search, .app-header__actions)').evaluateAll((elements) => elements.map((element) => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })));
        assert(headerBounds.every((bounds, index) => bounds.left >= 0 && bounds.right <= width && (!index || headerBounds[index - 1].right <= bounds.left + 1)), `Phone header controls overlap at ${width}px: ${JSON.stringify(headerBounds)}`);
        await page.getByRole("button", { name: "Mở Ứng dụng của tôi", exact: true }).click();
        const launcher = page.getByRole("dialog", { name: "Ứng dụng của tôi", exact: true });
        await insideViewport(launcher, page);
        assert(await launcher.getByRole("link", { name: "Nhân sự", exact: true }).isVisible());
        await page.keyboard.press("Escape");
        assert.equal(await launcher.count(), 0);
        await page.getByRole("button", { name: /^Bộ lọc/ }).click();
        const sheet = page.getByRole("dialog", { name: "Bộ lọc" });
        await sheet.getByRole("combobox", { name: "Trạng thái", exact: true }).click();
        await insideViewport(page.locator(".select-control__panel:visible"), page);
        await page.keyboard.press("Escape");
        assert(await sheet.isVisible(), "Escape should dismiss the select before its filter sheet");
        await sheet.getByRole("combobox", { name: "Trạng thái", exact: true }).click();
        await page.getByRole("option", { name: "Đang làm việc", exact: true }).click();
        await sheet.getByRole("button", { name: "Đóng", exact: true }).click();
        await page.getByRole("button", { name: /^Bộ lọc/ }).click();
        assert((await sheet.getByRole("combobox", { name: "Trạng thái", exact: true }).innerText()).includes("Đang làm việc"));
        await Promise.all([page.waitForURL((url) => url.searchParams.get("status") === "active"), sheet.getByRole("button", { name: "Áp dụng" }).click()]);
      } else {
        const select = page.getByRole("combobox", { name: "Trạng thái", exact: true });
        await select.click();
        await insideViewport(page.locator(".select-control__panel:visible"), page);
        await page.getByRole("option", { name: "Đang làm việc", exact: true }).click();
        await Promise.all([page.waitForURL((url) => url.searchParams.get("status") === "active"), page.getByRole("button", { name: "Lọc", exact: true }).click()]);
      }
      await page.getByRole("searchbox", { name: "Tìm nhân viên" }).fill("NO_MATCH_UI_QA");
      await Promise.all([page.waitForURL((url) => url.searchParams.get("q") === "NO_MATCH_UI_QA"), page.getByRole("button", { name: "Lọc", exact: true }).click()]);
      await page.getByRole("heading", { name: "Chưa có nhân viên", exact: true }).waitFor();
      await Promise.all([page.waitForURL((url) => !url.search), page.getByRole("button", { name: "Xóa", exact: true }).click()]);
      assert.equal(await page.getByRole("searchbox", { name: "Tìm nhân viên" }).inputValue(), "");
      const records = width < 768 ? page.locator(".mobile-record") : page.locator(".data-table tbody tr");
      await records.first().waitFor();
      const menuTrigger = records.first().locator(".dropdown__trigger");
      await menuTrigger.focus();
      await page.keyboard.press("ArrowDown");
      const menu = page.getByRole("menu");
      await menu.waitFor();
      await insideViewport(menu, page);
      assert(await menu.getByRole("menuitem").first().evaluate((element) => document.activeElement === element), "Keyboard opening should focus the first action");
      await page.screenshot({ path: path.join(output, `employee-menu-${width}.png`) });
      await page.keyboard.press("Escape");
      assert(await menuTrigger.evaluate((element) => document.activeElement === element));
      assert.deepEqual(errors, []);
      console.log(`PASS employee filter retention, empty/reset, keyboard row menu and portal bounds ${width}px`);
    } finally { await context.close(); }
  }

  for (const width of [320, 390, 430, 1440]) {
    const { context, page, errors } = await session("test.supervisor", width);
    try {
      await page.goto(`${baseUrl}/projects/b0000000-0000-4000-8000-000000000001/progress?mode=report-issue`, { waitUntil: "load" });
      const drawer = page.getByRole("dialog", { name: "Báo vướng hiện trường", exact: true });
      const select = drawer.getByRole("combobox", { name: "Công việc", exact: true });
      await select.click();
      await insideViewport(page.locator(".select-control__panel:visible"), page);
      await page.keyboard.press("Escape");
      assert(await drawer.isVisible());
      await page.keyboard.press("Escape");
      assert.equal(await drawer.count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS project drawer and nested select/Escape ${width}px`);
    } finally { await context.close(); }
  }

  for (const width of [320, 390, 430, 1440]) {
    const { context, page, errors } = await session("test.payroll", width);
    try {
      await page.goto(`${baseUrl}/accounting/payroll`, { waitUntil: "load" });
      await page.getByRole("heading", { name: "Bảng lương", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Lập bảng lương", exact: true }).count(), 0, "QA payroll role has no payroll.create permission");
      const allowed = await page.request.get(`${baseUrl}/api/v1/accounting/payroll`);
      assert(allowed.ok(), "Payroll role must keep its original access");
      const denied = await page.request.get(`${baseUrl}/api/v1/employees`);
      assert.equal(denied.status(), 403, "UI changes must preserve RBAC");
      assert.deepEqual(errors, []);
      console.log(`PASS original payroll UI and API permissions ${width}px`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

try {
  for (const { username, route, title } of [
    { username: "test.payroll", route: "/accounting/payroll", title: "Bảng lương" },
    { username: "test.supervisor", route: "/employees", title: "Nhân viên" }
  ]) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "vi-VN" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/login`);
      await page.locator('[name="username"]').fill(username);
      await page.locator('[name="password"]').fill(getTestPassword());
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.waitForURL((url) => url.pathname !== "/login");
      await page.goto(`${baseUrl}${route}`);
      await page.locator("main h1").filter({ hasText: title }).first().waitFor({ state: width < 768 ? "attached" : "visible" });
      if (route === "/accounting/payroll") {
        await page.locator(".data-table-shell").waitFor();
      }
      assert.equal(await page.locator(width < 768 ? ".app-header__mobile-back" : "main .back-link").filter({ visible: true }).count(), 0, `${route} should not have a return control`);
      if (width >= 768) {
        const heading = page.getByRole("heading", { name: title, level: 1 });
        assert((await heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))) <= 24, "Page title is still oversized");
        assert.equal(await heading.locator("..").evaluate((element) => getComputedStyle(element, "::before").content), "none", "Decorative title stripe remains");
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route} overflows at ${width}px`);
      assert.deepEqual(errors, [], `${route} has browser errors`);
      console.log(`PASS ${username} ${width}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

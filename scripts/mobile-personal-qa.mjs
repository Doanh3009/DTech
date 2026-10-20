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
  for (const { width, height } of [{ width: 320, height: 568 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: "vi-VN" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${baseUrl}/login`);
    await page.locator('[name="username"]').fill("test.payroll");
    await page.locator('[name="password"]').fill(getTestPassword());
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === "/personal");
    await page.locator(".mobile-bottom-nav").waitFor({ state: "visible" });
    await page.locator(".personal-home .personal-today").waitFor();

    const home = await page.evaluate(() => {
      const nav = document.querySelector(".mobile-bottom-nav");
      const rect = nav?.getBoundingClientRect();
      const header = document.querySelector(".app-header")?.getBoundingClientRect();
      const leading = document.querySelector(".app-header__mobile-leading")?.getBoundingClientRect();
      const search = document.querySelector(".app-header__search")?.getBoundingClientRect();
      const actions = document.querySelector(".app-header__actions")?.getBoundingClientRect();
      const firstCard = document.querySelector(".personal-home .personal-today")?.getBoundingClientRect();
      return {
        viewport: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        navItems: nav?.querySelectorAll("a").length ?? 0,
        navTop: rect?.top ?? 0,
        navBottom: rect?.bottom ?? 0,
        headerHeight: header?.height,
        headerBottom: header?.bottom,
        firstCardTop: firstCard?.top,
        leadingRight: leading?.right,
        searchLeft: search?.left,
        searchRight: search?.right,
        actionsLeft: actions?.left,
        visibleTitle: [...document.querySelectorAll(".app-header__mobile-leading strong")].some((element) => element.getBoundingClientRect().width > 10)
      };
    });
    assert(home.pageWidth <= home.viewport + 1, `Personal home overflows at ${width}px: ${JSON.stringify(home)}`);
    assert(home.navItems > 0 && home.navItems <= 5, `Invalid bottom navigation at ${width}px`);
    assert(Math.abs(home.navBottom - height) <= 1, `Bottom navigation is not docked at ${width}px`);
    assert(home.headerHeight >= 52 && home.headerHeight <= 65, `Header height is not compact at ${width}px: ${JSON.stringify(home)}`);
    assert(home.headerBottom <= home.firstCardTop, `Header overlaps personal attendance at ${width}px: ${JSON.stringify(home)}`);
    assert(home.leadingRight <= home.searchLeft + 1 && home.searchRight <= home.actionsLeft + 1, `Header controls overlap at ${width}px: ${JSON.stringify(home)}`);
    assert(await page.getByRole("navigation", { name: "Thông tin của tôi" }).isVisible(), "Personal shortcuts are missing");
    assert.equal(await page.locator('.mobile-bottom-nav a[aria-current="page"]').count(), 1);
    assert.equal(home.visibleTitle, false, "Mobile function title is still visible");
    for (const desktopRoute of ["/applications", "/dashboard", "/accounting/payroll"]) {
      await page.goto(`${baseUrl}${desktopRoute}`);
      await page.waitForURL((url) => url.pathname === desktopRoute);
      await page.locator("#main-content").waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${desktopRoute} overflows at ${width}px`);
    }
    await page.goto(`${baseUrl}/personal`);
    await page.getByRole("link", { name: "Phiếu lương của tôi", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/accounting/payslips");
    await page.locator("#main-content .page-stack").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Payslips overflow at ${width}px`);
    assert.equal(await page.locator('.mobile-bottom-nav a[aria-current="page"]').count(), 1);
    assert.deepEqual(errors, [], `Browser errors at ${width}px`);
    console.log(`PASS mobile personal and self payslips ${width}x${height}`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`);
  await page.locator('[name="username"]').fill("test.employee");
  await page.locator('[name="password"]').fill(getTestPassword());
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/personal");
  const quickAction = page.locator('.mobile-bottom-nav a[href="/attendance/quick"]');
  await quickAction.waitFor({ state: "visible" });
  const moreAction = page.locator(".mobile-bottom-nav button");
  if (await moreAction.count()) {
    await moreAction.click();
    await page.getByRole("dialog", { name: "Thêm" }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Thêm" }).waitFor({ state: "hidden" });
  }
  assert(await quickAction.isEnabled(), "Employee quick attendance is unavailable");
  assert.equal((await quickAction.textContent())?.trim(), "Chấm công");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Employee home overflows");
  await quickAction.click();
  await page.waitForURL((url) => url.pathname === "/attendance/quick");
  await page.getByRole("region", { name: "Chụp ảnh chấm công" }).waitFor();
  assert.equal(await page.locator(".mobile-bottom-nav").isVisible(), true, "Bottom navigation disappeared in camera workflow");
  await page.locator(".attendance-capture-actions").scrollIntoViewIfNeeded();
  const cameraBounds = await page.evaluate(() => ({
    actionsBottom: document.querySelector(".attendance-capture-actions")?.getBoundingClientRect().bottom,
    navTop: document.querySelector(".mobile-bottom-nav")?.getBoundingClientRect().top
  }));
  assert(cameraBounds.actionsBottom <= cameraBounds.navTop, "Bottom navigation obscures camera controls");
  console.log("PASS employee quick attendance 390px");
  await context.close();
} finally {
  await browser.close();
}

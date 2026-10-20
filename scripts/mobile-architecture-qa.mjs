import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const password = getTestPassword();
const projectId = process.env.UI_QA_PROJECT_ID || "b0000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });

async function login(page, username) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('[name="username"]').fill(username);
  await page.locator('[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 25_000 });
}

async function audit(page, route, mobile) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, route, `${route} redirected during mobile QA`);
  if (route !== "/attendance/quick") await page.locator(".app-header").waitFor({ state: "visible" });
  if (mobile) await page.locator(".mobile-bottom-nav").waitFor({ state: "visible", timeout: 20_000 });
  const result = await page.evaluate(() => {
    const visible = (element) => element && element.getBoundingClientRect().width > 0 && getComputedStyle(element).display !== "none";
    const navs = [...document.querySelectorAll(".mobile-bottom-nav")].filter(visible);
    const legacy = [...document.querySelectorAll(".mobile-context-nav, [aria-label='Thao tác hiện trường']")].filter(visible);
    const items = [...(navs[0]?.querySelectorAll("a, button") ?? [])].filter(visible);
    const header = document.querySelector(".app-header");
    const leading = header?.querySelector(".app-header__mobile-leading")?.getBoundingClientRect();
    const search = header?.querySelector(".app-header__search")?.getBoundingClientRect();
    const actions = header?.querySelector(".app-header__actions")?.getBoundingClientRect();
    const root = header?.classList.contains("app-header--root");
    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      navCount: navs.length,
      legacyCount: legacy.length,
      items: items.length,
      centerLabel: navs[0]?.querySelector('[data-slot="3"]')?.textContent?.trim(),
      touchHeights: items.map((item) => Math.round(item.getBoundingClientRect().height)),
      navBottom: navs[0]?.getBoundingClientRect().bottom,
      windowHeight: innerHeight,
      headerHeight: header?.getBoundingClientRect().height,
      headerOverlap: Boolean(leading && search && (leading.right > search.left + 1 || (root && actions && search.right > actions.left + 1))),
      repeatedPageHeading: [...document.querySelectorAll('.page-header[data-ui="page-header"] .page-header__copy')].some(visible)
    };
  });
  assert(result.scrollWidth <= result.viewport + 1, `${route} horizontal page overflow: ${JSON.stringify(result)}`);
  if (mobile) {
    assert.equal(result.navCount, 1, `${route} must have exactly one mobile bottom bar`);
    assert.equal(result.legacyCount, 0, `${route} still has legacy mobile navigation`);
    assert.equal(result.items, 5, `${route} must keep five bottom destinations`);
    assert.equal(result.centerLabel, "Chấm công", `${route} changed the center action`);
    assert(result.touchHeights.every((height) => height >= 44), `${route} has a touch target below 44px`);
    assert(Math.abs(result.navBottom - result.windowHeight) <= 1, `${route} bottom bar is not docked`);
    if (route !== "/attendance/quick") {
      assert(result.headerHeight >= 52 && result.headerHeight <= 65, `${route} header is not compact: ${JSON.stringify(result)}`);
      assert.equal(result.headerOverlap, false, `${route} header controls overlap: ${JSON.stringify(result)}`);
    }
    const headings = await page.locator('#main-content h1:visible').count();
    assert(headings <= 1, `${route} must have at most one visible main title`);
  } else {
    assert.equal(result.navCount, 0, `${route} has an unexpected mobile bottom bar`);
  }
}

try {
  for (const viewport of [
    { width: 320, height: 568 }, { width: 360, height: 800 }, { width: 375, height: 812 },
    { width: 390, height: 844 }, { width: 393, height: 852 }, { width: 412, height: 915 }, { width: 430, height: 932 },
    { width: 640, height: 900 }, { width: 667, height: 375 }, { width: 767, height: 900 }
  ]) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page, "test.employee");
    await audit(page, "/personal", true);
    await audit(page, "/attendance/me", true);
    await audit(page, "/attendance/quick", true);
    await audit(page, "/attendance/history", true);
    await page.locator(".attendance-calendar__grid > button").first().waitFor({ state: "visible" });
    const calendar = await page.locator(".attendance-calendar__grid > button").evaluateAll((cells) => ({
      count: cells.length,
      widths: cells.slice(0, 7).map((cell) => Math.round(cell.getBoundingClientRect().width)),
      heights: cells.slice(0, 7).map((cell) => Math.round(cell.getBoundingClientRect().height))
    }));
    assert.equal(calendar.count, 42, `Calendar must display six complete weeks at ${viewport.width}px`);
    assert(calendar.widths.every((width) => width >= 44), `Calendar day width below 44px at ${viewport.width}px: ${JSON.stringify(calendar)}`);
    assert(calendar.heights.every((height) => height >= 44), `Calendar day height below 44px at ${viewport.width}px: ${JSON.stringify(calendar)}`);
    const selectableDay = page.locator(".attendance-calendar__grid > button:not([disabled])").first();
    if (await selectableDay.count()) {
      await selectableDay.click();
      await page.locator(".attendance-day-drawer").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await page.locator(".attendance-day-drawer").waitFor({ state: "hidden" });
    }
    await audit(page, "/timesheets", true);
    await audit(page, "/leave", true);
    await audit(page, "/notifications", true);
    await audit(page, "/accounting/payslips", true);
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/notifications");
    await page.locator('.mobile-bottom-nav a[href="/applications"]').waitFor({ state: "visible" });
    assert.deepEqual(errors, [], `Browser errors at ${viewport.width}px`);
    console.log(`PASS employee ${viewport.width}x${viewport.height}`);
    await context.close();
  }

  for (const { username, routes } of [
    { username: "test.supervisor", routes: ["/employees", "/projects", `/projects/${projectId}/progress`, "/worker-attendance/today", "/notifications"] },
    { username: "test.payroll", routes: ["/accounting/payroll", "/accounting/salaries"] }
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN" });
    const page = await context.newPage();
    await login(page, username);
    for (const route of routes) await audit(page, route, true);
    console.log(`PASS ${username} 390x844`);
    await context.close();
  }

  for (const width of [768, 1024, 1280, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "vi-VN" });
    const page = await context.newPage();
    await login(page, "test.employee");
    await audit(page, "/personal", false);
    await audit(page, "/accounting/payslips", false);
    const sidebar = await page.locator(".app-rail").evaluate((rail) => rail.getBoundingClientRect().width > 0 && getComputedStyle(rail).display !== "none");
    assert(sidebar, `Desktop navigation is missing at ${width}px`);
    console.log(`PASS tablet/desktop ${width}x900`);
    await context.close();
  }
} finally {
  await browser.close();
}

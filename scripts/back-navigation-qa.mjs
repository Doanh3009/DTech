import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "vi-VN" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/login`);
    await page.locator('[name="username"]').fill(process.env.UI_QA_USERNAME || "test.supervisor");
    await page.locator('[name="password"]').fill(getTestPassword());
    const loginResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    assert.equal((await loginResponse).status(), 200, "Test account login failed");
    await page.waitForURL("**/dashboard");

    async function ready(path) {
      await page.waitForURL((url) => url.pathname === path);
      await page.waitForFunction((path) => window.history.state?.ctBackHistoryV1?.href.split(/[?#]/)[0] === path, path);
    }
    function backControl() {
      return page.locator(width < 768 ? ".app-header__mobile-back" : "main .back-link").filter({ visible: true }).first();
    }
    async function backTo(path) {
      await backControl().click();
      await ready(path);
    }
    async function goDashboard() {
      assert.equal(await backControl().count(), 0, "Top-level work screens should not show a return control");
      const dashboard = page.locator('.app-rail a[href="/dashboard"]').first();
      if (width < 768) await dashboard.evaluate((link) => link.click());
      else await dashboard.click();
      await ready("/dashboard");
    }
    await ready("/dashboard");
    // Use the application's actual Next links, rather than synthetic pushState.
    await page.locator('main a[href="/projects"]').first().click();
    await ready("/projects");
    const detail = page.locator('main a[href^="/projects/"]').filter({ visible: true }).first();
    const detailHref = await detail.getAttribute("href");
    assert(detailHref && detailHref !== "/projects/new", "Need an existing package for read-only navigation QA");
    await detail.click();
    await ready(new URL(detailHref, baseUrl).pathname);
    await backTo("/projects");
    await goDashboard();
    console.log(`PASS ${width}: detail -> list -> original screen`);

    // Menu-return must close the child flow instead of reopening it on Back.
    await page.locator('main a[href="/projects"]').first().click();
    await ready("/projects");
    await page.locator(`main a[href="${detailHref}"]`).filter({ visible: true }).first().click();
    await ready(new URL(detailHref, baseUrl).pathname);
    if (width < 768) {
      // The rail is hidden on mobile, but its Next Link still exercises the same menu action.
      await page.locator('.app-rail a[href="/projects"]').first().evaluate((link) => link.click());
    } else {
      await page.locator('.app-rail a[href="/projects"]').first().click();
    }
    await ready("/projects");
    await page.reload();
    await ready("/projects");
    await goDashboard();
    console.log(`PASS ${width}: menu return + reload -> original screen`);

    // Native Back/Forward must not leave stale future entries in the return chain.
    await page.goto(`${baseUrl}/projects`);
    await ready("/projects");
    await page.locator(`main a[href="${detailHref}"]`).filter({ visible: true }).first().click();
    await ready(new URL(detailHref, baseUrl).pathname);
    await page.goBack();
    await ready("/projects");
    await page.goForward();
    await ready(new URL(detailHref, baseUrl).pathname);
    await backTo("/projects");
    assert(await page.evaluate(() => window.history.length > 1));
    assert.deepEqual(await page.evaluate(() => window.history.state.ctBackHistoryV1.previous), []);
    await goDashboard();
    console.log(`PASS ${width}: first app screen with forward entries does not reopen a child`);

    // A direct URL has no tracked predecessor even if browser history is long.
    await page.goto(`${baseUrl}/warehouse/items`);
    await ready("/warehouse/items");
    assert.deepEqual(await page.evaluate(() => window.history.state.ctBackHistoryV1.previous), []);
    await goDashboard();
    console.log(`PASS ${width}: direct warehouse list uses primary navigation`);

    assert.deepEqual(errors, [], "Browser runtime errors");
    await context.close();
  }
} finally {
  await browser.close();
}

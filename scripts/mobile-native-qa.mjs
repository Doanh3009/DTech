import { getTestPassword } from "./testing/password.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const browserPath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const projectId = process.env.UI_QA_PROJECT_ID || "b0000000-0000-4000-8000-000000000001";
const output = path.join(process.cwd(), "docs", "ui-evidence", "mobile-native");
await mkdir(output, { recursive: true });

const routes = [
  { name: "dashboard", path: "/dashboard" },
  { name: "positions", path: "/employees/positions" },
  { name: "package-progress", path: `/projects/${projectId}/progress` },
  { name: "package-team", path: `/projects/${projectId}/team` },
  { name: "package-profile", path: `/projects/${projectId}/profile` },
  { name: "package-documents", path: `/projects/${projectId}/documents` }
];
const viewports = [
  { width: 360, height: 800, suffix: "360x800" },
  { width: 390, height: 844, suffix: "390x844" },
  { width: 844, height: 390, suffix: "landscape" }
];

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, locale: "vi-VN", reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(`console: ${message.text()}`);
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      const expectedAvatar = response.status() === 404 && url.pathname === "/api/v1/workspace/avatar";
      if (response.status() >= 400 && !expectedAvatar) errors.push(`http ${response.status()}: ${url.pathname}`);
    });

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('[name="username"]').fill("test.supervisor");
    await page.locator('[name="password"]').fill(getTestPassword());
    await Promise.all([
      page.waitForURL(/\/dashboard/),
      page.locator('form button[type="submit"]').click()
    ]);

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
      await page.locator("#main-content").waitFor();
      const audit = await page.evaluate((routeName) => {
        const root = document.documentElement;
        const main = document.querySelector("#main-content");
        const records = Array.from(document.querySelectorAll(".mobile-record"));
        const tabItems = Array.from(document.querySelectorAll(".context-tabs .tabs__item"));
        const dashboard = document.querySelector(".dashboard-page");
        const visible = (element) => element instanceof HTMLElement && element.offsetParent !== null;
        const actionTargets = Array.from(document.querySelectorAll("main .button, main .icon-button, main .dropdown > summary"))
          .filter(visible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { width: Math.round(rect.width), height: Math.round(rect.height), text: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) };
          });
        return {
          viewport: root.clientWidth,
          content: root.scrollWidth,
          mainScroll: main?.scrollWidth ?? 0,
          mainClient: main?.clientWidth ?? 0,
          recordOverflow: records.some((record) => record.scrollWidth > record.clientWidth + 1),
          smallTargets: actionTargets.filter((target) => target.width < 44 || target.height < 44),
          tabOverflow: tabItems.some((tab) => tab.getBoundingClientRect().right > root.clientWidth + 1),
          dashboardBackground: dashboard ? getComputedStyle(dashboard).backgroundImage : null,
          dashboardColor: dashboard ? getComputedStyle(dashboard).backgroundColor : null,
          routeName
        };
      }, route.name);

      if (audit.content > audit.viewport || audit.mainScroll > audit.mainClient + 1 || audit.recordOverflow || audit.tabOverflow) {
        throw new Error(`Overflow ${route.name} ${viewport.suffix}: ${JSON.stringify(audit)}`);
      }
      if (audit.smallTargets.length) throw new Error(`Touch target ${route.name} ${viewport.suffix}: ${JSON.stringify(audit.smallTargets.slice(0, 5))}`);
      if (route.name === "dashboard" && audit.dashboardBackground !== "none") throw new Error(`Dashboard frame remains: ${JSON.stringify(audit)}`);

      await page.screenshot({
        caret: "initial",
        fullPage: true,
        path: path.join(output, `${route.name}-${viewport.suffix}.png`)
      });

      if (route.name === "package-progress") {
        const filterButton = page.locator(".mobile-filter-bar__primary .button").first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
          const drawer = page.locator(".drawer");
          await drawer.waitFor();
          const drawerAudit = await drawer.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const close = element.querySelector(".overlay__header .icon-button")?.getBoundingClientRect();
            return { width: rect.width, viewport: document.documentElement.clientWidth, closeWidth: close?.width ?? 0, closeHeight: close?.height ?? 0 };
          });
          if (drawerAudit.width > drawerAudit.viewport + 1 || drawerAudit.closeWidth < 44 || drawerAudit.closeHeight < 44) {
            throw new Error(`Filter sheet ${viewport.suffix}: ${JSON.stringify(drawerAudit)}`);
          }
          await page.screenshot({ caret: "initial", path: path.join(output, `package-filter-${viewport.suffix}.png`) });
          await page.locator(".drawer .overlay__header .icon-button").click();
        }
      }

      if (route.name === "package-profile") {
        const record = page.locator('button[class*="recordRow"]').first();
        if (await record.isVisible()) {
          await record.click();
          const detailDrawer = page.locator(".drawer");
          await detailDrawer.waitFor();
          await page.screenshot({ caret: "initial", path: path.join(output, `package-profile-detail-${viewport.suffix}.png`) });
          await page.locator(".drawer .overlay__header .icon-button").click();
        }
      }
      console.log(`PASS ${route.name} ${viewport.suffix}`);
    }

    if (errors.length) throw new Error(`Browser errors ${viewport.suffix}: ${errors.join(" | ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}

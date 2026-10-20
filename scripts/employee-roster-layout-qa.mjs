import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const recordOnly = process.argv.includes("--record-only");
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const evidenceDir = "docs/ui-evidence/employee-roster";
const browser = await chromium.launch({
  executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});
const results = [];

try {
  await mkdir(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: "vi-VN" });
  const page = await context.newPage();
  const login = await context.request.post(`${baseUrl}/api/v1/auth/login`, {
    data: {
      username: process.env.UI_QA_USERNAME || "test.supervisor",
      password: getTestPassword()
    }
  });
  if (!login.ok()) {
    const body = await login.json();
    throw new Error(`QA login failed (${login.status()}): ${body.error?.message || "Unknown error"}`);
  }

  for (const width of [1920, 1600, 1366, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseUrl}/employees`, { waitUntil: "domcontentloaded" });
    await page.locator(".employee-table").waitFor();
    await page.locator(width < 768 ? ".employee-table .mobile-record" : ".employee-table tbody .employee-name-cell").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const inspector of width >= 1024 ? [false, true] : [false]) {
      if (inspector) {
        await page.locator('.employee-table .table-link').first().click();
        await page.locator(".employee-roster__inspector").waitFor({ state: "attached" });
      }
      const metrics = await page.evaluate(() => {
        const table = document.querySelector(".employee-table table");
        const scroller = document.querySelector(".employee-table .data-table-scroll");
        const nameNodes = [...document.querySelectorAll(".employee-table .employee-name-cell .table-link")];
        const scrollRules = [];
        function inspectRules(rules) {
          for (const rule of rules) {
            if (rule.selectorText && scroller?.matches(rule.selectorText) && (rule.style.overflow || rule.style.overflowX)) {
              scrollRules.push({ selector: rule.selectorText, overflow: rule.style.overflow, overflowX: rule.style.overflowX });
            }
            if (rule.cssRules && (!rule.media || matchMedia(rule.conditionText).matches)) inspectRules(rule.cssRules);
          }
        }
        for (const sheet of document.styleSheets) inspectRules(sheet.cssRules);
        return {
          viewport: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          tableWidth: table?.getBoundingClientRect().width,
          hasColumnSizing: Boolean(table?.querySelector('col[data-priority="primary"]')),
          tableMinWidth: table ? getComputedStyle(table).minWidth : null,
          scrollerWidth: scroller?.clientWidth,
          scrollMode: scroller ? getComputedStyle(scroller).overflowX : null,
          scrollRules,
          columns: [...(table?.querySelectorAll("thead th") || [])].map((cell) => ({
            id: cell.dataset.column || "actions",
            width: Math.round(cell.getBoundingClientRect().width)
          })),
          names: nameNodes.map((link) => ({
            name: link.textContent,
            width: link.clientWidth,
            scrollWidth: link.scrollWidth,
            overflow: getComputedStyle(link).overflow,
            whiteSpace: getComputedStyle(link).whiteSpace,
            ellipsis: getComputedStyle(link).textOverflow === "ellipsis"
          })),
          mobileRecords: document.querySelectorAll(".employee-table .mobile-record").length
        };
      });
      const suffix = `${width}${inspector ? "-inspector" : ""}`;
      await page.screenshot({ path: `${evidenceDir}/${recordOnly ? "before" : "after"}-${suffix}.png`, fullPage: true });
      results.push({ width, inspector, ...metrics });
      console.log(JSON.stringify({ width, inspector, ...metrics }));
      if (!recordOnly) {
        assert(metrics.pageWidth <= width + 1, `Page overflows at ${suffix}`);
        if (width >= 768) {
          assert(metrics.columns[0].width >= 280, `Name column is too narrow at ${suffix}`);
          assert(metrics.columns[0].width > metrics.columns[1].width, `Name column must be wider than department at ${suffix}`);
          assert(metrics.columns.at(-1).width <= 100, `Actions consume too much space at ${suffix}`);
          for (const item of metrics.names) {
            assert(!item.ellipsis && item.whiteSpace !== "nowrap", `Employee name is truncated: ${item.name}`);
            assert(item.scrollWidth <= item.width + 1, `Employee name overflows: ${item.name}`);
          }
          if (metrics.tableWidth > metrics.scrollerWidth + 1) {
            assert.equal(metrics.scrollMode, "auto", `Hidden table columns at ${suffix}`);
          }
        } else {
          assert(metrics.mobileRecords > 0, "Mobile roster is empty");
        }
      }
    }
  }
  await context.close();
} finally {
  await writeFile(`${evidenceDir}/${recordOnly ? "before" : "after"}-metrics.json`, `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}

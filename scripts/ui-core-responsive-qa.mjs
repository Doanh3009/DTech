import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3100";
const browserPath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.join(process.cwd(), "docs", "ui-evidence");
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath, headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/ui-preview`, { waitUntil: "networkidle" });

    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const shortTargets = [...document.querySelectorAll("button, a, summary, input, select")]
        .filter((element) => visible(element))
        .filter((element) => !(element instanceof HTMLInputElement && ["checkbox", "radio", "file"].includes(element.type)))
        .map((element) => ({
          label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || element.tagName,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height
        }))
        .filter((target) => target.height < 43.5 || (target.width < 43.5 && target.label.length === 0));
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        pageHeadings: document.querySelectorAll("h1").length,
        entityHeaders: document.querySelectorAll(".entity-context-header").length,
        contextTabs: document.querySelectorAll(".context-tabs").length,
        contextTabScrollers: document.querySelectorAll(".context-tabs__scroller").length,
        functionToolbars: document.querySelectorAll(".function-toolbar").length,
        worklists: document.querySelectorAll(".data-table--workspace").length,
        mobileLists: document.querySelectorAll(".mobile-record-list").length,
        mobileRecords: document.querySelectorAll(".mobile-record").length,
        fieldGroups: document.querySelectorAll(".form-section").length,
        uploadPreviews: document.querySelectorAll(".upload-preview").length,
        shortTargets
      };
    });

    if (audit.content > audit.viewport) throw new Error(`UI Core tràn ngang tại ${viewport.width}px: ${audit.content}/${audit.viewport}`);
    for (const key of ["pageHeadings", "entityHeaders", "contextTabs", "contextTabScrollers", "functionToolbars", "fieldGroups", "uploadPreviews"]) {
      if (audit[key] < 1) throw new Error(`Thiếu ${key} tại ${viewport.width}px: ${JSON.stringify(audit)}`);
    }
    const validWorklist = viewport.width < 768
      ? audit.worklists === 0 && audit.mobileLists === 1 && audit.mobileRecords === 2
      : audit.worklists === 1 && audit.mobileLists === 0;
    if (!validWorklist) throw new Error(`Worklist không đáp ứng viewport ${viewport.width}px: ${JSON.stringify(audit)}`);
    if (viewport.width <= 430 && audit.shortTargets.length) throw new Error(`Touch target dưới 44px tại ${viewport.width}px: ${JSON.stringify(audit.shortTargets)}`);

    if (viewport.width <= 430) {
      const filterButton = page.getByRole("button", { name: /^Bộ lọc/ });
      await filterButton.waitFor({ state: "visible" });
      await filterButton.click();
      const sheet = page.getByRole("dialog", { name: "Bộ lọc" });
      await sheet.waitFor({ state: "visible" });
      await page.waitForTimeout(260);
      const sheetMetrics = await sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom, viewport: window.innerHeight, className: element.className };
      });
      if (!sheetMetrics.className.includes("filter-sheet") || Math.abs(sheetMetrics.viewport - sheetMetrics.bottom) > 1) {
        throw new Error(`FilterSheet không neo đáy tại ${viewport.width}px: ${JSON.stringify(sheetMetrics)}`);
      }
      await sheet.getByRole("button", { name: "Đóng" }).click();
    }

    await page.screenshot({ path: path.join(output, `stage05-ui-core-${viewport.width}x${viewport.height}.png`), fullPage: true });
    console.log(`PASS UI Core ${viewport.width}x${viewport.height}`);
    await context.close();
  }

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN", reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${baseUrl}/ui-preview`, { waitUntil: "networkidle" });
  await reducedPage.getByRole("button", { name: /^Bộ lọc/ }).click();
  const animationName = await reducedPage.getByRole("dialog", { name: "Bộ lọc" }).evaluate((element) => getComputedStyle(element).animationName);
  if (animationName !== "none") throw new Error(`FilterSheet chưa tắt motion: ${animationName}`);
  console.log("PASS UI Core reduced motion");
  await reducedContext.close();
} finally {
  await browser.close();
}

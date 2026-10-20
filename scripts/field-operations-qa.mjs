import { getTestPassword } from "./testing/password.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const projectId = process.env.UI_QA_PROJECT_ID || "b0000000-0000-4000-8000-000000000001";
const browserPath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.join(process.cwd(), "docs", "ui-evidence", "field-operations");
const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath, headless: true });

async function assertNoOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  if (size.content > size.viewport + 1) throw new Error(`${label} tràn ngang: ${size.content}px > ${size.viewport}px`);
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('[name="username"]').fill("test.supervisor");
    await page.locator('[name="password"]').fill(getTestPassword());
    await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole("button", { name: /Đăng nhập/i }).click()]);

    await page.goto(`${baseUrl}/projects/${projectId}/today`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Việc cần làm tại hiện trường" }).waitFor();
    await assertNoOverflow(page, `Hôm nay ${viewport.width}`);
    if (viewport.width <= 767) {
      const mobileNav = page.getByRole("navigation", { name: "Thao tác hiện trường" });
      const labels = (await mobileNav.getByRole("link").allTextContents()).map((item) => item.trim());
      for (const expected of ["Hôm nay", "Công việc", "Cập nhật", "Nhân lực", "Thông tin"]) if (!labels.includes(expected)) throw new Error(`Thiếu ${expected} trong mobile nav: ${labels.join("|")}`);
      const undersized = await mobileNav.getByRole("link").evaluateAll((items) => items.filter((item) => { const box = item.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).length);
      if (undersized) throw new Error(`${undersized} touch target dưới 44px tại ${viewport.width}px`);
    } else {
      const desktopNav = page.getByRole("navigation", { name: "Không gian làm việc gói" });
      const labels = (await desktopNav.getByRole("link").allTextContents()).map((item) => item.trim());
      if (labels.join("|") !== "Hôm nay|Công việc|Nhân lực|Thông tin|Tài liệu") throw new Error(`Sai desktop nav: ${labels.join("|")}`);
    }
    await page.screenshot({ path: path.join(output, `today-${viewport.width}x${viewport.height}.png`), fullPage: true });

    await page.goto(`${baseUrl}/projects/${projectId}/progress`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Công việc hiện trường" }).waitFor();
    if (!await page.getByText("Tiến độ", { exact: true }).first().isVisible()) throw new Error("Thiếu nhãn Tiến độ.");
    await assertNoOverflow(page, `Công việc ${viewport.width}`);
    if (viewport.width <= 767) {
      const firstCard = page.locator('article[class*="taskRow"]').first();
      if (await firstCard.count()) {
        await firstCard.getByRole("button", { name: "Cập nhật", exact: true }).click();
        const updateDialog = page.getByRole("dialog", { name: "Cập nhật tiến độ" });
        await updateDialog.waitFor();
        await page.getByRole("button", { name: "Đóng" }).click();
        await updateDialog.waitFor({ state: "hidden" });
        await firstCard.getByRole("button", { name: "Báo vướng", exact: true }).click();
        const issueDialog = page.getByRole("dialog", { name: "Báo vướng hiện trường" });
        await issueDialog.waitFor();
        await page.getByRole("button", { name: "Đóng" }).click();
        await issueDialog.waitFor({ state: "hidden" });
      }
    }
    await page.screenshot({ path: path.join(output, `work-${viewport.width}x${viewport.height}.png`), fullPage: true });

    if (viewport.width === 375) {
      const firstCard = page.locator('article[class*="taskRow"]').first();
      await firstCard.getByRole("button", { name: "Cập nhật", exact: true }).click();
      await page.getByRole("dialog", { name: "Cập nhật tiến độ" }).waitFor();
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await page.getByRole("button", { name: "Lưu cập nhật" }).click();
      const queued = await page.evaluate(async () => new Promise((resolve, reject) => {
        const request = indexedDB.open("ct-field-operations", 2);
        request.onsuccess = () => {
          const database = request.result;
          const count = database.transaction("field-update-queue", "readonly").objectStore("field-update-queue").count();
          count.onsuccess = () => { database.close(); resolve(count.result); };
          count.onerror = () => reject(count.error);
        };
        request.onerror = () => reject(request.error);
      }));
      if (!queued) throw new Error("Cập nhật ngoại tuyến không được giữ trong IndexedDB.");
    } else {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await page.getByText("Ngoại tuyến", { exact: true }).waitFor();
      await context.setOffline(false);
    }
    await context.close();
    console.log(`PASS field operations ${viewport.width}x${viewport.height}`);
  }
} finally {
  await browser.close();
}

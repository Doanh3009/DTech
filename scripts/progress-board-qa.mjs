import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const projectId = process.env.UI_QA_PROJECT_ID || "b0000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
await mkdir("docs/ui-evidence/progress-board", { recursive: true });
try {
  const context = await browser.newContext({ locale: "vi-VN" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/login`);
  await page.locator('[name="username"]').fill(process.env.UI_QA_USERNAME || "test.supervisor");
  await page.locator('[name="password"]').fill(getTestPassword());
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/dashboard");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${baseUrl}/projects/${projectId}/progress`);
    const board = page.getByRole("region", { name: "Tiến độ công việc", exact: true });
    await board.getByRole("progressbar").first().waitFor();
    await page.screenshot({ path: `docs/ui-evidence/progress-board/progress-${width}.png`, fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow at ${width}`);
    const firstUpdate = board.getByRole("button", { name: /^Cập nhật / }).first();
    const expectedName = (await firstUpdate.getAttribute("aria-label")).replace(/^Cập nhật /, "");
    await firstUpdate.click();
    const dialog = page.getByRole("dialog", { name: "Cập nhật tiến độ" });
    await dialog.waitFor();
    await page.waitForTimeout(350);
    assert.equal(await dialog.locator("strong").filter({ hasText: expectedName }).first().textContent(), expectedName, "Update opened for the wrong task/phase");
    assert(await dialog.getByRole("button", { name: "Đang vướng" }).count(), "Blocked status is missing");
    await page.screenshot({ path: `docs/ui-evidence/progress-board/update-${width}.png` });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Dialog horizontal overflow at ${width}`);
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    await board.getByRole("button", { name: /^Cần xử lý/ }).click();
    assert.equal(await board.getByRole("button", { name: /^Cần xử lý/ }).getAttribute("aria-pressed"), "true");
    await board.getByRole("button", { name: /^Tất cả/ }).click();
    console.log(`PASS ${width}: summary, responsive layout, filter, exact phase update (no data saved)`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

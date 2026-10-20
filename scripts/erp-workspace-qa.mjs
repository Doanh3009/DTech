import { getTestPassword } from "./testing/password.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const browserPath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const projectId = process.env.UI_QA_PROJECT_ID || "b0000000-0000-4000-8000-000000000001";
const output = path.join(process.cwd(), "docs", "ui-evidence", "erp-workspace");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) browserErrors.push(`console: ${message.text()}`); });
    page.on("response", (response) => {
      const expectedMissingAvatar = response.status() === 404 && new URL(response.url()).pathname === "/api/v1/workspace/avatar";
      if (response.status() >= 400 && !expectedMissingAvatar) browserErrors.push(`http ${response.status()}: ${response.url()}`);
    });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('[name="username"]').fill("test.supervisor");
    await page.locator('[name="password"]').fill(getTestPassword());
    await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole("button", { name: "Đăng nhập" }).click()]);

    await page.getByRole("heading", { name: "Ứng dụng của tôi" }).waitFor();
    const dashboard = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      hasWorkbench: document.body.innerText.includes("Cần xử lý") && document.body.innerText.includes("Theo dõi vận hành"),
      myAppsCount: document.querySelectorAll(".module-launcher__grid > a").length
    }));
    if (dashboard.content > dashboard.viewport || !dashboard.hasWorkbench || dashboard.myAppsCount < 1) throw new Error(`Dashboard sai layout ${viewport.width}: ${JSON.stringify(dashboard)}`);
    await page.screenshot({ path: path.join(output, `dashboard-${viewport.width}x${viewport.height}.png`), fullPage: true, caret: "initial" });

    await page.goto(`${baseUrl}/projects/${projectId}/progress`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Thi công & Tiến độ" }).waitFor();
    const project = await page.evaluate(() => {
      const taskPanel = document.querySelector('[class*="taskPanel"]');
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        panelClient: taskPanel?.clientWidth ?? 0,
        panelScroll: taskPanel?.scrollWidth ?? 0,
        hasLaborLink: document.body.innerText.includes("Xem chấm công")
      };
    });
    if (project.content > project.viewport || project.panelScroll > project.panelClient + 1 || !project.hasLaborLink) throw new Error(`Gói/Công trường sai layout ${viewport.width}: ${JSON.stringify(project)}`);
    await page.screenshot({ path: path.join(output, `project-${viewport.width}x${viewport.height}.png`), fullPage: true, caret: "initial" });

    await page.goto(`${baseUrl}/projects/${projectId}/team`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Chấm công tại công trường" }).waitFor();
    const search = page.getByPlaceholder("Tìm tên, mã nhân viên, công trường");
    await search.fill("Phạm");
    await search.clear();
    const attendance = await page.evaluate(() => {
      const table = document.querySelector('table[class*="table"]');
      const mobileList = document.querySelector('[class*="mobileList"]');
      const projectHeading = document.querySelector('h1');
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        hasHorizontalProjectHeader: Boolean(projectHeading?.textContent?.includes("CT-")),
        hasSummary: document.body.innerText.includes("Tình hình chấm công") && document.body.innerText.includes("Thống kê tuần này"),
        tableVisible: table ? getComputedStyle(table).display !== "none" && getComputedStyle(table.parentElement).display !== "none" : false,
        cardsVisible: mobileList ? getComputedStyle(mobileList).display !== "none" : false
      };
    });
    const rightComposition = viewport.width <= 767 ? attendance.cardsVisible : attendance.tableVisible;
    if (attendance.content > attendance.viewport || !attendance.hasHorizontalProjectHeader || !attendance.hasSummary || !rightComposition) throw new Error(`Chấm công sai layout ${viewport.width}: ${JSON.stringify(attendance)}`);
    await page.screenshot({ path: path.join(output, `attendance-${viewport.width}x${viewport.height}.png`), fullPage: true, caret: "initial" });
    if (browserErrors.length) throw new Error(`Browser console ${viewport.width}: ${browserErrors.join(" | ")}`);
    await context.close();
    console.log(`PASS ERP workspace ${viewport.width}x${viewport.height}`);
  }
} finally {
  await browser.close();
}

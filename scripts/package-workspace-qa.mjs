import { getTestPassword } from "./testing/password.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const projectId = process.env.UI_QA_PROJECT_ID || "b0000000-0000-4000-8000-000000000001";
const edgePath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.join(process.cwd(), "docs", "ui-evidence", "two-screen-audit");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('[name="username"]').fill("test.supervisor");
    await page.locator('[name="password"]').fill(getTestPassword());
    await Promise.all([
      page.waitForURL(/\/dashboard/),
      page.getByRole("button", { name: /Đăng nhập/i }).click()
    ]);

    await page.goto(`${baseUrl}/projects`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Gói / Công trường" }).waitFor({ state: "visible" });
    const portfolioLayout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      hasSummary: document.body.innerText.includes("Đang hoạt động") && document.body.innerText.includes("Nhân sự phân công")
    }));
    if (portfolioLayout.content > portfolioLayout.viewport || !portfolioLayout.hasSummary) throw new Error(`Danh sách gói sai layout: ${JSON.stringify(portfolioLayout)}`);
    await page.screenshot({ path: path.join(output, `after-projects-list-${viewport.width}x${viewport.height}.png`), fullPage: true });

    await page.goto(`${baseUrl}/projects/${projectId}/progress`, { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", { name: viewport.width < 768 ? "Thao tác hiện trường" : "Không gian làm việc gói" });
    const labels = await nav.getByRole("link").allTextContents();
    const expectedLabels = viewport.width < 768 ? "Hôm nay|Công việc|Cập nhật|Nhân lực|Thông tin" : "Hôm nay|Công việc|Nhân lực|Thông tin|Tài liệu";
    if (labels.map((value) => value.trim()).join("|") !== expectedLabels) throw new Error(`Sai WorkspaceNav: ${labels.join("|")}`);
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      statCards: document.querySelectorAll(".stat-card").length,
      hasConstructionHeading: [...document.querySelectorAll("h2")].some((item) => item.textContent?.trim() === "Công việc"),
      hasSearch: Boolean(document.querySelector('input[type="search"]')),
      hasStatusFilter: Boolean(document.querySelector("select")),
      repeatedScheduleRows: document.querySelectorAll('[class*="lookaheadList"] article').length
    }));
    if (layout.content > layout.viewport) throw new Error(`Thi công tràn ngang ${viewport.width}px: ${layout.content}px > ${layout.viewport}px`);
    if (!layout.hasConstructionHeading) throw new Error(`Thiếu nội dung Thi công: ${JSON.stringify(layout)}`);
    if (!layout.hasSearch || !layout.hasStatusFilter || layout.repeatedScheduleRows !== 0) throw new Error(`Thiếu công cụ thao tác công việc: ${JSON.stringify(layout)}`);
    if (viewport.width === 390) {
      const sizes = await nav.getByRole("link").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
      if (sizes.some((height) => height < 44)) throw new Error(`Touch target tab dưới 44px: ${sizes.join(",")}`);
    }
    await page.screenshot({ path: path.join(output, `after-project-progress-${viewport.width}x${viewport.height}.png`), fullPage: true });

    await page.goto(`${baseUrl}/projects/${projectId}/team`, { waitUntil: "networkidle" });
    const attendance = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      statCards: document.querySelectorAll(".stat-card").length,
      hasHeading: [...document.querySelectorAll("h2")].some((item) => item.textContent?.trim() === "Chấm công tại công trường"),
      hasSummary: [...document.querySelectorAll("h3")].some((item) => item.textContent?.trim() === "Tình hình chấm công")
    }));
    if (attendance.content > attendance.viewport) throw new Error(`Chấm công tràn ngang ${viewport.width}px`);
    if (attendance.statCards !== 0 || !attendance.hasHeading || !attendance.hasSummary) throw new Error(`Chấm công thiếu nội dung vận hành: ${JSON.stringify(attendance)}`);
    await page.screenshot({ path: path.join(output, `package-workspace-attendance-${viewport.width}x${viewport.height}.png`), fullPage: true });

    await page.goto(`${baseUrl}/projects/${projectId}/profile`, { waitUntil: "networkidle" });
    const records = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      hasHeading: [...document.querySelectorAll("h2")].some((item) => item.textContent?.trim() === "Thông tin gói"),
      hasCustomer: document.body.innerText.includes("Khách hàng"),
      hasDetachedInfoButton: [...document.querySelectorAll("button")].some((item) => item.textContent?.trim() === "Thông tin gói")
    }));
    if (records.content > records.viewport || !records.hasHeading || !records.hasCustomer || records.hasDetachedInfoButton) throw new Error(`Thông tin gói sai layout: ${JSON.stringify(records)}`);
    await page.screenshot({ path: path.join(output, `package-workspace-records-${viewport.width}x${viewport.height}.png`), fullPage: true });

    await page.goto(`${baseUrl}/projects/${projectId}/documents`, { waitUntil: "networkidle" });
    const documents = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      search: Boolean(document.querySelector('input[type="search"]')),
      filter: Boolean(document.querySelector("select"))
    }));
    if (documents.content > documents.viewport || !documents.search || !documents.filter) throw new Error(`Tài liệu sai workspace: ${JSON.stringify(documents)}`);
    await page.screenshot({ path: path.join(output, `package-workspace-documents-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await context.close();
    console.log(`PASS package workspace ${viewport.width}x${viewport.height}`);
  }
} finally {
  await browser.close();
}

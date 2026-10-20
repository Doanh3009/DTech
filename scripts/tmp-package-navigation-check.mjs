import { getTestPassword } from "./testing/password.mjs";
import { chromium } from "playwright-core";

const baseUrl = "http://localhost:3000";
const projectId = "b0000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('[name="username"]').fill("test.supervisor");
    await page.locator('[name="password"]').fill(getTestPassword());
    await Promise.all([
      page.waitForURL((url) => url.pathname !== "/login"),
      page.getByRole("button", { name: "Đăng nhập" }).click()
    ]);

    for (const section of ["today", "progress", "team", "profile"]) {
      await page.goto(`${baseUrl}/projects/${projectId}/${section}`, { waitUntil: "networkidle" });
      const state = await page.evaluate(({ projectId, section }) => ({
        path: window.location.pathname,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        packageShell: document.querySelector(".app-content--package") !== null,
        projectPreserved: window.location.pathname === `/projects/${projectId}/${section}`
      }), { projectId, section });
      if (state.overflow || !state.packageShell || !state.projectPreserved) throw new Error(`${viewport.width} ${section}: ${JSON.stringify(state)}`);
    }

    await page.goto(`${baseUrl}/projects/${projectId}/progress`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `.tmp-package-progress-${viewport.width}.png`, fullPage: true });
    const labels = viewport.width < 768 ? ["Hôm nay", "Công việc", "Nhân lực", "Thông tin"] : ["Hôm nay", "Công việc", "Nhân lực", "Thông tin", "Tài liệu"];
    for (const label of labels) {
      const navName = viewport.width < 768 ? "Thao tác hiện trường" : "Không gian làm việc gói";
      const link = page.getByRole("navigation", { name: navName }).getByRole("link", { name: label, exact: true });
      const href = await link.getAttribute("href");
      if (!href?.startsWith(`/projects/${projectId}/`)) throw new Error(`${label} thoát khỏi dự án: ${href}`);
    }
    if (errors.length) throw new Error(`${viewport.width} runtime: ${errors.join(" | ")}`);
    console.log(`PASS ${viewport.width}x${viewport.height}`);
    await context.close();
  }
} finally {
  await browser.close();
}

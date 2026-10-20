import { getTestPassword } from "./testing/password.mjs";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const browserPath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const password = getTestPassword();
const scenarios = [
  {
    username: "test.supervisor",
    routes: [
      ["/dashboard", "Nguyễn Minh Giám Sát"],
      ["/projects", "Bảo trì hệ thống ray Cảng ABC"],
      ["/projects/b0000000-0000-4000-8000-000000000001/team", "Chấm công"],
      ["/worker-attendance", "Điểm danh"], ["/notifications", "Thông báo"]
    ],
    apis: [
      "/api/v1/dashboard",
      "/api/v1/projects", "/api/v1/projects/b0000000-0000-4000-8000-000000000001",
      "/api/v1/worker-attendance/today", "/api/v1/notifications"
    ],
    deniedPages: ["/employees", "/employees/90000000-0000-4000-8000-000000000001/projects", "/attendance/today", "/attendance/logs", "/timesheets"],
    deniedApis: ["/api/v1/employees", "/api/v1/employees/90000000-0000-4000-8000-000000000002", "/api/v1/attendance/records?employeeId=90000000-0000-4000-8000-000000000002"]
  },
  {
    username: "test.employee",
    routes: [
      ["/dashboard", "Trần Thu Nhân Viên"], ["/attendance/me", "Chấm công"], ["/attendance/history", "Lịch công của tôi"],
      ["/leave", "Nghỉ phép"], ["/profile", "Cá nhân"], ["/notifications", "Thông báo"]
    ],
    apis: [
      "/api/v1/dashboard", "/api/v1/attendance/dashboard", "/api/v1/attendance/history",
      "/api/v1/timesheet-periods", "/api/v1/leave-requests?scope=self", "/api/v1/notifications"
    ],
    deniedPages: ["/employees", "/attendance/today", "/attendance/logs", "/timesheets", "/timesheets/matrix"],
    deniedApis: ["/api/v1/employees", "/api/v1/employees/90000000-0000-4000-8000-000000000001", "/api/v1/hr/departments", "/api/v1/hr/contracts", "/api/v1/projects"]
  }
];

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
let failed = false;
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(`pageerror:${error.message}`));
    page.on("response", (response) => { if (response.status() >= 500) runtimeErrors.push(`http:${response.status()}:${new URL(response.url()).pathname}`); });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('[name="username"]').fill(scenario.username);
    await page.locator('[name="password"]').fill(password);
    await Promise.all([page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 }), page.getByRole("button", { name: "Đăng nhập" }).click()]);
    console.log(`PASS login ${scenario.username}`);

    for (const [route, expectedText] of scenario.routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.getByText(expectedText, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      const body = await page.locator("body").innerText();
      const layout = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      if (!response || response.status() >= 400) throw new Error(`${scenario.username} ${route} HTTP ${response?.status()}`);
      if (!body.includes(expectedText)) throw new Error(`${scenario.username} ${route} thiếu nội dung ${expectedText}`);
      if (body.includes("Bạn cần đăng nhập để tiếp tục")) throw new Error(`${scenario.username} ${route} mất phiên`);
      if (layout.content > layout.viewport) throw new Error(`${scenario.username} ${route} tràn ngang ${layout.content}/${layout.viewport}`);
      if (scenario.username === "test.supervisor" && route.endsWith("/team")) {
        const topbar = await page.evaluate(() => {
          const header = document.querySelector(".app-header")?.getBoundingClientRect();
          const search = document.querySelector(".app-header__search")?.getBoundingClientRect();
          const actions = document.querySelector(".app-header__actions")?.getBoundingClientRect();
          return header && search && actions ? {
            headerHeight: header.height,
            sameRow: Math.abs(search.top - actions.top) <= 2,
            actionsInside: actions.bottom <= header.bottom + 1
          } : null;
        });
        if (!topbar || topbar.headerHeight > 61 || !topbar.sameRow || !topbar.actionsInside) {
          throw new Error(`topbar desktop bị xuống hàng: ${JSON.stringify(topbar)}`);
        }
        if (await page.locator(".app-header .quick-create").count()) throw new Error("Global create actions must remain in their owning page");
        console.log("PASS desktop topbar and page-owned actions");
      }
      console.log(`PASS page ${scenario.username} ${route}`);
    }
    for (const route of scenario.deniedPages) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Không có quyền truy cập", exact: true }).waitFor({ timeout: 15_000 });
      console.log(`PASS denied page ${scenario.username} ${route}`);
    }
    for (const route of scenario.apis) {
      const response = await page.request.get(`${baseUrl}${route}`);
      const body = await response.text();
      if (!response.ok()) throw new Error(`${scenario.username} ${route} HTTP ${response.status()} ${body.slice(0, 180)}`);
      if (!("data" in JSON.parse(body))) throw new Error(`${scenario.username} ${route} thiếu data envelope`);
      console.log(`PASS api ${scenario.username} ${route}`);
    }
    for (const route of scenario.deniedApis) {
      const response = await page.request.get(`${baseUrl}${route}`);
      if (response.status() !== 403) throw new Error(`${scenario.username} ${route} phải trả 403, thực tế ${response.status()}`);
      console.log(`PASS denied ${scenario.username} ${route}`);
    }
    if (scenario.username === "test.supervisor") {
      const preferencesLoaded = page.waitForResponse((response) =>
        response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/workspace/preferences"
      );
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      const preferencesResponse = await preferencesLoaded;
      if (!preferencesResponse.ok()) throw new Error(`workspace preferences GET HTTP ${preferencesResponse.status()}`);
      const preferencesBody = await preferencesResponse.json();
      const initialPreferences = preferencesBody.data;
      if (!initialPreferences) throw new Error("workspace preferences response missing data");

      const rail = page.locator(".app-rail");
      await rail.waitFor({ state: "visible", timeout: 15_000 });
      const initiallyCollapsed = await rail.evaluate((element) => element.classList.contains("is-collapsed"));
      const initialLabel = initiallyCollapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng";
      const toggledLabel = initiallyCollapsed ? "Thu gọn điều hướng" : "Mở rộng điều hướng";
      await page.getByRole("button", { name: initialLabel }).waitFor({ state: "visible", timeout: 15_000 });
      const toggleSaved = page.waitForResponse((response) =>
        response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/workspace/preferences"
      );
      await page.getByRole("button", { name: initialLabel }).click();
      const toggleResponse = await toggleSaved;
      if (!toggleResponse.ok()) throw new Error(`workspace preferences PUT HTTP ${toggleResponse.status()}`);
      const preferencesReloadedAfterToggle = page.waitForResponse((response) =>
        response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/workspace/preferences"
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await preferencesReloadedAfterToggle;
      await page.getByRole("button", { name: toggledLabel }).waitFor({ state: "visible", timeout: 15_000 });

      const restoreResponse = await page.request.put(`${baseUrl}/api/v1/workspace/preferences`, {
        data: initialPreferences
      });
      if (!restoreResponse.ok()) throw new Error(`workspace preferences restore HTTP ${restoreResponse.status()}`);
      await page.evaluate((compact) => {
        const keys = Object.keys(localStorage).filter((key) => key.startsWith("ct:sidebar-layout:v2:"));
        for (const key of keys) localStorage.setItem(key, compact ? "compact" : "expanded");
      }, initiallyCollapsed);
      const preferencesReloadedAfterRestore = page.waitForResponse((response) =>
        response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/workspace/preferences"
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await preferencesReloadedAfterRestore;
      await page.getByRole("button", { name: initialLabel }).waitFor({ state: "visible", timeout: 15_000 });
      console.log("PASS sidebar preference persists after reload and is restored");
    }
    if (runtimeErrors.length) throw new Error(`${scenario.username} runtime errors: ${runtimeErrors.join(", ")}`);
    await context.close();
  }

  const overlayContext = await browser.newContext({ viewport: { width: 1033, height: 243 }, locale: "vi-VN" });
  const overlayPage = await overlayContext.newPage();
  await overlayPage.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await overlayPage.locator('[name="username"]').fill("test.payroll");
  await overlayPage.locator('[name="password"]').fill(password);
  await Promise.all([overlayPage.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000 }), overlayPage.getByRole("button", { name: "Đăng nhập" }).click()]);
  const payrollResponse = await overlayPage.goto(`${baseUrl}/accounting/payroll/98400000-0000-4000-8000-000000000001`, { waitUntil: "domcontentloaded" });
  if (!payrollResponse || payrollResponse.status() >= 400) throw new Error(`payroll detail HTTP ${payrollResponse?.status()}`);
  const payrollApi = await overlayPage.request.get(`${baseUrl}/api/v1/accounting/payroll/98400000-0000-4000-8000-000000000001`);
  if (!payrollApi.ok()) throw new Error(`payroll detail API HTTP ${payrollApi.status()} ${await payrollApi.text()}`);
  await overlayPage.locator(".data-table tbody .data-table__actions").first().waitFor({ state: "visible", timeout: 15_000 });
  const overlap = await overlayPage.evaluate(() => {
    const action = document.querySelector(".data-table tbody .data-table__actions")?.getBoundingClientRect();
    const launcher = document.querySelector(".chat-dock-launcher")?.getBoundingClientRect();
    if (!action || !launcher) return { verified: false, overlap: false };
    return {
      verified: true,
      overlap: action.left < launcher.right && action.right > launcher.left && action.top < launcher.bottom && action.bottom > launcher.top
    };
  });
  if (!overlap.verified || overlap.overlap) throw new Error(`chat launcher che thao tác bảng lương tại 1033x243: ${JSON.stringify(overlap)}`);
  console.log("PASS fixed chat launcher does not cover payroll actions at 1033x243");
  await overlayContext.close();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator('[name="username"]').fill("test.employee");
  await page.locator('[name="password"]').fill(password);
  await Promise.all([page.waitForURL(/\/personal(?:$|\?)/, { timeout: 20_000 }), page.getByRole("button", { name: "Đăng nhập" }).click()]);
  for (const route of ["/personal", "/attendance/me", "/leave", "/profile"]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    const layout = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    if (layout.content > layout.viewport) throw new Error(`mobile ${route} tràn ngang ${layout.content}/${layout.viewport}`);
    if (await page.locator('.mobile-bottom-nav a[aria-current="page"]').count() !== 1) throw new Error(`mobile ${route} cần đúng một mục điều hướng đang chọn`);
    console.log(`PASS mobile ${route}`);
  }
  await context.close();
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.stack : String(error));
} finally {
  await browser.close();
}
if (failed) process.exit(1);

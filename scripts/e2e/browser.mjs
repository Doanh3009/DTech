import { readdir } from "node:fs/promises";
import path from "node:path";
import { observePage, pageContent } from "./page-ready.mjs";

async function staticRoutes(directory, segments = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes = entries.some((entry) => entry.name === "page.tsx") ? [`/${segments.join("/")}`] : [];
  for (const entry of entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.includes("["))) {
    const routeSegments = /^\(.+\)$/.test(entry.name) ? segments : [...segments, entry.name];
    routes.push(...await staticRoutes(path.join(directory, entry.name), routeSegments));
  }
  return routes;
}

export async function registerBrowserCases(s) {
  const { test, assert, state, need } = s;
  async function screen(route, width, role = "admin") {
    const context = s.context(role);
    const page = await context.newPage();
    const observer = observePage(page);
    try {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      const response = await page.goto(s.baseUrl + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      assert(response && response.status() < 400, `${route}: HTTP ${response?.status()}`);
      await observer.ready();
      const content = pageContent(page);
      const text = await content.innerText();
      assert(!/Không có quyền truy cập|Có lỗi xảy ra|Không thể tải|Application error/.test(text), `${route}: ${text.slice(0, 300)}`);
      assert.equal(await content.locator(".state-box--error").count(), 0);
      const layout = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
      assert(layout.content <= layout.viewport + 1, `${route}: tràn ngang ${layout.content}/${layout.viewport}`);
      assert.deepEqual(observer.errors, [], `${route}: runtime errors`);
      return page;
    } catch (error) {
      await page.screenshot({ path: path.join(s.output, `fail-${route.replaceAll("/", "_")}-${width}.png`), fullPage: true }).catch(() => undefined);
      await page.close();
      throw error;
    }
  }
  const routes = (await staticRoutes(path.resolve("src/app/(app)"))).sort();
  s.report.staticRouteCount = routes.length;
  for (const [index, route] of routes.entries()) {
    test(`SCREEN-${String(index + 1).padStart(3, "0")}`, `Mở ${route} trên desktop và điện thoại`, async () => {
      for (const width of [1440, 390]) {
        const page = await screen(route, width);
        await page.close();
      }
    }, "BROWSER");
  }
  for (const width of [360, 390, 430, 1366, 1440, 1920]) {
    test(`SHELL-${width}`, `Khung cấu hình ${width}px và một viền focus`, async () => {
      const page = await screen("/settings", width);
      try {
        const requests = [];
        page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/v1/settings-catalog") requests.push(request.url()); });
        const input = page.getByRole("searchbox", { name: "Tìm cài đặt", exact: true });
        await input.focus();
        const focus = await input.evaluate((element) => ({ outline: getComputedStyle(element).outlineStyle, border: getComputedStyle(element).borderTopWidth, parentRing: getComputedStyle(element.parentElement).boxShadow }));
        assert.equal(focus.outline, "none"); assert.equal(focus.border, "0px"); assert.notEqual(focus.parentRing, "none");
        const start = performance.now();
        await input.fill("ZZZ_NO_SETTING_E2E");
        await page.getByRole("heading", { name: "Không tìm thấy cài đặt", exact: true }).waitFor({ timeout: 3000 });
        s.report.timings.push({ route: "/settings", kind: "local-filter", width, ms: Math.round(performance.now() - start), catalogRequests: requests.length });
        await input.fill("");
        await page.locator(".settings-groups").waitFor();
        assert.equal(requests.length, 0, "Tìm kiếm cấu hình không cần gọi lại server");
        await page.screenshot({ path: path.join(s.output, `settings-${width}.png`), fullPage: true });
      } finally { await page.close(); }
    }, "BROWSER");
  }
  test("UI-PERSONAL", "Nhân viên chỉ thấy Cá nhân và mở phiếu lương từ Cá nhân", async () => {
    need("payslip");
    const page = await screen("/personal", 390, "employee");
    try {
      const link = page.locator('.personal-home__links a[href="/personal/payslips"]');
      await link.click();
      await page.waitForURL((url) => url.pathname === "/personal/payslips");
      await page.getByRole("heading", { name: "Phiếu lương của tôi", exact: true }).waitFor();
      assert.equal(await page.locator('.app-rail a[href^="/accounting"]').count(), 0);
      const detail = await s.api("employee", "GET", `/api/v1/accounting/payslips/${state.payslip.id}`);
      assert.equal(detail.employeeId, s.people.employee.employeeId);
      await page.goto(`${s.baseUrl}/personal/payslips/${state.payslip.id}`);
      await page.getByRole("heading", { name: "Chi tiết phiếu lương", exact: true }).waitFor();
      await page.screenshot({ path: path.join(s.output, "employee-payslip-390.png"), fullPage: true });
    } finally { await page.close(); }
  }, "BROWSER");
  test("UI-PAYROLL", "Bảng lương lên cao và thao tác có thể chạm trên điện thoại", async () => {
    need("payroll");
    const page = await screen(`/accounting/payroll/${state.payroll.id}`, 1440, "accountant");
    try {
      await page.locator(".data-table tbody tr").first().waitFor();
      const table = await page.locator(".data-table").boundingBox();
      assert(table && table.y < 400, `Bảng bị đẩy xuống ${table?.y}px`);
      assert.equal(await page.getByRole("heading", { name: /^Bảng lương tháng / }).count(), 1);
      await page.screenshot({ path: path.join(s.output, "payroll-1440.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('[aria-label="Lương nhân viên"]:visible').waitFor();
      assert.equal(await pageContent(page).locator(".mobile-record:visible").count(), 0, "Bảng lương không hiển thị trùng thẻ nhân viên trên điện thoại");
      const employeeName = `[E2E ${s.fixture.manifest.runId}] employee`;
      const visibleEmployeeCount = await pageContent(page).getByText(employeeName, { exact: true }).evaluateAll((elements) => elements.filter((element) => element.getClientRects().length > 0).length);
      assert.equal(visibleEmployeeCount, 1, "Nhân viên E2E chỉ hiển thị một lần trong bảng lương điện thoại");
      const sizes = await pageContent(page).locator(".button:visible").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      assert(sizes.every((size) => size >= 44));
      await page.screenshot({ path: path.join(s.output, "payroll-390.png"), fullPage: true });
    } finally { await page.close(); }
  }, "BROWSER");
  test("UI-HR-CREATE", "Nhân sự tạo hồ sơ bằng form trình duyệt và mở hồ sơ vừa tạo", async () => {
    const page = await s.page("hr", "/employees/new");
    try {
      await page.locator('[name="employeeCode"]').fill(`${s.fixture.prefix}_UI`);
      await page.locator('[name="fullName"]').fill(`[E2E] Nhân viên tạo trên trình duyệt`);
      for (const [field, label] of [["departmentId", "Phòng ban"], ["positionId", "Chức vụ"], ["employmentTypeId", "Nhóm làm việc"]]) {
        const native = page.locator(`select[name="${field}"]`);
        const control = page.locator(".select-control").filter({ has: native });
        await control.getByRole("combobox", { name: label, exact: true }).click();
        await page.getByRole("listbox", { name: label, exact: true }).getByRole("option").filter({ hasNotText: /^Chọn/ }).first().click();
        assert(await native.inputValue(), `Chưa chọn ${label}`);
      }
      const response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/employees" && response.request().method() === "POST");
      await page.getByRole("button", { name: /Lưu/ }).last().click();
      const saved = await response;
      const body = await saved.json();
      assert.equal(saved.status(), 201, body.error?.message);
      await s.fixture.track("employees", body.data.employee.id);
      await page.waitForURL((url) => url.pathname.includes(body.data.employee.id));
      await page.getByText("Nhân viên tạo trên trình duyệt", { exact: false }).first().waitFor();
    } finally { await page.close(); }
  }, "BROWSER");
  test("UI-AUTH", "Đăng nhập bằng form, đăng xuất và không dùng lại phiên được", async () => {
    const context = await s.newContext();
    const page = await context.newPage();
    try {
      await page.goto(s.baseUrl + "/login");
      await page.locator('[name="username"]').fill(s.people.employee.username);
      await page.locator('[name="password"]').fill(s.fixture.password);
      await Promise.all([page.waitForURL((url) => url.pathname !== "/login"), page.getByRole("button", { name: "Đăng nhập", exact: true }).click()]);
      const response = await context.request.post(s.baseUrl + "/api/v1/auth/logout");
      assert.equal(response.status(), 200);
      await page.goto(s.baseUrl + "/personal");
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 30000 });
      assert.equal(new URL(page.url()).pathname, "/login");
      const sessions = await context.request.get(s.baseUrl + "/api/v1/auth/sessions");
      assert.equal(sessions.status(), 401);
    } finally { await context.close(); }
  }, "BROWSER");
}

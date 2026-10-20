import path from "node:path";
import { projectIds } from "../testing/projects.mjs";
import { observePage, pageContent } from "./page-ready.mjs";

export function registerTesterCases(s) {
  const { test, assert } = s;
  const newContext = () => s.browser.newContext({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh", httpCredentials: process.env.APP_ENV === "staging" ? { username: process.env.STAGING_ACCESS_USER, password: process.env.STAGING_ACCESS_PASSWORD } : undefined });
  async function gate(context) {
    const response = await context.request.post(s.baseUrl + "/api/testing/access", { data: { secret: process.env.TEST_TOOLS_GATE_SECRET } });
    assert.equal(response.status(), 200);
  }
  async function switchAccount(context, username) {
    const response = await context.request.post(s.baseUrl + "/api/testing/login", { data: { username } });
    assert.equal(response.status(), 200, (await response.json()).error?.message);
  }
  async function switchFromPicker(page, observer, label, username) {
    const selector = page.getByRole("combobox", { name: "Chuyển tài khoản kiểm thử", exact: true });
    if (!await selector.isVisible()) await page.getByRole("button", { name: "Kiểm thử", exact: true }).click();
    await selector.waitFor();
    const [loginResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/testing/login" && response.request().method() === "POST"),
      (async () => {
        if (await selector.evaluate((element) => element.tagName === "SELECT")) await selector.selectOption({ label });
        else {
          await selector.click();
          await page.getByRole("listbox", { name: "Chuyển tài khoản kiểm thử", exact: true }).getByRole("option", { name: label, exact: true }).click();
        }
      })()
    ]);
    assert.equal(loginResponse.status(), 200);
    await page.waitForLoadState("load");
    await observer.ready();
    if (!await selector.isVisible()) await page.getByRole("button", { name: "Kiểm thử", exact: true }).click();
    await page.locator(".test-account-picker header").getByText(username, { exact: true }).waitFor();
    await page.locator(".test-account-picker__accounts").waitFor();
  }
  test("TESTER-01", "Thiếu cổng tester thì API đăng nhập nhanh bị chặn", async () => {
    const context = await newContext();
    try {
      const list = await context.request.get(s.baseUrl + "/api/testing/accounts"); assert.equal(list.status(), 401);
      const login = await context.request.post(s.baseUrl + "/api/testing/login", { data: { username: "admin.test" } }); assert.equal(login.status(), 401);
    } finally { await context.close(); }
  }, "BROWSER + API");
  test("TESTER-02", "Mở cổng tester và đăng nhập nhanh bằng nút trên điện thoại", async () => {
    const context = await newContext(), page = await context.newPage();
    const observer = observePage(page);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(s.baseUrl + "/login");
      await page.getByLabel("Mã truy cập tester").fill(process.env.TEST_TOOLS_GATE_SECRET);
      await page.getByRole("button", { name: "Mở kiểm thử", exact: true }).click();
      await page.getByRole("button", { name: "Nhân viên", exact: true }).waitFor();
      await Promise.all([page.waitForURL((url) => url.pathname === "/personal"), page.getByRole("button", { name: "Nhân viên", exact: true }).click()]);
      await page.getByRole("button", { name: "Kiểm thử", exact: true }).click();
      await page.getByText("employee.test", { exact: true }).first().waitFor();
      await observer.ready();
      await page.locator(".test-account-picker__accounts").waitFor();
      assert.equal(await page.getByLabel("Mã truy cập tester").count(), 0, "Cổng tester đã mở không yêu cầu nhập mã lại sau khi chuyển tài khoản");
      for (const width of [360, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const picker = await page.locator(".test-account-picker--compact").boundingBox();
        assert(picker && picker.height <= 176, `Bộ chọn tài khoản chiếm quá nhiều chiều cao: ${picker?.height}px tại ${width}px`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
      }
      await context.storageState({ path: path.join(s.output, "employee-storage-state.json") });
      await page.screenshot({ path: path.join(s.output, "test-switcher-390.png"), fullPage: true });
    } finally { await context.close(); }
  }, "BROWSER");
  test("TESTER-03", "Chuyển admin → nhân viên thu hồi phiên trước và tải lại đúng quyền", async () => {
    const context = await newContext();
    try {
      await gate(context); await switchAccount(context, "admin.test");
      const previousState = await context.storageState();
      const admin = await context.request.get(s.baseUrl + "/api/v1/settings-catalog"); assert.equal(admin.status(), 200);
      await switchAccount(context, "employee.test");
      const denied = await context.request.get(s.baseUrl + "/api/v1/settings-catalog"); assert.equal(denied.status(), 403);
      const old = await s.browser.newContext({ storageState: previousState, httpCredentials: process.env.APP_ENV === "staging" ? { username: process.env.STAGING_ACCESS_USER, password: process.env.STAGING_ACCESS_PASSWORD } : undefined });
      try { const revoked = await old.request.get(s.baseUrl + "/api/v1/auth/sessions"); assert.equal(revoked.status(), 401); }
      finally { await old.close(); }
      const page = await context.newPage(), observer = observePage(page);
      await page.goto(s.baseUrl + "/personal"); await observer.ready();
      await switchFromPicker(page, observer, "Kế toán", "accountant.test");
      const payrollAccess = await context.request.get(s.baseUrl + "/api/v1/accounting/salaries"); assert.equal(payrollAccess.status(), 200);
      const accountantState = await context.storageState();
      await switchFromPicker(page, observer, "Nhân viên", "employee.test");
      const salaryDenied = await context.request.get(s.baseUrl + "/api/v1/accounting/salaries"); assert.equal(salaryDenied.status(), 403);
      const oldAccountant = await s.browser.newContext({ storageState: accountantState, httpCredentials: process.env.APP_ENV === "staging" ? { username: process.env.STAGING_ACCESS_USER, password: process.env.STAGING_ACCESS_PASSWORD } : undefined });
      try { const revoked = await oldAccountant.request.get(s.baseUrl + "/api/v1/auth/sessions"); assert.equal(revoked.status(), 401); }
      finally { await oldAccountant.close(); }
      await page.reload(); await observer.ready();
      assert.equal(await page.locator('.app-rail a[href^="/system-admin"], .app-rail a[href^="/accounting"]').count(), 0);
    } finally { await context.close(); }
  }, "BROWSER + API");
  test("TESTER-04", "Kỹ sư chỉ truy cập gói được phân công, API gói khác trả 404", async () => {
    const context = await newContext();
    try {
      await gate(context); await switchAccount(context, "engineer.test");
      const own = await context.request.get(`${s.baseUrl}/api/v1/projects/${projectIds[0]}`); assert.equal(own.status(), 200);
      const other = await context.request.get(`${s.baseUrl}/api/v1/projects/${projectIds[1]}`); assert.equal(other.status(), 404);
      for (const width of [360, 390, 430, 844]) {
        const page = await context.newPage(), observer = observePage(page);
        await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
        await page.goto(`${s.baseUrl}/projects/${projectIds[0]}/today`); await observer.ready();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
        await page.screenshot({ path: path.join(s.output, `package-${width}.png`), fullPage: true });
        await page.close();
      }
      await switchAccount(context, "engineer02.test");
      const oldProject = await context.request.get(`${s.baseUrl}/api/v1/projects/${projectIds[0]}`); assert.equal(oldProject.status(), 404);
      const newProject = await context.request.get(`${s.baseUrl}/api/v1/projects/${projectIds[1]}`); assert.equal(newProject.status(), 200);
    } finally { await context.close(); }
  }, "BROWSER + API");
  test("TESTER-05", "Request sửa role không nâng quyền và tài khoản ngoài whitelist bị chặn", async () => {
    const context = await newContext();
    try {
      await gate(context);
      const forged = await context.request.post(s.baseUrl + "/api/testing/login", { data: { username: "employee.test", role: "admin" } }); assert.equal(forged.status(), 400);
      const real = await context.request.post(s.baseUrl + "/api/testing/login", { data: { username: "real.admin" } }); assert.equal(real.status(), 403);
    } finally { await context.close(); }
  }, "API");
  test("TESTER-06", "API chậm hiển thị trạng thái tải rồi trả dữ liệu; offline có phản hồi", async () => {
    const context = await newContext(), page = await context.newPage();
    const observer = observePage(page);
    let releaseResponse;
    const heldResponse = new Promise((resolve) => { releaseResponse = resolve; });
    const isPayslipRequest = (request) => request.method() === "GET" && new URL(request.url()).pathname === "/api/v1/accounting/payslips";
    try {
      await gate(context); await switchAccount(context, "employee.test");
      await page.route((url) => url.pathname === "/api/v1/accounting/payslips", async (route) => {
        if (isPayslipRequest(route.request())) await heldResponse;
        await route.continue();
      });
      await Promise.all([
        page.waitForRequest(isPayslipRequest, { timeout: 30000 }),
        page.goto(s.baseUrl + "/personal/payslips", { waitUntil: "domcontentloaded" })
      ]);
      const content = pageContent(page);
      const loading = content.getByRole("status", { name: "Đang tải dữ liệu", exact: true });
      await loading.waitFor({ timeout: 10000 });
      assert.equal(await content.getByRole("heading", { name: "Chưa có phiếu lương", exact: true }).count(), 0);
      const loadedResponse = page.waitForResponse((response) => isPayslipRequest(response.request()), { timeout: 30000 });
      releaseResponse();
      const response = await loadedResponse;
      assert.equal(response.status(), 200);
      assert(Array.isArray((await response.json()).data), "Danh sách phiếu lương phải là một mảng");
      await observer.ready();
      await loading.waitFor({ state: "hidden", timeout: 30000 });
      await content.locator(".data-table-shell").waitFor({ timeout: 30000 });
      assert.equal(await content.locator(".state-box--error").count(), 0);
      assert.deepEqual(observer.errors, []);
      await context.setOffline(true);
      await page.locator('.connection-status[aria-label="Mất kết nối"]').waitFor({ timeout: 10000 });
      await context.setOffline(false);
    } finally { releaseResponse(); await context.setOffline(false).catch(() => undefined); await context.close(); }
  }, "BROWSER");
}

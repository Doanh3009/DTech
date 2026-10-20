import path from "node:path";
import { observePage } from "./page-ready.mjs";

export function registerReadOnlyCases(s) {
  const { test, assert, api } = s;
  const routes = {
    employee: ["/dashboard", "/personal", "/attendance/me", "/attendance/history", "/leave", "/leave/new", "/profile", "/personal/payslips", "/notifications", "/messages"],
    hr: ["/employees", "/employees/new", "/employees/departments", "/employees/positions", "/employees/contracts", "/employees/insurance", "/attendance/today", "/attendance/logs", "/timesheets", "/timesheets/exceptions", "/shifts", "/shifts/calendar", "/leave/manage"],
    accountant: ["/dashboard", "/accounting", "/accounting/payroll", "/accounting/salaries", "/accounting/salary-history", "/accounting/payslips"],
    supervisor: ["/dashboard", "/projects", "/worker-attendance", "/worker-attendance/today", "/project-monitoring"]
  };
  for (const [role, paths] of Object.entries(routes)) for (const route of paths) {
    test(`READ-${role}-${route.replaceAll("/", "_")}`, `${role} mở ${route} ở desktop/điện thoại`, async () => {
      const page = await s.context(role).newPage();
      const observer = observePage(page);
      try {
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
          const start = performance.now();
          const response = await page.goto(s.baseUrl + route, { waitUntil: "domcontentloaded", timeout: 60000 });
          assert(response?.ok(), `HTTP ${response?.status()}`);
          await observer.ready();
          const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, text: document.querySelector("main").innerText }));
          assert(layout.content <= layout.width + 1, `Tràn ngang ${layout.content}/${layout.width}`);
          assert(!/Không có quyền truy cập|Có lỗi xảy ra|Không thể tải dữ liệu|Application error/.test(layout.text), layout.text.slice(0, 240));
          assert.equal(await page.locator("main .state-box--error").count(), 0, "Dữ liệu trang bị lỗi");
          assert.deepEqual(observer.errors, []);
          const navigation = await page.evaluate(() => { const entry = performance.getEntriesByType("navigation")[0]; return { ttfbMs: Math.round(entry.responseStart - entry.requestStart), domMs: Math.round(entry.domContentLoadedEventEnd - entry.startTime) }; });
          s.report.timings.push({ role, route, width, readyMs: Math.round(performance.now() - start), ...navigation });
          if (["/dashboard", "/personal", "/accounting/payroll"].includes(route)) await page.screenshot({ path: path.join(s.output, `${role}-${route.replaceAll("/", "_")}-${width}.png`), fullPage: true });
        }
      } catch (error) {
        await page.screenshot({ path: path.join(s.output, `fail-${role}-${route.replaceAll("/", "_")}.png`), fullPage: true }).catch(() => undefined);
        throw error;
      } finally { await page.close(); }
    }, "BROWSER READ ONLY");
  }
  for (const [role, route] of [["employee", "/api/v1/employees"], ["employee", "/api/v1/accounting/salaries"], ["employee", "/api/v1/accounting/payroll"], ["employee", "/api/v1/warehouse/inventory"], ["employee", "/api/v1/shipments"], ["employee", "/api/v1/settings-catalog"]]) {
    test(`DENIED-${route.replaceAll("/", "_")}`, `Nhân viên bị chặn ${route}`, () => api(role, "GET", route, undefined, [403]));
  }
  test("READ-PERSONAL-PAYSLIP", "Phiếu lương nằm trong Cá nhân và không có ứng dụng Kế toán", async () => {
    const page = await s.page("employee", "/personal", 390);
    try {
      await page.locator('.personal-home__links a[href="/personal/payslips"]').waitFor();
      assert.equal(await page.locator('.app-rail a[href^="/accounting"]').count(), 0);
      const slips = await api("employee", "GET", "/api/v1/accounting/payslips?scope=self");
      assert(Array.isArray(slips));
    } finally { await page.close(); }
  }, "BROWSER READ ONLY");
  test("WRITE-COVERAGE", "Luồng ghi nghiệp vụ cần được phép chạy trên database test", () => { s.need("writeAuthorization"); }, "NOT EXECUTED");
}

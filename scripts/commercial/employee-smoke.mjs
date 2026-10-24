import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright-core";

const baseUrl = process.env.ERP_SITE_BASE_URL || "http://localhost:3100";
const output = process.env.ERP_AUDIT_OUTPUT || ".tmp/erp-p3-employee-browser";
const report = {
  generatedAt: new Date().toISOString(), results: [], checks: {},
  publishesConfiguration: false, writesOperationalData: false,
  scope: "Existing employee dynamic pages; all employee PATCH requests intercepted in the browser."
};
let browser;
let context;
let activePage;
let stage = "initialization";

function safePath(url) {
  return new URL(url).pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]");
}

async function capture(page, file) {
  // Full-page captures retain fixed elements at the current viewport position.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(output, file), fullPage: true });
}

try {
  assert(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "Employee browser acceptance requires localhost.");
  const credentials = parseEnv(await readFile(process.env.ERP_AUDIT_CREDENTIALS_FILE || ".env.admin.local", "utf8"));
  const username = credentials.BOOTSTRAP_ADMIN_USERNAME;
  const password = credentials.BOOTSTRAP_ADMIN_PASSWORD;
  assert(username && password, "Missing audit credentials.");
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", reducedMotion: "reduce" });
  let employeePath;
  let intercepted = 0;
  let rejectedUnexpectedWrites = 0;
  let simulatedStatus = 409;
  let lastCommand;
  // Install the write barrier before login or any employee page opens.
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())
      || (request.method() === "POST" && ["/api/v1/auth/login", "/api/v1/auth/logout"].includes(pathname))) {
      await route.continue();
      return;
    }
    if (request.method() === "PATCH" && pathname === employeePath) {
      intercepted += 1;
      lastCommand = request.postDataJSON();
      await route.fulfill({ status: simulatedStatus, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: simulatedStatus === 409 ? "CONFLICT" : "NETWORK_ERROR", message: simulatedStatus === 409 ? "Hồ sơ đã thay đổi. Tải lại hồ sơ." : "Kết quả kiểm tra kết nối." } }) });
      return;
    }
    rejectedUnexpectedWrites += 1;
    await route.abort("blockedbyclient");
  });

  stage = "authentication";
  const login = await context.newPage();
  login.setDefaultTimeout(30_000);
  await login.goto(`${baseUrl}/login`);
  await login.locator('input[name="username"]').fill(username);
  await login.locator('input[name="password"]').fill(password);
  const authenticated = login.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST");
  await login.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  assert.equal((await authenticated).status(), 200);
  await login.waitForURL("**/applications", { waitUntil: "domcontentloaded" });
  await login.close();

  stage = "read employee identity";
  const directory = await context.request.get(`${baseUrl}/api/v1/employees?pageSize=1`);
  assert.equal(directory.status(), 200);
  const employeeId = (await directory.json()).data.employees.items[0]?.id;
  assert(typeof employeeId === "string" && /^[0-9a-f-]{36}$/i.test(employeeId), "No existing employee available for read-only acceptance.");
  employeePath = `/api/v1/employees/${employeeId}`;

  for (const section of ["profile", "edit"]) {
    stage = `dynamic ${section} page`;
    const routeTemplate = `/employees/[id]/${section}`;
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(30_000);
    const errors = [];
    const apiFailures = [];
    page.on("pageerror", () => errors.push("runtime error"));
    page.on("response", (response) => {
      const normalized = safePath(response.url());
      if (response.url().startsWith(`${baseUrl}/api/`) && response.status() >= 400
        && !(response.status() === 404 && (normalized.endsWith("/avatar") || normalized === "/api/v1/workspace/avatar"))) {
        apiFailures.push({ path: normalized, status: response.status() });
      }
    });
    const response = await page.goto(`${baseUrl}/employees/${employeeId}/${section}`, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await page.locator("main h1").first().waitFor();
    if (section === "edit") {
      stage = "dynamic edit controls";
      for (const name of ["dateOfBirth", "gender", "joinDate", "permanentAddress"]) assert.equal(await page.locator(`[name="${name}"]`).count(), 1);
      assert.equal(await page.locator('select[name="employmentStatus"] option[value="terminated"]').count(), 1);
      const before = intercepted;
      stage = "dynamic edit empty submit";
      await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Cần có ít nhất một thông tin thay đổi." }).waitFor();
      assert.equal(intercepted, before);
      report.checks.emptySubmissionDoesNotSendCommand = true;
      report.checks.profileFieldsAndOffboardChoicePresent = true;
    }
    const viewports = [];
    stage = `dynamic ${section} responsive`;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      const viewport = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.equal(viewport.horizontalOverflow, false);
      viewports.push(viewport);
      await capture(page, `employee-${section}-${width}.png`);
    }
    stage = `dynamic ${section} runtime checks`;
    assert.deepEqual(errors, []);
    assert.deepEqual(apiFailures, []);
    report.results.push({ route: routeTemplate, destination: routeTemplate, routeKind: "dynamic", status: response.status(), ok: true, errors, apiFailures, viewports });
    await page.close();
  }

  for (const status of [409, 503]) {
    stage = `intercepted ${status} recovery`;
    simulatedStatus = status;
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(30_000);
    await page.setViewportSize({ width: status === 409 ? 1440 : 390, height: 1000 });
    await page.goto(`${baseUrl}/employees/${employeeId}/edit`, { waitUntil: "domcontentloaded" });
    const fullName = page.locator('input[name="fullName"]');
    await fullName.fill("Nhân sự kiểm tra giao diện");
    const before = intercepted;
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: status === 409 ? "Hồ sơ đã thay đổi." : "Chưa xác định được kết quả lưu." }).waitFor();
    assert.equal(intercepted, before + 1);
    assert.deepEqual(Object.keys(lastCommand).sort(), ["fullName", "rowVersion"]);
    assert(Number.isInteger(lastCommand.rowVersion));
    assert.equal(await fullName.inputValue(), "Nhân sự kiểm tra giao diện");
    assert.equal(await fullName.isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Tải lại hồ sơ", exact: true }).isEnabled(), true);
    await capture(page, `employee-simulated-${status}.png`);
    report.checks[status === 409 ? "conflictKeepsDraftAndRequiresReload" : "ambiguousFailureKeepsDraftAndRequiresReload"] = true;
    await page.close();
  }
  assert.equal(intercepted, 2);
  assert.equal(rejectedUnexpectedWrites, 0);
  report.checks.changedFieldsOnly = true;
  report.checks.allEmployeeWritesIntercepted = true;
  report.checks.operationalRecordsUnchanged = true;
  stage = "logout";
  assert.equal((await context.request.post(`${baseUrl}/api/v1/auth/logout`)).status(), 200);
  assert.equal((await context.request.get(`${baseUrl}/api/v1/employees?pageSize=1`)).status(), 401);
  report.checks.auditSessionRevoked = true;
  report.passed = true;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, dynamicRoutes: report.results.length, checks: report.checks, writesOperationalData: false }));
} catch (error) {
  // Never print Playwright call logs, employee URLs, request bodies or login details.
  report.passed = false;
  report.failure = { stage, type: error instanceof Error ? error.name : "unknown", message: "Employee browser acceptance failed; inspect the local UI and safe stage identifier." };
  await mkdir(output, { recursive: true }).catch(() => undefined);
  if (activePage && !activePage.isClosed()) await capture(activePage, "failure.png").catch(() => undefined);
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2)).catch(() => undefined);
  console.error(JSON.stringify({ passed: false, stage, writesOperationalData: false }));
  process.exitCode = 1;
} finally {
  if (context) await context.request.post(`${baseUrl}/api/v1/auth/logout`).catch(() => undefined);
  if (browser) await browser.close();
}

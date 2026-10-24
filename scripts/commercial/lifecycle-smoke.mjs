import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright-core";

const baseUrl = process.env.ERP_SITE_BASE_URL || "http://localhost:3100";
const output = process.env.ERP_AUDIT_OUTPUT || ".tmp/erp-p3b-lifecycle-browser";
const widths = [1440, 768, 390];
const report = {
  generatedAt: new Date().toISOString(), results: [], checks: {},
  publishesConfiguration: false, writesOperationalData: false,
  scope: "Existing user/employee pages and real read-only pending-operation API. All operational mutations are intercepted in the browser; recovery queue fixtures are explicitly synthetic."
};
let browser;
let context;
let activePage;
let stage = "initialization";
let synthetic = null;
let employeeApi;
let expectedMutation = null;
let mutationStatus = 409;
let lastEmployeeCommand;
let unexpectedWrites = 0;
let interceptedEmployeeWrites = 0;
let interceptedRecoveryWrites = 0;
const syntheticRequests = [];
const markerPassword = "UiOnly!Provided123";
const markerTemporaryPassword = "UiOnly!Temporary123";

function safePath(url) {
  return new URL(url).pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]");
}
function syntheticQueue() {
  return [
    [1, "generated", "prepared", "ui_smoke_generated"],
    [2, "provided", "prepared", "ui_smoke_provided"],
    [3, null, "cleanup_required", "ui_smoke_deletion"],
    [4, "provided", "prepared", "ui_smoke_cancel"]
  ].map(([n, credentialMode, state, username]) => ({
    requestId: `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    accountId: `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    employeeId: `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    kind: n === 3 ? "delete" : "provision", state, credentialMode, username,
    createdAt: new Date().toISOString()
  }));
}
async function fulfill(route, status, data) {
  await route.fulfill({ status, contentType: "application/json", headers: { "x-erp-smoke-intercepted": "1" }, body: JSON.stringify(data) });
}
function simulatedError(status) {
  return { ok: false, error: { code: status === 409 ? "CONFLICT" : "NETWORK_ERROR", message: `Kiểm tra giao diện ${status}` } };
}
async function screenshot(page, name) {
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(output, name), fullPage: true });
}
async function viewport(page, name) {
  await page.getByText("Đang tải", { exact: true }).first().waitFor({ state: "hidden" });
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
  assert.equal(result.horizontalOverflow, false, "Horizontal page overflow");
  await screenshot(page, name);
  return result;
}
async function pageFor(route) {
  const page = await context.newPage(); activePage = page; page.setDefaultTimeout(25_000);
  const errors = []; const apiFailures = [];
  page.on("pageerror", () => errors.push("runtime error"));
  page.on("response", (response) => {
    if (!response.url().startsWith(`${baseUrl}/api/`) || response.status() < 400 || response.headers()["x-erp-smoke-intercepted"] === "1") return;
    const normalized = safePath(response.url());
    if (response.status() === 404 && (normalized.endsWith("/avatar") || normalized === "/api/v1/workspace/avatar")) return;
    apiFailures.push({ path: normalized, status: response.status() });
  });
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200); await page.locator("main h1").first().waitFor();
  const result = { route: safePath(`${baseUrl}${route}`), destination: safePath(page.url()), routeKind: route.includes(employeeApi?.split("/").at(-1)) ? "dynamic" : "static", status: response.status(), ok: true, errors, apiFailures, viewports: [] };
  return { page, result, async finish() { assert.deepEqual(errors, []); assert.deepEqual(apiFailures, []); report.results.push(result); await page.close(); activePage = null; } };
}
async function noPasswordStorage(page) {
  assert.equal(await page.evaluate((markers) => [localStorage, sessionStorage].some((storage) => Object.keys(storage).some((key) => markers.some((marker) => String(storage.getItem(key)).includes(marker)))), [markerPassword, markerTemporaryPassword]), false);
}
function queueRow(page, username) {
  return page.locator("tr, article.mobile-record").filter({ has: page.getByText(username, { exact: true }) });
}
async function openSensitive(page) {
  await page.locator("section, article, .card").filter({ has: page.getByRole("heading", { name: "CCCD, ngân hàng, thuế/BHXH", exact: true }) }).getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Thông tin nhạy cảm", exact: true }); await dialog.waitFor(); return dialog;
}

try {
  assert(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "Lifecycle smoke requires localhost.");
  const credentials = parseEnv(await readFile(process.env.ERP_AUDIT_CREDENTIALS_FILE || ".env.admin.local", "utf8"));
  assert(credentials.BOOTSTRAP_ADMIN_USERNAME && credentials.BOOTSTRAP_ADMIN_PASSWORD, "Missing audit credentials.");
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", reducedMotion: "reduce" });
  // Installed before login: every non-auth mutation is either explicitly
  // simulated below or blocked. No operational request can reach a server.
  await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (synthetic && url.origin === baseUrl && url.pathname === "/api/v1/account-operations" && method === "GET") {
        await fulfill(route, 200, { ok: true, data: { operations: synthetic.operations } }); return;
      }
      await route.continue(); return;
    }
    if (url.origin === baseUrl && method === "POST" && ["/api/v1/auth/login", "/api/v1/auth/logout"].includes(url.pathname)) { await route.continue(); return; }
    if (url.origin === baseUrl && expectedMutation && url.pathname === `${employeeApi}/${expectedMutation}`
      && method === (expectedMutation === "sensitive" ? "PATCH" : "POST")) {
      interceptedEmployeeWrites += 1; lastEmployeeCommand = request.postDataJSON();
      await fulfill(route, mutationStatus, simulatedError(mutationStatus)); return;
    }
    if (synthetic && url.origin === baseUrl && method === "POST" && url.pathname.startsWith("/api/v1/account-operations/")) {
      const requestId = url.pathname.split("/").at(-1); const operation = synthetic.operations.find((item) => item.requestId === requestId);
      if (operation) {
        interceptedRecoveryWrites += 1; const body = request.postDataJSON();
        syntheticRequests.push({ requestId, body: request.postData() });
        const attempts = syntheticRequests.filter((item) => item.requestId === requestId).length;
        if (operation.username === "ui_smoke_provided" && attempts <= 2) { await fulfill(route, attempts === 1 ? 503 : 409, simulatedError(attempts === 1 ? 503 : 409)); return; }
        const receipt = { requestId, accountId: operation.accountId, employeeId: operation.employeeId, kind: operation.kind,
          state: body.action === "cancel" || (operation.kind === "provision" && operation.state === "cleanup_required") ? "cancelled" : "completed",
          ...(operation.username === "ui_smoke_generated" ? { temporaryPassword: markerTemporaryPassword } : {}) };
        synthetic.operations = synthetic.operations.filter((item) => item.requestId !== requestId);
        await fulfill(route, 200, { ok: true, data: receipt }); return;
      }
    }
    unexpectedWrites += 1; await route.abort("blockedbyclient");
  });
  stage = "authentication";
  const login = await context.newPage(); activePage = login;
  await login.goto(`${baseUrl}/login`); await login.locator('input[name="username"]').fill(credentials.BOOTSTRAP_ADMIN_USERNAME);
  await login.locator('input[name="password"]').fill(credentials.BOOTSTRAP_ADMIN_PASSWORD);
  const authenticated = login.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST");
  await login.getByRole("button", { name: "Đăng nhập", exact: true }).click(); assert.equal((await authenticated).status(), 200);
  await login.waitForURL("**/applications", { waitUntil: "domcontentloaded" }); await login.close(); activePage = null;

  stage = "real read-only API wiring";
  const pending = await context.request.get(`${baseUrl}/api/v1/account-operations`); assert.equal(pending.status(), 200);
  const pendingBody = await pending.json(); assert.equal(pendingBody.ok, true); assert.deepEqual(pendingBody.data.operations, []);
  report.checks.realPendingOperationsEmpty = true;
  const employees = await context.request.get(`${baseUrl}/api/v1/employees?pageSize=1`); assert.equal(employees.status(), 200);
  const employee = (await employees.json()).data.employees.items[0]; assert(/^[0-9a-f-]{36}$/i.test(employee?.id));
  employeeApi = `/api/v1/employees/${employee.id}`;

  for (const route of ["/settings/users", "/employees", `/employees/${employee.id}/profile`, `/employees/${employee.id}/account`]) {
    stage = `real page ${safePath(`${baseUrl}${route}`)}`; const visit = await pageFor(route);
    if (route === "/settings/users") {
      await visit.page.getByRole("heading", { name: "Yêu cầu tài khoản", exact: true }).waitFor();
      await visit.page.getByText("Không có yêu cầu đang chờ", { exact: true }).waitFor();
      assert.equal(await visit.page.getByRole("button", { name: "Xóa", exact: true }).count(), 0);
      report.checks.currentAdministratorCannotBeDeletedFromTable = true;
    }
    for (const width of widths) { await visit.page.setViewportSize({ width, height: 1000 }); visit.result.viewports.push(await viewport(visit.page, `${route.includes("profile") ? "employee-profile" : route.includes("account") ? "employee-account" : route === "/employees" ? "employees" : "users"}-${width}.png`)); }
    await visit.finish();
  }

  for (const status of [409, 503]) {
    stage = `sensitive intercepted ${status}`; mutationStatus = status; expectedMutation = "sensitive";
    const visit = await pageFor(`/employees/${employee.id}/profile`); const dialog = await openSensitive(visit.page);
    const reason = dialog.getByRole("textbox", { name: "Lý do thay đổi", exact: true }); await reason.fill("Kiểm tra giao diện");
    const before = interceptedEmployeeWrites; await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await dialog.getByRole("alert").waitFor(); assert.equal(interceptedEmployeeWrites, before);
    report.checks.sensitiveUnchangedFieldsDoNotSubmit = true;
    const bank = dialog.getByRole("textbox", { name: "Ngân hàng", exact: true }); const originalBank = await bank.inputValue();
    const nextBank = originalBank ? "" : "Ngân hàng kiểm tra giao diện"; await bank.fill(nextBank);
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await dialog.getByRole("button", { name: "Tải lại hồ sơ", exact: true }).waitFor();
    assert.equal(interceptedEmployeeWrites, before + 1); assert.deepEqual(Object.keys(lastEmployeeCommand).sort(), ["bankName", "reason", "rowVersion"]);
    assert(Number.isInteger(lastEmployeeCommand.rowVersion)); assert.equal(lastEmployeeCommand.bankName, nextBank || null);
    assert.equal(await bank.inputValue(), nextBank); assert.equal(await reason.inputValue(), "Kiểm tra giao diện");
    assert.equal(await bank.isDisabled(), true); assert.equal(await dialog.getByRole("button", { name: "Lưu", exact: true }).isDisabled(), true);
    for (const width of widths) { await visit.page.setViewportSize({ width, height: 1000 }); visit.result.viewports.push(await viewport(visit.page, `sensitive-${status}-${width}.png`)); }
    report.checks[`sensitive${status}PreservesDraftAndRequiresReload`] = true;
    report.checks.sensitiveChangedFieldsOnlyWithCas = true;
    if (originalBank) report.checks.sensitiveExplicitNullClearIntercepted = true;
    else report.checks.sensitiveNullClearCoverage = "Stored bank value is empty; explicit null clearing is covered by unit and native database tests.";
    await visit.finish(); expectedMutation = null;
  }
  for (const status of [409, 503]) {
    stage = `archive intercepted ${status}`; mutationStatus = status; expectedMutation = "archive";
    const visit = await pageFor("/employees");
    await visit.page.getByRole("button", { name: `Thao tác ${employee.fullName}`, exact: true }).click();
    await visit.page.getByRole("menuitem", { name: "Lưu trữ", exact: true }).click();
    const dialog = visit.page.getByRole("dialog", { name: "Lưu trữ hồ sơ", exact: true }); await dialog.waitFor();
    const reason = dialog.getByRole("textbox", { name: "Lý do", exact: true }); await reason.fill("Kiểm tra giao diện lưu trữ");
    const before = interceptedEmployeeWrites; await dialog.getByRole("button", { name: "Lưu trữ", exact: true }).click();
    await dialog.getByRole("button", { name: "Tải lại hồ sơ", exact: true }).waitFor();
    assert.equal(interceptedEmployeeWrites, before + 1); assert.deepEqual(Object.keys(lastEmployeeCommand).sort(), ["reason", "rowVersion"]);
    assert(Number.isInteger(lastEmployeeCommand.rowVersion)); assert.equal(await reason.inputValue(), "Kiểm tra giao diện lưu trữ");
    assert.equal(await reason.isDisabled(), true); assert.equal(await dialog.getByRole("button", { name: "Lưu trữ", exact: true }).isDisabled(), true);
    for (const width of widths) { await visit.page.setViewportSize({ width, height: 1000 }); visit.result.viewports.push(await viewport(visit.page, `archive-${status}-${width}.png`)); }
    report.checks[`archive${status}PreservesReasonAndRequiresReload`] = true; await visit.finish(); expectedMutation = null;
  }

  for (const width of widths) {
    stage = `synthetic recovery ${width}`; synthetic = { operations: syntheticQueue() }; syntheticRequests.length = 0;
    const visit = await pageFor("/settings/users"); await visit.page.setViewportSize({ width, height: 1000 });
    await queueRow(visit.page, "ui_smoke_deletion").getByRole("button", { name: "Hoàn tất thu hồi", exact: true }).waitFor();
    const cleanupLabelFits = await queueRow(visit.page, "ui_smoke_deletion").getByRole("button", { name: "Hoàn tất thu hồi", exact: true }).evaluate((button) => [button, ...button.querySelectorAll("span")].every((element) => element.scrollWidth <= element.clientWidth + 1));
    assert(cleanupLabelFits, "Recovery action label is clipped");
    report.checks.recoveryActionLabelsFit = true;
    await viewport(visit.page, `recovery-queue-${width}.png`);
    await queueRow(visit.page, "ui_smoke_provided").getByRole("button", { name: "Tiếp tục", exact: true }).click();
    let dialog = visit.page.getByRole("dialog", { name: "Tiếp tục yêu cầu", exact: true }); const password = dialog.getByLabel(/Mật khẩu ban đầu/);
    await password.fill(markerPassword); await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await dialog.getByRole("alert").waitFor(); assert.equal(await password.inputValue(), markerPassword); assert.equal(await password.isDisabled(), true);
    await noPasswordStorage(visit.page); await viewport(visit.page, `recovery-provided-503-${width}.png`);
    await dialog.getByRole("button", { name: "Thử lại", exact: true }).click(); await dialog.getByRole("alert").filter({ hasText: "409" }).waitFor();
    assert.equal(await password.inputValue(), markerPassword); await noPasswordStorage(visit.page);
    await dialog.getByRole("button", { name: "Thử lại", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
    assert.equal(syntheticRequests.length, 3); assert.equal(new Set(syntheticRequests.map((request) => request.requestId)).size, 1);
    assert.equal(new Set(syntheticRequests.map((request) => request.body)).size, 1); assert.deepEqual(JSON.parse(syntheticRequests[0].body), { action: "resume", password: markerPassword });
    report.checks.recoveryRetriesKeepImmutableRequestAndPasswordInMemory = true;

    await queueRow(visit.page, "ui_smoke_generated").getByRole("button", { name: "Tiếp tục", exact: true }).click();
    dialog = visit.page.getByRole("dialog", { name: "Tiếp tục yêu cầu", exact: true }); assert.equal(await dialog.locator('input[type="password"]').count(), 0);
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click(); dialog = visit.page.getByRole("dialog", { name: "Tài khoản đã được tạo", exact: true });
    await dialog.getByText(markerTemporaryPassword, { exact: true }).waitFor(); await noPasswordStorage(visit.page);
    await viewport(visit.page, `recovery-generated-${width}.png`); await dialog.getByRole("button", { name: "Hoàn tất", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
    assert.equal(await visit.page.getByText(markerTemporaryPassword, { exact: true }).count(), 0); report.checks.temporaryPasswordClearedWhenClosed = true;

    await queueRow(visit.page, "ui_smoke_cancel").getByRole("button", { name: "Hủy yêu cầu", exact: true }).click();
    dialog = visit.page.getByRole("dialog", { name: "Hủy yêu cầu", exact: true }); assert.equal(await dialog.locator('input[type="password"]').count(), 0);
    await dialog.getByRole("button", { name: "Hủy yêu cầu", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(JSON.parse(syntheticRequests.at(-1).body), { action: "cancel" }); report.checks.cancellationDoesNotRequirePassword = true;

    await queueRow(visit.page, "ui_smoke_deletion").getByRole("button", { name: "Hoàn tất thu hồi", exact: true }).click();
    dialog = visit.page.getByRole("dialog", { name: "Hoàn tất thu hồi", exact: true }); assert.equal(await dialog.getByRole("button", { name: "Hủy yêu cầu", exact: true }).count(), 0);
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(JSON.parse(syntheticRequests.at(-1).body), { action: "resume" }); report.checks.deletionCleanupAcceptsCompletedReceipt = true;
    await visit.page.getByText("Không có yêu cầu đang chờ", { exact: true }).waitFor(); await noPasswordStorage(visit.page);
    visit.result.viewports.push(await viewport(visit.page, `recovery-finished-${width}.png`)); await visit.finish(); synthetic = null;
  }
  assert.equal(unexpectedWrites, 0); assert.equal(interceptedEmployeeWrites, 4); assert.equal(interceptedRecoveryWrites, 18);
  report.checks.allOperationalMutationsIntercepted = true; report.checks.syntheticRecoveryQueueOnly = true;
  report.checks.interceptedEmployeeWrites = interceptedEmployeeWrites; report.checks.interceptedRecoveryWrites = interceptedRecoveryWrites;
  stage = "logout"; assert.equal((await context.request.post(`${baseUrl}/api/v1/auth/logout`)).status(), 200);
  assert.equal((await context.request.get(`${baseUrl}/api/v1/account-operations`)).status(), 401); report.checks.auditSessionRevoked = true;
  report.passed = true; await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, pageVisits: report.results.length, viewportWidths: widths, checks: report.checks, writesOperationalData: false }));
} catch (error) {
  report.passed = false; report.failure = { stage, type: error instanceof Error ? error.name : "unknown", message: "Lifecycle browser acceptance failed; inspect the local screenshot and safe stage identifier." };
  await mkdir(output, { recursive: true }).catch(() => undefined);
  if (activePage) await screenshot(activePage, "failure.png").catch(() => undefined);
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2)).catch(() => undefined);
  console.error(JSON.stringify({ passed: false, stage, writesOperationalData: false })); process.exitCode = 1;
} finally {
  if (context) await context.request.post(`${baseUrl}/api/v1/auth/logout`).catch(() => undefined);
  if (browser) await browser.close();
}

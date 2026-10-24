import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import path from "node:path";
import { chromium } from "playwright-core";
import { loadDeploymentManifest } from "../database/deployment-manifest.mjs";

const publish = process.argv.includes("--publish");
const baseUrl = process.env.ERP_SITE_BASE_URL || "http://localhost:3100";
const output = process.env.ERP_AUDIT_OUTPUT || ".tmp/erp-p2-setup";
const { target } = await loadDeploymentManifest();
if (publish && (target.projectRef !== "tcjjhxqtreemccdbvyza" || target.application.environment !== "development"
  || !["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname))) {
  throw new Error("Publish smoke chỉ dùng cho bản DTech development qua localhost.");
}
if (publish) {
  const environment = parseEnv(await readFile(".env.local", "utf8"));
  if (environment.NEXT_PUBLIC_SUPABASE_URL !== target.apiUrl || environment.RELEASE_ENVIRONMENT === "production") {
    throw new Error("Môi trường ứng dụng không khớp DTech development.");
  }
}
const credentials = parseEnv(await readFile(".env.admin.local", "utf8"));
await mkdir(output, { recursive: true });
const report = { generatedAt: new Date().toISOString(), results: [], checks: {}, publishesConfiguration: publish };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
let context;
try {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", reducedMotion: "reduce" });
  assert.equal((await context.request.get(`${baseUrl}/api/v1/system-settings/activation`)).status(), 401);
  report.checks.anonymousSetupDenied = true;
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const errors = [];
  page.on("pageerror", () => errors.push("runtime error"));
  await page.goto(`${baseUrl}/login`);
  await page.locator('input[name="username"]').fill(credentials.BOOTSTRAP_ADMIN_USERNAME);
  await page.locator('input[name="password"]').fill(credentials.BOOTSTRAP_ADMIN_PASSWORD);
  const authentication = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  assert.equal((await authentication).status(), 200);
  await page.waitForURL("**/applications", { waitUntil: "domcontentloaded" });
  const beforeResponse = await context.request.get(`${baseUrl}/api/v1/system-settings/activation`);
  assert.equal(beforeResponse.status(), 200);
  const before = (await beforeResponse.json()).data;
  if (publish) assert.equal(before.ready, true);
  await page.goto(`${baseUrl}/system-admin/setup`);
  await page.locator("#setup-organization-companyName").waitFor();
  assert.equal(await page.locator("#setup-organization-companyName").inputValue(), before.settings.organization.companyName);
  report.checks.snapshotMatchesStoredCompany = true;

  // Exercise a browser-only draft. It is discarded before any publish.
  const draftName = `${before.settings.organization.companyName} · Bản nháp`;
  await page.locator("#setup-organization-companyName").fill(draftName);
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await page.getByText("Đã lưu bản nháp trên trình duyệt.", { exact: true }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "Tiếp tục bản nháp", exact: true }).click();
  assert.equal(await page.locator("#setup-organization-companyName").inputValue(), draftName);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bỏ bản nháp", exact: true }).click();
  await page.waitForFunction((expected) => document.querySelector('#setup-organization-companyName')?.value === expected, before.settings.organization.companyName);
  report.checks.browserDraftSurvivesReloadAndDiscards = true;

  // Canonicalization preserves the stored company name while exercising the full UI save.
  if (publish) await page.locator("#setup-organization-companyName").fill(`${before.settings.organization.companyName} `);
  const viewports = [];
  for (let step = 0; step < 4; step += 1) {
    assert.equal(await page.locator("#setup-step-heading").textContent(), ["Doanh nghiệp", "Thương hiệu", "Module", "Xác nhận"][step]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      const viewport = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.equal(viewport.horizontalOverflow, false);
      viewports.push({ ...viewport, step: step + 1 });
      await page.screenshot({ path: path.join(output, `setup-step-${step + 1}-${width}.png`), fullPage: true });
    }
    if (step < 3) await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  }
  report.checks.allFourStepsResponsive = true;
  if (!before.ready) {
    await page.getByText("Chờ cập nhật hệ thống", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Xuất bản cấu hình", exact: true }).isDisabled(), true);
    report.checks.unmigratedPublishBlocked = true;
  }
  if (publish) {
    await page.getByLabel("Xác nhận xuất bản cấu hình", { exact: true }).check();
    const outgoing = page.waitForRequest((request) => request.url().endsWith("/api/v1/system-settings/activation") && request.method() === "POST");
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/v1/system-settings/activation") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Xuất bản cấu hình", exact: true }).click();
    const command = (await outgoing).postDataJSON();
    assert.equal((await saved).status(), 200);
    await page.getByText("Đã xuất bản cấu hình ERP.", { exact: true }).waitFor();
    const current = (await (await context.request.get(`${baseUrl}/api/v1/system-settings/activation`)).json()).data;
    assert.deepEqual(current.settings, before.settings);
    for (const group of ["branding", "organization", "localization", "modules"]) assert.equal(current.versions[group], before.versions[group] + 1);
    const retry = await context.request.post(`${baseUrl}/api/v1/system-settings/activation`, { data: command });
    assert.equal(retry.status(), 200);
    assert.deepEqual((await retry.json()).data.versions, current.versions);
    const changed = structuredClone(command);
    changed.groups.branding.systemName += " retry";
    assert.equal((await context.request.post(`${baseUrl}/api/v1/system-settings/activation`, { data: changed })).status(), 409);
    const stale = { ...command, requestId: randomUUID() };
    assert.equal((await context.request.post(`${baseUrl}/api/v1/system-settings/activation`, { data: stale })).status(), 409);
    const finalState = (await (await context.request.get(`${baseUrl}/api/v1/system-settings/activation`)).json()).data;
    assert.deepEqual(finalState.settings, before.settings);
    assert.deepEqual(finalState.versions, current.versions);
    report.checks.uiPublishesAtomically = true;
    report.checks.retryDoesNotIncrementVersions = true;
    report.checks.changedRequestAndStaleVersionsRejected = true;
    report.checks.semanticConfigurationPreserved = true;
    await page.screenshot({ path: path.join(output, "setup-published-390.png"), fullPage: true });
  }
  assert.deepEqual(errors, []);
  report.results.push({ route: "/system-admin/setup", destination: "/system-admin/setup", status: 200, ok: true, errors, apiFailures: [], viewports });
  await context.request.post(`${baseUrl}/api/v1/auth/logout`);
  assert.equal((await context.request.get(`${baseUrl}/api/v1/system-settings/activation`)).status(), 401);
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, checks: report.checks, publishesConfiguration: publish }));
} finally {
  if (context) await context.request.post(`${baseUrl}/api/v1/auth/logout`).catch(() => undefined);
  await browser.close();
}

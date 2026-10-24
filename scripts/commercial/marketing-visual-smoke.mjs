import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.ERP_SITE_BASE_URL || "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = path.resolve(".tmp/erp-marketing-3d");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const report = { generatedAt: new Date().toISOString(), viewports: [], errors: [], blockedWrites: 0, checks: {} };
try {
  const context = await browser.newContext({ reducedMotion: "reduce", locale: "vi-VN" });
  await context.route("**/*", route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { report.blockedWrites++; return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.name));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const response = await page.goto(base, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("h1").count(), 1);
    const hero = page.getByRole("group", { name: "Giao diện ERP nổi 3D" });
    await hero.waitFor();
    assert(await hero.getByRole("tabpanel").isVisible());
    assert.notEqual(await hero.locator('[class*="mainScreen"]').evaluate(element => getComputedStyle(element).transform), "none");
    await hero.getByRole("tab", { name: "Nhân sự" }).click();
    assert.equal(await hero.getByRole("tab", { name: "Nhân sự" }).getAttribute("aria-selected"), "true");
    await page.keyboard.press("ArrowRight");
    assert.equal(await hero.getByRole("tab", { name: "Dự án" }).getAttribute("aria-selected"), "true");
    await hero.getByRole("tab", { name: "Kho vật tư" }).click();
    await page.locator("h1").click();
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(overflow.document <= width + 1, `Horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
    await page.screenshot({ path: path.join(output, `landing-${width}.png`), fullPage: true });
    await page.screenshot({ path: path.join(output, `hero-${width}.png`), fullPage: false });
    await page.locator("#hieu-qua").screenshot({ path: path.join(output, `impact-${width}.png`) });
    report.viewports.push({ width, status: 200, dimensionalPreviewLoaded: true, horizontalOverflow: false });
  }
  const sliders = page.getByRole("slider");
  await sliders.nth(0).focus();
  await page.keyboard.press("Home");
  await page.getByRole("status", { name: "Kết quả so sánh" }).filter({ hasText: "Chưa có mức ban đầu" }).waitFor();
  await page.keyboard.press("End");
  await sliders.nth(1).focus();
  await page.keyboard.press("End");
  await page.getByRole("status", { name: "Kết quả so sánh" }).filter({ hasText: "Giảm 0" }).waitFor();
  await page.getByRole("button", { name: "Đặt lại mô phỏng" }).click();
  await page.getByRole("status", { name: "Kết quả so sánh" }).filter({ hasText: "Giảm 48 giờ / tháng" }).waitFor();
  await page.getByRole("button", { name: "Dừng chuyển động biểu đồ" }).click();
  assert.equal(await page.getByRole("button", { name: "Bật chuyển động biểu đồ" }).getAttribute("aria-pressed"), "true");
  const reduced = await page.locator("[class*='bar_'] > i").first().evaluate(element => getComputedStyle(element).animationName);
  assert.equal(reduced, "none");
  await page.getByText("Xem bảng số liệu", { exact: true }).click();
  await page.getByRole("table").filter({ hasText: "Số liệu mô phỏng" }).waitFor();
  const cases = page.getByRole("group", { name: "Chọn tình huống theo ngành" }).getByRole("button");
  assert.equal(await cases.count(), 6);
  for (let index = 0; index < 6; index++) { await cases.nth(index).click(); assert.equal(await cases.nth(index).getAttribute("aria-pressed"), "true"); }
  const hashLinks = await page.locator('a[href^="/#"],a[href^="#"]').evaluateAll(links => links.map(link => new URL(link.href).hash));
  for (const hash of hashLinks) assert(await page.locator(hash).count(), `Missing anchor ${hash}`);
  report.checks = { keyboardRangeInputs: true, zeroBaseline: true, reset: true, motionToggle: true, reducedMotion: true, dataTable: true, sixIndustryCases: true, anchorTargets: true };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Bật chuyển động biểu đồ" }).click();
  assert.notEqual(await page.locator("[class*='bar_'] > i").first().evaluate(element => getComputedStyle(element).animationName), "none");
  report.checks.motionEnabled = true;
  await page.getByRole("button", { name: "Dừng chuyển động giao diện 3D" }).click();
  assert.equal(await page.getByRole("button", { name: "Bật chuyển động giao diện 3D" }).getAttribute("aria-pressed"), "true");
  report.checks.dimensionalPreviewMotionToggle = true;
  report.checks.dimensionalPreviewKeyboardAndPointer = true;
  assert.deepEqual(report.errors, []);
  assert.equal(report.blockedWrites, 0);
  report.passed = true;
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));

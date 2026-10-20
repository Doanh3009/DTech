import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const output = path.join(process.cwd(), "docs", "ui-evidence", "attendance-photo-workspace");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const report = [];

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/ui-preview/attendance/photos`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const mark = page.getByRole("button", { name: /Đã xem và tiếp/ });
    await mark.waitFor();
    await page.waitForFunction(() => {
      const section = document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"]');
      return [...section.querySelectorAll("img")].length >= 2 && [...section.querySelectorAll("img")].every((image) => image.complete && image.naturalWidth > 0);
    });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Đã xem và tiếp") && !button.disabled));
    const dimensions = await page.evaluate(() => {
      const section = document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"]');
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        images: [...section.querySelectorAll("img")].map((image) => ({ width: Math.round(image.getBoundingClientRect().width), height: Math.round(image.getBoundingClientRect().height), frameHeight: Math.round(image.parentElement.getBoundingClientRect().height), fit: getComputedStyle(image).objectFit })),
        hasTable: Boolean(document.querySelector("table"))
      };
    });
    if (dimensions.content > dimensions.viewport) throw new Error(`Overflow ${dimensions.content}/${dimensions.viewport}`);
    if (dimensions.hasTable || dimensions.images.some((image) => image.height < 250)) throw new Error("Photo workstation layout is too small or still contains a table.");
    if (dimensions.images.some((image) => image.height > image.frameHeight + 1 || image.fit !== "contain")) throw new Error("Photo frame crops attendance evidence.");
    await page.screenshot({ path: path.join(output, `workspace-${viewport.width}x${viewport.height}.png`), fullPage: true });
    const inspector = page.getByRole("region", { name: "Kiểm tra ảnh nhân viên" });
    const firstName = await inspector.getByRole("heading", { level: 2 }).textContent();
    await mark.click();
    await page.waitForFunction((name) => document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"] h2')?.textContent !== name, firstName);
    await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await page.waitForFunction((name) => document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"] h2')?.textContent === name, firstName);
    if (viewport.width > 1023) {
      await inspector.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction((name) => document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"] h2')?.textContent !== name, firstName);
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction((name) => document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"] h2')?.textContent === name, firstName);
    }
    await inspector.getByRole("button", { name: /Xem ảnh chấm vào/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Ảnh sau", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Đánh dấu(?: F)?$/ }).click();
    if (viewport.width <= 1023) await page.getByRole("button", { name: /Chọn nhân viên/ }).click();
    await page.getByRole("button", { name: /^Đánh dấu\s*\d+$/ }).click();
    await page.waitForFunction((name) => document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"] h2')?.textContent === name, firstName);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Trên thiết bị này", { exact: true }).waitFor();
    if (viewport.width <= 1023) await page.getByRole("button", { name: /Chọn nhân viên/ }).click();
    await page.getByRole("button", { name: /^Đánh dấu\s*\d+$/ }).click();
    await page.waitForFunction((name) => document.querySelector('[aria-label="Kiểm tra ảnh nhân viên"] h2')?.textContent === name, firstName);
    await page.getByLabel("Ngày", { exact: true }).fill("2026-09-30");
    await page.waitForFunction(() => document.querySelector('[aria-label="Tiến độ xem ảnh"]').getAttribute("aria-valuenow") === "0");
    if (errors.length) throw new Error(errors.join("; "));
    report.push({ viewport, dimensions, markAndNext: true, undo: true, photoZoom: true, flagsPersisted: true, dateScope: true, runtimeErrors: errors });
    console.log(`PASS photo workspace ${viewport.width}x${viewport.height}`);
    await context.close();
  }
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

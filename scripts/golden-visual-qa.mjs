import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const edgePath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.join(process.cwd(), "docs", "erp-v2", "references", "golden-v1");
const screens = [
  { id: "tasks", label: "Gói · Thi công" },
  { id: "warehouse", label: "Kho · Chứng từ" },
  { id: "employee", label: "Nhân sự · Tạo mới" },
  { id: "dashboard", label: "Dashboard cá nhân" }
];
const states = ["filled", "empty", "loading", "error", "denied", "open", "success"];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 }
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: edgePath, headless: true });

async function setPrototype(page, screen, state) {
  console.log(`CHECK ${screen.id}/${state}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  const currentScreen = await page.locator("[data-golden-canvas]").getAttribute("data-golden-screen");
  if (currentScreen !== screen.id) {
    await page.getByRole("button", { name: screen.label, exact: true }).click();
    await page.waitForFunction((screenId) => document.querySelector("[data-golden-canvas]")?.getAttribute("data-golden-screen") === screenId, screen.id);
    await page.waitForFunction(() => document.querySelector("[data-golden-canvas]")?.getAttribute("data-golden-state") === "filled");
  }
  await page.locator("#golden-state").selectOption(state);
  await page.waitForTimeout(100);
  const selectedState = await page.locator("#golden-state").inputValue();
  const renderedState = await page.locator("[data-golden-canvas]").getAttribute("data-golden-state");
  if (selectedState !== state || renderedState !== state) throw new Error(`State selector không đồng bộ ${screen.id}/${state}: select=${selectedState}, canvas=${renderedState}`);
}

async function inspect(page, viewport, screen, state) {
  const metrics = await page.evaluate(({ expectedScreen, expectedState }) => {
    const canvas = document.querySelector("[data-golden-canvas]");
    if (!(canvas instanceof HTMLElement)) throw new Error("Không tìm thấy Golden canvas.");
    const visibleControls = [...canvas.querySelectorAll("button, input, select, summary")]
      .filter((element) => {
        if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      })
      .map((element) => ({
        name: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || element.tagName,
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
        iconOnly: Boolean(element.getAttribute("aria-label")) && !(element.textContent || "").trim()
      }));
    return {
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
      screen: canvas.dataset.goldenScreen,
      state: canvas.dataset.goldenState,
      dialog: Boolean(canvas.querySelector('[role="dialog"]')),
      success: Boolean(canvas.querySelector('[data-state-marker="success"]')),
      marker: Boolean(canvas.querySelector(`[data-state-marker="${expectedState}"]`)),
      shortTargets: visibleControls.filter((control) => control.height < 43.5 || (control.iconOnly && control.width < 43.5)),
      taskOverlap: (() => {
        const check = canvas.querySelector("[data-golden-task-check]")?.getBoundingClientRect();
        const copy = canvas.querySelector("[data-golden-task-copy]")?.getBoundingClientRect();
        return check && copy ? check.right + 7.5 > copy.left : false;
      })(),
      clippedDocumentContent: [...canvas.querySelectorAll("[data-golden-document-row]")].some((row) => {
        const rowRect = row.getBoundingClientRect();
        return [...row.children].some((child) => {
          const rect = child.getBoundingClientRect();
          return rect.right > rowRect.right + .5 || rect.left < rowRect.left - .5;
        });
      }),
      expectedScreen
    };
  }, { expectedScreen: screen.id, expectedState: state });

  if (metrics.screen !== screen.id || metrics.state !== state) throw new Error(`Sai state ${screen.id}/${state}: ${JSON.stringify(metrics)}`);
  if (metrics.contentWidth > metrics.viewportWidth) throw new Error(`Tràn ngang ${screen.id}/${state} @ ${viewport.width}: ${metrics.contentWidth}px > ${metrics.viewportWidth}px`);
  if (state === "open" && !metrics.dialog) throw new Error(`Thiếu panel mở: ${screen.id}`);
  if (state === "success" && !metrics.success) throw new Error(`Thiếu trạng thái lưu thành công: ${screen.id}`);
  if (["empty", "loading", "error", "denied"].includes(state) && !metrics.marker) throw new Error(`Thiếu state marker ${screen.id}/${state}`);
  if (viewport.width <= 390 && metrics.shortTargets.length) throw new Error(`Touch target dưới 44px ${screen.id}/${state}: ${JSON.stringify(metrics.shortTargets)}`);
  if (state === "filled" && screen.id === "tasks" && metrics.taskOverlap) throw new Error(`Nút hoàn thành đè lên nội dung task @ ${viewport.width}px`);
  if (state === "filled" && screen.id === "warehouse" && viewport.width > 820 && metrics.clippedDocumentContent) throw new Error(`Nội dung worklist bị cắt @ ${viewport.width}px`);
}

async function capture(page, fileName) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.evaluate(() => {
    const controls = document.querySelector("[data-prototype-controls]");
    const canvas = document.querySelector("[data-golden-canvas]");
    if (controls instanceof HTMLElement) controls.style.display = "none";
    if (canvas instanceof HTMLElement) canvas.style.minHeight = "100dvh";
  });
  await page.screenshot({ path: path.join(output, fileName) });
  await page.evaluate(() => {
    const controls = document.querySelector("[data-prototype-controls]");
    const canvas = document.querySelector("[data-golden-canvas]");
    if (controls instanceof HTMLElement) controls.style.removeProperty("display");
    if (canvas instanceof HTMLElement) canvas.style.removeProperty("min-height");
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/ui-preview/golden`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  for (const viewport of viewports) {
    for (const screen of screens) {
      for (const state of states) {
        await setPrototype(page, screen, state);
        await page.setViewportSize(viewport);
        await inspect(page, viewport, screen, state);
        if (state !== "filled" && viewport.width !== 360) await capture(page, `${screen.id}-${state}-${viewport.width}x${viewport.height}.png`);
      }

      await setPrototype(page, screen, "filled");
      await page.setViewportSize(viewport);
      await capture(page, `${screen.id}-${viewport.width}x${viewport.height}.png`);
      console.log(`PASS screenshot ${screen.id} ${viewport.width}x${viewport.height}`);
    }
  }

  await setPrototype(page, screens[0], "filled");
  const beforeWidth = await page.locator("aside").first().evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
  const afterWidth = await page.locator("aside").first().evaluate((element) => element.getBoundingClientRect().width);
  if (beforeWidth < 220 || afterWidth > 70) throw new Error(`Sidebar không thu gọn đúng: ${beforeWidth}px → ${afterWidth}px`);
  console.log(`PASS sidebar collapse ${beforeWidth}px → ${afterWidth}px`);
  await context.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN", reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${baseUrl}/ui-preview/golden`, { waitUntil: "networkidle" });
  await reducedPage.setViewportSize({ width: 1440, height: 900 });
  await reducedPage.locator("#golden-state").selectOption("open");
  await reducedPage.setViewportSize({ width: 390, height: 844 });
  const animation = await reducedPage.getByRole("dialog").evaluate((element) => getComputedStyle(element).animationName);
  if (animation !== "none") throw new Error(`prefers-reduced-motion chưa tắt drawer animation: ${animation}`);
  console.log("PASS prefers-reduced-motion");
  await reducedContext.close();
} finally {
  await browser.close();
}

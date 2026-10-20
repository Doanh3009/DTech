import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const baseUrl = process.env.UI_QA_BASE_URL || "http://127.0.0.1:3100";
const edgePath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.join(process.cwd(), "docs", "ui-evidence");
const viewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 480, height: 900 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 }
];
const vietnameseGlyphs = "Nguyễn Văn Cường Quản lý nhân sự Điều chỉnh chấm công Nghỉ phép Kiểm kê Phiếu nhập kho Đồng bộ tức thời";

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: edgePath, headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "vi-VN" });
    const page = await context.newPage();
    const fontResponses = [];
    page.on("response", (response) => {
      if (/inter.*\.woff2(?:\?|$)/i.test(response.url())) fontResponses.push({ status: response.status(), url: response.url() });
    });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    const layout = await page.evaluate(async (glyphs) => {
      await document.fonts.ready;
      await Promise.all(["400", "500", "600"].map((weight) => document.fonts.load(`${weight} 16px "Inter"`, glyphs)));
      const loadedFaces = [...document.fonts].filter((face) => face.family.replaceAll('"', "") === "Inter");
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        font: getComputedStyle(document.body).fontFamily,
        fontReady: document.fonts.check('16px "Inter"', glyphs),
        loadedWeights: loadedFaces.filter((face) => face.status === "loaded").map((face) => face.weight).sort(),
        language: document.documentElement.lang
      };
    }, vietnameseGlyphs);
    if (layout.content > layout.viewport) throw new Error(`Tràn ngang tại ${viewport.width}x${viewport.height}: ${layout.content}px > ${layout.viewport}px`);
    if (layout.font.split(",")[0]?.trim().replaceAll('"', "") !== "Inter") throw new Error(`Inter chưa được áp dụng tại ${viewport.width}px: ${layout.font}`);
    if (!layout.fontReady || !["400", "500", "600"].every((weight) => layout.loadedWeights.includes(weight))) throw new Error(`Font tiếng Việt chưa tải đủ tại ${viewport.width}px: ${JSON.stringify(layout)}`);
    if (fontResponses.some((response) => response.status >= 400)) throw new Error(`Tệp Inter lỗi HTTP tại ${viewport.width}px`);
    if (!fontResponses.some((response) => /inter-latin-\d+-normal[^/]*\.woff2/i.test(response.url))) throw new Error(`Thiếu subset Latin của Inter tại ${viewport.width}px`);
    if (!fontResponses.some((response) => /inter-vietnamese-\d+-normal[^/]*\.woff2/i.test(response.url))) throw new Error(`Thiếu subset Vietnamese của Inter tại ${viewport.width}px`);
    if (layout.language !== "vi") throw new Error("Thuộc tính ngôn ngữ tài liệu không phải tiếng Việt.");
    if ([320, 390, 1440, 1920, 2560].includes(viewport.width)) {
      await page.screenshot({ path: path.join(output, `login-${viewport.width}x${viewport.height}-playwright.png`), fullPage: true });
    }
    console.log(`PASS login ${viewport.width}x${viewport.height} · content ${layout.content}px · font ready ${layout.loadedWeights.join("/")}`);
    await context.close();
  }

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1100 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "vi-VN" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/ui-preview`, { waitUntil: "networkidle" });
    const visual = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        appBackground: root.getPropertyValue("--app-bg").trim(),
        cardRadius: root.getPropertyValue("--radius-card").trim(),
        controlHeight: root.getPropertyValue("--control-height-md").trim(),
        metricCards: document.querySelectorAll(".dashboard-overview__metric").length,
        dataTables: document.querySelectorAll(".data-table").length,
        mobileLists: document.querySelectorAll(".mobile-record-list").length,
        mobileRecords: document.querySelectorAll(".mobile-record").length,
        formFields: document.querySelectorAll(".erp-form-preview .field").length,
        invalidFields: document.querySelectorAll('.erp-form-preview [aria-invalid="true"]').length,
        readOnlyFields: document.querySelectorAll(".erp-form-preview :read-only").length,
        disabledFields: document.querySelectorAll(".erp-form-preview :disabled").length,
        filterBars: document.querySelectorAll(".filter-bar").length,
        stickyActionBars: document.querySelectorAll(".sticky-action-bar").length
      };
    });
    if (visual.content > visual.viewport) throw new Error(`UI preview tràn ngang tại ${viewport.width}px: ${visual.content}px > ${visual.viewport}px`);
    if (visual.appBackground !== "#f0fdfa" || visual.cardRadius !== "12px" || visual.controlHeight !== "44px") throw new Error(`UI preview không nhận đúng token: ${JSON.stringify(visual)}`);
    const validWorklist = viewport.width < 768
      ? visual.dataTables === 0 && visual.mobileLists === 1 && visual.mobileRecords === 2
      : visual.dataTables === 1 && visual.mobileLists === 0;
    if (visual.metricCards < 4 || !validWorklist) throw new Error(`UI preview thiếu primitive bắt buộc: ${JSON.stringify(visual)}`);
    if (visual.formFields < 7 || visual.invalidFields !== 1 || visual.readOnlyFields < 1 || visual.disabledFields < 1) throw new Error(`UI preview thiếu trạng thái field ERP: ${JSON.stringify(visual)}`);
    if (visual.filterBars !== 1 || visual.stickyActionBars !== 1) throw new Error(`UI preview thiếu filter/action contract ERP: ${JSON.stringify(visual)}`);
    await page.screenshot({ path: path.join(output, `ui-preview-${viewport.width}x${viewport.height}-playwright.png`), fullPage: true });
    console.log(`PASS UI preview ${viewport.width}x${viewport.height} · UI/UX Pro Max ERP tokens and shared primitives`);
    await context.close();
  }

  for (const zoom of [0.8, 1, 1.25, 1.5]) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "vi-VN" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    const layout = await page.evaluate((scale) => {
      document.documentElement.style.zoom = String(scale);
      return { viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth };
    }, zoom);
    if (layout.content > layout.viewport) throw new Error(`Tràn ngang ở zoom ${Math.round(zoom * 100)}%: ${layout.content}px > ${layout.viewport}px`);
    console.log(`PASS login zoom ${Math.round(zoom * 100)}% · content ${layout.content}px/${layout.viewport}px`);
    await context.close();
  }

  for (const route of ["/dashboard", "/attendance", "/warehouse/receipts/test-record"]) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    if (!page.url().includes("/login")) throw new Error(`Route ${route} không chuyển về đăng nhập khi chưa có phiên.`);
    console.log(`PASS protected route ${route}`);
    await context.close();
  }
} finally {
  await browser.close();
}

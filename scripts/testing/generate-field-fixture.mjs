import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#eef8ff;font-family:Arial;color:#17486b"><svg width="960" height="540" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="540" fill="#eef8ff"/><circle cx="800" cy="95" r="42" fill="#ffd975"/><path d="M0 390 Q200 320 400 390 T960 370 V540 H0" fill="#bce8cf"/><rect x="155" y="160" width="440" height="250" rx="8" fill="#b8d9f5"/><path d="M155 240H595 M155 320H595 M240 160V410 M330 160V410 M420 160V410 M510 160V410" stroke="#4c9fe6" stroke-width="13"/><path d="M650 75V420 M625 420H680 M510 90H870 M650 70L540 90 M650 70L770 90 M815 90V220" stroke="#ffb65c" stroke-width="12" fill="none"/><rect x="120" y="408" width="620" height="14" rx="7" fill="#6cbea1"/><rect x="36" y="35" width="360" height="50" rx="12" fill="white"/><text x="54" y="68" font-size="24" font-weight="bold" fill="#1678bd">CT NOIBO / TEST FIXTURE</text><rect x="36" y="460" width="888" height="52" rx="12" fill="white"/><text x="54" y="492" font-size="20" fill="#35708c">FAKE FIELD REPORT - NO REAL PEOPLE OR WORKSITE</text></svg></body></html>`);
  await mkdir("scripts/testing/fixtures", { recursive: true });
  await page.screenshot({ path: "scripts/testing/fixtures/mock-field-report.png" });
} finally { await browser.close(); }

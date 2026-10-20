import { getTestPassword } from "./testing/password.mjs";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const browserPath = process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const password = getTestPassword();

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "vi-VN" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator('[name="username"]').fill("test.supervisor");
  await page.locator('[name="password"]').fill(password);
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/auth/login"),
    page.getByRole("button", { name: "Đăng nhập" }).click()
  ]);
  if (!loginResponse.ok()) throw new Error(`Không thể chạy QA vì đăng nhập trả HTTP ${loginResponse.status()}`);
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });

  await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Gói / Công trường" }).waitFor({ state: "visible", timeout: 15_000 });

  let dashboardApiRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/dashboard") dashboardApiRequests += 1;
  });

  const startedAt = Date.now();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 15_000 });
  const firstState = await Promise.race([
    page.locator(".dashboard-route-skeleton").waitFor({ state: "visible", timeout: 2_000 }).then(() => "skeleton"),
    page.locator(".dashboard-heading").waitFor({ state: "visible", timeout: 2_000 }).then(() => "content")
  ]);
  const firstFeedbackMs = Date.now() - startedAt;
  await page.locator(".dashboard-heading").waitFor({ state: "visible", timeout: 15_000 });
  const contentReadyMs = Date.now() - startedAt;

  if (firstFeedbackMs > 1_000) throw new Error(`Dashboard phản hồi đầu tiên quá chậm: ${firstFeedbackMs}ms`);
  if (dashboardApiRequests !== 0) throw new Error(`Dashboard còn fetch API sau hydrate: ${dashboardApiRequests} request`);

  console.log(`PASS dashboard first feedback ${firstFeedbackMs}ms (${firstState})`);
  console.log(`PASS dashboard content ready ${contentReadyMs}ms without client dashboard fetch`);
  await context.close();
} finally {
  await browser.close();
}

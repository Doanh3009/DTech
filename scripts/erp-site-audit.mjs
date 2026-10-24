import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright-core";

const baseUrl = process.env.ERP_SITE_BASE_URL || "http://localhost:3000";
const routePrefix = process.argv.find((arg) => arg.startsWith("--prefix="))?.slice(9);
const output = process.env.ERP_AUDIT_OUTPUT || `.tmp/erp-site-audit${routePrefix ? routePrefix.replaceAll("/", "-") : ""}`;
const appRoot = path.resolve("src/app/(app)");
const credentials = parseEnv(await readFile(process.env.ERP_AUDIT_CREDENTIALS_FILE || ".env.admin.local", "utf8"));
const username = process.env.ERP_AUDIT_USERNAME || credentials.BOOTSTRAP_ADMIN_USERNAME;
const password = process.env.ERP_AUDIT_PASSWORD || credentials.BOOTSTRAP_ADMIN_PASSWORD;
if (!username || !password) throw new Error("Cần tài khoản để duyệt ERP.");

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) routes.push(...await collect(target));
    if (entry.name === "page.tsx") routes.push(`/${path.relative(appRoot, directory).replaceAll(path.sep, "/")}`);
  }
  return routes;
}

await mkdir(output, { recursive: true });
const templates = (await collect(appRoot)).sort();
const dynamic = templates.filter((route) => route.includes("["));
const routes = templates.filter((route) => !route.includes("[") && !route.includes("__") && (!routePrefix || route.startsWith(routePrefix)));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const report = { baseUrl, generatedAt: new Date().toISOString(), routeTemplates: templates.length, dynamicTemplates: dynamic, results: [] };
const redact = (value) => String(value).replaceAll(password, "[redacted]").replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]");
let context;
try {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", reducedMotion: "reduce" });
  const loginPage = await context.newPage();
  loginPage.setDefaultTimeout(30_000);
  await loginPage.goto(`${baseUrl}/login`);
  await loginPage.locator('input[name="username"]').fill(username);
  await loginPage.locator('input[name="password"]').fill(password);
  const loginResponse = loginPage.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST");
  await loginPage.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const login = await loginResponse;
  if (!login.ok()) throw new Error(`Không đăng nhập được (${login.status()}).`);
  await loginPage.waitForURL("**/applications", { waitUntil: "commit", timeout: 60_000 });
  await loginPage.close();
  console.log(JSON.stringify({ authenticated: true, staticRoutes: routes.length, dynamicTemplates: dynamic.length }));

  for (const route of routes) {
    console.log(JSON.stringify({ startingRoute: route }));
    // Isolate streamed redirects and client effects from the following route.
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    const apiFailures = [];
    const onError = (error) => errors.push(redact(error.message));
    const onResponse = (response) => {
      const responsePath = new URL(response.url()).pathname;
      // An unset optional avatar returns NOT_FOUND and Avatar renders initials.
      if (response.url().startsWith(`${baseUrl}/api/`) && response.status() >= 400 && !(responsePath === "/api/v1/workspace/avatar" && response.status() === 404)) apiFailures.push({ path: responsePath, status: response.status() });
    };
    page.on("pageerror", onError);
    page.on("response", onResponse);
    const entry = { route, errors, apiFailures, viewports: [] };
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      entry.status = response?.status();
      await page.locator("main").first().waitFor();
      await page.locator("h1").first().waitFor({ state: "attached", timeout: 30_000 });
      await page.waitForTimeout(1000);
      entry.destination = new URL(page.url()).pathname;
      entry.headings = await page.locator("h1").allTextContents();
      entry.alerts = (await page.locator('[role="alert"]').allTextContents()).map(redact).filter((value) => value.trim());
      entry.applicationError = await page.getByText(/Application error|Internal Server Error|Đã có lỗi xảy ra|Không thể tải dữ liệu/).count();
      entry.repeatedAppStrip = await page.getByRole("heading", { name: "Ứng dụng của tôi", exact: true }).count();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(120);
        const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        entry.viewports.push(layout);
        const slug = route.slice(1).replaceAll("/", "-") || "root";
        await page.screenshot({ path: path.join(output, `${slug}-${width}.png`), fullPage: true, animations: "disabled", timeout: 15_000 });
      }
      entry.ok = entry.status < 400 && entry.destination !== "/login" && !entry.applicationError && !entry.repeatedAppStrip && errors.length === 0 && apiFailures.length === 0 && entry.viewports.every((item) => !item.horizontalOverflow);
    } catch (error) {
      entry.failure = redact(error.message).slice(0, 1000);
      entry.ok = false;
    } finally {
      page.off("pageerror", onError);
      page.off("response", onResponse);
      await page.close();
    }
    report.results.push(entry);
    await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ route, ok: entry.ok, destination: entry.destination, status: entry.status, failures: apiFailures, errors: errors.length, alerts: entry.alerts, overflow: entry.viewports.some((item) => item.horizontalOverflow) }));
  }
  console.log(JSON.stringify({ completed: report.results.length, passed: report.results.filter((item) => item.ok).length, output }));
  if (report.results.some((item) => !item.ok)) process.exitCode = 1;
} finally {
  if (context) await context.request.post(`${baseUrl}/api/v1/auth/logout`).catch(() => undefined);
  await browser.close();
}

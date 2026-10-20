import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright-core";
import { observePage, pageContent } from "./page-ready.mjs";

const browserPath = process.env.UI_QA_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

test("readiness follows a redirect during font loading and waits for the destination font", { timeout: 30000 }, async (t) => {
  const font = await readFile(new URL("../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", import.meta.url));
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  let releaseInitialFont, releaseFinalFont;
  const initialFontGate = new Promise((resolve) => { releaseInitialFont = resolve; });
  const finalFontGate = new Promise((resolve) => { releaseFinalFont = resolve; });
  t.after(async () => { releaseInitialFont(); releaseFinalFont(); await browser.close(); });
  try {
    const page = await browser.newPage();
    const observer = observePage(page);
    await page.route("**/*", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith(".woff2")) {
        await (pathname === "/initial.woff2" ? initialFontGate : finalFontGate);
        await route.fulfill({ contentType: "font/woff2", body: font });
        return;
      }
      const destination = pathname === "/final";
      await route.fulfill({
        contentType: "text/html",
        body: `<style>@font-face{font-family:ReadinessFixture;src:url('/${destination ? "final" : "initial"}.woff2')}h1{font-family:ReadinessFixture}</style><main id="main-content"><h1>${destination ? "Final destination content" : "Initial redirect content"}</h1><main>Nested workspace</main></main>`
      });
    });
    await Promise.all([
      page.waitForRequest((request) => new URL(request.url()).pathname === "/initial.woff2"),
      page.goto("http://page-ready.test/start", { waitUntil: "domcontentloaded" })
    ]);
    await page.waitForFunction(() => document.fonts.status === "loading");
    let markFontWait;
    const fontWaitStarted = new Promise((resolve) => { markFontWait = resolve; });
    await page.exposeFunction("fixtureFontWaitStarted", () => { markFontWait(); });
    await page.evaluate(() => {
      for (const property of ["status", "ready"]) {
        const descriptor = Object.getOwnPropertyDescriptor(FontFaceSet.prototype, property);
        Object.defineProperty(document.fonts, property, {
          get() { void window.fixtureFontWaitStarted(); return descriptor.get.call(this); }
        });
      }
    });
    let completed = false;
    const readiness = observer.ready().then(() => { completed = true; });
    await fontWaitStarted;
    await Promise.all([
      page.waitForURL("http://page-ready.test/final", { waitUntil: "domcontentloaded" }),
      page.waitForRequest((request) => new URL(request.url()).pathname === "/final.woff2"),
      page.evaluate(() => { setTimeout(() => location.replace("/final"), 0); })
    ]);
    await page.waitForFunction(() => document.fonts.status === "loading");
    assert.equal(completed, false, "Readiness must wait for the destination font");
    releaseInitialFont();
    releaseFinalFont();
    await readiness;
    assert.equal(page.url(), "http://page-ready.test/final");
    assert.match(await pageContent(page).innerText(), /Final destination content/);
    assert.equal(await page.evaluate(() => document.fonts.status), "loaded");
    assert.deepEqual(observer.errors, []);
  } finally {
    releaseInitialFont();
    releaseFinalFont();
    await browser.close();
  }
});

test("readiness waits for content loading without swallowing runtime errors", { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  t.after(() => browser.close());
  try {
    const page = await browser.newPage();
    const observer = observePage(page);
    await page.setContent('<main id="main-content"><h1>Fixture workspace</h1><main>Nested content</main><div class="state-box--loading-pattern" role="status">Loading</div></main>');
    let completed = false;
    const readiness = observer.ready().then(() => { completed = true; });
    const runtimeError = page.waitForEvent("pageerror");
    await page.evaluate(() => { setTimeout(() => { throw new Error("Readiness fixture runtime failure"); }, 0); });
    await runtimeError;
    assert.equal(completed, false);
    await page.locator(".state-box--loading-pattern").evaluate((element) => element.remove());
    await readiness;
    assert.equal(await pageContent(page).getAttribute("id"), "main-content");
    assert.deepEqual(observer.errors, ["Readiness fixture runtime failure"]);
    await page.setContent("<main><h1>Standalone fallback content</h1></main>");
    await observer.ready();
    assert.equal(await pageContent(page).count(), 1);
  } finally { await browser.close(); }
});

test("readiness ignores router prefetches and optional address lookups but waits for business data", { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  let releasePrefetches, releaseApi;
  const prefetchGate = new Promise((resolve) => { releasePrefetches = resolve; });
  const apiGate = new Promise((resolve) => { releaseApi = resolve; });
  t.after(async () => { releasePrefetches(); releaseApi(); await browser.close(); });
  try {
    const page = await browser.newPage();
    const observer = observePage(page);
    let prefetchResponses = 0;
    await page.route("**/*", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith("/api/v1/prefetch-") || pathname === "/api/v1/attendance/address") {
        await prefetchGate;
        prefetchResponses++;
        await route.fulfill({ contentType: "application/json", body: "{}" });
        return;
      }
      if (pathname === "/api/v1/actual") {
        await apiGate;
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"Fixture API failure"}}' });
        return;
      }
      await route.fulfill({
        contentType: "text/html",
        body: `<main id="main-content"><h1>Static API documentation</h1></main><script>
          for (const value of ["1", "2", "3"]) fetch('/api/v1/prefetch-' + value, {headers: {'Next-Router-Prefetch': value}}).catch(() => {});
          fetch('/api/v1/prefetch-purpose', {headers: {Purpose: 'prefetch'}}).catch(() => {});
          fetch('/api/v1/attendance/address', {method: 'POST'}).catch(() => {});
        </script>`
      });
    });
    await Promise.all([
      ...["1", "2", "3", "purpose"].map((suffix) => page.waitForRequest((request) => new URL(request.url()).pathname === `/api/v1/prefetch-${suffix}`)),
      page.waitForRequest((request) => new URL(request.url()).pathname === "/api/v1/attendance/address"),
      page.goto("http://page-ready.test/prefetch", { waitUntil: "domcontentloaded" })
    ]);
    await observer.ready();
    assert.equal(prefetchResponses, 0, "Background prefetches must not block static content readiness");
    await Promise.all([
      page.waitForRequest((request) => new URL(request.url()).pathname === "/api/v1/actual"),
      page.evaluate(() => {
        void fetch("/api/v1/actual").then((response) => response.json()).then(() => {
          document.querySelector("h1").textContent = "Actual API response handled";
        });
      })
    ]);
    let completed = false;
    const readiness = observer.ready().then(async () => {
      completed = true;
      assert.match(await pageContent(page).innerText(), /Actual API response handled/);
    });
    assert.equal(completed, false);
    releaseApi();
    await readiness;
    assert.deepEqual(observer.errors, ["HTTP 503 /api/v1/actual"]);
    assert.equal(prefetchResponses, 0);
  } finally { releasePrefetches(); releaseApi(); await browser.close(); }
});

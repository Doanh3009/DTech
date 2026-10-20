import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3200";
const password = getTestPassword();
const label = process.env.UI_PERFORMANCE_LABEL || "before";
assert(["before", "after"].includes(label), "Use UI_PERFORMANCE_LABEL=before or after");
const environment = process.env.UI_PERFORMANCE_ENV || "production";
assert(["production", "development"].includes(environment), "Use UI_PERFORMANCE_ENV=production or development");
const outputFilename = `${label}${environment === "production" ? "" : "-dev"}.json`;
const availableRoles = ["test.supervisor", "test.employee", "test.payroll"];
const roles = process.env.UI_PERFORMANCE_ROLES ? process.env.UI_PERFORMANCE_ROLES.split(",") : availableRoles;
assert(roles.every((role) => availableRoles.includes(role)), "Profile only the disposable QA roles");
const sampleCount = Number(process.env.UI_PERFORMANCE_SAMPLES ?? 2);
assert(Number.isInteger(sampleCount) && sampleCount >= 0 && sampleCount <= 5, "UI_PERFORMANCE_SAMPLES must be between 0 and 5");
const output = path.resolve("docs/ui-evidence/performance");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const reports = [];
if (roles.length < availableRoles.length) {
  try {
    const previous = JSON.parse(await readFile(path.join(output, outputFilename), "utf8"));
    if (previous.baseUrl === baseUrl) reports.push(...previous.reports.filter((report) => !roles.includes(report.username)));
  } catch { /* A filtered first run starts its own evidence file. */ }
}

function rounded(value) { return Math.round(value * 10) / 10; }
function summarize(requests) {
  const groups = new Map();
  for (const request of requests) {
    const key = request.path + (request.rsc ? " [RSC]" : "");
    const group = groups.get(key) || { path: key, count: 0, prefetch: 0, totalMs: 0, longestMs: 0, bytes: 0, statuses: new Set() };
    group.count += 1;
    group.prefetch += Number(request.prefetch);
    group.totalMs += request.durationMs || 0;
    group.longestMs = Math.max(group.longestMs, request.durationMs || 0);
    group.bytes += request.bytes || 0;
    group.statuses.add(request.status);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, totalMs: rounded(group.totalMs), longestMs: rounded(group.longestMs), statuses: [...group.statuses] })).sort((a, b) => b.longestMs - a.longestMs);
}

async function begin(username) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN", reducedMotion: "reduce" });
  const login = await context.request.post(`${baseUrl}/api/v1/auth/login`, { data: { username, password } });
  assert(login.ok(), `QA login failed: ${username} ${login.status()}`);
  await context.addInitScript(() => {
    window.__qaLongTasks = [];
    window.__qaPaints = [];
    try {
      new PerformanceObserver((list) => window.__qaLongTasks.push(...list.getEntries().map((entry) => ({ startTime: entry.startTime, duration: entry.duration })))).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => window.__qaPaints.push(...list.getEntries().map((entry) => ({ name: entry.name, startTime: entry.startTime })))).observe({ type: "paint", buffered: true });
    } catch { /* Browsers without Long Task support still retain navigation timing. */ }
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  const requests = [];
  const pending = new Set();
  const started = new WeakMap();
  const failures = [];
  let phase = "initial";
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(baseUrl).origin) return;
    const entry = { path: url.pathname, method: request.method(), phase, resourceType: request.resourceType(), rsc: url.searchParams.has("_rsc"), prefetch: request.headers()["next-router-prefetch"] === "1" || request.headers().purpose === "prefetch", status: 0, durationMs: 0, ttfbMs: 0, bytes: 0, completed: false };
    requests.push(entry);
    started.set(request, { at: performance.now(), entry });
  });
  page.on("response", (response) => {
    const info = started.get(response.request());
    if (!info) return;
    info.entry.status = response.status();
    info.entry.ttfbMs = rounded(performance.now() - info.at);
  });
  page.on("requestfinished", (request) => {
    const promise = (async () => {
      const info = started.get(request);
      if (!info) return;
      const timing = request.timing();
      let bytes = 0;
      try { const sizes = await request.sizes(); bytes = sizes.responseBodySize + sizes.responseHeadersSize; } catch { /* Redirects may not expose encoded sizes. */ }
      Object.assign(info.entry, { durationMs: rounded(performance.now() - info.at), ttfbMs: rounded(timing.responseStart >= 0 ? timing.responseStart : info.entry.ttfbMs), bytes, completed: true });
    })();
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
  });
  page.on("requestfailed", (request) => {
    const info = started.get(request);
    if (info) Object.assign(info.entry, { durationMs: rounded(performance.now() - info.at), failure: request.failure()?.errorText });
    if (request.failure()?.errorText !== "net::ERR_ABORTED") failures.push(`${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`);
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const diagnostic = environment === "development" && url.pathname === "/__nextjs_original-stack-frames";
    if (url.origin === new URL(baseUrl).origin && !diagnostic && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      failures.push(`Write blocked: ${request.method()} ${url.pathname}`);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return { context, page, requests, failures, setPhase: (value) => { phase = value; }, flush: async () => { await Promise.allSettled([...pending]); } };
}

async function ready(page, route) {
  await page.locator("#main-content h1:visible").first().waitFor();
  if (route === "/dashboard") await page.locator("[data-dashboard-metric]").first().waitFor();
  if (route === "/employees") await page.locator(".data-table tbody tr").first().waitFor();
  await page.waitForFunction(() => !document.querySelector("#main-content .state-box--loading-pattern"));
  assert.equal(await page.locator("#main-content .state-box--error").count(), 0, `Data error on ${route}`);
}

async function browserTiming(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      navigation: navigation ? { ttfbMs: navigation.responseStart - navigation.requestStart, responseEndMs: navigation.responseEnd, domContentLoadedMs: navigation.domContentLoadedEventEnd, loadMs: navigation.loadEventEnd, transferBytes: navigation.transferSize, decodedHtmlBytes: navigation.decodedBodySize } : null,
      paints: window.__qaPaints || [],
      longTasks: window.__qaLongTasks || []
    };
  });
}

async function watchTransition(page, waitForClick) {
  await page.evaluate((waiting) => {
    const state = { start: performance.now(), started: !waiting, from: location.pathname, firstLoaderMs: null, urlChangeMs: null, frame: 0 };
    const onClick = () => { state.start = performance.now(); state.started = true; };
    if (waiting) document.addEventListener("click", onClick, { once: true, capture: true });
    const inspect = () => {
      if (!state.started) return;
      if (state.urlChangeMs === null && location.pathname !== state.from) state.urlChangeMs = performance.now() - state.start;
      if (state.firstLoaderMs === null) {
        const main = document.querySelector("#main-content");
        const loader = main?.querySelector('.state-box--loading-pattern, .employee-list-loading, .module-transition, [role="status"][aria-label^="Đang tải"]');
        if (loader && loader.getBoundingClientRect().height > 0) state.firstLoaderMs = performance.now() - state.start;
      }
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.querySelector("#main-content") || document.body, { childList: true, subtree: true, attributes: true });
    const loop = () => { inspect(); state.frame = requestAnimationFrame(loop); };
    loop();
    window.__qaTransition = { state, observer, onClick };
  }, waitForClick);
}

async function finishTransition(page) {
  return page.evaluate(() => {
    const { state, observer, onClick } = window.__qaTransition;
    observer.disconnect();
    cancelAnimationFrame(state.frame);
    document.removeEventListener("click", onClick, true);
    return { firstLoaderMs: state.firstLoaderMs, urlChangeMs: state.urlChangeMs, dataReadyMs: performance.now() - state.start };
  });
}

try {
  for (const username of roles) {
    const session = await begin(username);
    const { context, page, requests, failures } = session;
    try {
      const directSamples = [];
      if (!sampleCount) {
        await page.goto(`${baseUrl}/dashboard`, { waitUntil: "load" });
        await ready(page, "/dashboard");
      }
      for (let sample = 0; sample < sampleCount; sample += 1) {
        session.setPhase(`dashboard-direct-${sample + 1}`);
        const start = performance.now();
        const response = await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
        const headersMs = rounded(performance.now() - start);
        assert(response?.ok(), `Dashboard navigation failed for ${username}`);
        await ready(page, "/dashboard");
        const readyMs = rounded(performance.now() - start);
        await page.waitForLoadState("load");
        await page.waitForTimeout(2000);
        await session.flush();
        const timing = await browserTiming(page);
        directSamples.push({ headersMs, readyMs, ...timing });
        console.log(`${label} ${username} dashboard sample${sample + 1}: headers ${headersMs}ms, visible data ${readyMs}ms, longtasks ${timing.longTasks.length}, phase requests ${requests.filter((request) => request.phase === `dashboard-direct-${sample + 1}`).length}`);
      }

      session.setPhase("dashboard-idle");
      await page.waitForTimeout(5000);
      await session.flush();

      session.setPhase("dashboard-focus-burst");
      await page.evaluate(() => {
        for (let index = 0; index < 6; index += 1) window.dispatchEvent(new Event("focus"));
      });
      await page.waitForTimeout(2000);
      await session.flush();

      session.setPhase("dashboard-focus");
      const otherTab = await context.newPage();
      await otherTab.goto("about:blank");
      await otherTab.bringToFront();
      await page.waitForTimeout(250);
      await page.bringToFront();
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForTimeout(2500);
      await otherTab.close();
      await session.flush();

      const transitions = [];
      let mobileScroll = null;
      if (username === "test.supervisor") {
        session.setPhase("sidebar-to-employees");
        const employeeLink = page.locator('.app-rail a[href="/employees"]').first();
        await employeeLink.waitFor();
        await watchTransition(page, true);
        let start = performance.now();
        await employeeLink.click();
        await page.waitForURL((url) => url.pathname === "/employees");
        await ready(page, "/employees");
        transitions.push({ route: "/employees", kind: "sidebar", readyMs: rounded(performance.now() - start), feedback: await finishTransition(page) });
        await page.waitForTimeout(2000);
        await session.flush();

        session.setPhase("browser-back-to-dashboard");
        await watchTransition(page, false);
        start = performance.now();
        await page.goBack({ waitUntil: "commit" });
        await page.waitForURL((url) => url.pathname === "/dashboard");
        await ready(page, "/dashboard");
        transitions.push({ route: "/dashboard", kind: "browser-back", readyMs: rounded(performance.now() - start), feedback: await finishTransition(page) });
        await page.waitForTimeout(2000);
        await session.flush();

        session.setPhase("mobile-scroll-frames");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => document.fonts.ready);
        mobileScroll = await page.evaluate(async () => {
          const frames = [];
          const start = performance.now();
          const scrollStart = window.scrollY;
          const distance = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          let previous = start;
          for (let frame = 0; frame < 60; frame += 1) {
            const timestamp = await new Promise((resolve) => requestAnimationFrame(resolve));
            frames.push(timestamp - previous);
            previous = timestamp;
            window.scrollTo(0, distance * frame / 59);
          }
          window.scrollTo(0, scrollStart);
          const sorted = [...frames].sort((a, b) => a - b);
          return { durationMs: performance.now() - start, count: frames.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * 0.95)], worstMs: sorted.at(-1), framesOver34Ms: frames.filter((value) => value > 34).length, distancePx: distance, caveat: "Headless software browser sample; physical device performance was not measured." };
        });
      }

      if (!sampleCount) {
        try {
          const previous = JSON.parse(await readFile(path.join(output, outputFilename), "utf8"));
          const previousReport = previous.reports.find((report) => report.username === username);
          directSamples.push(...(previousReport?.directSamples || []));
          requests.push(...(previousReport?.requests.filter((request) => request.phase.startsWith("dashboard-direct-")) || []));
        } catch { /* A navigation-only first run has no direct samples. */ }
      }
      const phases = [...new Set(requests.map((request) => request.phase))].map((phase) => {
        const entries = requests.filter((request) => request.phase === phase);
        return { phase, requestCount: entries.length, apiCount: entries.filter((request) => request.path.startsWith("/api/")).length, rscCount: entries.filter((request) => request.rsc).length, totalBytes: entries.reduce((sum, request) => sum + request.bytes, 0), endpoints: summarize(entries) };
      });
      reports.push({ username, directSamples, transitions, mobileScroll, phases, requests, failures });
      assert.deepEqual(failures, [], `Runtime/read-only QA failures for ${username}`);
      await writeFile(path.join(output, outputFilename), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, label, environment, viewport: { width: 1440, height: 900 }, reports }, null, 2)}\n`, "utf8");
      const focus = phases.find((entry) => entry.phase === "dashboard-focus");
      const idle = phases.find((entry) => entry.phase === "dashboard-idle");
      const burst = phases.find((entry) => entry.phase === "dashboard-focus-burst");
      console.log(`${label} ${username} idle requests ${idle?.requestCount || 0}, focus requests ${focus?.requestCount || 0}, burst requests ${burst?.requestCount || 0}; transitions ${JSON.stringify(transitions)}; mobile scroll ${JSON.stringify(mobileScroll)}`);
    } finally { await context.close(); }
  }
  console.log(`PASS read-only performance capture: ${path.join(output, outputFilename)}`);
} finally { await browser.close(); }

import assert from "node:assert/strict";

export function pageContent(page) {
  return page.locator("#main-content").or(page.locator("main").first()).first();
}

const loadingSelector = '.state-box--loading-pattern, [aria-busy="true"], .loading-spinner, .skeleton, [data-ui="loading-spinner"]';

function isPrefetchRequest(request) {
  const headers = request.headers();
  return ["1", "2", "3"].includes(headers["next-router-prefetch"]) ||
    /\bprefetch\b/i.test(`${headers.purpose ?? ""} ${headers["sec-purpose"] ?? ""}`);
}

export function observePage(page) {
  const pending = new Set();
  const navigationRequests = new Set();
  const errors = [];
  let lastRequest = performance.now();
  let navigationEpoch = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) { pending.clear(); navigationEpoch++; lastRequest = performance.now(); }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    void response.finished().then(() => {
      if (pending.delete(response.request())) lastRequest = performance.now();
    }).catch(() => pending.delete(response.request()));
  });
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigationRequests.add(request); navigationEpoch++; lastRequest = performance.now();
    }
    const pathname = new URL(request.url()).pathname;
    // Address enrichment may queue provider retries after the table is usable.
    // Core data, visible loaders and runtime failures still gate readiness.
    const backgroundRequest = pathname === "/api/v1/attendance/address" || /^\/api\/v1\/(workspace\/|auth\/realtime-token|chat\/unread|notifications\/unread-count|system-notices\/active)/.test(pathname);
    if (pathname.startsWith("/api/") && !backgroundRequest && !isPrefetchRequest(request) && ["fetch", "xhr"].includes(request.resourceType())) {
      pending.add(request); lastRequest = performance.now();
    }
  });
  const done = (request) => {
    const apiFinished = pending.delete(request);
    const navigationFinished = navigationRequests.delete(request);
    if (apiFinished || navigationFinished) lastRequest = performance.now();
  };
  page.on("requestfinished", done);
  page.on("requestfailed", (request) => {
    done(request);
    if (new URL(request.url()).pathname.startsWith("/api/") && request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`);
  });
  return {
    errors,
    async ready() {
      const deadline = performance.now() + 30000;
      const timeout = () => Math.max(1, Math.ceil(deadline - performance.now()));
      while (performance.now() < deadline) {
        const epoch = navigationEpoch;
        try {
          await pageContent(page).waitFor({ timeout: timeout() });
          await page.waitForFunction((selector) => {
            const main = document.getElementById("main-content") ?? document.querySelector("main");
            return main && main.innerText.trim().length > 5 && !main.matches(selector) && !main.querySelector(selector);
          }, loadingSelector, { timeout: timeout() });
          while (pending.size || navigationRequests.size || performance.now() - lastRequest < 180) {
            assert(performance.now() < deadline, `Trang chưa tải xong sau 30 giây: ${[...pending, ...navigationRequests].map((request) => new URL(request.url()).pathname).join(", ")}`);
            await page.waitForTimeout(Math.min(50, timeout()));
          }
          // Rerunnable polling follows redirects into the destination document.
          // Recheck UI after requests finish so a heading cannot hide data errors.
          await page.waitForFunction((selector) => {
            const main = document.getElementById("main-content") ?? document.querySelector("main");
            return document.fonts.status === "loaded" && document.readyState === "complete" &&
              main && main.innerText.trim().length > 5 && !main.matches(selector) && !main.querySelector(selector);
          }, loadingSelector, { timeout: timeout() });
          if (epoch === navigationEpoch && !pending.size && !navigationRequests.size && performance.now() - lastRequest >= 180) return;
        } catch (error) {
          if (!/Execution context was destroyed/.test(error.message) || page.isClosed() || performance.now() >= deadline) throw error;
        }
      }
      assert.fail("Trang chưa ổn định sau 30 giây");
    }
  };
}

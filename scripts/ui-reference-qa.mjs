import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright-core";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3200";
const password = getTestPassword();
const output = path.resolve("docs/ui-evidence/reference-match");
const viewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 }
];
const roles = ["test.supervisor", "test.employee", "test.payroll"];
const evidence = [];
const sidebarInteractions = [];
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

function compact(value) {
  return String(value).normalize("NFC").replace(/[\s\u00a0]/g, "");
}

async function railState(page, expanded) {
  const targetWidth = expanded ? 232 : 84;
  await page.waitForFunction(({ expanded, targetWidth }) => {
    const rail = document.querySelector(".app-rail");
    const button = rail?.querySelector(".app-rail__collapse");
    return button?.getAttribute("aria-expanded") === String(expanded) && Math.abs(rail.getBoundingClientRect().width - targetWidth) <= 1;
  }, { expanded, targetWidth });
  const state = await page.locator(".app-rail").evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    expanded: element.querySelector(".app-rail__collapse")?.getAttribute("aria-expanded"),
    links: [...element.querySelectorAll(".app-rail__link")].map((link) => {
      const label = link.querySelector(":scope > span");
      const icon = link.querySelector("svg");
      return {
        href: link.getAttribute("href"),
        name: link.getAttribute("aria-label") || label?.textContent?.trim() || "",
        labelVisible: Boolean(label?.textContent?.trim() && label.getBoundingClientRect().width > 0 && label.getBoundingClientRect().height > 0),
        iconVisible: Boolean(icon && icon.getBoundingClientRect().width >= 16 && icon.getBoundingClientRect().height >= 16)
      };
    })
  }));
  assert(state.links.length > 0 && state.links.every((link) => link.iconVisible && link.name), "Sidebar actions need visible icons and accessible function names");
  assert(state.links.every((link) => link.labelVisible === expanded), expanded ? "The expanded sidebar must display each function label beside its icon" : "The compact sidebar must retain accessible names while hiding visual labels");
  if (expanded) assert(await page.locator(".app-rail__collapse").getByText("Thu gọn", { exact: true }).isVisible(), "The expanded sidebar needs a visible collapse label");
  return state;
}

async function verifySidebarPersistence(page, errors) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "load" });
  await page.locator("[data-dashboard-metric]").first().waitFor();
  const expanded = await railState(page, true);
  const destinations = expanded.links.map(({ href, name }) => ({ href, name }));
  const mockedChoices = [];
  const preferenceRoute = "**/api/v1/workspace/preferences";
  const mockPreferenceSave = async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    const preferences = route.request().postDataJSON();
    assert.equal(typeof preferences.sidebarCollapsed, "boolean", "Sidebar preference saves must contain an explicit layout choice");
    mockedChoices.push(preferences.sidebarCollapsed);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: preferences }) });
  };
  // Fulfill only the layout preference PUT locally. Every other write continues
  // through the read-only guard; the real server preference is never changed.
  await page.route(preferenceRoute, mockPreferenceSave);
  try {
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/workspace/preferences" && response.request().method() === "PUT"),
      page.getByRole("button", { name: "Thu gọn điều hướng", exact: true }).click()
    ]);
    const collapsed = await railState(page, false);
    assert.deepEqual(collapsed.links.map(({ href, name }) => ({ href, name })), destinations, "Collapsing the sidebar must preserve all permitted destinations and accessible names");
    const compactPreference = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith("ct:sidebar-layout:v2:"));
      return keys.map((key) => ({ key, value: localStorage.getItem(key) }));
    });
    assert.equal(compactPreference.length, 1, "Sidebar layout must persist in the current account's versioned key");
    assert.equal(compactPreference[0].value, "compact");
    await page.reload({ waitUntil: "load" });
    const compactReloaded = await railState(page, false);
    assert.deepEqual(compactReloaded.links.map(({ href, name }) => ({ href, name })), destinations);
    await page.locator("[data-dashboard-metric]").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, "test.supervisor-sidebar-compact-1440.png"), fullPage: true, animations: "disabled" });

    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/workspace/preferences" && response.request().method() === "PUT"),
      page.getByRole("button", { name: "Mở rộng điều hướng", exact: true }).click()
    ]);
    const reopened = await railState(page, true);
    assert.deepEqual(reopened.links.map(({ href, name }) => ({ href, name })), destinations);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), compactPreference[0].key), "expanded");
    await page.reload({ waitUntil: "load" });
    const expandedReloaded = await railState(page, true);
    assert.deepEqual(expandedReloaded.links.map(({ href, name }) => ({ href, name })), destinations);
    await page.locator("[data-dashboard-metric]").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, "test.supervisor-sidebar-expanded-1440.png"), fullPage: true, animations: "disabled" });
    assert.deepEqual(mockedChoices, [true, false], "Only the two expected local sidebar preference saves should occur");
    assert.deepEqual(errors, [], "Sidebar persistence must not introduce runtime/API errors");
    sidebarInteractions.push({ username: "test.supervisor", viewport: { width: 1440, height: 900 }, initialWidth: expanded.width, collapsedWidth: compactReloaded.width, reopenedWidth: expandedReloaded.width, destinations, persistedValues: ["compact", "expanded"], mockedPreferenceWrites: mockedChoices.length });
    console.log("PASS labelled sidebar: default 232px, collapse 84px, expand 232px, account-local persistence and unchanged navigation");
  } finally { await page.unroute(preferenceRoute, mockPreferenceSave); }
}

async function verifyReadModel(context, username) {
  const response = await context.request.get(`${baseUrl}/api/v1/dashboard`);
  assert(response.ok(), `Dashboard API access failed for ${username}: ${response.status()}`);
  const body = await response.json();
  assert(body.data && Array.isArray(body.data.widgets), `Dashboard read model missing for ${username}`);
  const metrics = body.data.widgets.flatMap((widget) => widget.data?.metrics || []);
  assert(metrics.length > 0, `QA dashboard has no real metrics for ${username}`);
  assert(metrics.every((metric) => metric.label && (typeof metric.value === "string" || Number.isFinite(metric.value))), "Dashboard metrics must contain real labels and valid values");
  assert(!body.data.widgets.some((widget) => widget.status === "error"), `Dashboard widget failed for ${username}`);
  return body.data;
}

async function verifyHeaderControls(page) {
  const geometry = await page.evaluate(() => {
    const selectors = [
      { name: "search", selector: ".app-header__search .header-search" },
      { name: "messages", selector: ".app-header__actions > .message-bell" },
      { name: "notifications", selector: ".app-header__actions > .notification-bell:not(.message-bell)" },
      { name: "user", selector: ".app-header__actions > .dropdown .dropdown__trigger" }
    ];
    const box = (element) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!bounds.width || !bounds.height || style.display === "none" || style.visibility === "hidden") return null;
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
    };
    const header = document.querySelector(".app-header");
    const search = document.querySelector(".app-header__search .header-search");
    return {
      header: box(header),
      gridColumns: getComputedStyle(header).gridTemplateColumns,
      controls: selectors.flatMap(({ name, selector }) => {
        const bounds = box(document.querySelector(selector));
        return bounds ? [{ name, ...bounds }] : [];
      }),
      searchChildren: search ? [...search.children].flatMap((element) => {
        const bounds = box(element);
        return bounds ? [{ name: element.tagName.toLowerCase(), ...bounds }] : [];
      }) : []
    };
  });
  for (const name of ["search", "notifications", "user"]) assert(geometry.controls.some((control) => control.name === name), `Desktop/tablet header must expose ${name}`);
  for (const control of geometry.controls) {
    assert(control.left >= geometry.header.left - 1 && control.right <= geometry.header.right + 1 && control.top >= geometry.header.top - 1 && control.bottom <= geometry.header.bottom + 1, `Header ${control.name} exceeds its header bounds: ${JSON.stringify(geometry)}`);
  }
  for (let index = 0; index < geometry.controls.length; index += 1) {
    for (const next of geometry.controls.slice(index + 1)) {
      const control = geometry.controls[index];
      const intersectionWidth = Math.min(control.right, next.right) - Math.max(control.left, next.left);
      const intersectionHeight = Math.min(control.bottom, next.bottom) - Math.max(control.top, next.top);
      assert(intersectionWidth <= 1 || intersectionHeight <= 1, `Header ${control.name} overlaps ${next.name}: ${JSON.stringify(geometry)}`);
    }
  }
  const search = geometry.controls.find((control) => control.name === "search");
  assert(geometry.searchChildren.every((child) => child.left >= search.left - 1 && child.right <= search.right + 1), `Search text, shortcut and icon must remain inside the search button: ${JSON.stringify(geometry)}`);
  return geometry;
}

async function capture(page, route, username, viewport, readModel, errors) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
  assert(response && response.status() < 400, `${username} ${route} returned ${response?.status()}`);
  assert.equal(new URL(page.url()).pathname, route, `${username} unexpectedly redirected from ${route}`);
  const main = page.locator("#main-content");
  await main.waitFor();
  await main.locator("h1:visible").first().waitFor();
  await page.waitForFunction(() => !document.querySelector("#main-content .state-box--loading-pattern"));
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await main.locator("h1:visible").count(), 1, `One visible main heading required for ${username} ${route}`);
  assert.equal(await main.locator(".state-box--error").count(), 0, `Data load failed for ${username} ${route}`);
  assert.equal(await main.locator("select:visible, datalist:visible").count(), 0, "Feature selects must use the shared styled control");

  const layout = await page.evaluate(() => {
    const main = document.querySelector("#main-content");
    const mainStyle = getComputedStyle(main);
    const canvasStyle = getComputedStyle(document.querySelector(".app-content") || main);
    const rootStyle = getComputedStyle(document.documentElement);
    const header = document.querySelector(".app-header")?.getBoundingClientRect();
    const rail = document.querySelector(".app-rail")?.getBoundingClientRect();
    const tokenNames = ["--workspace-canvas", "--surface", "--surface-border", "--shadow-card", "--shadow-control", "--radius-card-large", "--sidebar-width", "--topbar-height", "--reference-surface", "--reference-shadow", "--reference-panel-radius", "--reference-orange", "--reference-cyan", "--reference-violet"];
    return {
      width: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      canvas: { backgroundColor: canvasStyle.backgroundColor, backgroundImage: canvasStyle.backgroundImage, mainBackgroundColor: mainStyle.backgroundColor },
      tokens: Object.fromEntries(tokenNames.map((name) => [name, rootStyle.getPropertyValue(name).trim()])),
      header: header ? { top: header.top, bottom: header.bottom, height: header.height } : null,
      rail: rail ? { width: rail.width, height: rail.height, expanded: document.querySelector(".app-rail__collapse")?.getAttribute("aria-expanded") } : null
    };
  });
  assert(layout.width <= layout.viewportWidth + 1, `${username} ${route} overflows at ${viewport.width}px`);
  assert(layout.header && layout.header.top >= 0 && layout.header.bottom < viewport.height / 2, "Shell header must stay within the top of the viewport");
  assert(layout.canvas.backgroundImage !== "none", "Reference workspace requires the softly tinted canvas");
  assert(layout.tokens["--shadow-card"] && layout.tokens["--shadow-card"] !== "none", "Reference cards require a shared elevation token");
  let headerControls = null;
  if (viewport.width >= 768) {
    assert(layout.rail && Math.abs(layout.rail.width - 232) <= 1, "Fresh desktop and tablet sessions must open the labelled 232px sidebar");
    assert.equal(layout.rail.expanded, "true", "The default sidebar must expose expanded state and an accessible collapse action");
    await railState(page, true);
    headerControls = await verifyHeaderControls(page);
  }

  let dashboard = null;
  let employeeMaterial = null;
  if (route === "/dashboard") {
    const launcherOrder = await page.locator("[data-dashboard-applications]").evaluate((element) => ({
      first: element.parentElement?.firstElementChild === element,
      beforeAnalytics: Boolean(element.compareDocumentPosition(element.parentElement.querySelector('section[aria-label="Tổng quan"]')) & Node.DOCUMENT_POSITION_FOLLOWING),
      links: element.querySelectorAll("a").length
    }));
    assert(launcherOrder.first && launcherOrder.beforeAnalytics && launcherOrder.links > 0, "Applications must appear first, above the dashboard analytics");
    await page.locator("[data-dashboard-metric]").first().waitFor();
    const cards = await page.locator("[data-dashboard-metric]").evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        label: element.getAttribute("data-metric-label"),
        value: element.getAttribute("data-metric-value"),
        text: element.textContent,
        boxShadow: style.boxShadow,
        backgroundImage: style.backgroundImage,
        borderRadius: style.borderRadius
      };
    }));
    const modelMetrics = readModel.widgets.flatMap((widget) => widget.data?.metrics || []);
    assert(cards.length >= 1 && cards.length <= modelMetrics.length, "Display only real, permitted dashboard metrics");
    for (const card of cards) {
      const metric = modelMetrics.find((entry) => card.label ? entry.label === card.label : card.text.includes(entry.label));
      assert(metric, `Dashboard card is missing from the real read model: ${card.label || card.text}`);
      const value = typeof metric.value === "number" ? new Intl.NumberFormat("vi-VN").format(metric.value) : metric.value;
      assert(card.value !== null ? compact(card.value) === compact(metric.value) : compact(card.text).includes(compact(value)), `Dashboard metric does not match real data: ${metric.label}`);
      assert(card.boxShadow !== "none", `Metric ${metric.label} needs the visible soft card elevation`);
      assert(parseFloat(card.borderRadius) >= 10, `Metric ${metric.label} needs the rounded card geometry`);
    }
    const panels = await page.locator("[data-dashboard-panel]").evaluateAll((elements) => elements.map((element) => ({
      kind: element.getAttribute("data-chart-kind"),
      boxShadow: getComputedStyle(element).boxShadow,
      borderRadius: getComputedStyle(element).borderRadius,
      title: element.querySelector("h2")?.textContent || null
    })));
    assert(panels.length > 0, "Dashboard reference layout requires content panels");
    assert(panels.every((panel) => panel.boxShadow !== "none" && parseFloat(panel.borderRadius) >= 10), "Dashboard panels must share the soft elevated material");
    const gauges = await page.locator('[data-chart-kind="gauge"]').evaluateAll((elements) => elements.map((element) => ({
      title: element.querySelector("h2")?.textContent,
      accessibleValue: element.querySelector('svg[role="img"]')?.getAttribute("aria-label")
    })));
    for (const gauge of gauges) {
      const source = readModel.widgets.flatMap((widget) => widget.data?.charts || []).find((chart) => chart.title === gauge.title);
      assert(source && source.unit === "%" && source.series.length === 1, "Each gauge must represent a real single percentage series");
      const point = source.series[0];
      assert(point.value >= 0 && point.value <= 100, "Percentage gauges must stay within their actual 0–100 domain");
      assert.equal(gauge.accessibleValue, `${point.label}: ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(point.value)}%`, "The accessible gauge value must match the real read model");
    }
    dashboard = { profile: readModel.profile, cards, panels, gauges };
  } else {
    await page.locator(viewport.width < 768 ? ".mobile-record" : ".data-table tbody tr").first().waitFor();
    employeeMaterial = await page.locator(".workbench-layout.employee-roster").evaluate((element) => {
      const style = getComputedStyle(element);
      const reference = document.createElement("span");
      reference.style.cssText = "position:absolute;visibility:hidden;background-color:var(--reference-surface)";
      element.appendChild(reference);
      const referenceColor = getComputedStyle(reference).backgroundColor;
      reference.remove();
      return { backgroundColor: style.backgroundColor, referenceColor, boxShadow: style.boxShadow, borderRadius: style.borderRadius, innerBackgroundColor: getComputedStyle(element.querySelector(".work-canvas")).backgroundColor };
    });
    assert.equal(employeeMaterial.backgroundColor, employeeMaterial.referenceColor, "The employee roster must use the shared pearl reference surface");
    assert(employeeMaterial.boxShadow !== "none" && parseFloat(employeeMaterial.borderRadius) >= 10, "The employee roster must retain the same soft elevation and rounded geometry as dashboard panels");
    assert.equal(employeeMaterial.innerBackgroundColor, "rgba(0, 0, 0, 0)", "The inner work canvas must preserve the outer pearl material");
  }

  assert.deepEqual(errors, [], `${username} ${route} runtime/API errors`);
  const filename = `${username}-${route.slice(1).replaceAll("/", "-")}-${viewport.width}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: "disabled" });
  evidence.push({ username, route, viewport, screenshot: filename, layout, dashboard, employeeMaterial, headerControls });
  console.log(`PASS reference appearance and real data ${username} ${route} ${viewport.width}x${viewport.height}`);
}

try {
  for (const username of roles) {
    const context = await browser.newContext({ viewport: viewports[0], locale: "vi-VN", reducedMotion: "reduce" });
    try {
      const login = await context.request.post(`${baseUrl}/api/v1/auth/login`, { data: { username, password } });
      assert(login.ok(), `QA login failed for ${username}: ${login.status()}`);
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(60_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 500 && new URL(response.url()).pathname.startsWith("/api/")) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      });
      // Authenticate first, then make every browser interaction read-only.
      // The request context below is used only for GET dashboard validation.
      await page.route("**/*", async (route) => {
        const request = route.request();
        const requestUrl = new URL(request.url());
        // Next dev uses POST to read original stack frames. This diagnostic
        // endpoint does not create application data and is absent in production.
        const isDevelopmentDiagnostic = requestUrl.pathname === "/__nextjs_original-stack-frames";
        if (requestUrl.origin === new URL(baseUrl).origin && !isDevelopmentDiagnostic && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
          errors.push(`Unexpected write blocked: ${request.method()} ${new URL(request.url()).pathname}`);
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        const readModel = await verifyReadModel(context, username);
        await capture(page, "/dashboard", username, viewport, readModel, errors);
        if (username === "test.supervisor") await capture(page, "/employees", username, viewport, null, errors);
      }
      if (username === "test.supervisor") await verifySidebarPersistence(page, errors);
    } finally { await context.close(); }
  }
  await writeFile(path.join(output, "appearance-evidence.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, captures: evidence, sidebarInteractions }, null, 2)}\n`, "utf8");
  console.log(`PASS ${evidence.length} reference captures and ${sidebarInteractions.length} sidebar persistence scenario. Evidence: ${output}`);
} finally { await browser.close(); }

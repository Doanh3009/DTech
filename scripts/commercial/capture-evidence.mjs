import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: {
    "unit-log": { type: "string", default: ".tmp/erp-unit-final.log" },
    output: { type: "string", default: "docs/commercial-erp/evidence/qa-summary.json" }
  },
  allowPositionals: true
});

async function read(file) {
  const bytes = await readFile(file);
  return bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString("utf16le") : bytes.toString("utf8").replace(/^\uFEFF/, "");
}
const unitLog = (await read(values["unit-log"])).replace(/\u001b\[[0-9;]*m/g, "");
const unit = /Tests\s+(\d+) passed\s*\|\s*(\d+) skipped\s*\((\d+)\)/.exec(unitLog);
if (!unit) throw new Error("Chưa có kết quả unit test hoàn tất và không lỗi.");
const browserFiles = positionals;
if (!browserFiles.length) browserFiles.push(".tmp/erp-site-review/report.json");
const routes = new Map();
const supplementaryChecks = [];
const browserScopes = [];
for (const file of browserFiles) {
  const report = JSON.parse(await read(file));
  if (report.passed === false || report.failure || !Array.isArray(report.results) || report.results.length === 0) {
    throw new Error(`Browser acceptance chưa hoàn tất: ${file}`);
  }
  if (report.checks) supplementaryChecks.push(report.checks);
  browserScopes.push({ checkedAt: report.generatedAt, publishesConfiguration: report.publishesConfiguration === true });
  for (const result of report.results) {
    const previous = routes.get(result.route);
    const viewports = new Map();
    for (const viewport of [...(previous?.viewports ?? []), ...(result.viewports ?? [])]) {
      const existing = viewports.get(viewport.width);
      viewports.set(viewport.width, { ...viewport,
        documentWidth: Math.max(existing?.documentWidth ?? 0, viewport.documentWidth),
        horizontalOverflow: existing?.horizontalOverflow === true || viewport.horizontalOverflow === true
      });
    }
    routes.set(result.route, {
      route: result.route, destination: result.destination, status: result.status,
      routeKind: result.routeKind === "dynamic" ? "dynamic" : "static",
      passed: (previous?.passed ?? true) && result.ok === true,
      runtimeErrors: (previous?.runtimeErrors ?? 0) + (result.errors?.length ?? 0),
      apiFailures: [...(previous?.apiFailures ?? []), ...(result.apiFailures?.map(({ path, status }) => ({ path, status })) ?? [])],
      viewports: [...viewports.values()].sort((a, b) => a.width - b.width),
      visits: (previous?.visits ?? 0) + 1, failure: result.failure ?? previous?.failure,
      checkedAt: report.generatedAt
    });
  }
}
const summary = {
  capturedAt: new Date().toISOString(),
  unit: { passed: Number(unit[1]), skipped: Number(unit[2]), total: Number(unit[3]) },
  supplementaryChecks,
  browserScopes,
  browser: {
    checkedStaticRoutes: [...routes.values()].filter((result) => result.routeKind === "static").length,
    checkedDynamicTemplates: [...routes.values()].filter((result) => result.routeKind === "dynamic").length,
    passed: [...routes.values()].filter((result) => result.passed).length,
    routes: [...routes.values()]
  },
  boundaries: ["No production deployment or production migration was executed; development migration evidence is recorded separately when applicable.", "No operational documents were created by browser audit; explicit configuration publishing is recorded in browserScopes.", "Only listed dynamic templates are visually checked; business mutations, adversarial cross-role flows, business document concurrency, UAT and restore drill remain separate acceptance gates.", "Screenshots and raw logs remain local; this artifact omits account names, cookies, tokens and record bodies."]
};
await mkdir("docs/commercial-erp/evidence", { recursive: true });
await writeFile(values.output, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ unit: summary.unit, staticRoutes: summary.browser.checkedStaticRoutes, dynamicTemplates: summary.browser.checkedDynamicTemplates, passed: summary.browser.passed }));

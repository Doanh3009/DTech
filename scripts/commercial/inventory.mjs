import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = process.cwd();
const output = "docs/commercial-erp/evidence";
const read = (file) => readFile(path.join(root, file), "utf8");
async function files(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(file));
    else result.push(file);
  }
  return result;
}
const sourceFiles = (await files("src")).filter((file) => /\.(?:ts|tsx|mts|mjs|css|json)$/.test(file));
const sources = await Promise.all(sourceFiles.map(async (file) => ({ file, text: await read(file) })));
const migrations = (await files("supabase/migrations")).filter((file) => file.endsWith(".sql")).sort();
const migrationSources = await Promise.all(migrations.map(async (file) => ({ file, text: await read(file) })));
const fingerprint = createHash("sha256");
for (const entry of [...sources, ...migrationSources].sort((left, right) => left.file.localeCompare(right.file))) fingerprint.update(`${entry.file}\0${entry.text}\0`);
const pages = sourceFiles.filter((file) => file.endsWith("/page.tsx"));
const routeFor = (file) => `/${file.replace(/^src\/app\//, "").replace(/(?:^|\/)(?:page|route)\.tsx?$/, "").split("/").filter((part) => !/^\(.+\)$/.test(part)).join("/")}`;
const routes = pages.map((file) => ({ path: routeFor(file), file, dynamic: file.includes("[") }));
const apis = sources.filter(({ file }) => file.startsWith("src/app/api/") && file.endsWith("/route.ts")).map(({ file, text }) => ({ path: routeFor(file), file, methods: [...text.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]) }));
const tables = [...new Set(migrationSources.flatMap(({ text }) => [...text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi)].map((match) => match[1])))].sort();
const rpcs = [...new Set(migrationSources.flatMap(({ text }) => [...text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_]*)/gi)].map((match) => match[1])))].sort();
const branded = sources.flatMap(({ file, text }) => text.split(/\r?\n/).flatMap((line, index) => /Châu Tuấn|CHÂU TUẤN|chau-tuan|chautuan|CT_NoiBo/i.test(line) ? [{ file, line: index + 1, category: /test|preview/.test(file) ? "test/demo" : /client\/(?:attendanceQueue|workerDraftStore)/.test(file) ? "persistent-browser-key-preserve" : /AppLogo|\.css$/.test(file) ? "legacy-asset-compatibility" : "runtime-review", excerpt: line.trim().slice(0, 240) }] : []));
const modules = [
  ["HR", /\/employees(?:\/|$)/, /\/employees(?:\/|$)/, ["employees"]],
  ["Attendance, leave, timesheets", /\/(?:attendance|leave|timesheets|shifts|personal)(?:\/|$)/, /\/(?:attendance|leave|timesheet|shifts|work-calendar)/, ["attendance", "leave", "timesheets", "workspace"]],
  ["Projects and field operations", /\/(?:projects|project-monitoring|worker-attendance)(?:\/|$)/, /\/(?:projects|project-|worker-attendance)/, ["projects", "project-monitoring", "worker-attendance"]],
  ["Warehouse", /\/warehouse(?:\/|$)/, /\/(?:warehouse|warehouses|items|item-categories|uom)(?:\/|$)/, ["warehouse"]],
  ["Import/export", /\/import-export(?:\/|$)/, /\/(?:import-|shipment|customs|partners)/, ["import-export"]],
  ["Payroll", /\/accounting(?:\/|$)/, /\/accounting(?:\/|$)/, ["accounting"]],
  ["Shared operations", /\/(?:approvals|documents|notifications|reports)(?:\/|$)/, /\/(?:approval|document|notifications|report)/, ["shared-platforms", "approvals"]],
  ["Messaging", /\/messages(?:\/|$)/, /\/(?:messages|chat)(?:\/|$)/, ["messaging"]],
  ["Integration and administration", /\/(?:settings|system-admin)(?:\/|$)/, /\/(?:settings|system-settings|integrations|api-keys|service-accounts|auth|operations)/, ["integrations", "system-admin"]]
].map(([name, pagePattern, apiPattern, features]) => {
  const domain = sources.filter(({ file }) => features.some((feature) => file.startsWith(`src/features/${feature}/`)));
  return { name, routes: routes.filter(({ path: route }) => pagePattern.test(route)), apis: apis.filter(({ path: route }) => apiPattern.test(route)), serviceFiles: domain.filter(({ file }) => !/\.test\./.test(file) && /service|Service/.test(file)).map(({ file }) => file), testFiles: domain.filter(({ file }) => /\.test\./.test(file)).map(({ file }) => file), referencedTables: [...new Set(domain.flatMap(({ text }) => [...text.matchAll(/\.from\(["']([a-z_]+)["']\)/g)].map((match) => match[1])))].sort(), referencedRpcs: [...new Set(domain.flatMap(({ text }) => [...text.matchAll(/\.rpc\(["']([a-z_]+)["']/g)].map((match) => match[1])))].sort() };
});
const inventory = { generatedAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), sourceFingerprintSha256: fingerprint.digest("hex"), fingerprintScope: "src TypeScript/TSX/MTS/MJS/CSS/JSON and active SQL migrations, including uncommitted changes", sourceFiles: sourceFiles.length, testFiles: sourceFiles.filter((file) => /\.test\./.test(file)).length, routes, apis, migrations, declaredTables: tables, declaredRpcs: rpcs, modules, brandingFindings: branded, limitations: ["Source inventory; declarations do not prove deployed schema or successful business transactions.", "Referenced entities are extracted from literal query calls; dynamic queries need manual review.", "No credentials or business records are included."] };
const lock = JSON.parse(await read("package-lock.json"));
const packages = [];
for (const [location, metadata] of Object.entries(lock.packages ?? {})) {
  if (!location) continue;
  let license = metadata.license;
  if (!license) { try { license = JSON.parse(await read(`${location}/package.json`)).license; } catch { /* Optional platform packages may not be installed. */ } }
  packages.push({ location, version: metadata.version ?? null, license: typeof license === "string" ? license : "NEEDS_REVIEW", development: metadata.dev === true, optional: metadata.optional === true });
}
await mkdir(output, { recursive: true });
await writeFile(`${output}/source-inventory.json`, JSON.stringify(inventory, null, 2));
await writeFile(`${output}/dependency-inventory.json`, JSON.stringify({ format: "DTech dependency inventory v1 (not a CycloneDX/SPDX attestation)", generatedAt: inventory.generatedAt, packages, unreviewed: packages.filter((entry) => entry.license === "NEEDS_REVIEW").length }, null, 2));
console.log(JSON.stringify({ routes: routes.length, apis: apis.length, migrations: migrations.length, declaredTables: tables.length, declaredRpcs: rpcs.length, testFiles: inventory.testFiles, brandingFindings: branded.length, dependencies: packages.length, output }));

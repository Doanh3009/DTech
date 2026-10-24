import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, parseEnv } from "node:util";
import { z } from "zod";
import { brandingSettingsSchema } from "../../src/config/customerSettingsSchemas.mjs";

export const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_MANIFEST = "supabase/deployments/dtech-erp.json";
export const PROTECTED_PROJECT_REFS = Object.freeze(["uioywupuuestcaliawlc", "lgmlkagcytfjazulgfbz"]);
const registry = JSON.parse(readFileSync(new URL("../../src/config/erpRegistry.json", import.meta.url), "utf8"));
export const moduleKeys = Object.freeze(Object.keys(registry.modules));
export const industryKeys = Object.freeze(Object.keys(registry.industries));
const projectRef = z.string().regex(/^[a-z]{20}$/);
const text = (max) => z.string().trim().min(2).max(max).refine((value) => !/[\x00-\x1f\x7f]/.test(value));
const legacySchema = z.object({
  name: text(100), projectRef, dashboardUrl: z.string(), apiUrl: z.string(),
  provisioningMode: z.literal("existing-project"), organizationId: projectRef,
  region: z.string().regex(/^[a-z]+-[a-z]+-\d+$/),
  migrationsDirectory: z.literal("supabase/migrations"), includeDevelopmentSeed: z.literal(false),
  protectedExistingProjectRefs: z.array(projectRef).default([])
}).strict();
const manifestSchema = legacySchema.extend({
  schemaVersion: z.literal(1),
  deploymentId: z.string().regex(/^[a-z][a-z0-9-]{2,49}$/),
  customer: z.object({ companyName: text(120), shortName: text(30), systemName: text(100), address:z.string().trim().max(240).optional(),phone:z.string().trim().max(30).optional(),email:z.union([z.literal(""),z.string().email()]).optional(),taxCode:z.string().trim().max(30).optional(),representativeName:z.string().trim().max(100).optional() }).strict(),
  branding: brandingSettingsSchema.optional(),
  industryPreset: z.enum(industryKeys),
  enabledModules: z.array(z.enum(moduleKeys)).max(moduleKeys.length).refine((keys) => new Set(keys).size === keys.length),
  localization: z.object({ timezone: z.literal("Asia/Ho_Chi_Minh"), locale: z.literal("vi-VN") }).strict(),
  application: z.object({ baseUrl: z.string(), environment: z.enum(["development", "staging", "production"]) }).strict(),
  admin: z.object({
    username: z.string().regex(/^[a-z][a-z0-9._-]{2,31}$/),
    displayName: text(100), employeeCode: z.string().regex(/^[A-Z][A-Z0-9-]{2,39}$/)
  }).strict()
}).strict();

export class DeploymentManifestError extends Error {
  constructor(message) { super(message); this.name = "DeploymentManifestError"; }
}

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "manifest"))];
    // Do not include Zod messages or input: a misplaced secret must not enter logs.
    throw new DeploymentManifestError(`Manifest không hợp lệ tại: ${fields.join(", ")}.`);
  }
  return result.data;
}

/** Versionless manifests are the original DTech contract; new customers use v1. */
export function validateDeploymentManifest(input) {
  const legacy = input && typeof input === "object" && !Object.hasOwn(input, "schemaVersion");
  const original = legacy ? parse(legacySchema, input) : input;
  if (legacy && (original.projectRef !== "tcjjhxqtreemccdbvyza" || original.name !== "DTech_ERP")) {
    throw new DeploymentManifestError("Manifest cũ chỉ tương thích bản DTech ban đầu; khách hàng mới cần schemaVersion 1.");
  }
  const target = parse(manifestSchema, legacy ? {
    ...original, schemaVersion: 1, deploymentId: "dtech-erp",
    customer: { companyName: "DTech", shortName: "DTECH", systemName: "DTech ERP" },
    industryPreset: "general", enabledModules: moduleKeys,
    localization: { timezone: "Asia/Ho_Chi_Minh", locale: "vi-VN" },
    application: { baseUrl: "http://localhost:3000", environment: "development" },
    admin: { username: "admin", displayName: "Quản trị DTech", employeeCode: "SYS-DTECH-ADMIN" }
  } : original);
  if (target.apiUrl !== `https://${target.projectRef}.supabase.co` || target.dashboardUrl !== `https://supabase.com/dashboard/project/${target.projectRef}`) {
    throw new DeploymentManifestError("apiUrl/dashboardUrl không khớp projectRef.");
  }
  if(target.branding && target.branding.systemName !== target.customer.systemName) throw new DeploymentManifestError("Thương hiệu và tên hệ thống trong manifest không khớp.");
  target.protectedExistingProjectRefs = [...new Set([...PROTECTED_PROJECT_REFS, ...target.protectedExistingProjectRefs])];
  if (target.protectedExistingProjectRefs.includes(target.projectRef)) throw new DeploymentManifestError("Project đã được bảo vệ; không thể chọn làm đích triển khai.");
  let base;
  try { base = new URL(target.application.baseUrl); } catch { throw new DeploymentManifestError("application.baseUrl không hợp lệ."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || base.pathname !== "/" || base.search || base.hash || !["https:", "http:"].includes(base.protocol)
    || (base.protocol === "http:" && !(local && target.application.environment === "development"))
    || (local && target.application.environment !== "development")) {
    throw new DeploymentManifestError("application.baseUrl phải là origin HTTPS; HTTP localhost chỉ dùng cho development.");
  }
  target.application.baseUrl = base.origin;
  return { target, legacy };
}

export function workspaceFile(filename, kind = "manifest") {
  if (typeof filename !== "string" || !filename || /[\x00-\x1f]/.test(filename)) throw new DeploymentManifestError("Đường dẫn file không hợp lệ.");
  const absolute = path.resolve(workspace, filename);
  const relative = path.relative(workspace, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new DeploymentManifestError("File phải nằm trong workspace.");
  if (kind === "manifest" && path.extname(absolute).toLowerCase() !== ".json") throw new DeploymentManifestError("Manifest phải là file JSON.");
  if (kind === "environment" && (path.dirname(absolute) !== workspace || !/^\.env(?:\.[a-z0-9_-]+)*\.local$/i.test(path.basename(absolute)))) {
    throw new DeploymentManifestError("File secret phải là .env*.local tại gốc workspace và được Git bỏ qua.");
  }
  return absolute;
}

export async function assertRealWorkspaceFile(filename) {
  let actual;
  try { actual = await realpath(filename); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  if (actual !== filename) throw new DeploymentManifestError("Không dùng symlink cho file triển khai.");
}

export async function loadDeploymentManifest(filename = DEFAULT_MANIFEST) {
  const absolute = workspaceFile(filename);
  await assertRealWorkspaceFile(absolute);
  let input;
  try { input = JSON.parse((await readFile(absolute, "utf8")).replace(/^\uFEFF/, "")); }
  catch { throw new DeploymentManifestError("Không đọc được manifest JSON."); }
  return { ...validateDeploymentManifest(input), manifestFile: path.relative(workspace, absolute).replaceAll(path.sep, "/") };
}

export function deploymentArguments(args = process.argv.slice(2), allowed = []) {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      manifest: { type: "string", default: DEFAULT_MANIFEST },
      "environment-file": { type: "string" },
      ...Object.fromEntries(allowed.map((key) => [key, { type: key === "credentials-file" ? "string" : "boolean" }]))
    }, strict: true, allowPositionals: false }));
  } catch { throw new DeploymentManifestError("Tham số không hợp lệ; chỉ dùng các tùy chọn được tài liệu hỗ trợ."); }
  workspaceFile(values.manifest);
  if (values["environment-file"]) workspaceFile(values["environment-file"], "environment");
  if (values["credentials-file"]) workspaceFile(values["credentials-file"], "environment");
  if (values["credentials-file"] && path.resolve(workspace, values["credentials-file"]) === path.resolve(workspace, values["environment-file"] || ".env.local")) {
    throw new DeploymentManifestError("File tài khoản quản trị phải khác file cấu hình ứng dụng.");
  }
  return values;
}

export function assertExplicitInstanceFiles(args, { credentials = false } = {}) {
  if (workspaceFile(args.manifest) !== workspaceFile(DEFAULT_MANIFEST)) {
    const defaults = new Set([workspaceFile(".env.local", "environment"), workspaceFile(".env.admin.local", "environment")]);
    if (!args["environment-file"] || defaults.has(workspaceFile(args["environment-file"], "environment"))
      || (credentials && (!args["credentials-file"] || defaults.has(workspaceFile(args["credentials-file"], "environment"))))) {
      throw new DeploymentManifestError("Manifest khách hàng riêng cần --environment-file riêng; bootstrap cần thêm --credentials-file riêng. Không dùng file mặc định DTech.");
    }
  }
}

/** Explicit files own the target/credentials; never borrow another instance's keys. */
export async function deploymentEnvironment(filename, inherited = process.env) {
  if (!filename) return { ...inherited };
  const absolute = workspaceFile(filename, "environment");
  await assertRealWorkspaceFile(absolute);
  let values;
  try { values = parseEnv(await readFile(absolute, "utf8")); }
  catch { throw new DeploymentManifestError("Không đọc được file cấu hình ứng dụng đã chọn."); }
  const result = { ...inherited };
  result.DTECH_CONTROL_CENTER_ENABLED = "false";
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete result[key];
  return { ...result, ...values };
}

export function assertDeploymentEnvironment(target, env) {
  if (target.projectRef !== "tcjjhxqtreemccdbvyza" && env.DTECH_CONTROL_CENTER_ENABLED === "true") throw new DeploymentManifestError("Bản ERP khách hàng phải tắt Trung tâm triển khai của DTech.");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== target.apiUrl) throw new DeploymentManifestError("Database không khớp project ERP đã chọn.");
  if (!(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) throw new DeploymentManifestError("Thiếu secret key của bản triển khai đã chọn.");
}

export function settingsPreview(target) {
  return {
    branding: { ...target.branding, systemName: target.customer.systemName },
    organization: { companyName: target.customer.companyName, shortName: target.customer.shortName, ...Object.fromEntries(["address","phone","email","taxCode","representativeName"].filter(key=>target.customer[key]!==undefined).map(key=>[key,target.customer[key]])) },
    localization: { ...target.localization },
    modules: { ...Object.fromEntries(moduleKeys.map((key) => [key, target.enabledModules.includes(key)])), industryPreset: target.industryPreset }
  };
}

export function manifestFingerprint(target) {
  const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
  return createHash("sha256").update(JSON.stringify(stable(target))).digest("hex");
}

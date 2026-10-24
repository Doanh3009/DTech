import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { assertDeploymentEnvironment, assertExplicitInstanceFiles, DeploymentManifestError, deploymentEnvironment, loadDeploymentManifest, manifestFingerprint, moduleKeys, settingsPreview, workspace, workspaceFile } from "./deployment-manifest.mjs";

export const ACTIVATION_GROUPS = Object.freeze(["branding", "organization", "localization", "modules"]);
const uuid = z.string().uuid();
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const versionSchema = z.object(Object.fromEntries(ACTIVATION_GROUPS.map((group) => [group, z.number().int().positive().max(2_147_483_646)]))).strict();
const receiptVersionSchema = z.object(Object.fromEntries(ACTIVATION_GROUPS.map((group) => [group, z.number().int().positive().max(2_147_483_647)]))).strict();
const MAX_PLAN_BYTES = 256 * 1024;

export class ActivationError extends Error {
  constructor(message) { super(message); this.name = "ActivationError"; }
}

export async function activationGroupsParser() {
  const { brandingSettingsSchema, organizationSettingsSchema, localizationSettingsSchema, moduleSettingsSchema } = await import("../../src/config/customerSettingsSchemas.mjs");
  const schema = z.object({
    branding: brandingSettingsSchema, organization: organizationSettingsSchema,
    localization: localizationSettingsSchema,
    modules: moduleSettingsSchema.superRefine((value, context) => {
      for (const key of moduleKeys) {
        if (typeof value[key] !== "boolean") context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Activation requires an explicit capability flag." });
      }
    })
  }).strict();
  return (input) => schema.parse(input);
}

export function activationFingerprint(value) {
  const stable = (item) => Array.isArray(item) ? item.map(stable) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, stable(item[key])])) : item;
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fail(message) { throw new ActivationError(message); }

export function activationArguments(argv = process.argv.slice(2)) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, strict: true, allowPositionals: false, options: {
      manifest: { type: "string", default: "supabase/deployments/dtech-erp.json" },
      "environment-file": { type: "string" }, "project-ref": { type: "string" },
      "actor-id": { type: "string" }, "request-id": { type: "string" },
      output: { type: "string" }, plan: { type: "string" }, "confirm-plan": { type: "string" },
      prepare: { type: "boolean", default: false }, apply: { type: "boolean", default: false }
    } }));
  } catch { fail("Tham số activation không hợp lệ."); }
  if (values.prepare && values.apply) fail("Chọn một chế độ activation.");
  workspaceFile(values.manifest);
  if (values["environment-file"]) workspaceFile(values["environment-file"], "environment");
  if (values.prepare || values.apply) {
    if (!values["environment-file"] || !/^[a-z]{20}$/.test(values["project-ref"] || "")) fail("Cần chọn --environment-file và --project-ref rõ ràng.");
    assertExplicitInstanceFiles(values);
  }
  if (values.prepare) {
    if (!uuid.safeParse(values["actor-id"]).success || !values.output) fail("Prepare cần --actor-id UUID và --output trong .tmp.");
    if (values.plan || values["confirm-plan"]) fail("Prepare không nhận plan đã duyệt.");
    if (values["request-id"] && !uuid.safeParse(values["request-id"]).success) fail("Request ID phải là UUID.");
  } else if (values.apply) {
    if (!values.plan || !sha.safeParse(values["confirm-plan"]).success) fail("Apply cần --plan và --confirm-plan SHA-256 đã duyệt.");
    if (values.output || values["request-id"] || values["actor-id"]) fail("Apply sử dụng actor và request ID cố định trong plan.");
  } else if (values.output || values.plan || values["actor-id"] || values["request-id"] || values["confirm-plan"] || values["project-ref"]) {
    fail("Preview local chỉ nhận --manifest và tên --environment-file dự kiến.");
  }
  if (values.output) activationPlanFile(values.output);
  if (values.plan) activationPlanFile(values.plan);
  return values;
}

/** Plans include customer configuration, so only ignored local .tmp files are accepted. */
export function activationPlanFile(filename) {
  const absolute = workspaceFile(filename);
  const local = path.relative(path.join(workspace, ".tmp"), absolute);
  if (!local || local.startsWith("..") || path.isAbsolute(local)) fail("Activation plan phải nằm trong .tmp và có đuôi .json.");
  return absolute;
}

async function assertPlanPath(absolute) {
  let current = absolute;
  while (current !== workspace) {
    try {
      const actual = await realpath(current);
      if (actual !== current) fail("Không dùng symlink trong đường dẫn activation plan.");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    current = path.dirname(current);
  }
}

export function localActivationPreview({ target, manifestFile }) {
  return {
    kind: "dtech-erp-activation-preview", schemaVersion: 1, dryRun: true,
    networkAccess: false, appliesChanges: false, manifestFile,
    deploymentId: target.deploymentId, projectRef: target.projectRef,
    manifestSha256: manifestFingerprint(target), patches: settingsPreview(target),
    requiresPrepare: true
  };
}

function parseVersions(input) {
  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) fail("Phiên bản cấu hình trong plan không hợp lệ.");
  return parsed.data;
}

/** The injected parser is shared with the application contract, never a permissive defaults merge. */
export function createActivationPlan({ target, manifestFile }, { rows, actorId, requestId = randomUUID(), environmentFile, parseGroups, now = new Date().toISOString() }) {
  if (!uuid.safeParse(actorId).success || !uuid.safeParse(requestId).success) fail("Actor/request ID phải là UUID.");
  const file = path.relative(workspace, workspaceFile(environmentFile, "environment")).replaceAll(path.sep, "/");
  const versions = {};
  const current = {};
  if (!Array.isArray(rows) || rows.length !== ACTIVATION_GROUPS.length) fail("Cần đủ bốn nhóm cấu hình đã lưu; không tự điền mặc định.");
  for (const row of rows) {
    if (!row || !ACTIVATION_GROUPS.includes(row.group_key) || Object.hasOwn(current, row.group_key)) fail("Nhóm cấu hình lưu trữ bị trùng hoặc không hợp lệ.");
    current[row.group_key] = row.value;
    versions[row.group_key] = row.version;
  }
  const expectedVersions = parseVersions(versions);
  let before, groups;
  try {
    // These three flags were added as optional fields. Their established read
    // contract is enabled when absent; preserve explicit false values.
    if (current.modules && typeof current.modules === "object" && !Array.isArray(current.modules)) {
      current.modules = { ...current.modules };
      for (const key of ["accounting", "operations", "messaging"]) {
        if (!Object.hasOwn(current.modules, key)) current.modules[key] = true;
      }
    }
    before = parseGroups(current);
    const patches = settingsPreview(target);
    groups = parseGroups(Object.fromEntries(ACTIVATION_GROUPS.map((group) => [group, { ...before[group], ...patches[group] }])));
  } catch { fail("Cấu hình hiện tại hoặc cấu hình hợp nhất không đúng schema; cần sửa trước khi prepare."); }
  if (!z.string().datetime().safeParse(now).success) fail("Thời điểm prepare không hợp lệ.");
  const plan = {
    kind: "dtech-erp-customer-activation", schemaVersion: 1, commandVersion: 1,
    command: "publish_system_settings_command", preparedAt: now,
    manifestFile, manifestSha256: manifestFingerprint(target),
    deploymentId: target.deploymentId, projectRef: target.projectRef, apiUrl: target.apiUrl,
    environmentFile: file, actorId, requestId, expectedVersions,
    beforeSha256: activationFingerprint({ groups: before, versions: expectedVersions }), groups
  };
  return { plan, sha256: activationFingerprint(plan) };
}

const planSchema = z.object({
  kind: z.literal("dtech-erp-customer-activation"), schemaVersion: z.literal(1), commandVersion: z.literal(1),
  command: z.literal("publish_system_settings_command"), preparedAt: z.string().datetime(),
  manifestFile: z.string(), manifestSha256: sha, deploymentId: z.string(), projectRef: z.string(), apiUrl: z.string(),
  environmentFile: z.string(), actorId: uuid, requestId: uuid, expectedVersions: versionSchema,
  beforeSha256: sha, groups: z.unknown()
}).strict();

export function validateReviewedActivationPlan(input, { target, manifestFile }, { confirmPlan, projectRef, environmentFile, parseGroups }) {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) fail("Activation plan không đúng hợp đồng; cần prepare lại.");
  const plan = parsed.data;
  if (!sha.safeParse(confirmPlan).success || activationFingerprint(plan) !== confirmPlan) fail("SHA-256 không khớp activation plan đã duyệt.");
  const file = path.relative(workspace, workspaceFile(environmentFile, "environment")).replaceAll(path.sep, "/");
  if (projectRef !== target.projectRef || plan.projectRef !== target.projectRef || plan.apiUrl !== target.apiUrl
    || plan.deploymentId !== target.deploymentId || plan.manifestFile !== manifestFile
    || plan.manifestSha256 !== manifestFingerprint(target) || plan.environmentFile !== file) {
    fail("Target, manifest hoặc file môi trường khác plan đã duyệt; cần prepare lại.");
  }
  let groups;
  try { groups = parseGroups(plan.groups); } catch { fail("Nhóm cấu hình trong plan không đúng schema."); }
  const patches = settingsPreview(target);
  for (const group of ACTIVATION_GROUPS) {
    for (const [key, value] of Object.entries(patches[group])) {
      if (activationFingerprint(groups[group][key]) !== activationFingerprint(value)) fail("Plan không khớp cấu hình manifest đã duyệt.");
    }
  }
  return { ...plan, groups };
}

export async function writeActivationPlan(filename, plan) {
  const absolute = activationPlanFile(filename);
  await assertPlanPath(absolute);
  await mkdir(path.dirname(absolute), { recursive: true });
  await assertPlanPath(absolute);
  let handle;
  try {
    handle = await open(absolute, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(plan, null, 2)}\n`, "utf8");
  } catch { fail("Không ghi được activation plan mới; không ghi đè file đã tồn tại."); }
  finally { await handle?.close(); }
  return path.relative(workspace, absolute).replaceAll(path.sep, "/");
}

export async function readActivationPlan(filename) {
  const absolute = activationPlanFile(filename);
  await assertPlanPath(absolute);
  try {
    const metadata = await stat(absolute);
    if (!metadata.isFile() || metadata.size > MAX_PLAN_BYTES) fail("Activation plan vượt giới hạn hoặc không phải file.");
    return JSON.parse((await readFile(absolute, "utf8")).replace(/^\uFEFF/, ""));
  } catch { fail("Không đọc được activation plan JSON hợp lệ."); }
}

export async function readActivationSettings(client) {
  let response;
  try { response = await client.from("system_settings").select("group_key,value,version").in("group_key", ACTIVATION_GROUPS); }
  catch { fail("Không đọc được cấu hình hiện tại; chưa tạo plan."); }
  if (response.error || !Array.isArray(response.data)) fail("Không đọc được cấu hình hiện tại; chưa tạo plan.");
  return response.data;
}

export async function assertActivationCommandReady(client) {
  let response;
  try { response = await client.from("system_settings_commands").select("request_id").limit(0); }
  catch { fail("Chưa xác minh được schema activation. Cần áp dụng và kiểm tra migration trước khi prepare."); }
  if (response.error || !Array.isArray(response.data)) fail("Chưa xác minh được schema activation. Cần áp dụng và kiểm tra migration trước khi prepare.");
}

/** Apply makes one atomic command call. The database validates actor, versions and idempotency. */
export async function executeActivationPlan(client, plan) {
  let response;
  try {
    response = await client.rpc("publish_system_settings_command", {
      p_actor_id: plan.actorId, p_request_id: plan.requestId,
      p_groups: plan.groups, p_expected_versions: plan.expectedVersions, p_change_type: "publish"
    });
  } catch { fail("Không xác nhận được activation. Giữ nguyên plan/request ID và kiểm tra trạng thái trước khi thử lại."); }
  if (response.error) fail("Activation bị từ chối hoặc chưa xác nhận. Kiểm tra migration, quyền admin và phiên bản; giữ request ID khi thử lại.");
  const result = z.object({ requestId: uuid, versions: receiptVersionSchema }).passthrough().safeParse(response.data);
  if (!result.success || result.data.requestId !== plan.requestId) fail("Kết quả activation chưa được xác nhận. Giữ plan/request ID để đối chiếu.");
  for (const group of ACTIVATION_GROUPS) {
    if (result.data.versions[group] !== plan.expectedVersions[group] + 1) fail("Phiên bản activation trả về chưa được xác nhận; cần đối chiếu database.");
  }
  return { requestId: result.data.requestId, versions: result.data.versions };
}

export async function runActivation(argv, dependencies = {}) {
  const args = activationArguments(argv);
  const manifest = await (dependencies.loadManifest || loadDeploymentManifest)(args.manifest);
  if (!args.prepare && !args.apply) return localActivationPreview(manifest);
  if (args["project-ref"] !== manifest.target.projectRef) fail("Project đã chọn không khớp manifest.");
  const parseActivationGroups = dependencies.parseGroups || await activationGroupsParser();
  let reviewed;
  if (args.apply) reviewed = validateReviewedActivationPlan(await (dependencies.readPlan || readActivationPlan)(args.plan), manifest, {
    confirmPlan: args["confirm-plan"], projectRef: args["project-ref"], environmentFile: args["environment-file"], parseGroups: parseActivationGroups
  });
  const env = await (dependencies.environment || deploymentEnvironment)(args["environment-file"], {});
  assertDeploymentEnvironment(manifest.target, env);
  const create = dependencies.createClient || (await import("@supabase/supabase-js")).createClient;
  const client = create(manifest.target.apiUrl, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  if (args.prepare) {
    await assertActivationCommandReady(client);
    const rows = await readActivationSettings(client);
    const { plan, sha256 } = createActivationPlan(manifest, {
      rows, actorId: args["actor-id"], requestId: args["request-id"], environmentFile: args["environment-file"], parseGroups: parseActivationGroups
    });
    const planFile = await (dependencies.writePlan || writeActivationPlan)(args.output, plan);
    return { prepared: true, appliesChanges: false, projectRef: plan.projectRef, requestId: plan.requestId, planFile, sha256, expectedVersions: plan.expectedVersions };
  }
  const result = await executeActivationPlan(client, reviewed);
  return { applied: true, projectRef: reviewed.projectRef, planFile: args.plan, sha256: args["confirm-plan"], ...result };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runActivation(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    // No SDK/parser diagnostic, argv, environment values or stored customer content enters output.
    console.error(JSON.stringify({ applied: false, error: error instanceof ActivationError || error instanceof DeploymentManifestError
      ? error.message : "Activation chưa hoàn tất. Kiểm tra tham số, plan đã duyệt, target, cấu hình và quyền operator theo runbook." }));
    process.exitCode = 1;
  });
}

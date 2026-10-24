import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertExplicitInstanceFiles, deploymentArguments, loadDeploymentManifest, manifestFingerprint, settingsPreview, workspace, workspaceFile } from "./deployment-manifest.mjs";

export async function createDeploymentPlan({ target, legacy, manifestFile }, { validateOnly = false, envFile } = {}) {
  const base = {
    valid: true, schemaVersion: 1, manifestFile, legacyManifest: legacy,
    deploymentId: target.deploymentId, projectRef: target.projectRef,
    manifestSha256: manifestFingerprint(target),
    dryRun: true, networkAccess: false, appliesChanges: false,
    createsProject: false, includesDevelopmentSeed: false
  };
  if (validateOnly) return base;
  assertExplicitInstanceFiles({ manifest: manifestFile, "environment-file": envFile });
  const selectedEnvFile = path.relative(workspace, workspaceFile(envFile || ".env.local", "environment")).replaceAll(path.sep, "/");
  const directory = path.join(workspace, target.migrationsDirectory);
  const migrations = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  if (!migrations.length) throw new Error("Không tìm thấy migration để lập kế hoạch.");
  const hash = createHash("sha256");
  for (const filename of migrations) hash.update(filename).update("\0").update(await readFile(path.join(directory, filename))).update("\0");
  return {
    ...base, environment: target.application.environment, apiUrl: target.apiUrl,
    applicationUrl: target.application.baseUrl, envFile: selectedEnvFile,
    migrations: { directory: target.migrationsDirectory, count: migrations.length, latest: migrations.at(-1), sha256: hash.digest("hex") },
    settingsPreview: settingsPreview(target),
    admin: { username: target.admin.username, displayName: target.admin.displayName, employeeCode: target.admin.employeeCode, passwordSource: "secret store, environment or stdin" },
    requiredReviews: ["Quyền sở hữu và target database", "Backup và rehearsal migration", "Cấu hình khách hàng và module", "Secrets riêng cho bản triển khai", "Nghiệm thu nghiệp vụ và phê duyệt phát hành"],
    pendingActions: ["Migration staging", "Áp dụng customer settings qua luồng version/audit", "Bootstrap admin có thông tin xác thực riêng", "Health, smoke và UAT"]
  };
}

async function main() {
  const args = deploymentArguments(process.argv.slice(2), ["validate-only"]);
  const manifest = await loadDeploymentManifest(args.manifest);
  console.log(JSON.stringify(await createDeploymentPlan(manifest, { validateOnly: args["validate-only"], envFile: args["environment-file"] }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(JSON.stringify({ valid: false, error: error.message })); process.exitCode = 1; });
}

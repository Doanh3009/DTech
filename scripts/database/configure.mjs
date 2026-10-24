import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { assertExplicitInstanceFiles, assertRealWorkspaceFile, deploymentArguments, loadDeploymentManifest, workspace, workspaceFile } from "./deployment-manifest.mjs";
import { serializeEnvironment } from "./environment-format.mjs";

const args = deploymentArguments(process.argv.slice(2), ["check"]);
assertExplicitInstanceFiles(args);
const { target } = await loadDeploymentManifest(args.manifest);
const expectedUrl = target.apiUrl;
const envPath = workspaceFile(args["environment-file"] || ".env.local", "environment");
await assertRealWorkspaceFile(envPath);

async function runSupabase(args) {
  const child = spawn(process.execPath, [path.join(workspace, "node_modules/supabase/dist/supabase.js"), ...args, "--output", "json"], { cwd: workspace, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const status = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  if (status !== 0) {
    // Never echo API-key command output, including error diagnostics.
    if (args.includes("api-keys")) throw new Error("Không đọc được API key của project ERP. Kiểm tra quyền CLI.");
    throw new Error((stderr || stdout || "Supabase CLI thất bại.").slice(0, 3000));
  }
  try { return JSON.parse(stdout); } catch { throw new Error("Supabase CLI không trả về JSON hợp lệ."); }
}

const inventory = await runSupabase(["db", "query", "--linked", "--project-ref", target.projectRef, "--file", "supabase/bootstrap/preflight.sql"]);
if (args.check) {
  console.log(JSON.stringify({ projectRef: target.projectRef, inventory }, null, 2));
} else {
  const keys = await runSupabase(["projects", "api-keys", "--project-ref", target.projectRef]);
  const rows = Array.isArray(keys) ? keys : keys.api_keys;
  const publicKey = rows?.find((entry) => entry.name === "anon")?.api_key;
  const secretKey = rows?.find((entry) => entry.name === "service_role")?.api_key;
  if (!publicKey || !secretKey) throw new Error("Project chưa có API key tương thích với cấu hình ứng dụng.");
  let existing = "";
  try { existing = await readFile(envPath, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const values = new Map(Object.entries(parseEnv(existing)));
  const previousUrl = values.get("NEXT_PUBLIC_SUPABASE_URL");
  if (previousUrl && previousUrl !== expectedUrl) throw new Error(".env.local đang dùng project khác; không tự ghi đè kết nối đang có.");
  values.set("NEXT_PUBLIC_SUPABASE_URL", expectedUrl);
  values.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicKey);
  values.set("SUPABASE_SERVICE_ROLE_KEY", secretKey);
  if (target.projectRef !== "tcjjhxqtreemccdbvyza") values.set("DTECH_CONTROL_CENTER_ENABLED", "false");
  for (const key of ["API_KEY_PEPPER", "INTEGRATION_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET", "INTEGRATION_WORKER_SECRET", "OPERATIONS_CRON_SECRET", "SESSION_HASH_PEPPER"]) {
    if (!values.get(key)) values.set(key, randomBytes(32).toString("hex"));
  }
  if (!values.get("APP_BASE_URL")) values.set("APP_BASE_URL", target.application.baseUrl);
  if (!values.get("APP_TIMEZONE")) values.set("APP_TIMEZONE", target.localization.timezone);
  if (!values.get("RELEASE_ENVIRONMENT")) values.set("RELEASE_ENVIRONMENT", target.application.environment);
  await writeFile(envPath, `# Local-only ERP configuration. Do not commit.\n${serializeEnvironment(values)}`, { mode: 0o600 });
  console.log(JSON.stringify({ configured: true, projectRef: target.projectRef, apiUrl: expectedUrl, envFile: path.basename(envPath) }));
}

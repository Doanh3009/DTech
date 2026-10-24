import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { assertDeploymentEnvironment, assertExplicitInstanceFiles, assertRealWorkspaceFile, deploymentArguments, deploymentEnvironment, loadDeploymentManifest, workspace, workspaceFile } from "./deployment-manifest.mjs";
import { parseAdminCredentials, serializeEnvironment } from "./environment-format.mjs";

const args = deploymentArguments(process.argv.slice(2), ["credentials-stdin", "credentials-file"]);
assertExplicitInstanceFiles(args, { credentials: true });
const { target } = await loadDeploymentManifest(args.manifest);
const env = await deploymentEnvironment(args["environment-file"]);
assertDeploymentEnvironment(target, env);
const { username, displayName, employeeCode } = target.admin;
const credentialFile = workspaceFile(args["credentials-file"] || ".env.admin.local", "environment");
await assertRealWorkspaceFile(credentialFile);
let credentials;
try { credentials = parseEnv(await readFile(credentialFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (credentials && credentials.BOOTSTRAP_ADMIN_USERNAME !== username) throw new Error("File tài khoản quản trị đã có người dùng khác.");
let suppliedPassword = env.BOOTSTRAP_ADMIN_PASSWORD;
if (args["credentials-stdin"]) {
  const input = createInterface({ input: process.stdin, terminal: false });
  console.log(JSON.stringify({ awaitingCredentials: true }));
  try {
    const line = await new Promise((resolve, reject) => {
      input.once("line", resolve);
      input.once("close", () => reject(new Error("Chưa nhận thông tin quản trị qua stdin.")));
      input.once("error", reject);
    });
    suppliedPassword = parseAdminCredentials(line).password;
  } finally {
    input.close();
    process.stdin.pause();
  }
}
if (credentials && suppliedPassword && credentials.BOOTSTRAP_ADMIN_PASSWORD !== suppliedPassword) throw new Error("Mật khẩu được cung cấp khác thông tin quản trị đã lưu.");
const password = suppliedPassword || credentials?.BOOTSTRAP_ADMIN_PASSWORD;
if (typeof password !== "string" || password.length < 8 || /[\r\n]/.test(password)) throw new Error("Cần mật khẩu quản trị có tối thiểu 8 ký tự.");
if (!credentials) await writeFile(credentialFile, `# Local-only administrator credentials. Do not commit.\n${serializeEnvironment([["BOOTSTRAP_ADMIN_USERNAME", username], ["BOOTSTRAP_ADMIN_PASSWORD", password]])}`, { flag: "wx", mode: 0o600 });

const child = spawn(process.execPath, [path.join(workspace, "scripts/bootstrap-admin.mjs"), `--username=${username}`, `--name=${displayName}`], {
  cwd: workspace, env: { ...env, BOOTSTRAP_ADMIN_PASSWORD: password }, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]
});
let diagnostics = "";
child.stdout.on("data", () => undefined);
child.stderr.on("data", (chunk) => { diagnostics += chunk; });
const status = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
if (status !== 0) throw new Error(`Không khởi tạo được tài khoản quản trị: ${diagnostics.replaceAll(password, "[redacted]").slice(0, 1000)}`);

const client = createClient(target.apiUrl, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: account, error: accountError } = await client.from("app_accounts").select("id,employee_id,metadata").eq("username", username).single();
if (accountError) throw accountError;
if (!account.employee_id) {
  const { data: existing, error: existingError } = await client.from("employees").select("id").eq("employee_code", employeeCode).maybeSingle();
  if (existingError) throw existingError;
  let employeeId = existing?.id;
  if (!employeeId) {
    async function ensureReference(table, code, values) {
      const { data: existingReference, error: readError } = await client.from(table).select("id").eq("code", code).maybeSingle();
      if (readError) throw readError;
      if (existingReference) return existingReference.id;
      const { data, error } = await client.from(table).insert({ code, ...values }).select("id").single();
      if (error) throw error;
      return data.id;
    }
    const departmentId = await ensureReference("departments", "system", { name: "Quản trị hệ thống" });
    const positionId = await ensureReference("positions", "system_admin", { name: "Quản trị hệ thống", department_id: departmentId });
    const { data: employmentType, error: typeError } = await client.from("employment_types").select("id").eq("code", "office_employee").single();
    if (typeError) throw typeError;
    const { data, error } = await client.from("employees").insert({ employee_code: employeeCode, full_name: displayName, display_name: displayName, department_id: departmentId, position_id: positionId, employment_type_id: employmentType.id, join_date: new Date().toLocaleDateString("en-CA", { timeZone: target.localization.timezone }), employment_status: "active", profile_status: "pending_hr_completion", note: "Tài khoản quản trị ban đầu. Hồ sơ hệ thống cần được cập nhật khi bàn giao." }).select("id").single();
    if (error) throw error;
    employeeId = data.id;
  }
  const { error } = await client.from("app_accounts").update({ employee_id: employeeId, metadata: { ...account.metadata, erpBootstrap: true } }).eq("id", account.id);
  if (error) throw error;
}
console.log(JSON.stringify({ username, employeeLinked: true, credentialFile: path.basename(credentialFile) }));

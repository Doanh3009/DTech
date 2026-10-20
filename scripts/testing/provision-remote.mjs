import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { managementClient } from "./management.mjs";
import { assertTestConfigFilename } from "./config.mjs";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";

const ORGANIZATION = "jdfobdsnqqpyqfgbveke";
const NAME = "CT_NoiBo_Test";
const REGION = "ap-southeast-1";
const MANIFEST = "test-results/provisioning/CT_NoiBo_Test.private.json";
const action = process.argv[2];

async function main() {
  assert(["plan", "create", "status", "configure"].includes(action), "Chọn plan, create, status hoặc configure");
  const api = await managementClient();
  const organization = await api("GET", `/v1/organizations/${ORGANIZATION}`);
  assert(organization.plan === "free", "Tổ chức không thuộc gói Free; dừng, không tạo hoặc nâng gói");
  const projects = await api("GET", "/v1/projects");
  const production = parseEnv(await readFile(".env.local", "utf8"));
  const productionRef = new URL(production.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  if (action === "plan") {
    console.log(JSON.stringify({ organization: organization.name, plan: organization.plan, projects: projects.map(({ id, name, status, region }) => ({ id, name, status, region })), proposedName: NAME, proposedRegion: REGION }));
    return;
  }
  let manifest = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "null"));
  if (action === "create" && !manifest) {
    assert(process.argv.includes(`--confirm-create=${NAME}`), `Cần --confirm-create=${NAME}`);
    assert(!projects.some((project) => project.name === NAME), "Project cùng tên đã tồn tại nhưng chưa có manifest do script quản lý; cần xác minh ownership");
    assert(projects.filter((project) => !["INACTIVE", "PAUSED"].includes(project.status)).length < 2, "Đã hết hạn mức project Free; không tạo project hoặc nâng gói");
    const databasePassword = randomBytes(32).toString("base64url");
    // Omitting custom compute size and add-ons preserves the Free defaults.
    const project = await api("POST", "/v1/projects", { organization_slug: ORGANIZATION, name: NAME, db_pass: databasePassword, region_selection: { type: "specific", code: REGION } });
    manifest = { owner: TEST_OWNER, projectId: project.ref || project.id, organizationId: ORGANIZATION, name: NAME, plan: "free", region: REGION, createdAt: project.created_at, databasePassword };
    await mkdir("test-results/provisioning", { recursive: true });
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  }
  assert(manifest?.owner === TEST_OWNER && manifest.name === NAME && manifest.organizationId === ORGANIZATION && /^[a-z]{20}$/.test(manifest.projectId) && manifest.projectId !== productionRef, "Chưa có manifest project test độc lập hợp lệ");
  const project = await api("GET", `/v1/projects/${manifest.projectId}`);
  assert(project.name === NAME && (project.organization_slug || project.organization_id) === ORGANIZATION, "Project test không khớp manifest");
  console.log(JSON.stringify({ projectId: manifest.projectId, name: project.name, plan: organization.plan, region: project.region, status: project.status }));
  if (action !== "configure") return;
  assert(project.status === "ACTIVE_HEALTHY", "Project đang khởi tạo; chờ ACTIVE_HEALTHY trước khi lấy khóa");
  const filename = process.env.TEST_ENV_FILE || ".env.e2e.local";
  assertTestConfigFilename(filename);
  const config = parseEnv(await readFile(filename, "utf8"));
  assert(!config.TEST_SUPABASE_PROJECT_ID || config.TEST_SUPABASE_PROJECT_ID === manifest.projectId, "File test đang trỏ project khác; không ghi đè target đã cấu hình");
  const keys = await api("GET", `/v1/projects/${manifest.projectId}/api-keys?reveal=true`);
  const publicKey = keys.find((key) => key.type === "publishable" && key.api_key?.startsWith("sb_publishable_"));
  const secretKey = keys.find((key) => key.type === "secret" && key.api_key?.startsWith("sb_secret_"));
  assert(publicKey && secretKey, "Project chưa có publishable/secret keys; không sao chép khóa từ project khác");
  const target = `https://${manifest.projectId}.supabase.co`;
  Object.assign(config, { NEXT_PUBLIC_SUPABASE_URL: target, TEST_SUPABASE_URL: target, E2E_SUPABASE_URL: target, TEST_SUPABASE_PROJECT_ID: manifest.projectId, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey.api_key, NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SECRET_KEY: secretKey.api_key, SUPABASE_SERVICE_ROLE_KEY: "", APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true", E2E_DATABASE_KIND: "test", APP_BASE_URL: "http://localhost:3300", E2E_BASE_URL: "http://localhost:3300" });
  await writeFile(filename, Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
  console.log(`Đã ghi URL và khóa test vào ${filename}; không in secrets.`);
}

try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }

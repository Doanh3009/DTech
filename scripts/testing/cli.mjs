import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";
import { loadTestConfiguration, reportTestingError } from "./config.mjs";
import { assertSeedTarget, MARKER_KEY } from "./guard.mjs";
import { seedAccounts, verifyAccounts, check } from "./accounts.mjs";
import { seedProjects, verifyProjects } from "./projects.mjs";
import { seedShipmentDocuments, verifySeedFiles } from "./assets.mjs";
import { seedPersonalData } from "./personal.mjs";
import { verifyBusinessSeed } from "./verify.mjs";
async function main() {
  const command = process.argv[2];
  assert(["init", "accounts:seed", "accounts:verify", "projects:seed", "seed", "verify", "reset"].includes(command), "Lệnh test không hợp lệ");
  const { env, target } = await loadTestConfiguration();
  Object.assign(process.env, env);
  if (command === "init") {
    assert(process.argv.includes(`--confirm-project=${target.projectId}`), `Cần --confirm-project=${target.projectId}`);
    const db = createClient(target.databaseUrl, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const rows = await check(db.from("app_accounts").select("username,metadata").limit(1000), "database ownership");
    assert(rows.length < 1000, "Cần audit toàn bộ tài khoản trước khi đánh dấu database lớn là test");
    assert(rows.every((row) => row.metadata?.testData || row.metadata?.testOwner === TEST_OWNER), "Database có tài khoản chưa xác nhận là test; không được khởi tạo/reset");
    await check(db.from("app_configurations").upsert({ key: MARKER_KEY, value: { owner: TEST_OWNER, target: target.databaseUrl, projectId: target.projectId, environment: target.environment } }), "initialize test marker");
    console.log(`Initialized ${target.environment} / ${target.projectId}`);
  } else {
    const { db } = await assertSeedTarget();
    if (command === "accounts:seed") await seedAccounts(db, target);
    else if (command === "accounts:verify") await verifyAccounts(db, target);
    else if (command === "projects:seed") await seedProjects(db, target);
    else if (command === "seed") {
      for (const script of ["scripts/seed-development-coverage.mjs", "scripts/seed-development-storage.mjs", "scripts/seed-test-users.mjs"]) {
        await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [script, "--allow-remote"], { env: { ...process.env, SEED_TEST_PASSWORD: process.env.TEST_ACCOUNT_PASSWORD }, stdio: "inherit", shell: false, windowsHide: true });
          child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script}: exit ${code}`)));
        });
      }
      await seedAccounts(db, target); await seedProjects(db, target);
      await seedPersonalData(db); await seedShipmentDocuments(db);
      await verifyAccounts(db, target); await verifyProjects(db); await verifyBusinessSeed(db); await verifySeedFiles(db);
    }
    else if (command === "verify") { await verifyAccounts(db, target); await verifyProjects(db); await verifyBusinessSeed(db); await verifySeedFiles(db); }
    else if (command === "reset") {
      assert(process.argv.includes(`--confirm-project=${target.projectId}`), "Reset cần xác nhận đúng project ID");
      const accounts = await check(db.from("app_accounts").select("id").eq("metadata->>testOwner", TEST_OWNER).eq("metadata->>testTarget", target.databaseUrl), "owned accounts");
      if (accounts.length) await check(db.from("app_sessions").update({ revoked_at: new Date().toISOString() }).in("account_id", accounts.map((row) => row.id)), "revoke owned sessions");
      // Restore managed identities and project assignments; preserve immutable
      // business evidence. A destructive database reset is a separate local task.
      await seedAccounts(db, target); await seedProjects(db, target);
      console.log("Reset tài khoản và phân công test; chứng từ/audit được giữ nguyên.");
    } else throw new Error("Unknown testing command");
  }
}

try { await main(); } catch (error) { reportTestingError(error); }

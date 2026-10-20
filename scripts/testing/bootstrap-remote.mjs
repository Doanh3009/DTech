import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { loadTestConfiguration } from "./config.mjs";
import { managementClient } from "./management.mjs";
import { inspectBootstrapState, readBootstrapRecords } from "./bootstrap-state.mjs";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function main() {
  const { target } = await loadTestConfiguration();
  assert(process.argv.includes(`--confirm-project=${target.projectId}`), "Bootstrap cần xác nhận project ID test");
  const manifest = JSON.parse(await readFile("test-results/provisioning/CT_NoiBo_Test.private.json", "utf8"));
  assert(manifest.owner === TEST_OWNER && manifest.projectId === target.projectId && manifest.name === "CT_NoiBo_Test" && manifest.plan === "free", "Chỉ bootstrap project test do script tạo và quản lý");
  const api = await managementClient();
  const organization = await api("GET", `/v1/organizations/${manifest.organizationId}`);
  assert(organization.plan === "free", "Bootstrap chỉ dành cho project Free đã xác nhận");
  const project = await api("GET", `/v1/projects/${target.projectId}`);
  assert(project.name === manifest.name && (project.organization_slug || project.organization_id) === manifest.organizationId && project.status === "ACTIVE_HEALTHY", "Project không khớp manifest hoặc chưa sẵn sàng");
  const query = (sql, readOnly = false) => api("POST", `/v1/projects/${target.projectId}/database/query`, { query: sql, read_only: readOnly });
  const initial = await inspectBootstrapState(query, target.projectId);
  let recorded = initial.recorded;
  if (!initial.hasGuard) {
    await query(`begin;
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);
    create table if not exists supabase_migrations.ct_test_bootstrap(key text primary key, value jsonb not null);
    insert into supabase_migrations.ct_test_bootstrap(key,value) values('owner',${quote(JSON.stringify({ owner: TEST_OWNER, projectId: target.projectId }))}::jsonb) on conflict(key) do nothing;
    commit;`);
    recorded = await readBootstrapRecords(query, target.projectId);
  }
  const files = (await readdir("supabase/migrations")).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  for (const filename of files) {
    const sql = await readFile(`supabase/migrations/${filename}`, "utf8");
    const checksum = hash(sql);
    if (recorded.has(filename)) { assert(recorded.get(filename).sha256 === checksum, `Migration đã áp dụng bị sửa: ${filename}`); console.log(`SKIP ${filename}`); continue; }
    const version = filename.split("_")[0];
    const name = filename.slice(version.length + 1, -4);
    await query(`begin;\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(sql)}]);\ninsert into supabase_migrations.ct_test_bootstrap(key,value) values(${quote(filename)},${quote(JSON.stringify({ sha256: checksum }))}::jsonb);\ncommit;`);
    console.log(`PASS ${filename}`);
  }
  const seed = await readFile("supabase/seed.sql", "utf8");
  if (!recorded.has("seed.sql")) {
    assert(/\bcommit;\s*$/i.test(seed), "Seed cần transaction cuối file");
    // Tag only migration-created demo accounts on this newly owned project.
    const tags = `update public.app_accounts set metadata=coalesce(metadata,'{}'::jsonb)||${quote(JSON.stringify({ testData: true, testOwner: TEST_OWNER, testTarget: target.databaseUrl, testBootstrap: true }))}::jsonb;`;
    const repair = (await readFile("supabase/migrations/202610020001_standardize_employee_access_and_timesheet_exports.sql", "utf8")).split("-- Repair legacy or seeded locked periods")[1];
    assert(repair, "Không tìm thấy repair snapshot kỳ công mẫu");
    const final = `\n${tags}\n-- Repair legacy or seeded locked periods${repair}\ninsert into supabase_migrations.ct_test_bootstrap(key,value) values('seed.sql',${quote(JSON.stringify({ sha256: hash(seed) }))}::jsonb);\ncommit;`;
    await query(seed.replace(/\bcommit;\s*$/i, final));
    console.log("PASS seed.sql + demo ownership + locked period snapshots");
  } else {
    assert(recorded.get("seed.sql").sha256 === hash(seed), "Seed đã bootstrap bị sửa; dừng và tạo migration sửa dữ liệu riêng");
    console.log("SKIP seed.sql (checksum khớp; không ghi lại chứng từ)");
  }
  // The RPC is restricted to privileged callers; the Management API's
  // read_only role cannot execute it even though the function only selects.
  const audit = await query("select * from public.audit_inventory_balance(null)");
  assert(audit.every((row) => Number(row.difference) === 0), "Tồn kho mẫu không khớp sổ kho");
  console.log(`PASS ${files.length} migrations; tồn kho khớp ledger; target=${target.projectId}`);
}

try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { assertSeedTarget } from "../testing/guard.mjs";

export async function createFixture(runId, manifestPath, allowRemote) {
  await assertSeedTarget();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && secret, "Thiếu cấu hình Supabase cho fixture E2E");
  assert(allowRemote || ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Database remote cần --allow-remote để chạy dữ liệu E2E riêng");
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const manifest = { runId, records: [], authIds: [], people: {}, createdAt: new Date().toISOString() };
  const password = process.env.TEST_ACCOUNT_PASSWORD;
  assert(password && password.length >= 12, "Thiếu TEST_ACCOUNT_PASSWORD");
  const save = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  async function track(table, id) {
    assert(typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id), `Không có ID để theo dõi ${table}`);
    if (!manifest.records.some((record) => record.table === table && record.id === id)) manifest.records.push({ table, id });
    await save();
    return id;
  }
  async function query(operation, label) {
    const { data, error } = await operation;
    assert(!error, `${label}: ${error?.message}`);
    return data;
  }
  async function insert(table, row) {
    const data = await query(db.from(table).insert(row).select("*").single(), table);
    await track(table, data.id);
    return data;
  }
  const fixture = { db, manifest, password, track, insert, query, save, people: manifest.people, prefix: `E2E_${runId.toUpperCase()}` };
  await save();
  fixture.setup = async () => {
    const [roles, departments, positions, employmentTypes] = await Promise.all([
      query(db.from("roles").select("id,code,role_permissions(permission_key)"), "roles"),
      query(db.from("departments").select("id").limit(1), "departments"),
      query(db.from("positions").select("id").limit(1), "positions"),
      query(db.from("employment_types").select("id,code"), "employment types")
    ]);
    assert(departments.length && positions.length && employmentTypes.length, "Chưa có danh mục tổ chức");
    fixture.references = { departmentId: departments[0].id, positionId: positions[0].id, employmentTypeId: employmentTypes[0].id };
    const adminRole = roles.find((role) => role.code === "admin");
    assert(adminRole, "Chưa có role admin");
    const allPermissions = adminRole.role_permissions.map((row) => row.permission_key);
    for (const name of ["admin", "hr", "employee", "outsider", "accountant", "supervisor", "warehouse", "shipping"]) {
      let roleId = roles.find((role) => role.code === (name === "outsider" ? "employee" : name))?.id;
      if (!roleId) {
        const role = await insert("roles", { code: `e2e_${runId}_${name}`, name: `[E2E] ${name}`, is_system: false });
        roleId = role.id;
        const prefixes = name === "warehouse" ? ["warehouse."] : ["import_export.", "import_contract.", "shipment.", "shipment_document.", "shipment_receiving.", "partner.", "customs."];
        const permissions = allPermissions.filter((permission) => prefixes.some((prefix) => permission.startsWith(prefix)) || (name === "shipping" && ["warehouse.view", "warehouse.item.view", "warehouse.receipt.create", "warehouse.receipt.view"].includes(permission)));
        await query(db.from("role_permissions").insert(permissions.map((permission_key) => ({ role_id: roleId, permission_key }))), "role permissions");
      }
      const employeeId = randomUUID();
      const employee = await insert("employees", {
        id: employeeId, employee_code: `${fixture.prefix}_${name}`, full_name: `[E2E ${runId}] ${name}`,
        personal_phone: "", normalized_phone: "", join_date: "2026-01-01", employment_status: "active",
        department_id: fixture.references.departmentId, position_id: fixture.references.positionId,
        employment_type_id: (name === "outsider" ? employmentTypes.find((type) => type.code === "worker")?.id : undefined) || fixture.references.employmentTypeId
      });
      const username = `e2e.${runId}.${name}`;
      const { data, error } = await db.auth.admin.createUser({ email: `${username}@e2e.invalid`, password, email_confirm: true, user_metadata: { e2eRun: runId, testData: true } });
      assert(!error && data.user, `Auth fixture ${name}: ${error?.message}`);
      manifest.authIds.push(data.user.id);
      await save();
      const account = await insert("app_accounts", {
        id: randomUUID(), auth_user_id: data.user.id, employee_id: employee.id,
        username, primary_email: data.user.email, display_name: employee.full_name, status: "active",
        metadata: { e2eRun: runId }
      });
      await query(db.from("account_roles").insert({ account_id: account.id, role_id: roleId }), "assign role");
      manifest.people[name] = { username, accountId: account.id, employeeId: employee.id, roleId };
      await save();
    }
    await query(db.from("employees").update({ manager_employee_id: manifest.people.hr.employeeId }).eq("id", manifest.people.employee.employeeId), "manager");
  };
  return fixture;
}

export async function sealFixture(fixture) {
  const { db, manifest, query } = fixture;
  assert(/^\d{8}[a-f0-9]{6}$/.test(manifest.runId), "Manifest E2E không hợp lệ");
  const accounts = manifest.records.filter((record) => record.table === "app_accounts").map((record) => record.id);
  // Audit logs and stock ledger are append only by design. Never bypass their
  // triggers or delete posted records. Reset the disposable test database
  // outside this runner when the report has been reviewed.
  if (accounts.length) await query(db.from("app_accounts").update({ status: "disabled" }).in("id", accounts).eq("metadata->>e2eRun", manifest.runId), "disable owned E2E accounts");
  for (const [table, changes] of [["api_keys", { status: "revoked", revoked_at: new Date().toISOString() }], ["service_accounts", { status: "disabled" }], ["webhook_endpoints", { enabled: false, status: "disabled" }]]) {
    const ids = manifest.records.filter((record) => record.table === table).map((record) => record.id);
    if (ids.length) await query(db.from(table).update(changes).in("id", ids).in("created_by", accounts), `seal owned ${table}`);
  }
  for (const authId of manifest.authIds) {
    const current = await db.auth.admin.getUserById(authId);
    assert(!current.error && current.data.user?.user_metadata?.e2eRun === manifest.runId, "Không khóa Auth user ngoài lượt E2E");
    const { error } = await db.auth.admin.updateUserById(authId, { ban_duration: "876000h" });
    assert(!error, `seal E2E auth: ${error?.message}`);
  }
  manifest.sealedAt = new Date().toISOString();
  manifest.retention = "Business records and files retained in test database; accounts disabled";
  await fixture.save();
}

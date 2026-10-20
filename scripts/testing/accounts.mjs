import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";
const profiles = JSON.parse(await readFile(new URL("../../src/config/testAccounts.json", import.meta.url), "utf8"));
export const fixedId = (value) => {
  const hex = createHash("sha256").update(`${TEST_OWNER}:${value}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
export async function check(operation, label) {
  const { data, error } = await operation;
  assert(!error, `${label}: ${error?.message}`);
  return data;
}
export async function seedAccounts(db, target) {
  const [roles, permissions, departments, positions, types] = await Promise.all([
    check(db.from("roles").select("id,code,name,is_system"), "roles"), check(db.from("permissions").select("key"), "permissions"),
    check(db.from("departments").select("id,code"), "departments"), check(db.from("positions").select("id,code"), "positions"), check(db.from("employment_types").select("id,code"), "employment types")
  ]);
  const authUsers = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    assert(!error, "Không đọc được Auth users"); authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  for (const profile of profiles) {
    const id = fixedId(`account:${profile.username}`), employeeId = fixedId(`employee:${profile.username}`);
    const old = await check(db.from("app_accounts").select("id,username,auth_user_id,metadata").eq("username", profile.username).maybeSingle(), "account collision check");
    assert(!old || (old.id === id && old.metadata?.testOwner === TEST_OWNER && old.metadata?.testTarget === target.databaseUrl), `Từ chối ghi đè tài khoản không do bộ seed quản lý: ${profile.username}`);
    const existingEmployee = await check(db.from("employees").select("id,employee_code,note").eq("id", employeeId).maybeSingle(), "employee collision check");
    assert(!existingEmployee || existingEmployee.note === `[TEST:${TEST_OWNER}] ${profile.username}`, "Employee ID collision");
    const departmentId = departments.find((row) => row.code === profile.department)?.id;
    const positionId = positions.find((row) => row.code === profile.position)?.id;
    const employmentTypeId = types.find((row) => row.code === "office_employee")?.id;
    assert(departmentId && positionId && employmentTypeId, `Thiếu danh mục của ${profile.username}`);
    let role = roles.find((row) => row.code === profile.roleCode);
    if (profile.roleCode.startsWith("qa_")) {
      assert(!role || (!role.is_system && role.name === `[TEST] ${profile.label}`), "Vai trò QA trùng vai trò hiện hữu");
      if (!role) role = await check(db.from("roles").insert({ code: profile.roleCode, name: `[TEST] ${profile.label}`, is_system: false }).select("*").single(), "create QA profile");
      const keys = permissions.map((row) => row.key).filter((key) => profile.permissionKeys?.includes(key) || profile.permissionPrefixes?.some((prefix) => key.startsWith(prefix)));
      for (const key of profile.permissionKeys || []) assert(keys.includes(key), `Permission không tồn tại: ${key}`);
      assert(keys.length, "QA profile không có permission thực");
      await check(db.from("role_permissions").delete().eq("role_id", role.id), "repair QA role");
      await check(db.from("role_permissions").insert(keys.map((permission_key) => ({ role_id: role.id, permission_key }))), "QA permissions");
    }
    assert(role, `Role chuẩn chưa tồn tại: ${profile.roleCode}`);
    if (profile.excludedPermissionKeys?.length) {
      for (const key of profile.excludedPermissionKeys) assert(permissions.some((permission) => permission.key === key), `Permission không tồn tại: ${key}`);
      await check(db.from("role_permissions").delete().eq("role_id", role.id).in("permission_key", profile.excludedPermissionKeys), "remove excluded TEST role permissions");
    }
    await check(db.from("employees").upsert({ id: employeeId, employee_code: `QA_${profile.username.replaceAll(".", "_").toUpperCase()}`, full_name: `[TEST] ${profile.label}`, display_name: profile.label, personal_phone: "", normalized_phone: `QA:${profile.username}`, department_id: departmentId, position_id: positionId, employment_type_id: employmentTypeId, join_date: "2026-01-01", employment_status: "active", profile_status: "complete", profile_completeness: 100, note: `[TEST:${TEST_OWNER}] ${profile.username}` }, { onConflict: "id" }), "employee");
    const email = `${profile.username}@test.ct-noibo.invalid`;
    let authUser = authUsers.find((user) => user.id === old?.auth_user_id || user.email === email);
    assert(!authUser || (authUser.user_metadata?.testOwner === TEST_OWNER && authUser.user_metadata?.username === profile.username && authUser.user_metadata?.testTarget === target.databaseUrl), "Auth user collision");
    const authInput = { password: process.env.TEST_ACCOUNT_PASSWORD, email_confirm: true, ban_duration: "none", user_metadata: { testOwner: TEST_OWNER, username: profile.username, testTarget: target.databaseUrl } };
    const result = authUser ? await db.auth.admin.updateUserById(authUser.id, authInput) : await db.auth.admin.createUser({ ...authInput, email });
    assert(!result.error && result.data.user, `Auth ${profile.username}: ${result.error?.message}`); authUser = result.data.user;
    await check(db.from("app_accounts").upsert({ id, auth_user_id: authUser.id, employee_id: employeeId, username: profile.username, primary_email: email, display_name: `[TEST] ${profile.label}`, status: "active", metadata: { testOwner: TEST_OWNER, testTarget: target.databaseUrl } }, { onConflict: "id" }), "app account");
    await check(db.from("account_roles").delete().eq("account_id", id), "repair owned account roles");
    await check(db.from("account_roles").insert({ account_id: id, role_id: role.id }), "assign role");
    for (const code of profile.warehouseScopeCodes || []) {
      const warehouse = await check(db.from("warehouses").select("id,status").eq("code", code).single(), `warehouse scope ${code}`);
      assert(warehouse.status === "active", `Kho test chưa hoạt động: ${code}`);
      await check(db.from("warehouse_user_scopes").upsert({ account_id: id, warehouse_id: warehouse.id, can_view: true, can_operate: true, granted_by: fixedId("account:admin.test") }, { onConflict: "account_id,warehouse_id" }), `assign warehouse scope ${code}`);
    }
    // Changing seed passwords or roles invalidates only this managed account.
    await check(db.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("account_id", id).is("revoked_at", null), "revoke old test sessions");
    console.log(`READY ${profile.username} -> ${profile.roleCode}`);
  }
}
export async function verifyAccounts(db, target) {
  for (const profile of profiles) {
    const row = await check(db.from("app_accounts").select("id,employee_id,auth_user_id,status,metadata,account_roles!account_roles_account_id_fkey(roles(code,role_permissions(permission_key)))").eq("username", profile.username).single(), profile.username);
    assert(row.id === fixedId(`account:${profile.username}`) && row.metadata?.testOwner === TEST_OWNER && row.metadata?.testTarget === target.databaseUrl && row.employee_id === fixedId(`employee:${profile.username}`) && row.auth_user_id && row.status === "active", `Account chưa hợp lệ: ${profile.username}`);
    assert.equal(row.account_roles.length, 1); assert.equal(row.account_roles[0].roles.code, profile.roleCode);
    assert(row.account_roles[0].roles.role_permissions.length > 0, "Role chưa có quyền");
    const assignedKeys = new Set(row.account_roles[0].roles.role_permissions.map((permission) => permission.permission_key));
    for (const key of profile.permissionKeys || []) assert(assignedKeys.has(key), `Thiếu quyền ${key}: ${profile.username}`);
    for (const key of profile.excludedPermissionKeys || []) assert(!assignedKeys.has(key), `Quyền ngoài phạm vi ${key}: ${profile.username}`);
    for (const code of profile.warehouseScopeCodes || []) {
      const warehouse = await check(db.from("warehouses").select("id").eq("code", code).single(), `verify warehouse ${code}`);
      const scope = await check(db.from("warehouse_user_scopes").select("can_view,can_operate").eq("account_id", row.id).eq("warehouse_id", warehouse.id).single(), `verify warehouse scope ${profile.username}`);
      assert(scope.can_view && scope.can_operate, `Thiếu phạm vi nhận kho ${code}: ${profile.username}`);
    }
    const auth = await db.auth.admin.getUserById(row.auth_user_id);
    assert(!auth.error && auth.data.user?.user_metadata?.testOwner === TEST_OWNER && auth.data.user.user_metadata?.testTarget === target.databaseUrl && auth.data.user.user_metadata?.username === profile.username && (!auth.data.user.banned_until || new Date(auth.data.user.banned_until).getTime() <= Date.now()), "Auth linkage invalid");
    console.log(`PASS ${profile.username}`);
  }
}

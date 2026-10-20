import { getTestPassword } from "./testing/password.mjs";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thiếu cấu hình Supabase.");

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: roles, error } = await client.from("roles")
  .select("code,role_permissions(permission_key)").order("code");
if (error) throw new Error(`${error.code}: ${error.message}`);

const personnelPermissions = ["employee.view", "contract.view", "insurance.view", "department.manage", "position.manage", "attendance.view_all", "attendance.manage", "timesheet.view_all", "timesheet.view_team", "leave.view_all"];
for (const role of roles ?? []) {
  const assigned = role.role_permissions.map((item) => item.permission_key);
  console.log(JSON.stringify({ role: role.code, personnel: personnelPermissions.filter((permission) => assigned.includes(permission)), selfTimesheet: assigned.includes("timesheet.self.view"), legacyTimesheet: assigned.includes("timesheet.view"), photoPermissions: assigned.filter((permission) => ["attendance.photo.view", "attendance.view_photo"].includes(permission)) }));
}

const { data: accounts, error: accountError } = await client.from("app_accounts")
  .select("employee_id,status,metadata,username,primary_email,account_roles!account_roles_account_id_fkey(roles(code))");
if (accountError) throw new Error(`${accountError.code}: ${accountError.message}`);
const unassigned = accounts.filter((account) => account.account_roles.length === 0);
console.log(JSON.stringify({ unassignedAccounts: unassigned.length, unassignedLinkedEmployees: unassigned.filter((account) => Boolean(account.employee_id)).length, unassignedActiveAccounts: unassigned.filter((account) => account.status === "active").length }));

const disposablePrivileged = accounts.filter((account) => account.metadata?.testData === true && account.username?.startsWith("test.") && account.status === "active" && account.account_roles.some((assignment) => ["admin", "hr"].includes(assignment.roles?.code)));
console.log(JSON.stringify({ disposablePrivilegedAccounts: disposablePrivileged.map((account) => ({ username: account.username, roles: account.account_roles.map((assignment) => assignment.roles?.code) })) }));
if (process.argv.includes("--check-test-login")) {
  const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authKey) throw new Error("Thiếu cấu hình public auth client.");
  const auth = createClient(url, authKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const account of disposablePrivileged) {
    const { data, error: authError } = await auth.auth.signInWithPassword({ email: account.primary_email, password: getTestPassword() });
    console.log(JSON.stringify({ username: account.username, testLogin: Boolean(data.user && !authError) }));
    if (data.session) await auth.auth.signOut();
  }
}

if (process.argv.includes("--check-contract-query")) {
  const { error: queryError } = await client.from("employee_contracts")
    .select("*,employees(employee_code,full_name,departments(name),positions(name))")
    .order("effective_date", { ascending: false, nullsFirst: false }).limit(1);
  console.log(JSON.stringify({ contractQuery: queryError ? { code: queryError.code, message: queryError.message, hint: queryError.hint } : "ok" }));
}

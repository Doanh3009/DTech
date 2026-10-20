import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thiếu Supabase URL hoặc secret/service-role key.");

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = [
  "system_settings", "app_accounts", "employees", "departments", "positions", "roles", "account_roles",
  "attendance_events", "attendance_photos", "leave_requests", "leave_ledger", "projects", "project_assignments",
  "project_updates", "warehouses", "inventory_items", "inventory_balances", "stock_ledger", "inventory_documents",
  "business_partners", "import_contracts", "shipments", "notifications", "approval_cases", "documents", "timesheet_periods"
];

let failed = false;
console.log(`host=${new URL(url).host}`);
for (const table of tables) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) failed = true;
  console.log(error ? `${table}\tERROR ${error.code} ${error.message}` : `${table}\tcount=${count}`);
}

const [accountsResult, employeesResult, accountRolesResult, rolesResult, authUsersResult] = await Promise.all([
  client.from("app_accounts").select("id,auth_user_id,employee_id,primary_email,status,username"),
  client.from("employees").select("id,employee_code"),
  client.from("account_roles").select("account_id,role_id"),
  client.from("roles").select("id,code"),
  client.auth.admin.listUsers({ page: 1, perPage: 1000 })
]);
for (const [label, result] of [["app_accounts.rows", accountsResult], ["employees.rows", employeesResult], ["account_roles.rows", accountRolesResult], ["roles.rows", rolesResult]]) {
  if (result.error) {
    failed = true;
    console.log(`${label}\tERROR ${result.error.code} ${result.error.message}`);
  }
}

if (authUsersResult.error) {
  failed = true;
  console.log(`auth.users\tERROR ${authUsersResult.error.message}`);
} else {
  const accounts = accountsResult.data ?? [];
  const employees = employeesResult.data ?? [];
  const authUsers = authUsersResult.data.users;
  const employeeIds = new Set(employees.map((row) => row.id));
  const authIds = new Set(authUsers.map((row) => row.id));
  const authEmails = new Set(authUsers.map((row) => row.email?.toLowerCase()).filter(Boolean));
  const accountRoles = accountRolesResult.data ?? [];
  const adminRoleIds = new Set((rolesResult.data ?? []).filter((role) => role.code === "admin").map((role) => role.id));
  const checks = {
    auth_users: authUsers.length,
    active_accounts_unlinked_employee: accounts.filter((row) => row.status === "active" && (!row.employee_id || !employeeIds.has(row.employee_id))).length,
    account_employee_orphans: accounts.filter((row) => row.employee_id && !employeeIds.has(row.employee_id)).length,
    employees_without_account: employees.filter((row) => !accounts.some((account) => account.employee_id === row.id)).length,
    accounts_without_role: accounts.filter((row) => !accountRoles.some((assignment) => assignment.account_id === row.id)).length,
    accounts_matching_auth_user_id: accounts.filter((row) => row.auth_user_id && authIds.has(row.auth_user_id)).length,
    accounts_matching_auth_email: accounts.filter((row) => authEmails.has(row.primary_email?.toLowerCase())).length,
    auth_without_account_link: authUsers.filter((row) => !accounts.some((account) => account.auth_user_id === row.id)).length,
    active_admin_accounts_unlinked_employee: accounts.filter((account) => account.status === "active" && !account.employee_id && accountRoles.some((assignment) => assignment.account_id === account.id && adminRoleIds.has(assignment.role_id))).length
  };
  for (const [name, count] of Object.entries(checks)) console.log(`relationship.${name}\tcount=${count}`);
  for (const username of ["test.supervisor", "test.employee"]) {
    const account = accounts.find((row) => row.username === username);
    console.log(`relationship.${username}.auth_linked\t${Boolean(account?.auth_user_id && authIds.has(account.auth_user_id))}`);
  }
  if (checks.account_employee_orphans || checks.accounts_without_role || checks.auth_without_account_link || checks.active_admin_accounts_unlinked_employee) failed = true;
}

if (failed) process.exit(1);

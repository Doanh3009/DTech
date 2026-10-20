import assert from "node:assert/strict";
import { check } from "./accounts.mjs";
export async function verifyBusinessSeed(db) {
  const accounts = await check(db.from("app_accounts").select("username,employee_id,auth_user_id,metadata").like("username", "test.user%").order("username"), "50-user cohort");
  assert.equal(accounts.length, 50, "Chưa đủ 50 tài khoản test.user01–50");
  assert(accounts.every((row, index) => row.username === `test.user${String(index + 1).padStart(2, "0")}` && row.employee_id && row.auth_user_id && row.metadata?.seedBatch === "test-users-50"), "Tài khoản cohort chưa liên kết đúng");
  const employees = accounts.map((row) => row.employee_id);
  async function count(table, minimum, filter = (query) => query) {
    const { count: size, error } = await filter(db.from(table).select("*", { count: "exact", head: true }));
    assert(!error, `${table}: ${error?.message}`); assert(size >= minimum, `${table}: ${size}/${minimum}`);
    console.log(`PASS ${table}=${size} (tối thiểu ${minimum})`);
  }
  await count("employees", 50, (q) => q.in("id", employees));
  for (const table of ["employee_contracts", "employee_salary_history", "timesheet_period_summaries", "payroll_lines", "payslips"]) await count(table, 50, (q) => q.in("employee_id", employees));
  await count("attendance_events", 1000, (q) => q.in("employee_id", employees));
  await count("leave_requests", 10, (q) => q.in("employee_id", employees));
  await count("inventory_items", 3); await count("warehouses", 2);
  await count("inventory_documents", 3, (q) => q.like("document_number", "TEST-%"));
  await count("stock_counts", 1, (q) => q.like("count_number", "TEST-%"));
  await count("import_contracts", 1, (q) => q.like("contract_number", "TEST-%"));
  await count("shipments", 1, (q) => q.like("shipment_number", "TEST-%"));
  await count("shipment_containers", 1, (q) => q.like("container_number", "TEST%"));
  await count("shipment_documents", 4, (q) => q.eq("note", "[TEST:ct-noibo-test-v1]"));
  await count("inventory_balances", 1);
  console.log("PASS dữ liệu chính HR, công, phép, lương, kho và XNK; không thay thế đối soát E2E");
}

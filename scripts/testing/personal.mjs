import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixedId, check } from "./accounts.mjs";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";
const profiles = JSON.parse(await readFile(new URL("../../src/config/testAccounts.json", import.meta.url), "utf8"));
export async function cohortPayrollPeriod(db) {
  const account = await check(db.from("app_accounts").select("employee_id,metadata").eq("username", "test.user01").single(), "cohort account");
  assert(account.metadata?.seedBatch === "test-users-50" && account.employee_id, "Cần seed cohort 50 trước dữ liệu cá nhân QA");
  const line = await check(db.from("payroll_lines").select("employee_id,payroll_period_id").eq("id", "97700000-0000-4000-8000-000000000001").single(), "cohort payroll line");
  assert(line.employee_id === account.employee_id && line.payroll_period_id, "Dòng lương không thuộc cohort 50");
  const period = await check(db.from("payroll_periods").select("id,period_month,status,note,timesheet_period_id").eq("id", line.payroll_period_id).single(), "cohort payroll period");
  assert(period.note?.includes("[TEST DATA]") && period.status === "published", "Kỳ lương cohort chưa phát hành hoặc không thuộc dữ liệu test");
  return period;
}
export async function seedPersonalData(db) {
  const actor = fixedId("account:admin.test");
  const period = await cohortPayrollPeriod(db), periodId = period.id;
  const location = await check(db.from("attendance_locations").select("id,latitude,longitude").eq("active", true).limit(1).single(), "test attendance location");
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  async function owned(table, id, expected, row) {
    const previous = await check(db.from(table).select(Object.keys(expected).join(",")).eq("id", id).maybeSingle(), `${table} ownership`);
    assert(!previous || Object.entries(expected).every(([key, value]) => previous[key] === value), `${table}: Không ghi đè dữ liệu ngoài seed`);
    await check(db.from(table).upsert({ id, ...row }, { onConflict: "id", ignoreDuplicates: true }), table);
  }
  for (const [index, profile] of profiles.entries()) {
    const employeeId = fixedId(`employee:${profile.username}`), accountId = fixedId(`account:${profile.username}`);
    const note = `[TEST:${TEST_OWNER}] ${profile.username}`;
    await owned("employee_contracts", fixedId(`contract:${profile.username}`), { employee_id: employeeId, note }, { employee_id: employeeId, contract_number: `QA-CONTRACT-${index + 1}`, contract_type: "Hợp đồng thử nghiệm", start_date: "2026-01-01", effective_date: "2026-01-01", signed_date: "2025-12-30", status: "active", note, created_by: actor });
    const base = 12000000 + index * 500000, allowance = 1000000, bonus = 500000, deduction = 200000;
    await owned("employee_salary_history", fixedId(`salary:${profile.username}`), { employee_id: employeeId, note }, { employee_id: employeeId, base_salary: base, allowance, bonus, deduction, effective_date: period.period_month, note, reason: "Dữ liệu giả lập QA", changed_by: actor });
    const lineId = fixedId(`payroll-line:${profile.username}`);
    await owned("payroll_lines", lineId, { employee_id: employeeId, payroll_period_id: periodId }, { employee_id: employeeId, payroll_period_id: periodId, work_days: 22, base_salary: base, allowance, bonus, deduction, calculation_snapshot: { testOwner: TEST_OWNER, scheduledDays: 22, workDays: 22 } });
    await owned("payslips", fixedId(`payslip:${profile.username}`), { employee_id: employeeId, payroll_line_id: lineId }, { employee_id: employeeId, payroll_line_id: lineId, version: 1, status: "published", snapshot: { periodMonth: period.period_month, employee: { code: `QA_${profile.username}`, name: `[TEST] ${profile.label}` }, work_days: 22, base_salary: base, allowance, bonus, deduction, net_salary: base + allowance + bonus - deduction, testOwner: TEST_OWNER }, published_at: `${period.period_month}T12:00:00+07:00`, published_by: actor });
    for (const [kind, time] of [["check_in", "08:00"], ["check_out", "17:00"]]) {
      const id = fixedId(`attendance:${profile.username}:${date}:${kind}`);
      await owned("attendance_events", id, { employee_id: employeeId, account_id: accountId }, { client_event_id: id, employee_id: employeeId, account_id: accountId, event_type: kind, attendance_date: date, effective_at: `${date}T${time}:00+07:00`, captured_at_client: `${date}T${time}:00+07:00`, location_id: location.id, latitude: location.latitude, longitude: location.longitude, accuracy_meters: 5, distance_meters: 0, geofence_status: "valid", attendance_status: "recorded", photo_status: "not_required", sync_status: "synced", captured_offline: false, device_metadata: { testOwner: TEST_OWNER } });
    }
  }
  console.log("READY hợp đồng, lịch sử lương, phiếu lương và công cá nhân cho 10 tài khoản QA");
}

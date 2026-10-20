import { assertSeedTarget } from "./testing/guard.mjs";
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
await assertSeedTarget();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thiếu cấu hình Supabase.");
const host = new URL(url).hostname;
const local = host === "localhost" || host === "127.0.0.1";
if (!local && !process.argv.includes("--allow-remote")) throw new Error("Remote seed cần --allow-remote.");
const dryRun = process.argv.includes("--dry-run");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const supervisor = { accountId: "91000000-0000-4000-8000-000000000001", employeeId: "90000000-0000-4000-8000-000000000001", username: "test.supervisor" };
const employee = { accountId: "91000000-0000-4000-8000-000000000002", employeeId: "90000000-0000-4000-8000-000000000002", username: "test.employee" };
const actorId = supervisor.accountId;
const people = [supervisor, employee];

function assertResult(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data ?? [];
}

async function insertMissing(table, rows) {
  if (!rows.length) return 0;
  const ids = rows.map((row) => row.id);
  const existing = assertResult(await client.from(table).select("id").in("id", ids), `Đọc ${table}`);
  const found = new Set(existing.map((row) => row.id));
  const missing = rows.filter((row) => !found.has(row.id));
  if (!dryRun && missing.length) assertResult(await client.from(table).insert(missing), `Nạp ${table}`);
  console.log(`${table}: có ${existing.length}, ${dryRun ? "sẽ thêm" : "đã thêm"} ${missing.length}`);
  return missing.length;
}

function businessToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}

function dateKey(date) { return date.toISOString().slice(0, 10); }
function monthStart(today, offset) { return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)); }
function fixedId(prefix, number) { return `${prefix}-${String(number).padStart(12, "0")}`; }
function calendarId(prefix, person, date, eventNumber) {
  const tail = createHash("md5").update(`${person.employeeId}:${date}:${eventNumber}`).digest("hex").slice(0, 12);
  return `${prefix}-${tail}`;
}

console.log(`host=${host} mode=${dryRun ? "dry-run" : "seed"}`);

const accounts = assertResult(await client.from("app_accounts").select("id,employee_id,username,metadata").in("id", people.map((person) => person.accountId)), "Kiểm tra tài khoản TEST");
for (const person of people) {
  const account = accounts.find((row) => row.id === person.accountId);
  if (!account || account.employee_id !== person.employeeId || account.username !== person.username || account.metadata?.testData !== true) {
    throw new Error(`Tài khoản ${person.username} không phải fixture TEST hợp lệ; không ghi dữ liệu.`);
  }
}
const employeeRows = assertResult(await client.from("employees").select("id,employee_code,full_name").in("id", people.map((person) => person.employeeId)), "Kiểm tra nhân viên TEST");
if (employeeRows.length !== 2 || employeeRows.some((row) => !row.employee_code?.startsWith("TEST-"))) throw new Error("Nhân viên TEST không hợp lệ.");

const role = assertResult(await client.from("roles").select("id").eq("code", "employee").maybeSingle(), "Đọc vai trò Nhân viên");
if (!role?.id) throw new Error("Thiếu vai trò Nhân viên.");
const assignedRoles = assertResult(await client.from("account_roles").select("account_id").eq("role_id", role.id).in("account_id", people.map((person) => person.accountId)), "Đọc vai trò TEST");
const missingRoles = people.filter((person) => !assignedRoles.some((row) => row.account_id === person.accountId));
if (!dryRun && missingRoles.length) assertResult(await client.from("account_roles").insert(missingRoles.map((person) => ({ account_id: person.accountId, role_id: role.id }))), "Gán vai trò Nhân viên cho tài khoản TEST");
console.log(`employee_role: ${dryRun ? "sẽ thêm" : "đã thêm"} ${missingRoles.length}`);

const location = assertResult(await client.from("attendance_locations").select("id,latitude,longitude").eq("active", true).order("created_at").limit(1).maybeSingle(), "Đọc địa điểm chấm công");
if (!location?.id) throw new Error("Thiếu địa điểm chấm công active.");
const today = businessToday();
const workingDates = Array.from({ length: 24 }, (_, index) => {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() - index - 1);
  return date;
}).filter((date) => ![0, 6].includes(date.getUTCDay()));
const missingCheckoutDate = dateKey(workingDates[2]);
const firstDate = dateKey(workingDates.at(-1));
const existingEvents = assertResult(await client.from("attendance_events").select("employee_id,attendance_date,event_type").in("employee_id", people.map((person) => person.employeeId)).gte("attendance_date", firstDate), "Đọc lịch công TEST");
const eventKeys = new Set(existingEvents.map((row) => `${row.employee_id}:${row.attendance_date}:${row.event_type}`));
const calendarRows = [];
for (const person of people) for (const dateValue of workingDates) {
  const date = dateKey(dateValue);
  for (const eventNumber of [0, 1]) {
    if (eventNumber === 1 && date === missingCheckoutDate) continue;
    const eventType = eventNumber === 0 ? "check_in" : "check_out";
    if (eventKeys.has(`${person.employeeId}:${date}:${eventType}`)) continue;
    const time = eventNumber === 0 ? "07:54" : "17:06";
    calendarRows.push({
      id: calendarId("94200000-0000-4000-8000", person, date, eventNumber),
      client_event_id: calendarId("94300000-0000-4000-8000", person, date, eventNumber),
      employee_id: person.employeeId, account_id: person.accountId, event_type: eventType,
      attendance_date: date, effective_at: `${date}T${time}:00+07:00`, captured_at_client: `${date}T${time}:00+07:00`,
      location_id: location.id, latitude: location.latitude, longitude: location.longitude,
      accuracy_meters: 12, distance_meters: 8, geofence_status: "valid", attendance_status: "recorded",
      photo_status: "not_required", sync_status: "synced", captured_offline: false,
      device_metadata: { testData: true, device: "seed-calendar" }
    });
  }
}
const periodCandidates = Array.from({ length: 12 }, (_, index) => {
  const offset = index + 1;
  const start = monthStart(today, offset);
  const end = new Date(monthStart(today, offset - 1).getTime() - 86_400_000);
  const periodMonth = dateKey(start);
  const workDays = offset === 1 ? 21 : 22 - (offset % 3);
  const baseSalary = 18_000_000 - (offset - 1) * 150_000;
  const bonus = offset === 1 ? 500_000 : offset * 100_000;
  return { offset, periodMonth, startDate: dateKey(start), endDate: dateKey(end), workDays, baseSalary, bonus,
    timesheetId: fixedId("98300000-0000-4000-8000", offset), snapshotId: fixedId("98310000-0000-4000-8000", offset), summaryId: fixedId("98320000-0000-4000-8000", offset),
    supervisorSummaryId: fixedId("98330000-0000-4000-8000", offset),
    payrollId: fixedId("98400000-0000-4000-8000", offset), lineId: fixedId("98410000-0000-4000-8000", offset), payslipId: fixedId("98420000-0000-4000-8000", offset),
    supervisorLineId: fixedId("98430000-0000-4000-8000", offset), supervisorPayslipId: fixedId("98440000-0000-4000-8000", offset) };
});
const [existingPayrollMonths, existingTimesheetMonths, existingPayrollIds, existingTimesheetIds] = await Promise.all([
  client.from("payroll_periods").select("id,period_month").in("period_month", periodCandidates.map((item) => item.periodMonth)),
  client.from("timesheet_periods").select("id,start_date").in("start_date", periodCandidates.map((item) => item.startDate)),
  client.from("payroll_periods").select("id,period_month").in("id", periodCandidates.map((item) => item.payrollId)),
  client.from("timesheet_periods").select("id,start_date").in("id", periodCandidates.map((item) => item.timesheetId))
]);
const payrollByMonth = assertResult(existingPayrollMonths, "Kiểm tra tháng lương");
const timesheetByMonth = assertResult(existingTimesheetMonths, "Kiểm tra tháng công");
const payrollById = assertResult(existingPayrollIds, "Kiểm tra ID kỳ lương TEST");
const timesheetById = assertResult(existingTimesheetIds, "Kiểm tra ID kỳ công TEST");
const periodData = periodCandidates.filter((period) => {
  const payrollMonth = payrollByMonth.find((row) => row.period_month === period.periodMonth);
  const timesheetMonth = timesheetByMonth.find((row) => row.start_date === period.startDate);
  const payrollId = payrollById.find((row) => row.id === period.payrollId);
  const timesheetId = timesheetById.find((row) => row.id === period.timesheetId);
  return (!payrollMonth || payrollMonth.id === period.payrollId) && (!timesheetMonth || timesheetMonth.id === period.timesheetId)
    && (!payrollId || payrollId.period_month === period.periodMonth) && (!timesheetId || timesheetId.start_date === period.startDate);
}).slice(0, 4);
if (periodData.length !== 4) throw new Error("Không đủ bốn tháng trống an toàn để tạo phiếu lương TEST.");
console.log(`payslip_months=${periodData.map((period) => period.periodMonth.slice(0, 7)).join(",")}`);
if (!dryRun && calendarRows.length) assertResult(await client.from("attendance_events").insert(calendarRows), "Nạp lịch chấm công cá nhân TEST");
console.log(`attendance_events: ${dryRun ? "sẽ thêm" : "đã thêm"} ${calendarRows.length} lượt cá nhân; worker attendance không thay đổi`);
const now = new Date().toISOString();
await insertMissing("timesheet_periods", periodData.map((period) => ({ id: period.timesheetId, code: period.offset === 1 ? "TEST-TS-PREV" : `TEST-TS-HISTORY-${period.offset}`, name: `[TEST DATA] Kỳ công ${period.periodMonth.slice(0, 7)}`, start_date: period.startDate, end_date: period.endDate, status: "locked", version: 1, row_version: 1, locked_at: now, locked_by: actorId, created_by: actorId })));
const timesheetSummaryRows = periodData.flatMap((period) => [
  { id: period.summaryId, period_id: period.timesheetId, employee_id: employee.employeeId, employee_snapshot: { code: "TEST-NV01", name: "Trần Thu Nhân Viên" }, scheduled_workdays: 22, actual_workdays: period.workDays, worked_minutes: period.workDays * 480 },
  { id: period.supervisorSummaryId, period_id: period.timesheetId, employee_id: supervisor.employeeId, employee_snapshot: { code: "TEST-GS01", name: "Nguyễn Minh Giám Sát" }, scheduled_workdays: 22, actual_workdays: 22, worked_minutes: 10_560 }
]);
await insertMissing("timesheet_period_summaries", timesheetSummaryRows);
await insertMissing("timesheet_period_versions", periodData.map((period) => ({
  id: period.snapshotId,
  period_id: period.timesheetId,
  version: 1,
  snapshot: {
    period: { id: period.timesheetId, start_date: period.startDate, end_date: period.endDate, status: "locked", version: 1 },
    daily: [],
    summaries: timesheetSummaryRows.filter((summary) => summary.period_id === period.timesheetId)
  },
  created_by: actorId
})));
await insertMissing("payroll_periods", periodData.map((period) => ({ id: period.payrollId, period_month: period.periodMonth, timesheet_period_id: period.timesheetId, status: "published", calculated_at: now, calculated_by: actorId, created_by: actorId, note: "[TEST DATA] Phiếu lương cá nhân" })));
await insertMissing("payroll_lines", periodData.flatMap((period) => [
  { id: period.lineId, payroll_period_id: period.payrollId, employee_id: employee.employeeId, work_days: period.workDays, base_salary: period.baseSalary, allowance: 1_200_000, bonus: period.bonus, deduction: 300_000, calculation_snapshot: { testData: true } },
  { id: period.supervisorLineId, payroll_period_id: period.payrollId, employee_id: supervisor.employeeId, work_days: 22, base_salary: 22_000_000 - (period.offset - 1) * 200_000, allowance: 2_000_000, bonus: 750_000, deduction: 400_000, calculation_snapshot: { testData: true } }
]));
await insertMissing("payslips", periodData.flatMap((period) => {
  const supervisorBaseSalary = 22_000_000 - (period.offset - 1) * 200_000;
  const publishedAt = new Date(Date.parse(period.periodMonth) + 35 * 86_400_000).toISOString();
  return [
    { id: period.payslipId, payroll_line_id: period.lineId, employee_id: employee.employeeId, version: 1, status: "published", snapshot: { periodMonth: period.periodMonth, work_days: period.workDays, base_salary: period.baseSalary, allowance: 1_200_000, bonus: period.bonus, deduction: 300_000, net_salary: period.baseSalary + 1_200_000 + period.bonus - 300_000, testData: true }, published_at: publishedAt, published_by: actorId },
    { id: period.supervisorPayslipId, payroll_line_id: period.supervisorLineId, employee_id: supervisor.employeeId, version: 1, status: "published", snapshot: { periodMonth: period.periodMonth, work_days: 22, base_salary: supervisorBaseSalary, allowance: 2_000_000, bonus: 750_000, deduction: 400_000, net_salary: supervisorBaseSalary + 2_000_000 + 750_000 - 400_000, testData: true }, published_at: publishedAt, published_by: actorId }
  ];
}));

const groupId = "98600000-0000-4000-8000-000000000001";
const directId = "98600000-0000-4000-8000-000000000002";
const directKey = people.map((person) => person.accountId).sort().join(":");
await insertMissing("conversations", [
  { id: groupId, type: "group", title: "[TEST] Điều phối QC03", created_by: actorId },
  { id: directId, type: "direct", direct_key: directKey, created_by: employee.accountId }
]);
const expectedMembers = [
  { conversation_id: groupId, account_id: supervisor.accountId, role: "owner" },
  { conversation_id: groupId, account_id: employee.accountId, role: "member" },
  { conversation_id: directId, account_id: employee.accountId, role: "owner" },
  { conversation_id: directId, account_id: supervisor.accountId, role: "member" }
];
const members = assertResult(await client.from("conversation_members").select("conversation_id,account_id").in("conversation_id", [groupId, directId]), "Đọc thành viên hội thoại TEST");
const missingMembers = expectedMembers.filter((member) => !members.some((row) => row.conversation_id === member.conversation_id && row.account_id === member.account_id));
if (!dryRun && missingMembers.length) assertResult(await client.from("conversation_members").insert(missingMembers), "Nạp thành viên hội thoại TEST");
console.log(`conversation_members: ${dryRun ? "sẽ thêm" : "đã thêm"} ${missingMembers.length}`);
const messageBodies = [
  [groupId, supervisor.accountId, "[TEST DATA] Đã cập nhật danh sách đầu ca."],
  [groupId, employee.accountId, "[TEST DATA] Đã nhận thông tin."],
  [groupId, supervisor.accountId, "[TEST DATA] Ca sáng đã xác nhận đủ người."],
  [groupId, employee.accountId, "[TEST DATA] Em sẽ theo dõi lịch công."],
  [directId, employee.accountId, "[TEST DATA] Anh kiểm tra giúp em lượt chấm ra hôm trước nhé."],
  [directId, supervisor.accountId, "[TEST DATA] Anh đã nhận, sẽ kiểm tra trong hôm nay."]
];
await insertMissing("messages", messageBodies.map(([conversationId, senderId, body], index) => ({
  id: fixedId("98610000-0000-4000-8000", index + 1), conversation_id: conversationId,
  sender_account_id: senderId, body, created_at: new Date(Date.now() - (6 - index) * 3_600_000).toISOString(),
  metadata: { testData: true, deliveryState: "sent" }
})));

const [attendanceCount, workerCount, workerEntryCount, payslipCount, supervisorPayslipCount, messageCount] = await Promise.all([
  client.from("attendance_events").select("id", { count: "exact", head: true }).in("employee_id", people.map((person) => person.employeeId)),
  client.from("worker_attendance_sessions").select("id", { count: "exact", head: true }).eq("supervisor_employee_id", supervisor.employeeId),
  client.from("worker_attendance_entries").select("id", { count: "exact", head: true }).eq("session_id", "95000000-0000-4000-8000-000000000001"),
  client.from("payslips").select("id", { count: "exact", head: true }).eq("employee_id", employee.employeeId),
  client.from("payslips").select("id", { count: "exact", head: true }).eq("employee_id", supervisor.employeeId),
  client.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", [groupId, directId])
]);
for (const [label, result] of [["personal_attendance", attendanceCount], ["worker_sessions", workerCount], ["worker_session_entries", workerEntryCount], ["employee_payslips", payslipCount], ["supervisor_payslips", supervisorPayslipCount], ["test_messages", messageCount]]) {
  if (result.error) throw new Error(`Kiểm tra ${label}: ${result.error.message}`);
  console.log(`${label}: ${result.count}`);
}
const workerSession = assertResult(await client.from("worker_attendance_sessions").select("attendance_date,status").eq("id", "95000000-0000-4000-8000-000000000001").maybeSingle(), "Kiểm tra phiên công nhân TEST");
console.log(`worker_test_session: ${workerSession ? `${workerSession.attendance_date} / ${workerSession.status}` : "không có"}`);
const activeAssignments = assertResult(await client.from("project_assignments").select("employee_id,assignment_role")
  .eq("project_id", "b0000000-0000-4000-8000-000000000001")
  .eq("worksite_id", "b1000000-0000-4000-8000-000000000001")
  .eq("status", "active").lte("start_date", dateKey(today))
  .or(`end_date.is.null,end_date.gte.${dateKey(today)}`), "Kiểm tra phân công công trường hôm nay");
console.log(`worker_today_roster: supervisor=${activeAssignments.filter((row) => row.employee_id === supervisor.employeeId && row.assignment_role.startsWith("supervisor")).length}, workers=${activeAssignments.filter((row) => row.assignment_role === "worker").length}`);
const supervisorRoles = assertResult(await client.from("account_roles").select("role_id").eq("account_id", supervisor.accountId), "Kiểm tra vai trò giám sát TEST");
const supervisorPermissions = assertResult(await client.from("role_permissions").select("permission_key")
  .in("role_id", supervisorRoles.map((row) => row.role_id))
  .in("permission_key", ["attendance.self.create", "worker_attendance.create", "payslip.self.view"]), "Kiểm tra quyền giám sát TEST");
console.log(`supervisor_test_permissions: ${[...new Set(supervisorPermissions.map((row) => row.permission_key))].sort().join(",")}`);

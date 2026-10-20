import { assertSeedTarget } from "./testing/guard.mjs";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
await assertSeedTarget();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc Supabase secret/service-role key.");

const targetHost = new URL(url).hostname;
const isLocalTarget = targetHost === "127.0.0.1" || targetHost === "localhost";
const allowRemote = process.argv.includes("--allow-remote");
const dryRun = process.argv.includes("--dry-run");
const reset = process.argv.includes("--reset");
if (!isLocalTarget && !allowRemote) {
  throw new Error("Từ chối ghi dữ liệu tài khoản mẫu lên Supabase remote. Chỉ dùng --allow-remote sau khi xác nhận đây là staging/test.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const testPassword = process.env.TEST_ACCOUNT_PASSWORD || process.env.SEED_TEST_PASSWORD;
if (!testPassword || testPassword.length < 12) throw new Error("Mật khẩu test phải có tối thiểu 12 ký tự.");

const count = 50;
const staffIds = Array.from({ length: count }, (_, index) => fixedId("90500000", index + 1));
const accountIds = Array.from({ length: count }, (_, index) => fixedId("91500000", index + 1));
const attendanceEventIds = Array.from({ length: count * 40 }, (_, index) => fixedId("92500000", index + 1));
const rowsByTable = {
  attendance_events: [],
  employee_contracts: staffIds.map((_, index) => fixedId("93500000", index + 1)),
  leave_requests: Array.from({ length: 25 }, (_, index) => fixedId("94500000", index + 1)),
  leave_request_approval_steps: Array.from({ length: 25 }, (_, index) => fixedId("94600000", index + 1)),
  project_assignments: Array.from({ length: 10 }, (_, index) => fixedId("95500000", index + 1)),
  timesheet_period_summaries: staffIds.map((_, index) => fixedId("96500000", index + 1)),
  employee_salary_history: staffIds.map((_, index) => fixedId("97600000", index + 1)),
  payroll_lines: staffIds.map((_, index) => fixedId("97700000", index + 1)),
  payslips: staffIds.map((_, index) => fixedId("97800000", index + 1))
};
const ownedTimesheetPeriodId = fixedId("90400000", 1);
const ownedPayrollPeriodId = fixedId("91400000", 1);

function fixedId(prefix, number) {
  return `${prefix}-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function check(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

async function write(operation, label) {
  check(await operation, label);
}

async function upsertRows(table, rows, label = table) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    await write(client.from(table).upsert(rows.slice(offset, offset + 500), { onConflict: "id" }), `Nạp ${label}`);
  }
}

function businessToday() {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function dateKey(date) { return date.toISOString().slice(0, 10); }
function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function isoTime(date, hour, minute) {
  return `${dateKey(date)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`;
}

const familyNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Võ", "Đặng", "Bùi", "Đỗ"];
const middleNames = ["Minh", "Thảo", "Gia", "Thanh", "Quốc", "Khánh", "Bảo", "Thu", "Hải", "Ngọc"];
const givenNames = ["Anh", "Bình", "Châu", "Duy", "Giang", "Hà", "Khoa", "Lan", "Nam", "Phương"];
const groups = [
  { start: 0, end: 1, department: "board", position: "director", type: "office_employee", specialRole: null },
  { start: 2, end: 11, department: "engineering", position: "engineer", type: "engineer", specialRole: null },
  { start: 12, end: 21, department: "construction", position: "worker", type: "worker", specialRole: null },
  { start: 22, end: 28, department: "warehouse", position: "warehouse_keeper", type: "support_staff", specialRole: null },
  { start: 29, end: 36, department: "import_export", position: "engineer", type: "office_employee", specialRole: null },
  { start: 37, end: 42, department: "accounting", position: "accountant", type: "office_employee", specialRole: "accountant" },
  { start: 43, end: 49, department: "hr", position: "hr_specialist", type: "office_employee", specialRole: "hr" }
];

function groupFor(index) { return groups.find((group) => index >= group.start && index <= group.end); }
function fullName(index) {
  return `${familyNames[index % familyNames.length]} ${middleNames[Math.floor(index / familyNames.length)]} ${givenNames[(index * 7) % givenNames.length]}`;
}
function username(index) { return `test.user${String(index + 1).padStart(2, "0")}`; }
function loginEmail(index) { return `${username(index)}@accounts.chautuan.local`; }

const today = businessToday();
const todayKey = dateKey(today);
const people = Array.from({ length: count }, (_, index) => {
  const group = groupFor(index);
  const number = index + 1;
  const name = fullName(index);
  const displayName = name.split(" ").at(-1);
  const phone = `091${String(3000000 + number).slice(-7)}`;
  const managerIndex = index === group.start ? null : group.start;
  const isSupervisor = group.department === "construction" && index < group.start + 2;
  const isPrimaryAccountant = index === 0;
  const departmentCode = isPrimaryAccountant ? "accounting" : group.department;
  const positionCode = isPrimaryAccountant ? "accountant" : isSupervisor ? "site_supervisor" : group.position;
  const employmentTypeCode = isPrimaryAccountant ? "office_employee" : isSupervisor ? "supervisor" : group.type;
  const extraRole = isPrimaryAccountant ? "accountant" : isSupervisor ? "supervisor" : group.specialRole;
  const profileIncomplete = index >= 47;
  const joinDate = addDays(today, -((number % 6) + 1) * 120).toISOString().slice(0, 10);
  const birthDate = `${1972 + (number % 25)}-${String((number % 12) + 1).padStart(2, "0")}-${String((number % 27) + 1).padStart(2, "0")}`;
  return {
    index,
    number,
    employeeId: staffIds[index],
    accountId: accountIds[index],
    username: username(index),
    email: loginEmail(index),
    name,
    displayName,
    phone,
    managerEmployeeId: managerIndex === null ? null : staffIds[managerIndex],
    departmentCode,
    positionCode,
    employmentTypeCode,
    extraRole,
    joinDate,
    birthDate,
    profileStatus: profileIncomplete ? "pending_hr_completion" : "complete",
    profileCompleteness: profileIncomplete ? 72 + (index % 4) * 6 : 100,
    employmentStatus: [5, 27].includes(index) ? "probation" : index === 46 ? "on_leave" : "active"
  };
});

const accountIdSet = people.map((person) => person.accountId);
const accountEmails = people.map((person) => person.email);
const authByEmail = new Map();

async function removeSeedData() {
  const existingAccounts = check(await client.from("app_accounts").select("id,auth_user_id").in("id", accountIdSet), "Đọc tài khoản mẫu");
  const authIds = new Set(existingAccounts.map((row) => row.auth_user_id).filter(Boolean));
  const authList = check(await client.auth.admin.listUsers({ page: 1, perPage: 1000 }), "Liệt kê tài khoản Auth");
  for (const user of authList.users) {
    if (accountEmails.includes(user.email?.toLowerCase()) || authIds.has(user.id)) {
      const { error } = await client.auth.admin.deleteUser(user.id);
      if (error) throw new Error(`Xóa Auth ${user.email}: ${error.message}`);
    }
  }

  for (const [table, ids] of [
    ["payslips", rowsByTable.payslips],
    ["payroll_lines", rowsByTable.payroll_lines],
    ["payroll_periods", [ownedPayrollPeriodId]],
    ["timesheet_period_summaries", rowsByTable.timesheet_period_summaries],
    ["timesheet_periods", [ownedTimesheetPeriodId]],
    ["employee_salary_history", rowsByTable.employee_salary_history],
    ["project_assignments", rowsByTable.project_assignments],
    ["leave_request_approval_steps", rowsByTable.leave_request_approval_steps],
    ["leave_requests", rowsByTable.leave_requests],
    ["employee_contracts", rowsByTable.employee_contracts],
    ["attendance_events", attendanceEventIds]
  ]) {
    if (ids.length) await write(client.from(table).delete().in("id", ids), `Xóa ${table} mẫu`);
  }
  await write(client.from("audit_logs").delete().in("actor_account_id", accountIdSet), "Xóa audit log tài khoản mẫu");
  await write(client.from("account_roles").delete().in("account_id", accountIdSet), "Xóa vai trò tài khoản mẫu");
  await write(client.from("app_accounts").delete().in("id", accountIdSet), "Xóa tài khoản mẫu");
  await write(client.from("employees").update({ manager_employee_id: null }).in("id", staffIds), "Gỡ liên kết quản lý mẫu");
  await write(client.from("employees").delete().in("id", staffIds), "Xóa nhân viên mẫu");
  process.stdout.write(`Đã xóa cohort ${count} tài khoản mẫu và dữ liệu liên quan.\n`);
}

if (reset) {
  await removeSeedData();
  process.exit(0);
}

const seedActorIds = [fixedId("91000000", 1), fixedId("91000000", 2), fixedId("91000000", 3)];
const [departmentsResult, positionsResult, employmentTypesResult, rolesResult, locationsResult, leaveTypesResult, periodsResult, timesheetPeriodsResult, seedActorsResult, projectsResult, worksitesResult, existingAccountsResult] = await Promise.all([
  client.from("departments").select("id,code"),
  client.from("positions").select("id,code"),
  client.from("employment_types").select("id,code"),
  client.from("roles").select("id,code").in("code", ["employee", "supervisor", "hr", "accountant"]),
  client.from("attendance_locations").select("id,latitude,longitude").eq("active", true).order("created_at").limit(1).maybeSingle(),
  client.from("leave_types").select("id,code,name").eq("active", true),
  client.from("payroll_periods").select("id,period_month,timesheet_period_id,status,created_by,note").order("period_month", { ascending: false }).limit(1000),
  client.from("timesheet_periods").select("id,start_date,end_date,code").limit(1000),
  client.from("app_accounts").select("id").in("id", seedActorIds),
  client.from("projects").select("id,name").eq("id", "b0000000-0000-4000-8000-000000000001").maybeSingle(),
  client.from("worksites").select("id,name").eq("id", "b1000000-0000-4000-8000-000000000001").maybeSingle(),
  client.from("app_accounts").select("id,auth_user_id").in("id", accountIdSet)
]);
const departments = check(departmentsResult, "Đọc phòng ban");
const positions = check(positionsResult, "Đọc chức vụ");
const employmentTypes = check(employmentTypesResult, "Đọc loại nhân sự");
const roles = check(rolesResult, "Đọc vai trò");
const location = locationsResult.data;
const leaveTypes = check(leaveTypesResult, "Đọc loại nghỉ");
const existingPayrollPeriods = check(periodsResult, "Đọc kỳ payroll");
const existingTimesheetPeriods = check(timesheetPeriodsResult, "Đọc kỳ công");
const seedActors = check(seedActorsResult, "Đọc tài khoản seed cơ sở");
const project = projectsResult.data;
const worksite = worksitesResult.data;
const existingAccounts = check(existingAccountsResult, "Đọc tài khoản mẫu hiện có");

if (locationsResult.error || !location) throw new Error("Thiếu địa điểm chấm công active trong bộ seed cơ sở.");
if (!project || !worksite) throw new Error("Thiếu project/worksite TEST trong bộ seed cơ sở.");
const availableDepartmentCodes = new Set(departments.map((row) => row.code));
const departmentFallback = ["import_export", "engineering", "construction", "accounting", "hr", "board"]
  .find((code) => availableDepartmentCodes.has(code));
if (!departmentFallback) throw new Error("Thiếu phòng ban cơ sở để gắn hồ sơ test.");
for (const person of people) {
  if (!availableDepartmentCodes.has(person.departmentCode)) person.departmentCode = departmentFallback;
}
const seedActorId = seedActorIds.find((id) => seedActors.some((row) => row.id === id));
if (!seedActorId) throw new Error("Thiếu một tài khoản TEST cơ sở để ghi created_by/locked_by.");
const currentMonth = `${todayKey.slice(0, 7)}-01`;
let payrollPeriod = existingPayrollPeriods.find((period) => period.status === "published"
  && period.period_month < currentMonth && period.timesheet_period_id && period.created_by
  && (period.note?.includes("[TEST DATA]") || period.id === ownedPayrollPeriodId));
let timesheetPeriodToCreate = null;
let payrollPeriodToCreate = null;
if (!payrollPeriod) {
  const ownedTimesheet = existingTimesheetPeriods.find((period) => period.id === ownedTimesheetPeriodId);
  let periodStart;
  let periodEnd;
  if (ownedTimesheet && ownedTimesheet.start_date < currentMonth) {
    periodStart = ownedTimesheet.start_date;
    periodEnd = ownedTimesheet.end_date;
  } else {
    for (let offset = 1; offset <= 60; offset += 1) {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
      const startKey = dateKey(start);
      const endKey = dateKey(end);
      const monthExists = existingPayrollPeriods.some((period) => String(period.period_month).slice(0, 10) === startKey);
      const timesheetExists = existingTimesheetPeriods.some((period) => period.start_date === startKey && period.end_date === endKey);
      if (!monthExists && !timesheetExists) {
        periodStart = startKey;
        periodEnd = endKey;
        break;
      }
    }
  }
  if (!periodStart || !periodEnd) throw new Error("Không tìm được tháng trống để tạo kỳ TEST riêng cho cohort.");
  const periodMonth = periodStart;
  payrollPeriod = {
    id: ownedPayrollPeriodId,
    period_month: periodMonth,
    timesheet_period_id: ownedTimesheetPeriodId,
    status: "published",
    created_by: seedActorId
  };
  timesheetPeriodToCreate = {
    id: ownedTimesheetPeriodId,
    code: ownedTimesheet?.code ?? `TEST-TS-50U-${periodMonth.slice(0, 7).replace("-", "")}`,
    name: `[TEST DATA] Kỳ công ${periodMonth.slice(0, 7)} · cohort 50 tài khoản`,
    start_date: periodStart,
    end_date: periodEnd,
    status: "locked",
    version: 1,
    row_version: 1,
    locked_at: new Date().toISOString(),
    locked_by: seedActorId,
    created_by: seedActorId
  };
  payrollPeriodToCreate = {
    id: ownedPayrollPeriodId,
    period_month: periodMonth,
    timesheet_period_id: ownedTimesheetPeriodId,
    status: "published",
    calculated_at: new Date().toISOString(),
    calculated_by: seedActorId,
    created_by: seedActorId,
    note: "[TEST DATA] Cohort 50 tài khoản"
  };
}
for (const person of people) {
  const missing = [
    !departments.some((row) => row.code === person.departmentCode) ? `department:${person.departmentCode}` : null,
    !positions.some((row) => row.code === person.positionCode) ? `position:${person.positionCode}` : null,
    !employmentTypes.some((row) => row.code === person.employmentTypeCode) ? `employment_type:${person.employmentTypeCode}` : null
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Thiếu dữ liệu tham chiếu hồ sơ cho ${person.username}: ${missing.join(", ")}.`);
  }
}
for (const code of ["employee", "supervisor", "hr", "accountant"]) {
  if (!roles.some((row) => row.code === code)) throw new Error(`Thiếu role '${code}'.`);
}
if (!leaveTypes.length) throw new Error("Thiếu loại nghỉ active trong bộ seed cơ sở.");

const departmentByCode = new Map(departments.map((row) => [row.code, row.id]));
const positionByCode = new Map(positions.map((row) => [row.code, row.id]));
const employmentTypeByCode = new Map(employmentTypes.map((row) => [row.code, row.id]));
const roleByCode = new Map(roles.map((row) => [row.code, row.id]));
const employeeRoleId = roleByCode.get("employee");
const hrPeople = people.filter((person) => person.extraRole === "hr");
const leaveApprover = hrPeople[0];
const supervisorActor = people.find((person) => person.extraRole === "supervisor");
const projectActor = supervisorActor?.accountId ?? payrollPeriod.created_by;

const employeeRows = people.map((person) => ({
  id: person.employeeId,
  employee_code: `TEST-USER-${String(person.number).padStart(3, "0")}`,
  full_name: person.name,
  display_name: person.displayName,
  date_of_birth: person.birthDate,
  gender: person.index % 2 === 0 ? "female" : "male",
  personal_phone: person.phone,
  normalized_phone: `84${person.phone.slice(1)}`,
  personal_email: `user${String(person.number).padStart(2, "0")}@example.test`,
  company_email: `${person.username}@chautuan.local`,
  current_address: `${100 + person.number} Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh`,
  permanent_address: `${20 + person.number} Lê Lợi, TP. Thủ Đức, TP. Hồ Chí Minh`,
  province: "Thành phố Hồ Chí Minh",
  country: "Việt Nam",
  department_id: departmentByCode.get(person.departmentCode),
  position_id: positionByCode.get(person.positionCode),
  employment_type_id: employmentTypeByCode.get(person.employmentTypeCode),
  manager_employee_id: person.managerEmployeeId,
  join_date: person.joinDate,
  employment_status: person.employmentStatus,
  profile_status: person.profileStatus,
  profile_completeness: person.profileCompleteness,
  note: `[TEST DATA] Hồ sơ mẫu ${person.username}`
}));

const existingAuthByAccountId = new Map(existingAccounts.map((row) => [row.id, row.auth_user_id]));
const accountRows = people.map((person) => ({
  id: person.accountId,
  employee_id: person.employeeId,
  auth_user_id: existingAuthByAccountId.get(person.accountId) ?? null,
  display_name: person.name,
  primary_email: person.email,
  status: "active",
  username: person.username,
  metadata: { testData: true, seedBatch: "test-users-50" }
}));

const authList = check(await client.auth.admin.listUsers({ page: 1, perPage: 1000 }), "Liệt kê tài khoản Auth");
for (const user of authList.users) {
  if (accountEmails.includes(user.email?.toLowerCase())) authByEmail.set(user.email.toLowerCase(), user);
}

for (let index = 0; index < count; index += 1) {
  rowsByTable.attendance_events.push(...makeAttendanceRows(people[index], location, today));
}

const contractRows = people.map((person) => {
  const start = new Date(`${person.joinDate}T00:00:00Z`);
  const expiring = person.number % 13 === 0;
  const expired = person.number === 49;
  const endDate = expired ? dateKey(addDays(today, -30)) : expiring ? dateKey(addDays(today, 25)) : dateKey(addDays(today, 365));
  return {
    id: fixedId("93500000", person.number),
    employee_id: person.employeeId,
    contract_number: `TEST-HD-${String(person.number).padStart(4, "0")}`,
    contract_type: person.number % 3 === 0 ? "Hợp đồng xác định thời hạn" : "Hợp đồng lao động",
    start_date: dateKey(start),
    end_date: endDate,
    status: expired ? "expired" : "active",
    note: `[TEST DATA] Hợp đồng ${person.username}`,
    created_by: projectActor,
    signed_date: dateKey(addDays(start, -2)),
    effective_date: dateKey(start)
  };
});

const leaveRows = [];
const leaveApprovalRows = [];
for (let index = 0; index < 25; index += 1) {
  const person = people[index * 2];
  const leaveType = leaveTypes[index % leaveTypes.length];
  const scenario = index % 4;
  const status = ["approved", "pending_approval", "rejected", "draft"][scenario];
  const offset = status === "pending_approval" || status === "draft" ? 3 + index : -(5 + index * 2);
  const start = addDays(today, offset);
  const end = addDays(start, index % 7 === 0 ? 1 : 0);
  const id = fixedId("94500000", index + 1);
  const submittedAt = ["approved", "pending_approval", "rejected"].includes(status) ? isoTime(addDays(start, -4), 10, 15) : null;
  const actedAt = status === "approved" || status === "rejected" ? isoTime(addDays(start, -2), 14, 20) : null;
  const request = {
    id,
    request_number: `TEST-LV-U-${String(index + 1).padStart(4, "0")}`,
    employee_id: person.employeeId,
    leave_type_id: leaveType.id,
    start_date: dateKey(start),
    end_date: dateKey(end),
    calculated_days: dateKey(start) === dateKey(end) ? 1 : 2,
    reason: ["Khám sức khỏe định kỳ", "Việc gia đình", "Nghỉ bù theo lịch trực", "Tái khám theo lịch hẹn"][index % 4],
    status,
    submitted_at: submittedAt,
    approved_at: status === "approved" ? actedAt : null,
    rejected_at: status === "rejected" ? actedAt : null,
    workflow_snapshot: { version: 1, approver: leaveApprover.name, testData: true },
    employee_snapshot: { code: `TEST-USER-${String(person.number).padStart(3, "0")}`, name: person.name },
    request_snapshot: { leaveType: leaveType.name, calculatedDays: dateKey(start) === dateKey(end) ? 1 : 2, testData: true },
    approved_snapshot: status === "approved" ? { approver: leaveApprover.name, approvedAt: actedAt, testData: true } : null,
    created_by: person.accountId
  };
  leaveRows.push(request);
  if (status !== "draft") {
    leaveApprovalRows.push({
      id: fixedId("94600000", index + 1),
      request_id: id,
      step_order: 1,
      approver_source: "specific_user",
      resolved_approver_account_id: leaveApprover.accountId,
      resolved_approver_name: leaveApprover.name,
      status: status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending",
      acted_at: actedAt,
      comment: status === "rejected" ? "Vui lòng chọn lại ngày phù hợp với lịch trực." : status === "approved" ? "Đã đối chiếu lịch công." : null,
      snapshot: { testData: true, requestNumber: request.request_number }
    });
  }
}

const fieldWorkers = people.filter((person) => person.employmentTypeCode === "worker");
const projectPeople = [
  ...people.filter((person) => person.extraRole === "supervisor").slice(0, 2).map((person) => ({ person, assignmentRole: "supervisor_main" })),
  ...fieldWorkers.slice(0, 8).map((person) => ({ person, assignmentRole: "worker" }))
];
const projectAssignments = projectPeople.map(({ person, assignmentRole }, index) => ({
  id: fixedId("95500000", index + 1),
  project_id: project.id,
  worksite_id: worksite.id,
  employee_id: person.employeeId,
  assignment_role: assignmentRole,
  start_date: dateKey(addDays(today, -30)),
  end_date: dateKey(addDays(today, 90)),
  shift_code: "DAY",
  shift_name: "Ca ngày",
  status: "active",
  assigned_by: projectActor,
  note: `[TEST DATA] Phân công ${person.username}`
}));

const summaries = [];
const salaryHistory = [];
const payrollLines = [];
const payslips = [];
for (const person of people) {
  const scheduledDays = 22;
  const workDays = 18 + (person.number % 5);
  const baseSalary = 10_500_000 + (person.number % 8) * 1_150_000 + (person.extraRole === "supervisor" ? 4_000_000 : 0);
  const allowance = 350_000 + (person.number % 5) * 125_000;
  const bonus = person.number % 4 === 0 ? 650_000 : person.number % 3 === 0 ? 300_000 : 0;
  const deduction = person.number % 9 === 0 ? 250_000 : person.number % 7 === 0 ? 120_000 : 0;
  const summaryId = fixedId("96500000", person.number);
  const salaryId = fixedId("97600000", person.number);
  const lineId = fixedId("97700000", person.number);
  const payslipId = fixedId("97800000", person.number);
  const snapshot = { code: `TEST-USER-${String(person.number).padStart(3, "0")}`, name: person.name };
  summaries.push({
    id: summaryId,
    period_id: payrollPeriod.timesheet_period_id,
    employee_id: person.employeeId,
    employee_snapshot: snapshot,
    scheduled_workdays: scheduledDays,
    actual_workdays: workDays,
    worked_minutes: workDays * 480,
    late_days: person.number % 6 === 0 ? 2 : 0,
    late_minutes: person.number % 6 === 0 ? 18 : 0,
    annual_leave_days: person.number % 10 === 0 ? 1 : 0,
    missing_check_out_days: person.number % 8 === 0 ? 1 : 0
  });
  salaryHistory.push({
    id: salaryId,
    employee_id: person.employeeId,
    base_salary: baseSalary,
    allowance,
    bonus,
    deduction,
    effective_date: payrollPeriod.period_month,
    note: `[TEST DATA] Mức lương ${person.username}`,
    reason: "Tạo hồ sơ lương mẫu để kiểm thử bảng lương",
    changed_by: payrollPeriod.created_by
  });
  payrollLines.push({
    id: lineId,
    payroll_period_id: payrollPeriod.id,
    employee_id: person.employeeId,
    work_days: workDays,
    base_salary: baseSalary,
    allowance,
    bonus,
    deduction,
    calculation_snapshot: { testData: true, source: "test-users-50", scheduledDays, workDays }
  });
  const publishedAt = `${String(payrollPeriod.period_month).slice(0, 10)}T12:00:00+07:00`;
  payslips.push({
    id: payslipId,
    payroll_line_id: lineId,
    employee_id: person.employeeId,
    version: 1,
    status: "published",
    snapshot: {
      periodMonth: payrollPeriod.period_month,
      employee: snapshot,
      work_days: workDays,
      base_salary: baseSalary,
      allowance,
      bonus,
      deduction,
      net_salary: baseSalary + allowance + bonus - deduction,
      testData: true
    },
    published_at: publishedAt,
    published_by: payrollPeriod.created_by
  });
}

if (dryRun) {
  process.stdout.write(`host=${targetHost} mode=dry-run\n`);
  process.stdout.write(`accounts=${count} auth_existing=${authByEmail.size} attendance_events=${rowsByTable.attendance_events.length} contracts=${contractRows.length} leave_requests=${leaveRows.length} project_assignments=${projectAssignments.length} payroll_lines=${payrollLines.length} payslips=${payslips.length}\n`);
  process.stdout.write(`test_payroll_period=${payrollPeriodToCreate ? "create" : "reuse"} month=${String(payrollPeriod.period_month).slice(0, 7)}\n`);
  process.stdout.write("login=test.user01..test.user50\n");
  process.exit(0);
}

process.stdout.write(`host=${targetHost} mode=seed\n`);
await upsertRows("employees", employeeRows, "hồ sơ nhân viên");
await upsertRows("app_accounts", accountRows, "tài khoản ứng dụng");

for (const person of people) {
  let authUser = authByEmail.get(person.email);
  if (authUser) {
    const { error } = await client.auth.admin.updateUserById(authUser.id, {
      password: testPassword,
      email_confirm: true,
      user_metadata: { display_name: person.name, username: person.username, testData: true }
    });
    if (error) throw new Error(`Cập nhật tài khoản Auth ${person.username}: ${error.message}`);
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email: person.email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { display_name: person.name, username: person.username, testData: true }
    });
    if (error || !data.user) throw error ?? new Error(`Không tạo được Auth user ${person.username}.`);
    authUser = data.user;
    authByEmail.set(person.email, authUser);
  }
  if (!authUser) throw new Error(`Chưa tạo được Auth user ${person.username}.`);
  await write(client.from("app_accounts").update({ auth_user_id: authUser.id }).eq("id", person.accountId), `Liên kết Auth cho ${person.username}`);
}

const accountRoleRows = [];
for (const person of people) {
  accountRoleRows.push({ account_id: person.accountId, role_id: employeeRoleId });
  if (person.extraRole) accountRoleRows.push({ account_id: person.accountId, role_id: roleByCode.get(person.extraRole) });
}
for (let offset = 0; offset < accountRoleRows.length; offset += 500) {
  await write(client.from("account_roles").upsert(accountRoleRows.slice(offset, offset + 500), { onConflict: "account_id,role_id" }), "Gán vai trò tài khoản mẫu");
}

if (timesheetPeriodToCreate) await upsertRows("timesheet_periods", [timesheetPeriodToCreate], "kỳ công TEST");
if (payrollPeriodToCreate) await upsertRows("payroll_periods", [payrollPeriodToCreate], "kỳ lương TEST");
await upsertRows("attendance_events", rowsByTable.attendance_events, "chấm công");
await upsertRows("employee_contracts", contractRows, "hợp đồng");
await upsertRows("leave_requests", leaveRows, "đơn nghỉ");
await upsertRows("leave_request_approval_steps", leaveApprovalRows, "bước duyệt nghỉ");
await upsertRows("project_assignments", projectAssignments, "phân công dự án");
await upsertRows("timesheet_period_summaries", summaries, "tổng hợp công");
await upsertRows("employee_salary_history", salaryHistory, "lịch sử lương");
await upsertRows("payroll_lines", payrollLines, "dòng lương");
await upsertRows("payslips", payslips, "phiếu lương");

process.stdout.write(`Đã seed ${count} nhân viên và tài khoản đăng nhập mẫu.\n`);
process.stdout.write("Đăng nhập: test.user01 đến test.user50. Mật khẩu lấy từ biến môi trường bí mật.\n");
process.stdout.write(`attendance_events=${rowsByTable.attendance_events.length}; contracts=${contractRows.length}; leave_requests=${leaveRows.length}; payroll_lines=${payrollLines.length}; payslips=${payslips.length}; project_assignments=${projectAssignments.length}\n`);

function makeAttendanceRows(person, locationRow, currentDate) {
  const dates = [];
  for (let offset = 0; offset < 35 && dates.length < 20; offset += 1) {
    const date = addDays(currentDate, -offset);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) dates.push(date);
  }
  const rows = [];
  for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
    const date = dates[dayIndex];
    const outside = (person.number + dayIndex) % 37 === 0;
    const checkInHour = person.number % 7 === 0 ? 8 : 7;
    const checkInMinute = person.number % 7 === 0 ? 5 + (dayIndex % 25) : 42 + (person.number % 18);
    const checkInAt = isoTime(date, checkInHour, checkInMinute);
    const idNumber = (person.number - 1) * 40 + dayIndex * 2 + 1;
    rows.push({
      id: fixedId("92500000", idNumber),
      client_event_id: fixedId("92600000", idNumber),
      employee_id: person.employeeId,
      account_id: person.accountId,
      event_type: "check_in",
      attendance_date: dateKey(date),
      effective_at: checkInAt,
      captured_at_client: checkInAt,
      location_id: locationRow.id,
      latitude: locationRow.latitude,
      longitude: locationRow.longitude,
      accuracy_meters: 7 + (person.number % 16),
      distance_meters: outside ? 165 : 4 + (person.number % 24),
      geofence_status: outside ? "outside" : "valid",
      attendance_status: outside ? "needs_review" : "recorded",
      photo_status: outside ? "pending_upload" : "uploaded",
      sync_status: outside ? "sync_failed" : "synced",
      captured_offline: outside,
      device_metadata: { testData: true, seedBatch: "test-users-50", device: `demo-device-${person.number % 8 + 1}` }
    });

    const missingCheckout = dayIndex === 0 ? person.number % 8 === 0 : person.number % 19 === 0 && dayIndex === 4;
    if (!missingCheckout) {
      const checkOutAt = isoTime(date, 16 + (person.number % 2), 50 + (dayIndex % 10));
      const checkoutIdNumber = idNumber + 1;
      rows.push({
        id: fixedId("92500000", checkoutIdNumber),
        client_event_id: fixedId("92600000", checkoutIdNumber),
        employee_id: person.employeeId,
        account_id: person.accountId,
        event_type: "check_out",
        attendance_date: dateKey(date),
        effective_at: checkOutAt,
        captured_at_client: checkOutAt,
        location_id: locationRow.id,
        latitude: locationRow.latitude,
        longitude: locationRow.longitude,
        accuracy_meters: 8 + (person.number % 15),
        distance_meters: 5 + (dayIndex % 21),
        geofence_status: "valid",
        attendance_status: "recorded",
        photo_status: "not_required",
        sync_status: "synced",
        captured_offline: false,
        device_metadata: { testData: true, seedBatch: "test-users-50", device: `demo-device-${person.number % 8 + 1}` }
      });
    }
  }
  return rows;
}

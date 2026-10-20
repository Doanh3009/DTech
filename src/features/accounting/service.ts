import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser, type Permission } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { flushPayslipDeliveries } from "./payslipDelivery";
import { recordAuditLog } from "@/services/audit/auditLog";
import { readSettingsGroup } from "@/services/system-settings/systemSettingsService";
import type { payrollActionSchema, payrollCreateSchema, payslipRevokeSchema, salaryDeleteSchema, salaryInputSchema } from "./schemas";
import type { PayrollReadiness } from "./payrollRules";
import type { PayrollDetail, PayrollLine, PayrollPeriod, Payslip, SalaryRecord } from "./types";
import { cashoutAmounts } from "./cashoutPresentation";
import { summarizeAccounting } from "./accountingSummaryRules";
import { getBusinessDateKey } from "@/lib/time/timezone";

type Row = Record<string, unknown>;
type AccountingPageQuery = { range(from: number, to: number): PromiseLike<{ data: Row[] | null; error: unknown }> };
const ACCOUNTING_PAGE_SIZE = 500;
const ACCOUNTING_MAX_ROWS = 100_000;
async function readAccountingRows(query: () => AccountingPageQuery, message: string, rowLimit = ACCOUNTING_MAX_ROWS): Promise<Row[]> {
  const rows: Row[] = [];
  while (rows.length < rowLimit) {
    const pageSize = Math.min(ACCOUNTING_PAGE_SIZE, rowLimit - rows.length);
    const { data, error } = await query().range(rows.length, rows.length + pageSize - 1);
    if (error || !data) throw new AppError("SERVER_ERROR", message);
    rows.push(...data);
    if (data.length < pageSize || rowLimit < ACCOUNTING_MAX_ROWS && rows.length === rowLimit) return rows;
  }
  // Refuse an incomplete total instead of silently accepting a server row cap.
  throw new AppError("SERVER_ERROR", message);
}
function db(): SupabaseClient { const client = getSupabaseServiceClient(); if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình."); return client; }
function requireAny(user: AuthenticatedUser, permissions: Permission[]) { if (!permissions.some((permission) => can(user.permissions, permission))) throw new AppError("PERMISSION_DENIED"); }
async function identity(client: SupabaseClient, user: AuthenticatedUser) { let query = client.from("app_accounts").select("id,employee_id").limit(1); query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email); const { data, error } = await query.maybeSingle(); if (error) throw new AppError("SERVER_ERROR", "Không thể xác định tài khoản vận hành."); if (!data?.id) throw new AppError("PERMISSION_DENIED", "Không tìm thấy tài khoản vận hành."); return { accountId: String(data.id), employeeId: data.employee_id ? String(data.employee_id) : undefined }; }
function employee(row: Row) { const value = row.employees; return (Array.isArray(value) ? value[0] : value) as Row | undefined; }
function salary(row: Row): SalaryRecord { const person = employee(row), actorValue = row.changed_by_account, actor = (Array.isArray(actorValue) ? actorValue[0] : actorValue) as Row | undefined; return { id: String(row.id), employeeId: String(row.employee_id), employeeCode: String(person?.employee_code ?? "—"), employeeName: String(person?.full_name ?? "—"), baseSalary: Number(row.base_salary), allowance: Number(row.allowance), bonus: Number(row.bonus), deduction: Number(row.deduction), effectiveDate: String(row.effective_date), note: row.note ? String(row.note) : undefined, reason: String(row.reason), changedAt: String(row.changed_at), changedByName: actor?.display_name ? String(actor.display_name) : undefined }; }
function line(row: Row): PayrollLine { const person = employee(row); return { id: String(row.id), employeeId: String(row.employee_id), employeeCode: String(person?.employee_code ?? "—"), employeeName: String(person?.full_name ?? "—"), workDays: Number(row.work_days), baseSalary: Number(row.base_salary), allowance: Number(row.allowance), ...cashoutAmounts(row), deduction: Number(row.deduction), netSalary: Number(row.net_salary), rowVersion: Number(row.row_version), calculation: (row.calculation_snapshot ?? {}) as Row }; }

export async function listSalaries(user: AuthenticatedUser) { requireAny(user, ["salary.view", "salary.history.view"]); const client = db(); const data = await readAccountingRows(() => client.from("employee_salary_history").select("*,employees(employee_code,full_name),changed_by_account:app_accounts!employee_salary_history_changed_by_fkey(display_name)").order("effective_date", { ascending: false }).order("changed_at", { ascending: false }).order("id", { ascending: false }), "Không thể đọc dữ liệu lương."); const records=data.map(salary); if(can(user.permissions,"salary.history.view"))return records;const seen=new Set<string>();return records.filter((item)=>{if(seen.has(item.employeeId))return false;seen.add(item.employeeId);return true;}); }
export async function listEmployeeSalaries(user: AuthenticatedUser, employeeId: string) { requireAny(user, ["salary.view", "salary.history.view"]); const client = db(); const data = await readAccountingRows(() => client.from("employee_salary_history").select("*,employees(employee_code,full_name),changed_by_account:app_accounts!employee_salary_history_changed_by_fkey(display_name)").eq("employee_id", employeeId).order("effective_date", { ascending: false }).order("changed_at", { ascending: false }).order("id", { ascending: false }), "Không thể đọc lịch sử lương nhân viên.", can(user.permissions, "salary.history.view") ? undefined : 1); return data.map(salary); }
export async function listSalaryEmployees(user: AuthenticatedUser) { requireAny(user, ["salary.view", "salary.edit"]); const client = db(); const data = await readAccountingRows(() => client.from("employees").select("id,employee_code,full_name").in("employment_status", ["active", "probation", "pending_onboarding"]).order("employee_code").order("id"), "Không thể đọc danh sách nhân viên."); return data.map((row) => ({ id: String(row.id), code: String(row.employee_code), name: String(row.full_name) })); }
export async function saveSalary(user: AuthenticatedUser, input: z.infer<typeof salaryInputSchema>) { if (!can(user.permissions, "salary.edit")) throw new AppError("PERMISSION_DENIED"); const client = db(), actor = await identity(client, user); const { data: before } = await client.from("employee_salary_history").select("*").eq("employee_id", input.employeeId).order("effective_date", { ascending: false }).limit(1).maybeSingle(); const { data, error } = await client.from("employee_salary_history").insert({ employee_id: input.employeeId, base_salary: input.baseSalary, allowance: input.allowance, bonus: input.bonus, deduction: input.deduction, effective_date: input.effectiveDate, note: input.note ?? null, reason: input.reason, changed_by: actor.accountId }).select("*,employees(employee_code,full_name)").single(); if (error || !data) throw new AppError("SERVER_ERROR", "Không thể ghi nhận mức lương."); await recordAuditLog({ actorId: actor.accountId, action: "salary.changed", entityType: "employee", entityId: input.employeeId, before: before ?? undefined, after: input, reason: input.reason }); return salary(data as Row); }
export async function deleteSalary(user: AuthenticatedUser, id: string, input: z.infer<typeof salaryDeleteSchema>) {
  if (!can(user.permissions, "salary.edit")) throw new AppError("PERMISSION_DENIED");
  const client = db(), actor = await identity(client, user);
  const { data: before, error: readError } = await client.from("employee_salary_history").select("*").eq("id", id).maybeSingle();
  if (readError) throw new AppError("SERVER_ERROR", "Không thể đọc hồ sơ lương.");
  if (!before) throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ lương.");
  const { count, error: usageError } = await client.from("payroll_lines").select("id", { count: "exact", head: true }).contains("calculation_snapshot", { salaryHistoryId: id });
  if (usageError) throw new AppError("SERVER_ERROR", "Không thể kiểm tra bảng lương đã sử dụng hồ sơ này.");
  if (count) throw new AppError("CONFLICT", "Mức lương đã được dùng trong bảng lương và không thể xóa.");
  const { data, error } = await client.from("employee_salary_history").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể xóa hồ sơ lương.");
  if (!data) throw new AppError("CONFLICT", "Hồ sơ lương vừa được cập nhật.");
  await recordAuditLog({ actorId: actor.accountId, action: "salary.deleted", entityType: "employee_salary_history", entityId: id, before: before as Row, reason: input.reason });
  return { id };
}

async function periodRows(client: SupabaseClient): Promise<PayrollPeriod[]> {
  const [periods, lines, pendingDeliveries, handoffs] = await Promise.all([
    readAccountingRows(() => client.from("payroll_periods").select("*").order("period_month", { ascending: false }).order("id", { ascending: false }), "Không thể đọc kỳ lương."),
    readAccountingRows(() => client.from("payroll_lines").select("payroll_period_id,base_salary,allowance,bonus,deduction,net_salary").eq("is_included", true).order("id"), "Không thể đọc kỳ lương."),
    readAccountingRows(() => client.from("payslip_deliveries").select("payroll_period_id,payslip_id,payslips!inner(status)").in("status", ["pending", "processing", "failed"]).eq("payslips.status", "published").order("id"), "Không thể đọc trạng thái gửi phiếu lương."),
    readAccountingRows(() => client.from("payroll_timesheet_handoffs").select("timesheet_period_id,payroll_period_id,last_error").eq("status", "attention").order("timesheet_period_id"), "Không thể đọc tình trạng cập nhật lương.")
  ]);
  const pendingByPeriod = new Map<string, Set<string>>();
  for (const receipt of pendingDeliveries) {
    const key = String(receipt.payroll_period_id), slips = pendingByPeriod.get(key) ?? new Set<string>();
    slips.add(String(receipt.payslip_id)); pendingByPeriod.set(key, slips);
  }
  const totals = new Map<string, { count: number; gross: number; deduction: number; net: number }>();
  for (const line of lines ?? []) {
    const id = String(line.payroll_period_id);
    const value = totals.get(id) ?? { count: 0, gross: 0, deduction: 0, net: 0 };
    value.count += 1;
    value.gross += Number(line.base_salary) + Number(line.allowance) + Number(line.bonus);
    value.deduction += Number(line.deduction);
    value.net += Number(line.net_salary);
    totals.set(id, value);
  }
  return (periods ?? []).map((row) => {
    const total = totals.get(String(row.id)) ?? { count: 0, gross: 0, deduction: 0, net: 0 };
    const handoff = handoffs.find(item => item.payroll_period_id === row.id);
    return {
      id: String(row.id), periodMonth: String(row.period_month),
      timesheetPeriodId: row.timesheet_period_id ? String(row.timesheet_period_id) : undefined,
      status: row.status as PayrollPeriod["status"], rowVersion: Number(row.row_version), lineCount: total.count,
      grossTotal: total.gross, deductionTotal: total.deduction, netTotal: total.net,
      pendingDeliveryCount: pendingByPeriod.get(String(row.id))?.size ?? 0,
      syncIssue: handoff ? payrollOperationError(String(handoff.last_error)).message : undefined,
      syncTimesheetPeriodId: handoff ? String(handoff.timesheet_period_id) : undefined,
      note: row.note ? String(row.note) : undefined, updatedAt: String(row.updated_at)
    };
  });
}
export async function listPayroll(user: AuthenticatedUser) { requireAny(user, ["payroll.view", "payroll.create"]); return periodRows(db()); }
export async function listPayrollReferences(user: AuthenticatedUser) { requireAny(user, ["payroll.view", "payroll.create"]); const { data, error } = await db().from("timesheet_periods").select("id,code,name,start_date,end_date,status").eq("status", "locked").order("start_date", { ascending: false }).limit(36); if (error) throw new AppError("SERVER_ERROR", "Không thể đọc kỳ công đã khóa."); return (data ?? []).map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), startDate: String(row.start_date), endDate: String(row.end_date) })); }
export async function createPayroll(user: AuthenticatedUser, input: z.infer<typeof payrollCreateSchema>) {
  if (!can(user.permissions, "payroll.create")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const { data: timesheet, error: timesheetError } = await client.from("timesheet_periods").select("id,status,start_date").eq("id", input.timesheetPeriodId).maybeSingle();
  if (timesheetError) throw new AppError("SERVER_ERROR", "Không thể đọc bảng công.");
  if (!timesheet || timesheet.status !== "locked") throw new AppError("VALIDATION_ERROR", "Bảng công phải được chốt trước khi lập bảng lương.");

  const month = `${String(timesheet.start_date).slice(0, 7)}-01`;
  const [{ data: existingForTimesheet, error: existingTimesheetError }, { data: existingForMonth, error: existingMonthError }] = await Promise.all([
    client.from("payroll_periods").select("id").eq("timesheet_period_id", input.timesheetPeriodId).maybeSingle(),
    client.from("payroll_periods").select("id,timesheet_period_id").eq("period_month", month).maybeSingle()
  ]);
  if (existingTimesheetError || existingMonthError) throw new AppError("SERVER_ERROR", "Không thể kiểm tra bảng lương.");
  if (existingForTimesheet?.id) return getPayroll(user, String(existingForTimesheet.id));
  if (existingForMonth?.id) throw new AppError("CONFLICT", "Tháng này đã có bảng lương liên kết với một bảng công khác.");

  const { data, error } = await client.from("payroll_periods").insert({ period_month: month, timesheet_period_id: input.timesheetPeriodId, note: input.note ?? null, created_by: actor.accountId }).select("id").single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể tạo bảng lương.");
  await recordAuditLog({ actorId: actor.accountId, action: "payroll.created", entityType: "payroll_period", entityId: String(data.id), after: input });
  return getPayroll(user, String(data.id));
}
export async function getPayroll(user: AuthenticatedUser, id: string): Promise<PayrollDetail> {
  requireAny(user, ["payroll.view", "payroll.create"]);
  const client = db();
  const [{ data: period, error: periodError }, rows] = await Promise.all([
    client.from("payroll_periods").select("*").eq("id", id).maybeSingle(),
    readAccountingRows(() => client.from("payroll_lines").select("*,employees(employee_code,full_name)").eq("payroll_period_id", id).eq("is_included", true).order("employee_id").order("id"), "Không thể đọc bảng lương.")
  ]);
  if (periodError) throw new AppError("SERVER_ERROR", "Không thể đọc bảng lương.");
  if (!period) throw new AppError("NOT_FOUND", "Không tìm thấy kỳ lương.");
  const lines = (rows ?? []).map((row) => line(row as Row));
  if (lines.length) {
    const slipRows = await readAccountingRows(() => client.from("payslips").select("id,payroll_line_id,status,version,published_at,viewed_at,confirmed_at,payroll_lines!inner(payroll_period_id)").eq("payroll_lines.payroll_period_id", id).order("version", { ascending: false }).order("id", { ascending: false }), "Không thể đọc tình trạng gửi phiếu lương.");
    const latestSlips = new Map<string, Row>();
    for (const row of slipRows ?? []) if (!latestSlips.has(String(row.payroll_line_id))) latestSlips.set(String(row.payroll_line_id), row as Row);
    for (const item of lines) {
      const slip = latestSlips.get(item.id);
      if (slip) { item.payslipStatus = slip.status as PayrollLine["payslipStatus"]; item.payslipVersion = Number(slip.version); item.payslipId = String(slip.id); item.payslipViewedAt = slip.viewed_at ? String(slip.viewed_at) : undefined; item.payslipConfirmedAt = slip.confirmed_at ? String(slip.confirmed_at) : undefined; }
    }
    if (can(user.permissions, "payslip.publish")) {
      const recipients = await readAccountingRows(() => client.from("app_accounts").select("id,employee_id,username,display_name").eq("status", "active").order("id"), "Không thể xác định người nhận phiếu lương.");
      const byEmployee = new Map(recipients.filter(item => item.employee_id).map(item => [String(item.employee_id), item]));
      for (const item of lines) {
        const account = byEmployee.get(item.employeeId);
        item.deliveryReady = Boolean(account);
        if (account) item.deliveryAccount = { id: String(account.id), username: String(account.username ?? ""), displayName: String(account.display_name ?? item.employeeName) };
      }
    }
  }
  if (lines.length) {
    const receipts = await readAccountingRows(() => client.from("payslip_deliveries").select("payslip_id,status,attempts,last_error").eq("payroll_period_id", id).order("id"), "Không thể đọc biên nhận gửi phiếu lương.");
    const bySlip = new Map<string, Row[]>();
    for (const receipt of receipts) {
      if (receipt.status === "cancelled") continue;
      const key = String(receipt.payslip_id), current = bySlip.get(key) ?? [];
      current.push(receipt); bySlip.set(key, current);
    }
    for (const item of lines) {
      const current = bySlip.get(item.payslipId ?? "");
      if (!current?.length) continue;
      item.deliveryStatus = current.some(receipt => receipt.status === "failed") ? "failed" : current.every(receipt => receipt.status === "delivered") ? "delivered" : "pending";
      item.deliveryAttempts = Math.max(...current.map(receipt => Number(receipt.attempts)));
      item.deliveryError = current.find(receipt => receipt.status === "failed")?.last_error ? "Chưa gửi đủ thông báo và tin nhắn" : undefined;
    }
  }
  const { data: readiness, error: readinessError } = await client.rpc("inspect_payroll_inputs", { p_period_id: id });
  if (readinessError) throw new AppError("SERVER_ERROR", "Không thể đối chiếu dữ liệu công và lương. Kiểm tra migration nghiệp vụ.");
  const { data: handoff, error: handoffError } = await client.from("payroll_timesheet_handoffs").select("timesheet_period_id,last_error").eq("payroll_period_id", id).eq("status", "attention").limit(1).maybeSingle();
  if (handoffError) throw new AppError("SERVER_ERROR", "Không thể đọc tình trạng cập nhật lương.");
  return {
    id: String(period.id), periodMonth: String(period.period_month),
    timesheetPeriodId: period.timesheet_period_id ? String(period.timesheet_period_id) : undefined,
    status: period.status, rowVersion: Number(period.row_version), lineCount: lines.length,
    grossTotal: lines.reduce((sum, item) => sum + item.baseSalary + item.allowance + item.bonus + (item.leaveCashoutAmount ?? 0), 0),
    deductionTotal: lines.reduce((sum, item) => sum + item.deduction, 0),
    netTotal: lines.reduce((sum, item) => sum + item.netSalary, 0),
    note: period.note ?? undefined, updatedAt: String(period.updated_at), lines, readiness: readiness as PayrollReadiness,
    syncIssue: handoff ? payrollOperationError(String(handoff.last_error)).message : undefined,
    syncTimesheetPeriodId: handoff ? String(handoff.timesheet_period_id) : undefined
  };
}

function payrollOperationError(message: string): AppError {
  const errors: Record<string, string> = {
    VERSION_CONFLICT: "Bảng lương vừa được cập nhật. Hãy tải lại trước khi thao tác.",
    TIMESHEET_NOT_LOCKED: "Kỳ công chưa chốt. Chốt công trước khi tính hoặc kiểm tra lương.",
    PAYROLL_STALE_TIMESHEET: "Phiên bản kỳ công đã thay đổi. Cần tính lại bảng lương.",
    PAYROLL_STALE_SALARY: "Hồ sơ lương hiệu lực đã thay đổi. Cần tính lại bảng lương.",
    PAYROLL_MISSING_SALARY: "Còn nhân viên chưa có hồ sơ lương hiệu lực.",
    TIMESHEET_MISSING_DAILY: "Kỳ công thiếu bản ghi từng ngày. Cần đối chiếu và tổng hợp lại.",
    TIMESHEET_SUMMARY_MISMATCH: "Tổng công chưa khớp dữ liệu từng ngày. Cần tổng hợp lại kỳ công.",
    PAYROLL_MISSING_SCHEDULE: "Còn nhân viên chưa có ngày công chuẩn.",
    PAYROLL_EXCESS_WORKDAYS: "Công thực tế vượt công chuẩn. Cần rà soát trước khi tính lương.",
    TIMESHEET_HIGH_EXCEPTIONS: "Còn ngoại lệ nghiêm trọng chưa được xử lý.",
    PAYROLL_ROSTER_MISMATCH: "Danh sách lương chưa khớp bảng công. Cần tính lại.",
    PAYROLL_NEGATIVE_NET: "Có dòng thực nhận âm. Rà soát khấu trừ trước khi kiểm tra và khóa lương.",
    PAYROLL_LOCKED: "Bảng lương đã khóa. Mở lại để điều chỉnh.",
    PAYROLL_INVALID_TRANSITION: "Trạng thái bảng lương đã thay đổi. Hãy tải lại.",
    PAYROLL_NOT_EDITABLE: "Chỉ bảng lương đã tính và chưa khóa mới được điều chỉnh.",
    PAYROLL_PUBLISHED: "Phiếu lương đã gửi. Mở lại bảng lương trước khi điều chỉnh.",
    PAYROLL_MONTH_CONFLICT: "Tháng này có nhiều kỳ công. Cần hợp nhất trước khi cập nhật lương.",
    PAYROLL_EMPTY_INPUT: "Kỳ công chưa có dữ liệu tổng hợp.",
    PAYSLIP_ALREADY_PUBLISHED: "Phiếu lương của nhân viên này đã được gửi.",
    PAYSLIP_RECIPIENT_REQUIRED: "Nhân viên chưa có tài khoản hoạt động để nhận phiếu lương.",
    PAYROLL_NOT_LOCKED: "Duyệt lương trước khi duyệt phiếu lương.",
    PAYROLL_LINE_NOT_FOUND: "Không tìm thấy dòng lương của nhân viên này."
    ,CASHOUT_NOT_READY: "Còn phép dư cuối năm chưa quyết toán. Nhập đơn giá, xử lý đơn nghỉ chờ duyệt và tính lại lương."
    ,CASHOUT_EMPLOYEE_REMOVAL: "Nhân viên đã có khoản thanh toán phép dư. Không thể loại khỏi bảng lương."
  };
  const key = Object.keys(errors).find(code => message.includes(code));
  return new AppError(key ? "CONFLICT" : "SERVER_ERROR", key ? errors[key] : "Không thể cập nhật bảng lương.");
}

export async function actOnPayroll(user: AuthenticatedUser, id: string, input: z.infer<typeof payrollActionSchema>) {
  const client = db(), actor = await identity(client, user), period = await getPayroll(user, id);
  if (period.rowVersion !== input.rowVersion) throw new AppError("CONFLICT", "Kỳ lương vừa được cập nhật.");
  let publishedVersion: number | undefined;
  if (input.action === "calculate") {
    if (!can(user.permissions, "payroll.create")) throw new AppError("PERMISSION_DENIED");
    const { error } = await client.rpc("operate_payroll_period", { p_period_id: id, p_row_version: period.rowVersion, p_actor_id: actor.accountId, p_action: input.action, p_values: { payBasis: input.payBasis } });
    if (error) throw payrollOperationError(error.message);
  } else if (input.action === "approve_salary") {
    if (!can(user.permissions, "payroll.lock")) throw new AppError("PERMISSION_DENIED");
    const { error } = await client.rpc("approve_payroll_salary", { p_period_id: id, p_row_version: period.rowVersion, p_actor_id: actor.accountId });
    if (error) throw payrollOperationError(error.message);
  } else if (input.action === "update_line" || input.action === "review" || input.action === "lock") {
    if (!can(user.permissions, input.action === "lock" ? "payroll.lock" : "payroll.edit")) throw new AppError("PERMISSION_DENIED");
    const before = input.action === "update_line" ? period.lines.find(item => item.id === input.lineId) : undefined;
    const { error } = input.action === "update_line"
      ? await client.rpc("amend_payroll_salary", { p_period_id: id, p_row_version: period.rowVersion, p_actor_id: actor.accountId, p_values: input })
      : await client.rpc("operate_payroll_period", { p_period_id: id, p_row_version: period.rowVersion, p_actor_id: actor.accountId, p_action: input.action, p_values: input });
    if (error) throw payrollOperationError(error.message);
    if (input.action === "update_line") await recordAuditLog({ actorId: actor.accountId, action: "payroll.line_updated", entityType: "payroll_line", entityId: input.lineId, before: before ? { ...before } : undefined, after: input, reason: input.reason });
  } else if (input.action === "publish_employee") {
    if (!can(user.permissions, "payslip.publish")) throw new AppError("PERMISSION_DENIED");
    if (period.status !== "locked") throw new AppError("CONFLICT", "Duyệt lương trước khi duyệt phiếu lương.");
    const payrollLine = period.lines.find((item) => item.employeeId === input.employeeId);
    if (!payrollLine) throw new AppError("NOT_FOUND", "Không tìm thấy dòng lương của nhân viên này.");
    if (payrollLine.payslipStatus === "published") throw new AppError("CONFLICT", "Phiếu lương của nhân viên này đã được gửi.");
    const { data: accounts, error: accountError } = await client.from("app_accounts").select("id,employee_id").eq("employee_id", input.employeeId).eq("status", "active");
    if (accountError) throw new AppError("SERVER_ERROR", "Không thể xác định tài khoản nhận phiếu lương.");
    if (!accounts?.length) throw new AppError("VALIDATION_ERROR", "Nhân viên chưa có tài khoản hoạt động để nhận phiếu lương.");
    const { data: version, error } = await client.rpc("publish_employee_payslip", { p_period_id: id, p_employee_id: input.employeeId, p_row_version: period.rowVersion, p_actor_id: actor.accountId });
    if (error) throw payrollOperationError(error.message);
    publishedVersion = Number(version);
    await flushPayslipDeliveries(client, id, input.employeeId);
  } else if (input.action === "retry_delivery") {
    if (!can(user.permissions, "payslip.publish")) throw new AppError("PERMISSION_DENIED");
    if (!["locked", "published"].includes(period.status)) throw new AppError("CONFLICT", "Bảng lương chưa được phát hành phiếu.");
    if (input.employeeId && !period.lines.some(item => item.employeeId === input.employeeId && item.payslipStatus === "published")) throw new AppError("NOT_FOUND", "Không tìm thấy phiếu đã phát hành của nhân viên này.");
    const { error } = await client.rpc("retry_payroll_deliveries", { p_period_id: id, p_actor_id: actor.accountId, p_employee_id: input.employeeId ?? null });
    if (error) throw payrollOperationError(error.message);
    await flushPayslipDeliveries(client, id, input.employeeId);
  } else if (input.action === "reopen") {
    if (!can(user.permissions, "payroll.edit")) throw new AppError("PERMISSION_DENIED");
    if (!["locked", "published"].includes(period.status)) throw new AppError("CONFLICT", "Chỉ bảng lương đã khóa hoặc phát hành mới được mở lại.");
    const { error } = await client.rpc("reopen_payroll_period", { p_period_id: id, p_row_version: period.rowVersion, p_actor_id: actor.accountId, p_reason: input.reason });
    if (error) throw new AppError(error.message.includes("VERSION_CONFLICT") ? "CONFLICT" : "SERVER_ERROR", error.message.includes("VERSION_CONFLICT") ? "Kỳ lương vừa được cập nhật." : "Không thể mở lại kỳ lương.");
  } else {
    if (!can(user.permissions, "payslip.publish")) throw new AppError("PERMISSION_DENIED");
    if (period.status !== "locked") throw new AppError("CONFLICT", "Duyệt lương trước khi duyệt phiếu lương.");
    if (!period.lines.length) throw new AppError("VALIDATION_ERROR", "Bảng lương chưa có dòng dữ liệu để phát hành.");
    const remainingEmployeeIds = period.lines.filter((item) => item.payslipStatus !== "published").map((item) => item.employeeId);
    const remaining = new Set(remainingEmployeeIds);
    const accounts = remaining.size ? (await readAccountingRows(() => client.from("app_accounts").select("id,employee_id").eq("status", "active").order("id"), "Không thể xác định người nhận phiếu lương.")).filter(item => remaining.has(String(item.employee_id))) : [];
    const recipientEmployees = new Set(accounts.map(item => String(item.employee_id)));
    const missing = period.lines.filter(item => remaining.has(item.employeeId) && !recipientEmployees.has(item.employeeId));
    if (missing.length) throw new AppError("VALIDATION_ERROR", `${missing.length} nhân viên chưa có tài khoản hoạt động để nhận phiếu lương: ${missing.slice(0, 3).map(item => item.employeeName).join(", ")}${missing.length > 3 ? "…" : ""}.`);
    const { data: version, error } = await client.rpc("publish_payroll_period", { p_period_id: id, p_row_version: period.rowVersion, p_actor_id: actor.accountId });
    if (error) throw payrollOperationError(error.message);
    publishedVersion = Number(version);
    await flushPayslipDeliveries(client, id);
  }
  await recordAuditLog({ actorId: actor.accountId, action: `payroll.${input.action}`, entityType: "payroll_period", entityId: id, before: { status: period.status, rowVersion: period.rowVersion }, after: publishedVersion ? { payslipVersion: publishedVersion } : undefined, reason: "reason" in input ? input.reason : undefined });
  const result = await getPayroll(user, id), expected = input.action === "review" ? "reviewed" : input.action === "approve_salary" && period.status === "published" ? "published" : input.action === "lock" || input.action === "approve_salary" ? "locked" : input.action === "publish" ? "published" : input.action === "calculate" || input.action === "reopen" || input.action === "update_line" ? "calculated" : undefined;
  if (expected && result.status !== expected) throw new AppError("CONFLICT", "Kỳ lương vừa được cập nhật.");
  return result;
}

function mapPayslip(row: Row): Payslip {
  const person = employee(row), lineValue = row.payroll_lines, payrollLine = (Array.isArray(lineValue) ? lineValue[0] : lineValue) as Row | undefined, periodValue = payrollLine?.payroll_periods, period = (Array.isArray(periodValue) ? periodValue[0] : periodValue) as Row | undefined;
  return { id: String(row.id), payrollLineId: String(row.payroll_line_id), employeeId: String(row.employee_id), employeeCode: String(person?.employee_code ?? "—"), employeeName: String(person?.full_name ?? "—"), periodMonth: String(period?.period_month ?? (row.snapshot as Row)?.periodMonth ?? ""), version: Number(row.version), status: row.status as Payslip["status"], snapshot: normalizePayslipSnapshot(row.snapshot as Row), publishedAt: row.published_at ? String(row.published_at) : undefined, viewedAt: row.viewed_at ? String(row.viewed_at) : undefined, confirmedAt: row.confirmed_at ? String(row.confirmed_at) : undefined, confirmedBy: row.confirmed_by ? String(row.confirmed_by) : undefined, revokedAt: row.revoked_at ? String(row.revoked_at) : undefined, revokeReason: row.revoke_reason ? String(row.revoke_reason) : undefined };
}

function normalizePayslipSnapshot(snapshot: Row): Row {
  return {
    ...snapshot,
    workDays: snapshot.workDays ?? snapshot.work_days,
    baseSalary: snapshot.baseSalary ?? snapshot.base_salary,
    allowance: snapshot.allowance,
    ...cashoutAmounts(snapshot),
    leaveCashout: ((snapshot.calculation_snapshot ?? snapshot.calculation ?? {}) as Row).leaveCashout ?? [],
    deduction: snapshot.deduction,
    netSalary: snapshot.netSalary ?? snapshot.net_salary
  };
}

export async function listPayslips(user: AuthenticatedUser, scope: "all" | "self" = "all"): Promise<Payslip[]> {
  requireAny(user, ["payroll.view", "payslip.self.view"]);
  if (scope === "self" && !can(user.permissions, "payslip.self.view")) throw new AppError("PERMISSION_DENIED");
  const client = db(), actor = await identity(client, user);
  const isSelfService = scope === "self" || !can(user.permissions, "payroll.view");
  if (isSelfService && !actor.employeeId) throw new AppError("PERMISSION_DENIED", "Tài khoản chưa liên kết nhân viên.");
  const data = await readAccountingRows(() => {
    let query = client.from("payslips").select("*,payroll_lines(payroll_period_id,payroll_periods(period_month)),employees(employee_code,full_name)").order("created_at", { ascending: false }).order("id", { ascending: false });
    if (isSelfService) query = query.eq("employee_id", actor.employeeId!).eq("status", "published");
    return query;
  }, "Không thể đọc phiếu lương.");
  return data.map(mapPayslip);
}

export async function getPayslip(user: AuthenticatedUser, id: string, scope: "all" | "self" = "all"): Promise<Payslip> {
  requireAny(user, ["payroll.view", "payslip.self.view"]);
  if (scope === "self" && !can(user.permissions, "payslip.self.view")) throw new AppError("PERMISSION_DENIED");
  const client = db(), actor = await identity(client, user), isSelfService = scope === "self" || !can(user.permissions, "payroll.view");
  let query = client.from("payslips").select("*,payroll_lines(payroll_period_id,payroll_periods(period_month)),employees(employee_code,full_name)").eq("id", id);
  if (isSelfService) {
    if (!actor.employeeId) throw new AppError("PERMISSION_DENIED", "Tài khoản chưa liên kết nhân viên.");
    query = query.eq("employee_id", actor.employeeId).eq("status", "published");
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy phiếu lương.");
  if (isSelfService && !data.viewed_at) {
    const viewedAt = new Date().toISOString();
    const { error: viewedError } = await client.from("payslips").update({ viewed_at: viewedAt }).eq("id", id).is("viewed_at", null).eq("status", "published");
    if (viewedError) throw new AppError("SERVER_ERROR", "Không thể ghi nhận thời điểm xem phiếu lương.");
    data.viewed_at = viewedAt;
  }
  return mapPayslip(data as Row);
}

export async function confirmPayslip(user: AuthenticatedUser, id: string, version: number): Promise<Payslip> {
  if (!can(user.permissions, "payslip.self.view")) throw new AppError("PERMISSION_DENIED");
  const client = db(), actor = await identity(client, user);
  if (!actor.employeeId) throw new AppError("PERMISSION_DENIED", "Tài khoản chưa liên kết nhân viên.");
  const before = await getPayslip(user, id, "self");
  const { data, error } = await client.rpc("confirm_own_payslip", { p_payslip_id: id, p_version: version, p_actor_id: actor.accountId });
  if (error) {
    if (error.message.includes("PAYSLIP_NOT_FOUND")) throw new AppError("NOT_FOUND", "Không tìm thấy phiếu lương của bạn.");
    if (error.message.includes("VERSION_CONFLICT") || error.message.includes("PAYSLIP_NOT_PUBLISHED")) throw new AppError("CONFLICT", "Phiếu lương vừa được cập nhật hoặc thu hồi. Vui lòng tải lại.");
    throw new AppError("SERVER_ERROR", "Không thể xác nhận phiếu lương.");
  }
  if (!data?.confirmed_at || !data?.confirmed_by) throw new AppError("SERVER_ERROR", "Chưa ghi nhận được xác nhận phiếu lương.");
  return { ...before, confirmedAt: String(data.confirmed_at), confirmedBy: String(data.confirmed_by), viewedAt: String(data.viewed_at) };
}

export async function revokePayslip(user: AuthenticatedUser, id: string, input: z.infer<typeof payslipRevokeSchema>) {
  if (!can(user.permissions, "payslip.revoke")) throw new AppError("PERMISSION_DENIED");
  const client = db(), actor = await identity(client, user);
  const { data: before, error: readError } = await client.from("payslips").select("*").eq("id", id).maybeSingle();
  if (readError) throw new AppError("SERVER_ERROR", "Không thể đọc phiếu lương.");
  if (!before) throw new AppError("NOT_FOUND", "Không tìm thấy phiếu lương.");
  if (before.status !== "published") throw new AppError("CONFLICT", "Chỉ phiếu lương đang phát hành mới có thể thu hồi.");
  const revokedAt = new Date().toISOString();
  const { data, error } = await client.from("payslips").update({ status: "revoked", revoked_at: revokedAt, revoked_by: actor.accountId, revoke_reason: input.reason }).eq("id", id).eq("status", "published").select("id,status,revoked_at,revoke_reason").maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể thu hồi phiếu lương.");
  if (!data) throw new AppError("CONFLICT", "Phiếu lương vừa được cập nhật.");
  await recordAuditLog({ actorId: actor.accountId, action: "payslip.revoked", entityType: "payslip", entityId: id, before, after: data, reason: input.reason });
  return { id: String(data.id), status: data.status, revokedAt: String(data.revoked_at), revokeReason: String(data.revoke_reason) };
}

export async function createPayslipDownload(user: AuthenticatedUser, id: string) {
  requireAny(user, ["payroll.view", "payslip.self.view"]);
  const client = db(), actor = await identity(client, user), isSelfService = !can(user.permissions, "payroll.view");
  let query = client.from("payslips").select("*,employees(employee_code,full_name)").eq("id", id);
  if (isSelfService) {
    if (!actor.employeeId) throw new AppError("PERMISSION_DENIED", "Tài khoản chưa liên kết nhân viên.");
    query = query.eq("employee_id", actor.employeeId).eq("status", "published");
  }
  const { data: payslip, error } = await query.maybeSingle();
  if (error || !payslip) throw new AppError("NOT_FOUND", "Không tìm thấy phiếu lương.");
  const fileName = `phieu-luong-${String(payslip.snapshot?.periodMonth ?? "ky-luong").slice(0, 7)}-v${payslip.version}.pdf`;
  const { generatePayslipPdf } = await import("./payslipPdf");
  const person = employee(payslip as Row), template = await readSettingsGroup("payslip"), bytes = await generatePayslipPdf({ employeeCode: String(person?.employee_code ?? "—"), employeeName: String(person?.full_name ?? "—"), periodMonth: String(payslip.snapshot?.periodMonth ?? ""), version: Number(payslip.version), publishedAt: payslip.published_at ?? undefined, snapshot: normalizePayslipSnapshot(payslip.snapshot as Row), template });
  // Rebuild from the immutable published snapshot; old cached files may contain
  // the invalid WOFF font streams. Downloading creates no new salary/file rows.
  return { bytes, fileName };
}
export async function accountingSummary(user: AuthenticatedUser) {
  const [periods, salaries, slips] = await Promise.all([
    can(user.permissions, "payroll.view") ? listPayroll(user) : Promise.resolve([]),
    can(user.permissions, "salary.view") ? listSalaries(user) : Promise.resolve([]),
    can(user.permissions, "payroll.view") || can(user.permissions, "payslip.self.view") ? listPayslips(user) : Promise.resolve([])
  ]);
  return summarizeAccounting(periods, salaries, slips, getBusinessDateKey());
}

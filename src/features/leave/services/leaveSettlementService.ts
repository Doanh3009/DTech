import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { listAllLeaveBalances } from "./leaveRepository";
import type { LeaveSettlementOverview, LeaveSettlementRow } from "../types/leaveSettlement";

export const cashoutRateSchema = z.object({
  year: z.number().int().min(2000).max(2200), employeeId: z.string().uuid(), leaveTypeId: z.string().uuid(),
  dailyRate: z.number().int().positive().max(1_000_000_000), expectedVersion: z.number().int().positive().nullable(),
  reason: z.string().trim().min(3).max(500)
});
function db() { const client = getSupabaseServiceClient(); if (!client) throw new AppError("SERVER_ERROR"); return client; }
type Row = Record<string, unknown>;
async function readAll(build: (client: SupabaseClient, from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>) {
  const rows: Row[] = [], client = db();
  for (let from = 0; ; from += 500) {
    const { data, error } = await build(client, from, from + 499);
    if (error) throw new AppError("SERVER_ERROR", "Không thể đọc quyết toán phép.");
    const page = (data ?? []) as Row[]; rows.push(...page); if (page.length < 500) return rows;
  }
}
export async function getLeaveSettlements(user: AuthenticatedUser, year: number): Promise<LeaveSettlementOverview> {
  if (!can(user.permissions, "leave.balance.view_all")) throw new AppError("PERMISSION_DENIED");
  if (!z.number().int().min(2000).max(2200).safeParse(year).success) throw new AppError("VALIDATION_ERROR", "Năm quyết toán cần từ 2000 đến 2200.");
  const client = db(), month = `${year}-12-01`;
  const [balances, rates, settlements, periodResult, runResult] = await Promise.all([
    listAllLeaveBalances(user, year, true),
    readAll((c, from, to) => c.from("leave_cashout_rates").select("*").eq("leave_year", year).order("employee_id").order("leave_type_id").range(from, to)),
    readAll((c, from, to) => c.from("leave_year_end_settlements").select("*").eq("leave_year", year).order("id").range(from, to)),
    client.from("payroll_periods").select("id,status").eq("period_month", month).maybeSingle(),
    client.from("leave_cashout_runs").select("finished_at").not("finished_at", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (periodResult.error || runResult.error) throw new AppError("SERVER_ERROR", "Không thể đọc kỳ quyết toán phép.");
  const key = (employeeId: unknown, typeId: unknown) => `${employeeId}:${typeId}`;
  const rateByKey = new Map(rates.map(r => [key(r.employee_id, r.leave_type_id), r]));
  const settlementByKey = new Map(settlements.map(r => [key(r.employee_id, r.leave_type_id), r]));
  const currentYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
  const rows: LeaveSettlementRow[] = balances.map(b => {
    const rate = rateByKey.get(key(b.employeeId, b.leaveTypeId)), settlement = settlementByKey.get(key(b.employeeId, b.leaveTypeId)), period = periodResult.data;
    const days = settlement ? Number(settlement.days) : Math.max(0, b.officialRemaining);
    const dailyRate = settlement ? Number(settlement.daily_rate) : rate ? Number(rate.daily_rate) : null;
    const status = settlement ? "included" : !rate ? "missing_rate" : days > 0 && Math.round(days * (dailyRate ?? 0)) < 1 ? "invalid_rate" : year >= currentYear ? "not_due" : b.pending > 0 ? "pending_leave" : !period ? "waiting_payroll" : ["locked", "published"].includes(period.status) ? "payroll_locked" : "waiting_calculation";
    return { employeeId: b.employeeId, employeeCode: b.employeeCode, employeeName: b.employeeName,
      leaveTypeId: b.leaveTypeId, leaveTypeName: b.leaveTypeName, leaveTypeCode: b.leaveTypeCode,
      balanceDays: b.officialRemaining, days, dailyRate, rateVersion: rate ? Number(rate.row_version) : null,
      amount: settlement ? Number(settlement.amount) : dailyRate ? Math.round(days * dailyRate) : 0,
      status, payrollPeriodId: period ? String(period.id) : undefined };
  });
  return { year, rows, lastRunAt: runResult.data?.finished_at ?? undefined };
}
export async function saveLeaveCashoutRate(user: AuthenticatedUser, input: z.infer<typeof cashoutRateSchema>) {
  if (!can(user.permissions, "leave.balance.adjust")) throw new AppError("PERMISSION_DENIED");
  const { data, error } = await db().rpc("save_leave_cashout_rate", { p_employee_id: input.employeeId, p_leave_type_id: input.leaveTypeId,
    p_year: input.year, p_daily_rate: input.dailyRate, p_expected_version: input.expectedVersion, p_reason: input.reason, p_actor_id: user.id });
  if (error) {
    if (error.message.includes("CASHOUT_ACTOR_DENIED")) throw new AppError("PERMISSION_DENIED");
    if (error.message.includes("CASHOUT_INVALID_RATE") || error.message.includes("CASHOUT_INVALID_TYPE")) throw new AppError("VALIDATION_ERROR", "Đơn giá hoặc loại phép không hợp lệ.");
    if (error.message.includes("VERSION_CONFLICT")) throw new AppError("CONFLICT", "Đơn giá vừa thay đổi. Hãy tải lại.");
    if (error.message.includes("LEAVE_YEAR_SETTLED")) throw new AppError("CONFLICT", "Phép năm này đã đưa vào bảng lương và không thể đổi đơn giá.");
    throw new AppError("SERVER_ERROR", "Không thể lưu đơn giá thanh toán phép.");
  }
  return { version: Number(data) };
}

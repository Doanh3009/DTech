import type { LeaveBalance, LeaveDayPart, LeaveLedgerEntry } from "@/features/leave/types/leaveTypes";

export function calculateLeaveDays(input: { startDate: string; endDate: string; startDayPart: LeaveDayPart; endDayPart: LeaveDayPart; weekendDays: number[]; holidays: string[] }): number {
  const start = new Date(`${input.startDate}T12:00:00Z`); const end = new Date(`${input.endDate}T12:00:00Z`);
  if (end < start) return 0;
  let days = 0; const holidaySet = new Set(input.holidays);
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (!input.weekendDays.includes(cursor.getUTCDay()) && !holidaySet.has(date)) days += 1;
  }
  if (days && input.startDayPart !== "full_day" && !input.weekendDays.includes(start.getUTCDay()) && !holidaySet.has(input.startDate)) days -= 0.5;
  if (days && input.endDate !== input.startDate && input.endDayPart !== "full_day" && !input.weekendDays.includes(end.getUTCDay()) && !holidaySet.has(input.endDate)) days -= 0.5;
  return Math.max(0, days);
}

export function calculateLeaveWorkingDates(input: { startDate: string; endDate: string; weekendDays: number[]; holidays: string[] }): string[] {
  const dates: string[] = []; const end = new Date(`${input.endDate}T12:00:00Z`); const holidays = new Set(input.holidays);
  for (const cursor = new Date(`${input.startDate}T12:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (!input.weekendDays.includes(cursor.getUTCDay()) && !holidays.has(date)) dates.push(date);
  }
  return dates;
}

export function summarizeLedger(entries: readonly LeaveLedgerEntry[]) {
  const sum = (types: LeaveLedgerEntry["transactionType"][]) => entries.filter((entry) => types.includes(entry.transactionType)).reduce((total, entry) => total + entry.amount, 0);
  const granted = sum(["grant"]); const carryover = sum(["carryover"]); const adjustments = sum(["adjustment_add", "adjustment_subtract"]); const usageNet = sum(["leave_usage", "leave_reversal", "expiry"]);
  return { granted, carryover, adjustments, used: Math.max(0, -sum(["leave_usage", "leave_reversal"])), officialRemaining: granted + carryover + adjustments + usageNet };
}

export function withPending(balance: Omit<LeaveBalance, "pending" | "availableAfterPending">, pending: number): LeaveBalance {
  return { ...balance, pending, availableAfterPending: balance.officialRemaining - pending };
}

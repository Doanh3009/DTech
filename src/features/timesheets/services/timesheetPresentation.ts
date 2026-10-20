import type { DailyTimesheet, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";

export const dailyLabels: Record<DailyTimesheet["status"], string> = {
  full_work: "Đủ công", worker_site: "Công trường", late: "Đi muộn", early_leave: "Về sớm",
  missing_check_in: "Thiếu chấm vào", missing_check_out: "Thiếu chấm ra", annual_leave: "Phép năm",
  unpaid_leave: "Nghỉ không lương", absent: "Vắng", business_trip: "Công tác", holiday: "Ngày lễ",
  rest_day: "Ngày nghỉ", needs_review: "Cần rà soát"
};
export const dailySymbols: Record<DailyTimesheet["status"], string> = {
  full_work: "X", worker_site: "X", late: "M", early_leave: "S", missing_check_in: "!",
  missing_check_out: "!", annual_leave: "P", unpaid_leave: "KL", absent: "V", business_trip: "CT",
  holiday: "L", rest_day: "–", needs_review: "!"
};
export function periodDates(from: string, to: string) {
  const result: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`), end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && result.length < 93) {
    result.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
export function defaultPeriod(periods: TimesheetPeriod[], today: string) {
  return periods.find(item => item.startDate <= today && item.endDate >= today)?.id
    ?? [...periods].filter(item => item.startDate <= today).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]?.id
    ?? periods[0]?.id ?? "";
}
export function calendarWeeks(days: string[]) {
  const weeks: Array<Array<string | null>> = [];
  for (const date of days) {
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (!weeks.length || weekday === 0) weeks.push(Array<string | null>(7).fill(null));
    weeks[weeks.length - 1][weekday] = date;
  }
  return weeks;
}
export function reconcileTimesheet(summary: TimesheetSummary, daily: DailyTimesheet[]) {
  const actual = Number(daily.reduce((sum, item) => sum + item.workFraction, 0).toFixed(2));
  return { actual, hasDaily: daily.length > 0, mismatch: Math.abs(actual - summary.actualWorkdays) > 0.01 };
}

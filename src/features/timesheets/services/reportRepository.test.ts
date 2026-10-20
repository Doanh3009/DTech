import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
import { createReportExport, listReportTemplates } from "./reportRepository";

type Row = Record<string, unknown>;
const user: AuthenticatedUser = { id: "11111111-1111-4111-8111-111111111111", username: "hr", displayName: "Nhân sự", email: "hr@example.test", status: "active", permissions: ["timesheet.export", "timesheet.export_detail"] };
const template = {
  id: "template-1", code: "TIMESHEET_HR", name: "Bảng chấm công", report_type: "timesheet", version: 1, active: true,
  definition: { freezeHeader: true, autoFilter: true, sheets: [
    { key: "summary", name: "Tổng hợp", enabled: true }, { key: "daily", name: "Chi tiết", enabled: true },
    { key: "events", name: "Sự kiện", enabled: true }, { key: "leave", name: "Đơn nghỉ", enabled: true }, { key: "balance", name: "Phép năm", enabled: true }
  ] }
};

function database(daily: Row[] = [], summaries: Row[] = [], uploadError: { message: string } | null = null) {
  const reads: string[] = [];
  const pages: Array<{ table: string; start: number; end: number }> = [];
  const updates: Row[] = [];
  const upload = vi.fn<(path: string, bytes: Buffer, options: Row) => Promise<{ error: typeof uploadError }>>(async () => ({ error: uploadError }));
  const data: Record<string, Row[]> = {
    app_accounts: [{ id: user.id }], report_templates: [template],
    timesheet_periods: [{ id: "period-1", code: "2026_09", name: "Tháng 09/2026", status: "locked", version: 1, start_date: "2026-09-01", end_date: "2026-09-30" }],
    daily_timesheets: daily, timesheet_period_summaries: summaries, timesheet_period_versions: []
  };
  getSupabaseServiceClient.mockReturnValue({
    storage: { from: () => ({ upload }) },
    from(table: string) {
      reads.push(table);
      let start = 0, end = Infinity;
      let write = false;
      const result = (single = false) => {
        const rows = write ? table === "report_exports" ? [{ id: "export-1", status: "completed", metadata: {} }] : [] : (data[table] ?? []).slice(start, end + 1);
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null });
      };
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        range(from: number, to: number) { start = from; end = to; pages.push({ table, start, end }); return query; },
        insert: () => { write = true; return query; },
        update(value: Row) { write = true; updates.push(value); return query; },
        maybeSingle: () => result(true), single: () => result(true),
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) { return result().then(onFulfilled, onRejected); }
      };
      return query;
    }
  });
  return { reads, pages, updates, upload };
}

beforeEach(() => vi.clearAllMocks());

describe("report export data reads", () => {
  it("exports every day beyond Supabase's first page and supports a legacy locked period without a snapshot", async () => {
    const summaries = Array.from({ length: 35 }, (_, index) => ({ employee_id: `employee-${index}`, employee_snapshot: { code: `NV${String(index + 1).padStart(3, "0")}`, name: `Nguyễn Thị Ánh ${index + 1}` }, actual_workdays: 30 }));
    const daily = summaries.flatMap((summary) => Array.from({ length: 30 }, (_, day) => ({ ...summary, work_date: `2026-09-${String(day + 1).padStart(2, "0")}`, work_fraction: 1, work_minutes: 480, leave_fraction: 0, late_minutes: 0, early_leave_minutes: 0, exception_count: 0, status: "full_work" })));
    const mock = database(daily, summaries);
    await expect(createReportExport(user, { templateId: "template-1", periodId: "period-1" })).resolves.toMatchObject({ status: "completed" });
    expect(mock.pages.filter((page) => page.table === "daily_timesheets")).toEqual([{ table: "daily_timesheets", start: 0, end: 999 }, { table: "daily_timesheets", start: 1000, end: 1999 }]);
    expect(mock.reads).not.toContain("attendance_events");
    expect(mock.reads).not.toContain("leave_requests");
    expect(mock.reads).not.toContain("leave_ledger");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(mock.upload.mock.calls[0][1] as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Chi tiết")!.rowCount).toBe(1052);
    expect(workbook.getWorksheet("Bảng chấm công")!.getCell("A38").value).toBe("NV035");
  });

  it("loads report templates for an HR report permission and keeps an employee without export access blocked", async () => {
    database();
    await expect(listReportTemplates({ ...user, permissions: ["report.employee_basic"] })).resolves.toHaveLength(1);
    getSupabaseServiceClient.mockClear();
    await expect(listReportTemplates({ ...user, permissions: ["attendance.self.view"] })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("records the failed storage stage and returns an actionable Vietnamese error", async () => {
    const mock = database([], [], { message: "Storage unavailable" });
    await expect(createReportExport(user, { templateId: "template-1", periodId: "period-1" })).rejects.toThrow("Không thể lưu tệp Excel vào kho báo cáo.");
    expect(mock.updates).toContainEqual({ status: "failed", error_message: "Không thể lưu tệp Excel vào kho báo cáo." });
  });
});

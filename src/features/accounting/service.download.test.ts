import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
const state = vi.hoisted(() => ({ account: { id: "10000000-0000-4000-8000-000000000001", employee_id: "20000000-0000-4000-8000-000000000001" }, slip: undefined as Record<string, unknown> | undefined, calls: [] as Array<[string, string, unknown]>, from: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: state.from }) }));
vi.mock("./payslipPdf", () => ({ generatePayslipPdf: state.pdf }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup: async () => ({ title: "Phiếu lương" }) }));
import { createPayslipDownload } from "./service";
const user = { id: "10000000-0000-4000-8000-000000000001", email: "test@example.test", permissions: ["payslip.self.view"] } as AuthenticatedUser;
beforeEach(() => {
  vi.clearAllMocks(); state.calls = [];
  state.slip = { id: "slip", employee_id: state.account.employee_id, version: 1, status: "published", file_id: "old-broken-cached-file", snapshot: { periodMonth: "2026-09-01", base_salary: 12_000_000, bonus: 800_000, leave_cashout_amount: 300_000, net_salary: 13_300_000 }, employees: { employee_code: "NV001", full_name: "Nguyễn Văn Cường" } };
  state.pdf.mockResolvedValue(Uint8Array.from([37, 80, 68, 70, 45]));
  state.from.mockImplementation(table => {
    const query = {
      select: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { state.calls.push([table, key, value]); return query; },
      maybeSingle: async () => ({ data: table === "app_accounts" ? state.account : state.slip, error: null })
    };
    return query;
  });
});
describe("private payslip download", () => {
  it("rebuilds a valid PDF from the published snapshot instead of reusing broken cached files", async () => {
    const result = await createPayslipDownload(user, "slip");
    expect(result.fileName).toBe("phieu-luong-2026-09-v1.pdf");
    expect(new TextDecoder().decode(result.bytes)).toBe("%PDF-");
    expect(state.pdf).toHaveBeenCalledWith(expect.objectContaining({ employeeName: "Nguyễn Văn Cường", snapshot: expect.objectContaining({ bonus: 500_000, leaveCashoutAmount: 300_000, netSalary: 13_300_000 }) }));
    expect(state.calls).toContainEqual(["payslips", "employee_id", state.account.employee_id]);
    expect(state.calls).toContainEqual(["payslips", "status", "published"]);
    expect(state.from.mock.calls.every(([table]) => ["app_accounts", "payslips"].includes(table))).toBe(true);
  });
  it("rejects a missing or unowned payslip without generating a file", async () => {
    state.slip = undefined;
    await expect(createPayslipDownload(user, "unowned")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.pdf).not.toHaveBeenCalled();
  });
  it("requires payroll or own-payslip permission before any database access", async () => {
    await expect(createPayslipDownload({ ...user, permissions: [] }, "slip")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(state.from).not.toHaveBeenCalled();
  });
});

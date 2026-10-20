import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
const { getClient, audit } = vi.hoisted(() => ({ getClient: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: getClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: audit }));
import { getInsuranceDetail, listInsurance, saveInsurance, saveInsuranceContribution } from "./service";
import { insuranceContributionInputSchema, insuranceInputSchema } from "./schema";

const actorId = "11111111-1111-4111-8111-111111111111", employeeId = "22222222-2222-4222-8222-222222222222";
const user = { id: actorId, permissions: ["insurance.view", "insurance.edit", "insurance.document.upload", "insurance.history.view"] } as AuthenticatedUser;
const input = { employeeId, socialInsuranceNumber: "BH00001", participationStatus: "active" as const, paymentStatus: "paid" as const, contributionBase: 10_000_000,
  contributionRatePercent: 10, contributionMonth: "2026-10", socialInsuranceEnabled: true, healthInsuranceEnabled: true, unemploymentInsuranceEnabled: false,
  effectiveDate: "2026-10-14", changeType: "joined" as const, reason: "Ghi nhận kỳ đóng" };
type Row = Record<string, unknown>;
function database({ profile, events = [], profiles = [], contributions = [], rpcError, rpcData = "contribution-id", receipt, committed = false }: { profile?: Row; events?: Row[]; profiles?: Row[]; contributions?: Row[]; rpcError?: { code?: string; message: string }; rpcData?: string; receipt?: Row; committed?: boolean } = {}) {
  const writes: { table: string; action: string; payload?: unknown }[] = [], reads: string[] = [];
  const rpc = vi.fn(async () => ({ data: rpcData, error: rpcError ?? null }));
  const upload = vi.fn(async () => ({ error: null })), remove = vi.fn(async () => ({ error: null }));
  getClient.mockReturnValue({ rpc, storage: { from: () => ({ upload, remove }) }, from(table: string) {
    reads.push(table); let start = 0, end = Infinity;
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
      range: (from: number, to: number) => { start = from; end = to; return query; },
      insert: (payload: unknown) => { writes.push({ table, action: "insert", payload }); return Promise.resolve({ error: null }); },
      delete: () => { writes.push({ table, action: "delete" }); return query; },
      async maybeSingle() { return { data: table === "app_accounts" ? { id: actorId } : table === "employee_insurance_profiles" ? profile ?? null : table === "employee_insurance_contribution_commands" ? receipt ?? null : committed ? { id: "committed-event" } : null, error: null }; },
      then(resolve: (value: unknown) => unknown) { const rows = table === "employee_insurance_profiles" ? profiles : table === "employee_insurance_events" ? events : table === "employee_insurance_contributions" ? contributions : []; return Promise.resolve({ data: rows.slice(start, end + 1), error: null }).then(resolve); }
    }; return query;
  } });
  return { writes, reads, rpc, upload, remove };
}
function pdf() {
  const file = new File(["%PDF-1.7 test"], "bhxh.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("%PDF-1.7 test").buffer }); return file;
}
beforeEach(() => vi.clearAllMocks());
describe("insurance profile/history", () => {
  it("uses one atomic RPC rather than separate profile/history writes", async () => {
    const mock = database(); const result = await saveInsurance(user, input);
    expect(mock.rpc).toHaveBeenCalledWith("save_insurance_profile_command", expect.objectContaining({ p_employee_id: employeeId, p_actor_id: actorId, p_values: input, p_expected_updated_at: null }));
    expect(result.eventId).toEqual(expect.any(String)); expect(mock.writes).toEqual([]);
  });
  it("rejects stale profile before file upload or save", async () => {
    const mock = database({ profile: { updated_at: "2026-10-14T10:00:00Z" } });
    await expect(saveInsurance(user, { ...input, expectedUpdatedAt: "2026-10-13T10:00:00Z" }, pdf())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.upload).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("compensates an uncommitted private object on atomic command failure", async () => {
    const mock = database({ rpcError: { message: "HISTORY_INSERT_FAILED", code: "P0001" } });
    await expect(saveInsurance(user, input, pdf())).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.writes).toContainEqual({ table: "file_assets", action: "delete" });
    expect(mock.writes.some((write) => write.table === "employee_insurance_profiles" || write.table === "employee_insurance_events")).toBe(false);
  });
  it("keeps a committed event and object when RPC response is lost", async () => {
    const mock = database({ rpcError: { message: "network response lost" }, committed: true });
    await expect(saveInsurance(user, input, pdf())).resolves.toHaveProperty("eventId");
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.writes.filter((write) => write.action === "delete")).toEqual([]);
  });
  it("reads all profile pages and masks document access without its permission", async () => {
    const profiles = Array.from({ length: 501 }, (_, index) => ({ employee_id: `employee-${index}`, social_insurance_number: `BH${index}`, updated_at: "2026-10-14T10:00:00Z" }));
    profiles[0].employee_id = employeeId;
    database({ profiles, events: [{ id: "event", employee_id: employeeId, change_type: "adjusted", snapshot: { paymentStatus: "paid", contributionMonth: "2026-10" }, effective_date: "2026-10-14", changed_at: "2026-10-14T10:00:00Z", reason: "Đã đóng", file_assets: { id: "private-file", metadata: {} }, app_accounts: { display_name: "Nhân sự" } }] });
    const result = await listInsurance(user); expect(result.records).toHaveLength(501); expect(result.canViewHistory).toBe(true);
    expect(result.records[0].history[0]).toMatchObject({ snapshot: { paymentStatus: "paid" }, changedByName: "Nhân sự", fileId: undefined });
  });
  it("does not read history when permission is missing", async () => {
    const mock = database(); const result = await listInsurance({ ...user, permissions: ["insurance.view"] });
    expect(result.canViewHistory).toBe(false); expect(mock.reads).not.toContain("employee_insurance_events");
  });
  it("requires edit permission before reaching database", async () => {
    await expect(saveInsurance({ ...user, permissions: ["insurance.view"] }, input)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getClient).not.toHaveBeenCalled();
  });
  it("requires upload permission before uploading a private attachment", async () => {
    await expect(saveInsurance({ ...user, permissions: ["insurance.edit"] }, input, pdf())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getClient).not.toHaveBeenCalled();
  });
  it("maps an atomic version race to conflict without writing an audit", async () => {
    const mock = database({ rpcError: { message: "INSURANCE_VERSION_CONFLICT" } });
    await expect(saveInsurance(user, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.rpc).toHaveBeenCalledOnce(); expect(audit).not.toHaveBeenCalled();
  });
  it("audits the preserved month and status for a coverage-only profile edit", async () => {
    const version = "2026-10-14T10:00:00Z";
    database({ profile: { updated_at: version, contribution_month: "2026-09-01", payment_status: "pending" } });
    await saveInsurance(user, { ...input, recordContribution: false, contributionMonth: undefined, expectedUpdatedAt: version });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ contributionMonth: "2026-09", paymentStatus: "pending" }) }));
  });
  it("does not silently discard paid fields when a legacy profile editor changes payment status", async () => {
    database({ rpcError: { message: "INSURANCE_PAYMENT_RECORD_CONFLICT" } });
    await expect(saveInsurance(user, input)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Quá trình đóng") });
  });
  it("validates month and preserves optional concurrency timestamp", () => {
    expect(insuranceInputSchema.safeParse({ ...input, contributionMonth: "2026-99" }).success).toBe(false);
    expect(insuranceInputSchema.parse({ ...input, expectedUpdatedAt: "2026-10-14T10:00:00+00:00" }).expectedUpdatedAt).toBeTruthy();
  });
});

describe("monthly insurance contributions", () => {
  const monthly = { employeeId, contributionMonth: "2026-09", contributionBase: 12_000_000, contributionRatePercent: 10.5, paymentStatus: "paid" as const, paidAmount: 1_260_000, paidDate: "2026-10-01", note: "Ủy nhiệm chi tháng 09" };
  it("reads the operational ledger with insurance.view independently of restricted history", async () => {
    const mock = database({ profiles: [{ employee_id: employeeId, contribution_month: null, payment_status: "pending" }], contributions: [{ id: "month-1", employee_id: employeeId, contribution_month: "2026-09-01", contribution_base: "12000000", contribution_rate_percent: "10.50", expected_amount: "1260000", paid_amount: null, paid_date: null, payment_status: "paid", source: "legacy_profile", updated_at: "2026-10-01T00:00:00Z" }] });
    const result = await listInsurance({ ...user, permissions: ["insurance.view"] });
    expect(mock.reads).toContain("employee_insurance_contributions"); expect(mock.reads).not.toContain("employee_insurance_events");
    expect(result.records[0].contributions).toEqual([expect.objectContaining({ contributionMonth: "2026-09", expectedAmount: 1_260_000, paidAmount: undefined, paidDate: undefined, source: "legacy_profile", paymentStatus: "paid" })]);
    expect(result.records[0].contributionMonth).toBeUndefined(); expect(result.records[0].history).toEqual([]);
  });
  it("does not manufacture missing months, payment dates or paid amounts", async () => {
    database({ profiles: [{ employee_id: employeeId, payment_status: "pending", contribution_base: 12000000 }] });
    const result = await listInsurance(user); expect(result.records[0].contributions).toEqual([]); expect(result.records[0].contributionMonth).toBeUndefined();
  });
  it("pages every recorded contribution rather than cutting off the first 500", async () => {
    database({ profiles: [{ employee_id: employeeId }], contributions: Array.from({ length: 501 }, (_, index) => ({ id: `month-${index}`, employee_id: employeeId, contribution_month: "2026-09-01", payment_status: "pending" })) });
    expect((await listInsurance(user)).records[0].contributions).toHaveLength(501);
  });
  it("returns one employee detail and does not fetch the employee picker", async () => {
    const mock = database({ profiles: [{ employee_id: employeeId, employees: { employee_code: "NV1", full_name: "Trần Thị Bình" } }] });
    expect(await getInsuranceDetail(user, employeeId)).toMatchObject({ employeeId, employeeCode: "NV1", contributions: [] });
    expect(mock.reads).not.toContain("employees");
  });
  it("returns not found for absent employee details", async () => { database(); await expect(getInsuranceDetail(user, employeeId)).rejects.toMatchObject({ code: "NOT_FOUND" }); });
  it("saves through a single audited atomic command with the supplied version", async () => {
    const mock = database(); const version = "2026-10-01T00:00:00Z";
    expect(await saveInsuranceContribution(user, { ...monthly, expectedUpdatedAt: version })).toEqual({ contributionId: "contribution-id" });
    expect(mock.rpc).toHaveBeenCalledWith("save_insurance_contribution_command", expect.objectContaining({ p_command_id: expect.any(String), p_employee_id: employeeId, p_actor_id: actorId, p_values: { ...monthly, expectedUpdatedAt: version }, p_expected_updated_at: version }));
    expect(mock.writes).toEqual([]); expect(audit).not.toHaveBeenCalled();
  });
  it("requires insurance.edit before opening a database connection", async () => {
    await expect(saveInsuranceContribution({ ...user, permissions: ["insurance.view"] }, monthly)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getClient).not.toHaveBeenCalled();
  });
  it("recognizes a committed receipt when the RPC response was lost", async () => {
    database({ rpcError: { message: "transport lost after commit" }, receipt: { contribution_id: "saved-month" } });
    expect(await saveInsuranceContribution(user, monthly)).toEqual({ contributionId: "saved-month" });
  });
  it.each([
    ["INSURANCE_VERSION_CONFLICT", "CONFLICT"], ["INSURANCE_ACTOR_DENIED", "PERMISSION_DENIED"],
    ["INSURANCE_PROFILE_NOT_FOUND", "NOT_FOUND"], ["INSURANCE_INPUT_INVALID", "VALIDATION_ERROR"], ["database offline", "SERVER_ERROR"]
  ])("maps %s to %s without a second write", async (message, code) => {
    const mock = database({ rpcError: { message } }); await expect(saveInsuranceContribution(user, monthly)).rejects.toMatchObject({ code });
    expect(mock.rpc).toHaveBeenCalledOnce(); expect(mock.writes).toEqual([]);
  });
  it("allows an explicitly paid legacy month whose actual amount and date are unknown", () => {
    expect(insuranceContributionInputSchema.parse({ employeeId, contributionMonth: "2026-09", paymentStatus: "paid" })).toEqual({ employeeId, contributionMonth: "2026-09", paymentStatus: "paid" });
  });
  it.each([
    { contributionMonth: "0000-01" }, { contributionMonth: "2026-13" }, { contributionMonth: "2026-1" },
    { contributionBase: -1 }, { contributionRatePercent: 101 }, { paidAmount: -1 }, { paidDate: "2026-02-30" },
    { paidAmount: 100, paymentStatus: "pending" }, { paidDate: "2026-10-01", paymentStatus: "overdue" },
    { unexpected: true }, { note: "x".repeat(501) }
  ])("rejects invalid or contradictory monthly snapshots: %j", (override) => {
    expect(insuranceContributionInputSchema.safeParse({ ...monthly, ...override }).success).toBe(false);
  });
});

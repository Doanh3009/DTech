import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: getClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
vi.mock("./contractTemplateService", () => ({ generateContractDocument: vi.fn() }));
import { archiveContract, createContract, replaceContractFile, updateContract } from "./contractService";
import { employeeContractUpdateSchema } from "../schemas/employeeSchemas";

const user = { id: "11111111-1111-4111-8111-111111111111", permissions: ["contract.edit", "contract.file.upload"] } as AuthenticatedUser;
const current = { id: "contract", employee_id: "employee", contract_number: "HD-01", contract_type: "Không thời hạn", start_date: "2026-01-01", effective_date: "2026-01-01", status: "active", row_version: 2, attachment_file_id: "old-file" };
const input = { contractNumber: "HD-02", contractType: "Không thời hạn", effectiveDate: "2026-01-01", status: "active" as const, rowVersion: 2 };
function database(options: { updateError?: boolean; committed?: boolean; verifyError?: boolean; raced?: boolean } = {}) {
  const updates: Record<string, unknown>[] = [], filters: [string, unknown][] = [];
  const upload = vi.fn(async () => ({ error: null })), remove = vi.fn(async () => ({ error: null })), deletes: string[] = [];
  let written: Record<string, unknown> | undefined, reads = 0;
  getClient.mockReturnValue({ storage: { from: () => ({ upload, remove }) }, from(table: string) {
    let payload: Record<string, unknown> | undefined;
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; }, is: () => query,
      update: (next: Record<string, unknown>) => { payload = next; written = next; updates.push(next); return query; },
      insert: (next: Record<string, unknown>) => { if(table!=="employee_contracts")return Promise.resolve({ error: null });payload=next;written=next;updates.push(next);return query; }, delete: () => { deletes.push(table); return query; },
      single: async () => payload&&options.updateError ? { data: null, error: { message: "response lost" } } : { data: { ...current, ...written }, error: null },
      maybeSingle: async () => {
        if (table !== "employee_contracts") return { data: null, error: null };
        if (payload) return options.updateError ? { data: null, error: { message: "response lost" } } : options.raced ? { data: null, error: null } : { data: { ...current, ...payload }, error: null };
        reads++;
        if (reads > 1 && options.verifyError) return { data: null, error: { message: "read lost" } };
        return { data: { ...current, ...(options.committed ? written : {}) }, error: null };
      }
    }; return query;
  } }); return { updates, filters, upload, remove, deletes };
}
function pdf() { const file = new File(["%PDF-1.7 test"], "contract.pdf", { type: "application/pdf" }); Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("%PDF-1.7 test").buffer }); return file; }
beforeEach(() => vi.clearAllMocks());
describe("employee contract writes", () => {
  it("rejects missing expected rowVersion at API schema boundary", () => {
    expect(employeeContractUpdateSchema.safeParse({ ...input, rowVersion: undefined }).success).toBe(false);
  });
  it("rejects stale metadata before upload or update", async () => {
    const mock = database(); await expect(updateContract(user, "employee", "contract", { ...input, rowVersion: 1 }, pdf())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.updates).toEqual([]); expect(mock.upload).not.toHaveBeenCalled();
  });
  it("uses caller's version for metadata CAS", async () => {
    const mock = database(); await updateContract(user, "employee", "contract", input);
    expect(mock.filters).toContainEqual(["row_version", 2]); expect(mock.updates[0]).toMatchObject({ contract_number: "HD-02", row_version: 3 });
  });
  it("file-only upload preserves metadata and needs file permission rather than edit", async () => {
    const mock = database(); await replaceContractFile({ ...user, permissions: ["contract.file.upload"] }, "employee", "contract", 2, pdf());
    expect(Object.keys(mock.updates[0]).sort()).toEqual(["attachment_file_id", "row_version"]);
    expect(mock.updates[0]).toMatchObject({ row_version: 3, attachment_file_id: expect.any(String) });
  });
  it("rejects conflicting Word and PDF inputs before uploading", async () => {
    const mock = database(); await expect(createContract(user, "employee", input, pdf(), "template")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("retains a successfully attached PDF if the update response is lost", async () => {
    const mock = database({ updateError: true, committed: true });
    const result = await replaceContractFile(user, "employee", "contract", 2, pdf());
    expect(result.attachmentFileId).toBe(mock.updates[0].attachment_file_id);
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.deletes).toEqual([]);
  });
  it("retains the uploaded object when a lost update cannot be verified", async () => {
    const mock = database({ updateError: true, verifyError: true });
    await expect(replaceContractFile(user, "employee", "contract", 2, pdf())).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.deletes).toEqual([]);
  });
  it("cleans an uncommitted PDF only after confirming a conflicting update", async () => {
    const mock = database({ raced: true });
    await expect(replaceContractFile(user, "employee", "contract", 2, pdf())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.remove).toHaveBeenCalledOnce(); expect(mock.deletes).toEqual(["file_assets"]);
  });
  it("rejects stale archive requests and increments a matching caller version", async () => {
    const stale = database(); await expect(archiveContract(user, "employee", "contract", "Lưu trữ hồ sơ", 1)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(stale.updates).toEqual([]);
    const mock = database(); await archiveContract(user, "employee", "contract", "Lưu trữ hồ sơ", 2);
    expect(mock.filters).toContainEqual(["row_version", 2]); expect(mock.updates[0]).toMatchObject({ status: "terminated", row_version: 3 });
  });
  it("requires file permission before a file-only write", async () => {
    await expect(replaceContractFile({ ...user, permissions: ["contract.edit"] }, "employee", "contract", 2, pdf())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getClient).not.toHaveBeenCalled();
  });
  it("creates metadata without a Word template or attached document", async () => {
    const mock = database(); const result = await createContract(user, "employee", input);
    expect(result.contractNumber).toBe("HD-02"); expect(mock.updates[0]).toMatchObject({ attachment_file_id: null, template_id: null });
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("keeps the attachment after a committed create response is lost", async () => {
    const mock = database({ updateError: true, committed: true }); const result = await createContract(user, "employee", input, pdf());
    expect(result.attachmentFileId).toBe(mock.updates[0].attachment_file_id); expect(mock.remove).not.toHaveBeenCalled(); expect(mock.deletes).toEqual([]);
  });
});

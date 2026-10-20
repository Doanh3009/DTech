import { beforeEach, describe, expect, it, vi } from "vitest";
const { requestUser, detail } = vi.hoisted(() => ({ requestUser: vi.fn(), detail: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: requestUser }));
vi.mock("@/features/insurance/service", () => ({ getInsuranceDetail: detail }));
import { GET } from "./route";
import { AppError } from "@/lib/api/errors";
const user = { id: "11111111-1111-4111-8111-111111111111", status: "active", permissions: ["insurance.view"] };
const employeeId = "22222222-2222-4222-8222-222222222222";
const request = new Request("https://app.invalid/api/v1/insurance/employee");
const context = (value = employeeId) => ({ params: Promise.resolve({ employeeId: value }) });
beforeEach(() => { vi.clearAllMocks(); requestUser.mockResolvedValue(user); detail.mockResolvedValue({ employeeId, contributions: [], history: [] }); });
describe("individual insurance detail API", () => {
  it("requires an active authenticated account", async () => {
    requestUser.mockResolvedValue(null); expect((await GET(request, context())).status).toBe(401);
    requestUser.mockResolvedValue({ ...user, status: "disabled" }); expect((await GET(request, context())).status).toBe(403); expect(detail).not.toHaveBeenCalled();
  });
  it("validates the awaited employee UUID", async () => { expect((await GET(request, context("invalid"))).status).toBe(400); expect(detail).not.toHaveBeenCalled(); });
  it("returns only the requested employee record with private no-store response", async () => {
    const response = await GET(request, context()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ ok: true, data: { employeeId, contributions: [] } }); expect(detail).toHaveBeenCalledWith(user, employeeId);
  });
  it("preserves permission and missing-record errors", async () => {
    detail.mockRejectedValue(new AppError("PERMISSION_DENIED")); expect((await GET(request, context())).status).toBe(403);
    detail.mockRejectedValue(new AppError("NOT_FOUND")); expect((await GET(request, context())).status).toBe(404);
  });
});

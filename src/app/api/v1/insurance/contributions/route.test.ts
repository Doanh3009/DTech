import { beforeEach, describe, expect, it, vi } from "vitest";
const { requestUser, save } = vi.hoisted(() => ({ requestUser: vi.fn(), save: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: requestUser }));
vi.mock("@/features/insurance/service", () => ({ saveInsuranceContribution: save }));
import { POST } from "./route";
import { AppError } from "@/lib/api/errors";
const user = { id: "11111111-1111-4111-8111-111111111111", status: "active", permissions: ["insurance.edit"] };
const value = { employeeId: "22222222-2222-4222-8222-222222222222", contributionMonth: "2026-09", paymentStatus: "paid", paidAmount: 1000000 };
const request = (body: unknown) => new Request("https://app.invalid/api/v1/insurance/contributions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); requestUser.mockResolvedValue(user); save.mockResolvedValue({ contributionId: "new-month" }); });
describe("monthly insurance API", () => {
  it("requires an active authenticated account", async () => {
    requestUser.mockResolvedValue(null); expect((await POST(request(value))).status).toBe(401);
    requestUser.mockResolvedValue({ ...user, status: "disabled" }); expect((await POST(request(value))).status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });
  it("validates a contradictory payment before calling the command", async () => {
    expect((await POST(request({ ...value, paymentStatus: "pending" }))).status).toBe(400); expect(save).not.toHaveBeenCalled();
  });
  it("returns an uncached saved contribution response", async () => {
    const response = await POST(request(value)); expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ ok: true, data: { contributionId: "new-month" } }); expect(save).toHaveBeenCalledWith(user, value);
  });
  it("preserves command permission and conflict errors", async () => {
    save.mockRejectedValue(new AppError("PERMISSION_DENIED")); expect((await POST(request(value))).status).toBe(403);
    save.mockRejectedValue(new AppError("CONFLICT")); expect((await POST(request(value))).status).toBe(409);
  });
  it("rejects malformed JSON", async () => {
    expect((await POST(new Request("https://app.invalid/api/v1/insurance/contributions", { method: "POST", body: "{" }))).status).toBe(400); expect(save).not.toHaveBeenCalled();
  });
});

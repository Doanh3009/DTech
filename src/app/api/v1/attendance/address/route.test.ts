import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { requestUser, resolveAddress } = vi.hoisted(() => ({ requestUser: vi.fn(), resolveAddress: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: requestUser }));
vi.mock("@/features/attendance/services/attendanceAddressService", () => ({ resolveAttendanceAddress: resolveAddress }));
import { POST } from "./route";
import { AppError } from "@/lib/api/errors";

const user = { id: "actor-1", status: "active", permissions: ["attendance.self.create"] };
const point = { latitude: 10.7769, longitude: 106.7009 };
beforeEach(() => { vi.clearAllMocks(); requestUser.mockResolvedValue(user); resolveAddress.mockResolvedValue({ status: "resolved", address: "Đường Lê Thánh Tôn" }); });
afterEach(() => vi.restoreAllMocks());
const request = (body: unknown) => new Request("https://app.example.invalid/api/v1/attendance/address", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("attendance address API", () => {
  it("requires an active authenticated account", async () => {
    requestUser.mockResolvedValue(null);
    expect((await POST(request(point))).status).toBe(401);
    requestUser.mockResolvedValue({ ...user, status: "disabled" });
    expect((await POST(request(point))).status).toBe(403);
    expect(resolveAddress).not.toHaveBeenCalled();
  });

  it.each([{ latitude: 91, longitude: 106 }, { latitude: 10, longitude: 181 }, { latitude: "10.77", longitude: "106.7" }, { ...point, url: "https://attacker.invalid" }, {}, { ...point, employeeId: "other-person" }])("rejects invalid coordinates and arbitrary provider or employee lookup inputs: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(resolveAddress).not.toHaveBeenCalled();
  });

  it("rejects an oversized body without passing data to the provider", async () => {
    expect((await POST(request({ text: "x".repeat(300) }))).status).toBe(400);
    expect(resolveAddress).not.toHaveBeenCalled();
  });

  it("returns private uncached HTTP responses, so GPS never appears in a request URL or shared cache", async () => {
    const response = await POST(request(point));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, data: { status: "resolved", address: "Đường Lê Thánh Tôn" } });
    expect(resolveAddress).toHaveBeenCalledWith(user, point);
  });

  it("preserves service-level attendance permission checks", async () => {
    resolveAddress.mockRejectedValue(new AppError("PERMISSION_DENIED"));
    expect((await POST(request(point))).status).toBe(403);
  });
});

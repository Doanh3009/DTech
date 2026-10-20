import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const point = { latitude: 10.7769, longitude: 106.7009 };
const result = { status: "resolved", address: "Đường Lê Thánh Tôn" };

describe("attendance address client", () => {
  it("deduplicates simultaneous requests and reuses in-memory results without persisting staff GPS", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: result }) }); vi.stubGlobal("fetch", fetch);
    const { lookupAttendanceAddress } = await import("./attendanceAddressClient");
    const requests = [lookupAttendanceAddress(point), lookupAttendanceAddress(point)];
    expect(requests[0]).toBe(requests[1]);
    expect(await Promise.all(requests)).toEqual([result, result]);
    expect(await lookupAttendanceAddress(point)).toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/attendance/address");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", cache: "no-store", body: JSON.stringify(point) });
  });

  it("serializes different locations instead of flooding the provider while opening an admin list", async () => {
    let complete: (() => void) | undefined;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { complete = () => resolve({ ok: true, json: async () => ({ data: result }) }); })).mockResolvedValue({ ok: true, json: async () => ({ data: result }) });
    vi.stubGlobal("fetch", fetch);
    const { lookupAttendanceAddress } = await import("./attendanceAddressClient");
    const first = lookupAttendanceAddress(point), second = lookupAttendanceAddress({ latitude: 21.0278, longitude: 105.8342 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    complete!(); await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("backs off busy provider leases and stops after a bounded number of retries", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { status: "busy", retryAfterMs: 1100 } }) }); vi.stubGlobal("fetch", fetch);
    const { lookupAttendanceAddress } = await import("./attendanceAddressClient");
    const request = lookupAttendanceAddress(point);
    await vi.advanceTimersByTimeAsync(2300);
    expect(await request).toMatchObject({ status: "busy" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("falls back safely when offline or when the API rejects access", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetch);
    const { lookupAttendanceAddress } = await import("./attendanceAddressClient");
    expect(await lookupAttendanceAddress(point)).toEqual({ status: "unavailable" });
  });
});

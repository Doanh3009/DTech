import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, identity, service } = vi.hoisted(() => ({ rpc: vi.fn(), identity: vi.fn(), service: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: service }));
vi.mock("@/features/shared-platforms/services/platformIdentity", () => ({ resolvePlatformIdentity: identity }));
import { attendanceAddressProvider, resolveAttendanceAddress } from "./attendanceAddressService";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const user: AuthenticatedUser = { id: "account-id", displayName: "Demo", email: "demo@example.invalid", username: "demo", status: "active", permissions: ["attendance.self.create"] };
const coordinates = { latitude: 10.7769, longitude: 106.7009 };
const response = { features: [{ geometry: { coordinates: [106.70085, 10.77665] }, properties: { name: "Khuôn viên UBND Thành phố Hồ Chí Minh", district: "Sài Gòn", city: "Thành phố Hồ Chí Minh", country: "Việt Nam" } }] };

beforeEach(() => { vi.clearAllMocks(); service.mockReturnValue({ rpc }); identity.mockResolvedValue({ accountId: "account-id" }); rpc.mockImplementation(async (name: string) => ({ data: name === "claim_attendance_address_lookup" ? { status: "claimed", leaseId: "lease-1" } : true, error: null })); vi.stubEnv("GEOCODING_PROVIDER", "photon"); vi.stubEnv("GEOCODING_REVERSE_URL", ""); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("attendance reverse geocoding service", () => {
  it("defaults to supported Photon, with no API key and no public Nominatim fallback", () => {
    expect(attendanceAddressProvider()?.endpoint.href).toBe("https://photon.komoot.io/reverse");
    vi.stubEnv("GEOCODING_PROVIDER", "nominatim");
    expect(attendanceAddressProvider()).toBeUndefined();
    vi.stubEnv("GEOCODING_REVERSE_URL", "https://nominatim.openstreetmap.org/reverse");
    expect(attendanceAddressProvider()).toBeUndefined();
    vi.stubEnv("GEOCODING_REVERSE_URL", "https://geocode.example.invalid/reverse");
    expect(attendanceAddressProvider()?.provider).toBe("nominatim");
  });

  it("requires attendance permissions and valid coordinates before accessing any provider or database", async () => {
    await expect(resolveAttendanceAddress({ ...user, permissions: ["dashboard.view"] }, coordinates)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(resolveAttendanceAddress(user, { latitude: Infinity, longitude: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(service).not.toHaveBeenCalled();
  });

  it("disables external lookup explicitly and when the distributed gate is unavailable", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    vi.stubEnv("GEOCODING_PROVIDER", "disabled");
    expect(await resolveAttendanceAddress(user, coordinates)).toEqual({ status: "not_configured" });
    vi.stubEnv("GEOCODING_PROVIDER", "photon");
    rpc.mockResolvedValue({ data: null, error: { message: "missing migration" } });
    expect(await resolveAttendanceAddress(user, coordinates)).toEqual({ status: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns cached addresses without a provider request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    rpc.mockResolvedValue({ data: { status: "resolved", address: "Đường Nguyễn Huệ", matchedLatitude: 10.77, matchedLongitude: 106.7 }, error: null });
    expect(await resolveAttendanceAddress(user, coordinates)).toMatchObject({ status: "resolved", address: "Đường Nguyễn Huệ", attribution: "© OpenStreetMap" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches only the configured endpoint, with timeout, no redirects and no employee identity", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(response) }); vi.stubGlobal("fetch", fetch);
    expect(await resolveAttendanceAddress(user, coordinates)).toMatchObject({ status: "resolved", address: expect.stringContaining("Sài Gòn") });
    const [url, init] = fetch.mock.calls[0];
    expect(url.origin).toBe("https://photon.komoot.io");
    expect(url.searchParams.get("radius")).toBe("0.2");
    expect(url.href).not.toContain("account-id");
    expect(init).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(rpc).toHaveBeenLastCalledWith("finish_attendance_address_lookup", expect.objectContaining({ p_status: "resolved", p_address: expect.stringContaining("Hồ Chí Minh") }));
  });

  it("rejects far-away town centroids rather than presenting them as the current GPS address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ features: [{ ...response.features[0], geometry: { coordinates: [105.8, 21.02] } }] }) }));
    expect(await resolveAttendanceAddress(user, coordinates)).toEqual({ status: "not_found" });
  });

  it("persists provider throttling and fails open to a map link when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, headers: new Headers({ "retry-after": "120" }) }));
    expect(await resolveAttendanceAddress(user, coordinates)).toEqual({ status: "unavailable" });
    expect(rpc).toHaveBeenLastCalledWith("finish_attendance_address_lookup", expect.objectContaining({ p_status: "unavailable", p_retry_seconds: 120 }));
  });
});

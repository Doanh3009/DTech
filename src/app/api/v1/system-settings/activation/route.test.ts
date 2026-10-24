// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";
import { defaultSystemSettings } from "@/config/systemSettings";

const mocks = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn(), activate: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/services/system-settings/settingsActivationService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/system-settings/settingsActivationService")>(),
  readSettingsActivationState: mocks.read,
  activateSystemSettings: mocks.activate
}));

import { activationPermissions } from "@/services/system-settings/settingsActivationService";
import { GET, POST } from "./route";

const actor: AuthenticatedUser = {
  id: "11111111-1111-4111-8111-111111111111", username: "admin", displayName: "Administrator",
  email: "admin@example.invalid", status: "active", permissions: [...activationPermissions]
};
const state = {
  settings: structuredClone(defaultSystemSettings),
  versions: Object.fromEntries(Object.keys(defaultSystemSettings).map((key) => [key, 2])), ready: true
};
const body = {
  requestId: "22222222-2222-4222-8222-222222222222",
  groups: {
    branding: defaultSystemSettings.branding, organization: defaultSystemSettings.organization,
    localization: defaultSystemSettings.localization, modules: defaultSystemSettings.modules
  },
  expectedVersions: { branding: 2, organization: 2, localization: 2, modules: 2 }, changeType: "publish"
};
const request = (text = JSON.stringify(body)) => new Request("http://localhost/api/v1/system-settings/activation", {
  method: "POST", body: text, headers: { "content-type": "application/json" }
});

describe("settings activation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue(actor);
    mocks.read.mockResolvedValue(state);
    mocks.activate.mockResolvedValue({ ...state, requestId: body.requestId });
  });

  it("returns one snapshot with cache disabled", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: state });
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("reports an unmigrated database as not ready without attempting a write", async () => {
    mocks.read.mockResolvedValue({ ...state, ready: false });
    expect((await (await GET()).json()).data.ready).toBe(false);
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it.each(["GET", "POST"])("rejects an anonymous %s before reading configuration/body", async (method) => {
    mocks.user.mockResolvedValue(null);
    const response = method === "GET" ? await GET() : await POST(request("not json"));
    expect(response.status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it.each(activationPermissions)("requires %s for both read and publish", async (permission) => {
    mocks.user.mockResolvedValue({ ...actor, permissions: actor.permissions.filter((key) => key !== permission) });
    expect((await GET()).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("rejects a disabled account even with all management permissions", async () => {
    mocks.user.mockResolvedValue({ ...actor, status: "disabled" });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("uses the authenticated actor and forwards the immutable command", async () => {
    const first = await POST(request());
    const second = await POST(request());
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect((await first.json()).data.requestId).toBe(body.requestId);
    expect(second.status).toBe(200);
    expect(mocks.activate).toHaveBeenCalledTimes(2);
    expect(mocks.activate).toHaveBeenNthCalledWith(1, actor, body);
    expect(mocks.activate).toHaveBeenNthCalledWith(2, actor, body);
  });

  it.each(["{secret-malformed-json", "x".repeat(32_769)])("rejects malformed or oversized input without echoing it", async (text) => {
    const response = await POST(request(text));
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("Nội dung cấu hình ERP không hợp lệ.");
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it.each([
    ["CONFLICT", 409], ["NETWORK_ERROR", 503], ["PERMISSION_DENIED", 403], ["VALIDATION_ERROR", 400]
  ] as const)("preserves %s command errors without exposing the payload", async (code, status) => {
    mocks.activate.mockRejectedValue(new AppError(code));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const result = await response.json();
    expect(result.error.code).toBe(code);
    expect(result).not.toHaveProperty("groups");
  });

  it("propagates unavailable activation settings from the authenticated boundary", async () => {
    mocks.user.mockRejectedValue(new AppError("NETWORK_ERROR"));
    expect((await GET()).status).toBe(503);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("does not publish a default snapshot on a read failure", async () => {
    mocks.read.mockRejectedValue(new AppError("NETWORK_ERROR"));
    expect((await GET()).status).toBe(503);
    expect(mocks.activate).not.toHaveBeenCalled();
  });
});

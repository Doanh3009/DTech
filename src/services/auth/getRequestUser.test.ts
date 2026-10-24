import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSystemSettings } from "@/config/systemSettings";
import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const { resolveRequestUser, readSettingsGroup, requestHeaders } = vi.hoisted(() => ({ resolveRequestUser: vi.fn(), readSettingsGroup: vi.fn(), requestHeaders: vi.fn() }));
vi.mock("@/services/auth/sessionService", () => ({ resolveRequestUser }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));

import { getRequestUser } from "./getRequestUser";

const user: AuthenticatedUser = { id: "account", username: "admin", displayName: "Admin", email: "admin@example.invalid", status: "active", permissions: ["warehouse.view", "leave.approve", "system_admin.access", "module.manage"] };

describe("request module authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRequestUser.mockResolvedValue(user);
    readSettingsGroup.mockResolvedValue({ ...defaultSystemSettings.modules, warehouse: false, operations: false });
    requestHeaders.mockResolvedValue(new Headers());
  });
  it("does not load company settings for an anonymous request", async () => {
    resolveRequestUser.mockResolvedValue(null);
    expect(await getRequestUser()).toBeNull();
    expect(readSettingsGroup).not.toHaveBeenCalled();
  });
  it("narrows session permissions without mutating the stored role", async () => {
    const scoped = await getRequestUser();
    expect(scoped?.permissions).not.toContain("warehouse.view");
    expect(scoped?.permissions).toContain("module.manage");
    expect(user.permissions).toContain("warehouse.view");
  });
  it("does not return a role when activation cannot be verified", async () => {
    readSettingsGroup.mockRejectedValue(new AppError("NETWORK_ERROR"));
    await expect(getRequestUser()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 503 });
  });
  it("blocks direct API access even when a cross-module permission remains", async () => {
    requestHeaders.mockResolvedValue(new Headers({ "x-dtech-pathname": "/api/v1/approvals/123/approve" }));
    await expect(getRequestUser()).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
  });
  it("allows the same permission inside its enabled module and keeps configuration accessible", async () => {
    requestHeaders.mockResolvedValue(new Headers({ "x-dtech-pathname": "/api/v1/leave-requests" }));
    expect((await getRequestUser())?.permissions).toContain("leave.approve");
    requestHeaders.mockResolvedValue(new Headers({ "x-dtech-pathname": "/api/v1/system-settings/modules" }));
    expect((await getRequestUser())?.permissions).toContain("module.manage");
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({ user: vi.fn(), settings: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup: mocks.settings }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { GET } from "./route";

const authorizedUser: AuthenticatedUser = {
  id: "api-docs-account", displayName: "API administrator", username: "api-admin",
  email: "api-admin@example.com", status: "active", permissions: ["api_docs.view"]
};

describe("integration OpenAPI document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue(authorizedUser);
    mocks.settings.mockResolvedValue({ systemName: "DTech ERP" });
  });

  it("uses the deployment branding and keeps the external API contract", async () => {
    mocks.settings.mockResolvedValue({ systemName: "Acme Operations" });
    const response = await GET();
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/vnd.oai.openapi+json");
    expect(mocks.settings).toHaveBeenCalledExactlyOnceWith("branding");
    expect(document.openapi).toBe("3.1.0");
    expect(document.info).toEqual({ title: "Acme Operations External API", version: "1.0.0" });
    expect(document.servers).toEqual([{ url: "/api/external/v1" }]);
    expect(document.components.securitySchemes).toEqual({ apiKey: { type: "http", scheme: "bearer" } });
    expect(Object.keys(document.paths)).toEqual([
      "/employees", "/timesheets", "/projects", "/inventory", "/shipments", "/attendance-device-events"
    ]);
    const scopes = {
      "/employees": "employees.read", "/timesheets": "timesheets.read",
      "/projects": "projects.read", "/inventory": "warehouse.read", "/shipments": "shipments.read"
    };
    for (const [path, scope] of Object.entries(scopes)) {
      expect(document.paths[path].get["x-scope"]).toBe(scope);
      expect(document.paths[path].get.security).toEqual([{ apiKey: [] }]);
      expect(Object.keys(document.paths[path].get.responses)).toEqual(["200", "400", "401", "403", "429"]);
    }
    expect(document.paths["/timesheets"].get.parameters).toContainEqual({
      name: "period_id", in: "query", schema: { type: "string", format: "uuid" }
    });
    expect(document.paths["/attendance-device-events"].post["x-scope"]).toBe("attendance.write");
    expect(document.paths["/attendance-device-events"].post.parameters).toContainEqual({
      name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" }
    });
  });

  it("uses the latest branding without mutating another response", async () => {
    const first = await GET();
    mocks.settings.mockResolvedValue({ systemName: "Other Company" });
    const second = await GET();
    expect((await first.json()).info.title).toBe("DTech ERP External API");
    expect((await second.json()).info.title).toBe("Other Company External API");
  });

  it.each([
    [null, 401],
    [{ ...authorizedUser, permissions: [] }, 403],
    [{ ...authorizedUser, status: "disabled" }, 403]
  ])("rejects an unauthorized account before reading branding (%j)", async (user, status) => {
    mocks.user.mockResolvedValue(user);
    const response = await GET();
    expect(response.status).toBe(status);
    expect(mocks.settings).not.toHaveBeenCalled();
  });

  it("returns the settings error without publishing a fallback document", async () => {
    mocks.settings.mockRejectedValue(new AppError("NETWORK_ERROR"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("NETWORK_ERROR");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

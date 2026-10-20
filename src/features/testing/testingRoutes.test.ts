import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createTesterToken, TEST_OWNER } from "@/lib/testing/policy.mjs";
const mocks = vi.hoisted(() => ({ token: "", db: vi.fn(), signIn: vi.fn(), previous: vi.fn(), revoke: vi.fn(), write: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.token }) }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.db }));
vi.mock("@/services/auth/sessionService", () => ({ signInWithPassword: mocks.signIn, resolveRequestUser: mocks.previous, revokeCurrentSession: mocks.revoke, writeSessionCookies: mocks.write, requestNetworkContext: async () => ({ ip: "127.0.0.1", userAgent: "unit" }) }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup: async () => ({}) }));
vi.mock("@/features/dashboard/registry", () => ({ resolveLandingPage: () => "/personal" }));
import { POST } from "@/app/api/testing/login/route";
import { GET } from "@/app/api/testing/accounts/route";
const env = { APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321", TEST_SUPABASE_URL: "http://localhost:55321", TEST_TOOLS_GATE_SECRET: "unit-fixture-gate-secret-32-characters", TEST_ACCOUNT_PASSWORD: "UnitFixturePassword912", SESSION_HASH_PEPPER: "unit-fixture-session-secret-32-characters" };
const request = (body: unknown) => new Request("http://localhost:3300/api/testing/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const account = { id: "unit-owned-account", username: "employee.test", status: "active", auth_user_id: "unit-auth", employee_id: "unit-employee", metadata: { testOwner: TEST_OWNER, testTarget: "http://localhost:55321/" } };
function database(row: unknown = account) {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }), then: vi.fn((resolve: (result: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve)) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query); query.abortSignal.mockReturnValue(query);
  mocks.db.mockReturnValue({ from: (table: string) => {
    if (table !== "app_configurations") return query;
    const marker = { select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { value: { owner: TEST_OWNER, target: "http://localhost:55321/", projectId: "local" } }, error: null }) };
    marker.select.mockReturnValue(marker); marker.eq.mockReturnValue(marker); marker.abortSignal.mockReturnValue(marker); return marker;
  } });
}
describe("quick login server permission boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    mocks.token = createTesterToken(); mocks.previous.mockResolvedValue(null);
    mocks.signIn.mockResolvedValue({ user: { id: "unit-owned-account", username: "employee.test" }, session: {}, sessionId: "unit-session" });
    database();
  });
  afterEach(() => vi.unstubAllEnvs());
  it("returns 404 in production before database or authentication access", async () => {
    vi.stubEnv("APP_ENV", "production");
    expect((await GET()).status).toBe(404);
    expect((await POST(request({ username: "admin.test" }))).status).toBe(404);
    expect((await POST(request({ username: "admin.test", role: "admin" }))).status).toBe(404);
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("rejects forged or missing tester grant", async () => {
    for (const token of ["", "forged.test.token"]) {
      mocks.token = token;
      expect((await POST(request({ username: "admin.test" }))).status).toBe(401);
    }
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("rejects arbitrary accounts and supplied roles or passwords", async () => {
    expect((await POST(request({ username: "real.admin" }))).status).toBe(403);
    expect((await POST(request({ username: "employee.test", role: "admin" }))).status).toBe(400);
    expect((await POST(request({ username: "employee.test", password: "injected" }))).status).toBe(400);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("rejects unmanaged or disabled accounts", async () => {
    database({ ...account, metadata: {} });
    expect((await POST(request({ username: "employee.test" }))).status).toBe(403);
    database({ ...account, status: "disabled" });
    expect((await POST(request({ username: "employee.test" }))).status).toBe(403);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("does not replace a real user session", async () => {
    mocks.previous.mockResolvedValue({ username: "real.employee" });
    expect((await POST(request({ username: "employee.test" }))).status).toBe(403);
    expect(mocks.signIn).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it("uses existing password authentication and replaces only a managed session", async () => {
    mocks.previous.mockResolvedValue({ username: "employee.test" });
    const response = await POST(request({ username: "employee.test" }));
    expect(response.status).toBe(200);
    expect(mocks.signIn).toHaveBeenCalledWith(expect.objectContaining({ username: "employee.test", password: env.TEST_ACCOUNT_PASSWORD }));
    expect(mocks.revoke).toHaveBeenCalledOnce(); expect(mocks.write).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response.json())).not.toContain(env.TEST_ACCOUNT_PASSWORD);
  });
  it("keeps the previous session if new authentication fails", async () => {
    mocks.previous.mockResolvedValue({ username: "employee.test" });
    mocks.signIn.mockRejectedValue(new Error("auth unavailable"));
    expect((await POST(request({ username: "employee.test" }))).status).toBe(500);
    expect(mocks.revoke).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("returns only safe fields in the account list", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([{ username: "employee.test", label: "Nhân viên", status: "active" }]);
    expect(JSON.stringify(body)).not.toContain("unit-auth"); expect(JSON.stringify(body)).not.toContain("metadata");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, getUser, getSupabaseServiceClient } = vi.hoisted(() => ({
  cookies: vi.fn(),
  getUser: vi.fn(),
  getSupabaseServiceClient: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies, headers: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key" }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { ACCESS_COOKIE, resolveRequestUser, SESSION_COOKIE, SESSION_INACTIVITY_TIMEOUT_MS } from "./sessionService";

function activeSession() {
  return {
    id: "session-id",
    account_id: "account-id",
    last_seen_at: new Date().toISOString(),
    account: {
      id: "account-id", auth_user_id: "auth-user-id", employee_id: "employee-id",
      username: "tester", display_name: "Nhân viên", primary_email: "tester@example.invalid", status: "active",
      account_roles: [{ roles: { role_permissions: [{ permission_key: "employee.view" }, { permission_key: "unknown.permission" }] } }]
    }
  };
}

function mockSession(session: ReturnType<typeof activeSession> | null, error: unknown = null) {
  const activityWrite = vi.fn();
  const update = vi.fn().mockReturnValue({
    eq: () => ({
      then: (resolve: (result: { error: null }) => unknown) => { activityWrite(); return Promise.resolve({ error: null }).then(resolve); },
      is: () => Promise.resolve({ error: null })
    })
  });
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), gt: vi.fn(), maybeSingle: vi.fn(), update };
  for (const key of ["select", "eq", "is", "gt"] as const) query[key].mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: session, error });
  const from = vi.fn().mockReturnValue(query);
  getSupabaseServiceClient.mockReturnValue({ from });
  return { from, update, activityWrite };
}

describe("request session resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue({ get: (name: string) => ({ value: name === ACCESS_COOKIE ? "access-token" : name === SESSION_COOKIE ? "session-id" : "" }) });
    getUser.mockResolvedValue({ data: { user: { id: "auth-user-id", email: "tester@example.invalid" } }, error: null });
  });

  it("resolves current roles and employee permissions with one database read", async () => {
    const { from, activityWrite } = mockSession(activeSession());
    const user = await resolveRequestUser();
    expect(user).toMatchObject({ id: "account-id", username: "tester", status: "active" });
    expect(user?.permissions).toEqual(expect.arrayContaining(["employee.view", "profile.view"]));
    expect(user?.permissions).not.toContain("unknown.permission");
    expect(from.mock.calls.every(([table]) => table === "app_sessions")).toBe(true);
    expect(from).toHaveBeenCalledTimes(2); // Session read and nonblocking activity write.
    await vi.waitFor(() => expect(activityWrite).toHaveBeenCalledOnce());
  });

  it("rejects a session belonging to a different authenticated user", async () => {
    const session = activeSession();
    session.account.auth_user_id = "other-auth-user";
    const { update } = mockSession(session);
    expect(await resolveRequestUser()).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["disabled", "locked", "pending_activation"])("rejects %s accounts", async (status) => {
    const session = activeSession();
    session.account.status = status;
    const { update } = mockSession(session);
    expect(await resolveRequestUser()).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("revokes a session after twelve inactive hours", async () => {
    const session = activeSession();
    session.last_seen_at = new Date(Date.now() - SESSION_INACTIVITY_TIMEOUT_MS).toISOString();
    const { update, activityWrite } = mockSession(session);
    expect(await resolveRequestUser()).toBeNull();
    expect(update).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
    expect(activityWrite).not.toHaveBeenCalled();
  });

  it("fails closed when the session or authentication service cannot verify the user", async () => {
    mockSession(null, { code: "DATABASE_UNAVAILABLE" });
    expect(await resolveRequestUser()).toBeNull();
    mockSession(activeSession());
    getUser.mockResolvedValue({ data: { user: null }, error: { code: "INVALID_TOKEN" } });
    expect(await resolveRequestUser()).toBeNull();
  });

  it("shares only concurrent validations and rechecks changed account status on the next request", async () => {
    const { from } = mockSession(activeSession());
    const [first, second] = await Promise.all([resolveRequestUser(), resolveRequestUser()]);
    expect(first).toMatchObject({ id: "account-id" });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    first?.permissions.splice(0);
    expect(second?.permissions).toContain("employee.view");
    expect(getUser).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledTimes(2);

    const disabled = activeSession();
    disabled.account.status = "disabled";
    mockSession(disabled);
    expect(await resolveRequestUser()).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("validates separate session cookies independently even when the access token is the same", async () => {
    mockSession(activeSession());
    cookies.mockResolvedValueOnce({ get: (name: string) => ({ value: name === ACCESS_COOKIE ? "access-token" : "first-session" }) });
    cookies.mockResolvedValueOnce({ get: (name: string) => ({ value: name === ACCESS_COOKIE ? "access-token" : "second-session" }) });
    await Promise.all([resolveRequestUser(), resolveRequestUser()]);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("returns the authenticated user while the best-effort activity write is still pending", async () => {
    const { update } = mockSession(activeSession());
    update.mockReturnValue({ eq: () => ({ then: () => new Promise(() => undefined) }) });
    expect(await resolveRequestUser()).toMatchObject({ id: "account-id", status: "active" });
  });
});

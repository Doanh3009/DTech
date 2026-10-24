// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ from: vi.fn(), read: vi.fn(), insert: vi.fn(), rpc: vi.fn(), signIn: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithPassword: state.signIn } }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: state.from, rpc: state.rpc }) }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-publishable-key", SESSION_HASH_PEPPER: "test-pepper-for-session-hashing-at-least-32-characters" }) }));
vi.mock("@/lib/testing/policy.mjs", () => ({ productionAccountAllowed: () => true, sessionCookieNames: () => ({ access: "access", refresh: "refresh", session: "session" }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { signInWithPassword } from "./sessionService";

beforeEach(() => {
  vi.clearAllMocks();
  state.read.mockResolvedValueOnce({ data: { primary_email: "worker@example.invalid" }, error: null })
    .mockResolvedValueOnce({ data: { id: "account", auth_user_id: "auth-user", username: "worker", display_name: "Worker", primary_email: "worker@example.invalid", status: "active", account_roles: [] }, error: null });
  state.from.mockImplementation((table: string) => table === "app_sessions" ? { insert: state.insert } : { select: () => ({ eq: () => ({ maybeSingle: state.read }) }) });
  state.rpc.mockResolvedValue({ data: true, error: null });
  state.signIn.mockResolvedValue({ data: { user: { id: "auth-user", email: "worker@example.invalid" }, session: { access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 } }, error: null });
  state.insert.mockResolvedValue({ error: null });
});

describe("session registration after concurrent account changes", () => {
  it("reports an account disabled during login without returning an accepted session", async () => {
    state.insert.mockResolvedValue({ error: { code: "P0001", message: "ACCOUNT_SESSION_FORBIDDEN" } });
    await expect(signInWithPassword({ username: "worker", password: "test-password" })).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 403 });
    expect(state.rpc).not.toHaveBeenCalledWith("record_auth_login_result", expect.objectContaining({ p_succeeded: true }));
  });
  it("preserves an unrelated database failure", async () => {
    state.insert.mockResolvedValue({ error: { code: "08006", message: "private connection detail" } });
    await expect(signInWithPassword({ username: "worker", password: "test-password" })).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });
  it("returns a session only after successful registration", async () => {
    const result = await signInWithPassword({ username: "worker", password: "test-password" });
    expect(result.user.id).toBe("account");
    expect(result.sessionId).toHaveLength(43);
    expect(state.insert).toHaveBeenCalledOnce();
    expect(state.rpc).toHaveBeenCalledWith("record_auth_login_result", expect.objectContaining({ p_succeeded: true }));
  });
});

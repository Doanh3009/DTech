import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/errors";
import { allFoundationPermissions, type AccountStatus, type AuthenticatedUser, type Permission } from "@/lib/auth/permissions";
import { normalizeUsername } from "@/lib/auth/username";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { withEmployeeBaseline } from "@/services/authorization/employeeAccessPolicy";
import { productionAccountAllowed, sessionCookieNames } from "@/lib/testing/policy.mjs";

const cookieNames = sessionCookieNames();
export const ACCESS_COOKIE = cookieNames.access;
export const REFRESH_COOKIE = cookieNames.refresh;
export const SESSION_COOKIE = cookieNames.session;
export const SESSION_INACTIVITY_TIMEOUT_MS = 12 * 60 * 60 * 1000;

type CookieWriter = { set: (name: string, value: string, options: Record<string, unknown>) => void };

const validStatuses = new Set<AccountStatus>(["pending_activation", "active", "disabled", "locked", "invited"]);
const validPermissions = new Set<string>(allFoundationPermissions);
const accountFields = "id,employee_id,username,display_name,primary_email,status,metadata,account_roles!account_roles_account_id_fkey(roles(role_permissions(permission_key)))";
const pendingSessionResolutions = new Map<string, Promise<AuthenticatedUser | null>>();

interface StoredAccount {
  id: string;
  auth_user_id?: string;
  employee_id?: string | null;
  username: string;
  display_name: string;
  primary_email?: string | null;
  status: string;
  metadata?: unknown;
  account_roles?: Array<{ roles?: { role_permissions?: Array<{ permission_key?: string }> } | null }>;
}

export function isSessionInactive(lastSeenAt: string, now = Date.now()): boolean {
  const lastSeen = Date.parse(lastSeenAt);
  return !Number.isFinite(lastSeen) || now - lastSeen >= SESSION_INACTIVITY_TIMEOUT_MS;
}

function publicAuthClient() {
  const env = getServerEnv();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) throw new AppError("SERVER_ERROR", "Dịch vụ đăng nhập chưa được cấu hình.");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function tokenHash(value: string): string {
  const pepper = getServerEnv().SESSION_HASH_PEPPER;
  if (!pepper || pepper.length < 32) throw new AppError("SERVER_ERROR", "SESSION_HASH_PEPPER chưa được cấu hình an toàn.");
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export function writeSessionCookies(writer: CookieWriter, session: { access_token: string; refresh_token: string; expires_in: number }, sessionId: string): void {
  writer.set(ACCESS_COOKIE, session.access_token, cookieOptions(Math.max(60, session.expires_in)));
  writer.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
  writer.set(SESSION_COOKIE, sessionId, cookieOptions(60 * 60 * 24 * 30));
}

export function clearSessionCookies(writer: CookieWriter): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE]) writer.set(name, "", cookieOptions(0));
}

function requestFingerprint(input: { ip?: string | null; userAgent?: string | null }): { ipHash: string | null; userAgent: string | null } {
  return {
    ipHash: input.ip ? tokenHash(input.ip) : null,
    userAgent: input.userAgent?.slice(0, 512) || null
  };
}

export async function assertLoginAllowed(identifier: string, ip?: string | null): Promise<void> {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Cơ sở dữ liệu chưa được cấu hình.");
  const keyHash = tokenHash(`${normalizeUsername(identifier)}:${ip || "unknown"}`);
  const { data, error } = await client.rpc("check_auth_login_allowed", { p_key_hash: keyHash });
  if (error) {
    logger.error("auth.login_limit_check_failed", { metadata: { code: error.code, message: error.message.slice(0, 200) } });
    throw new AppError("SERVER_ERROR", "Không thể kiểm tra giới hạn đăng nhập.");
  }
  if (data === false) throw new AppError("RATE_LIMITED", "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.");
}

export async function recordLoginResult(identifier: string, ip: string | null | undefined, succeeded: boolean): Promise<void> {
  const client = getSupabaseServiceClient();
  if (!client) return;
  const keyHash = tokenHash(`${normalizeUsername(identifier)}:${ip || "unknown"}`);
  const { error } = await client.rpc("record_auth_login_result", { p_key_hash: keyHash, p_succeeded: succeeded });
  if (error) logger.warn("auth.login_attempt_record_failed", { metadata: { code: error.code } });
}

export async function signInWithPassword(input: { username: string; password: string; ip?: string | null; userAgent?: string | null }) {
  const username = normalizeUsername(input.username);
  await assertLoginAllowed(username, input.ip);
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) throw new AppError("SERVER_ERROR", "Cơ sở dữ liệu chưa được cấu hình.");
  const { data: loginAccount, error: lookupError } = await serviceClient
    .from("app_accounts")
    .select("primary_email,metadata")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) {
    logger.error("auth.username_lookup_failed", { metadata: { code: lookupError.code } });
    throw new AppError("SERVER_ERROR", "Không thể tra cứu tài khoản đăng nhập.");
  }
  if (!loginAccount?.primary_email) {
    await recordLoginResult(username, input.ip, false);
    throw new AppError("INVALID_CREDENTIALS", "Tên tài khoản hoặc mật khẩu không đúng.");
  }
  if (!productionAccountAllowed(loginAccount.metadata)) throw new AppError("ACCOUNT_DISABLED", "Tài khoản kiểm thử không được sử dụng trong production.");
  let data: Awaited<ReturnType<ReturnType<typeof publicAuthClient>["auth"]["signInWithPassword"]>>["data"];
  let error: Awaited<ReturnType<ReturnType<typeof publicAuthClient>["auth"]["signInWithPassword"]>>["error"];
  try {
    ({ data, error } = await publicAuthClient().auth.signInWithPassword({ email: String(loginAccount.primary_email), password: input.password }));
  } catch (cause) {
    logger.error("auth.supabase_sign_in_failed", { metadata: { name: cause instanceof Error ? cause.name : "unknown", message: cause instanceof Error ? cause.message.slice(0, 200) : "unknown" } });
    throw new AppError("SERVER_ERROR", "Dịch vụ đăng nhập chưa phản hồi hợp lệ.");
  }
  if (error || !data.user || !data.session) {
    await recordLoginResult(username, input.ip, false);
    throw new AppError("INVALID_CREDENTIALS", "Tên tài khoản hoặc mật khẩu không đúng.");
  }

  const account = await resolveAccount(data.user.id, data.user.email || String(loginAccount.primary_email));
  if (account.status !== "active") {
    await recordLoginResult(username, input.ip, false);
    throw new AppError("ACCOUNT_DISABLED", "Tài khoản chưa hoạt động hoặc đã bị khóa.");
  }

  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR");
  const sessionId = randomBytes(32).toString("base64url");
  const fingerprint = requestFingerprint(input);
  const { error: sessionError } = await client.from("app_sessions").insert({
    id: sessionId,
    account_id: account.id,
    refresh_token_hash: tokenHash(data.session.refresh_token),
    ip_hash: fingerprint.ipHash,
    user_agent: fingerprint.userAgent,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
  if (sessionError) throw new AppError("SERVER_ERROR", "Không thể tạo phiên đăng nhập.");
  await recordLoginResult(username, input.ip, true);
  return { user: account, session: data.session, sessionId };
}

async function resolveAccount(authUserId: string, fallbackEmail: string): Promise<AuthenticatedUser> {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Cơ sở dữ liệu chưa được cấu hình.");
  const { data: account, error } = await client.from("app_accounts")
    .select(accountFields)
    .eq("auth_user_id", authUserId).maybeSingle();
  if (error || !account) throw new AppError("ACCOUNT_NOT_PROVISIONED", "Tài khoản chưa được cấp quyền sử dụng hệ thống.");

  return mapAccount(account as unknown as StoredAccount, fallbackEmail);
}

function mapAccount(account: StoredAccount, fallbackEmail: string): AuthenticatedUser {
  if (!productionAccountAllowed(account.metadata)) throw new AppError("ACCOUNT_DISABLED");
  const rawRoles = account.account_roles || [];
  const assignedPermissions = [...new Set(rawRoles.flatMap(item => item.roles?.role_permissions || []).map(item => item.permission_key).filter((key): key is Permission => Boolean(key && validPermissions.has(key))))];
  const permissions = account.employee_id ? withEmployeeBaseline(assignedPermissions) : assignedPermissions;
  const status = String(account.status);
  return {
    id: String(account.id),
    displayName: String(account.display_name),
    username: String(account.username),
    email: String(account.primary_email || fallbackEmail),
    status: validStatuses.has(status as AccountStatus) ? status as AccountStatus : "locked",
    permissions
  };
}

export async function resolveRequestUser(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!accessToken || !sessionId) return null;

  // Parallel shell API requests can share a pending validation. Remove it as
  // soon as it completes so subsequent requests recheck revocation and roles.
  const key = createHash("sha256").update(accessToken).update(":").update(sessionId).digest("hex");
  let resolution = pendingSessionResolutions.get(key);
  if (!resolution) {
    resolution = resolveSessionUser(accessToken, sessionId);
    pendingSessionResolutions.set(key, resolution);
    const pending = resolution;
    void pending.finally(() => {
      if (pendingSessionResolutions.get(key) === pending) pendingSessionResolutions.delete(key);
    }).catch(() => undefined);
  }
  const user = await resolution;
  return user ? { ...user, permissions: [...user.permissions] } : null;
}

async function resolveSessionUser(accessToken: string, sessionId: string): Promise<AuthenticatedUser | null> {
  try {
    const client = getSupabaseServiceClient();
    if (!client) return null;
    const [{ data, error }, { data: session, error: sessionError }] = await Promise.all([
      publicAuthClient().auth.getUser(accessToken),
      client.from("app_sessions")
        .select(`id,account_id,last_seen_at,account:app_accounts!app_sessions_account_id_fkey(auth_user_id,${accountFields})`)
        .eq("id", sessionId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle()
    ]);
    if (error || !data.user) return null;
    if (sessionError || !session) return null;
    // Read the session and its account together, but still verify the account
    // belongs to the user authenticated by Supabase before accepting its roles.
    const storedAccount = (Array.isArray(session.account) ? session.account[0] : session.account) as unknown as StoredAccount | null;
    if (!storedAccount || storedAccount.auth_user_id !== data.user.id) return null;
    const account = mapAccount(storedAccount, data.user.email || "");
    if (account.status !== "active" || session.account_id !== account.id) return null;
    if (isSessionInactive(String(session.last_seen_at))) {
      await client.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sessionId).is("revoked_at", null);
      return null;
    }
    // PostgREST queries are lazy thenables: consuming the query starts the
    // activity write without making the page wait for another round trip.
    void Promise.resolve(client.from("app_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId))
      .then(({ error: updateError }) => {
        if (updateError) logger.warn("auth.session_activity_update_failed", { metadata: { code: updateError.code } });
      })
      .catch(() => logger.warn("auth.session_activity_update_failed"));
    return account;
  } catch (error) {
    logger.warn("auth.session_resolution_failed", { metadata: { error: error instanceof Error ? error.name : "unknown" } });
    return null;
  }
}

export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return;
  const client = getSupabaseServiceClient();
  if (client) await client.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sessionId);
}

export async function changeCurrentPassword(currentPassword:string,newPassword:string):Promise<void>{
  const user=await resolveRequestUser(); if(!user)throw new AppError("AUTHENTICATION_REQUIRED");
  const store=await cookies(); const access=store.get(ACCESS_COOKIE)?.value,refresh=store.get(REFRESH_COOKIE)?.value;
  if(!access||!refresh)throw new AppError("SESSION_EXPIRED");
  const verifier=publicAuthClient(); const verified=await verifier.auth.signInWithPassword({email:user.email,password:currentPassword});
  if(verified.error)throw new AppError("INVALID_CREDENTIALS","Mật khẩu hiện tại không đúng.");
  const client=publicAuthClient(); const session=await client.auth.setSession({access_token:access,refresh_token:refresh});
  if(session.error)throw new AppError("SESSION_EXPIRED");
  const updated=await client.auth.updateUser({password:newPassword}); if(updated.error)throw new AppError("VALIDATION_ERROR","Mật khẩu mới không đáp ứng chính sách hoặc chưa thể cập nhật.");
  const database=getSupabaseServiceClient(); if(database)await database.from("app_sessions").update({revoked_at:new Date().toISOString()}).eq("account_id",user.id).is("revoked_at",null);
}

export async function listCurrentSessions(){const user=await resolveRequestUser();if(!user)throw new AppError("AUTHENTICATION_REQUIRED");const current=(await cookies()).get(SESSION_COOKIE)?.value;const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR");const{data,error}=await client.from("app_sessions").select("id,user_agent,created_at,last_seen_at,expires_at").eq("account_id",user.id).is("revoked_at",null).gt("expires_at",new Date().toISOString()).order("last_seen_at",{ascending:false});if(error)throw new AppError("SERVER_ERROR");return(data||[]).map(item=>({...item,current:item.id===current}));}
export async function revokeOwnSession(sessionId:string){const user=await resolveRequestUser();if(!user)throw new AppError("AUTHENTICATION_REQUIRED");const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR");const{data,error}=await client.from("app_sessions").update({revoked_at:new Date().toISOString()}).eq("id",sessionId).eq("account_id",user.id).is("revoked_at",null).select("id").maybeSingle();if(error||!data)throw new AppError("NOT_FOUND","Không tìm thấy phiên hoạt động.");}

export async function requestNetworkContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || requestHeaders.get("x-real-ip"), userAgent: requestHeaders.get("user-agent") };
}

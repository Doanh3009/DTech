import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { provisionAccountSchema, type ProvisionAccountInput } from "@/features/employees/schemas/employeeSchemas";
import { accountLifecycleCommandError } from "./accountLifecycleCommandError";
import { AppError } from "@/lib/api/errors";
import { internalAuthEmail } from "@/lib/auth/username";
import { getServerEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getBusinessDateKey } from "@/lib/time/timezone";
import { isErpModuleEnabled } from "@/config/erpModules";
import { readSettingsGroup } from "@/services/system-settings/systemSettingsService";

const uuid = z.string().uuid();
const operationSchema = z.object({
  requestId: uuid, kind: z.enum(["provision", "delete"]),
  state: z.enum(["prepared", "cleanup_required", "completed", "cancelled"]),
  accountId: uuid, authUserId: uuid.nullable(), employeeId: uuid.nullable(),
  username: z.string(), loginEmail: z.string().nullable(),
  credentialMode: z.enum(["generated", "provided"]).nullable().optional(),
  credentialFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  roleIds: z.array(uuid).optional(), loginPhone: z.string().nullable().optional(), displayName: z.string().optional(),
  actorId: uuid, createdAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }).nullable()
});
export const pendingAccountOperationSchema = operationSchema.pick({
  requestId: true, kind: true, state: true, accountId: true, employeeId: true,
  username: true, credentialMode: true, createdAt: true
});
export type PendingAccountOperation = z.infer<typeof pendingAccountOperationSchema>;
type Operation = z.infer<typeof operationSchema>;

function unavailable() { return new AppError("NETWORK_ERROR", "Chưa thể xác nhận kết quả. Tiếp tục yêu cầu trong trang Người dùng."); }
function client() {
  const db = getSupabaseServiceClient({ timeoutMs: 10_000 });
  if (!db) throw new AppError("SERVER_ERROR", "Cơ sở dữ liệu chưa được cấu hình.");
  return db;
}
function validateId(value: string) {
  if (!uuid.safeParse(value).success) throw new AppError("VALIDATION_ERROR", "Mã yêu cầu hoặc tài khoản không hợp lệ.");
}
async function rpc(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const { data, error } = await db.rpc(name, args).abortSignal(controller.signal);
    if (error) throw accountLifecycleCommandError(error);
    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable();
  } finally { clearTimeout(timer); }
}
async function command(db: SupabaseClient, name: string, args: Record<string, unknown>, expected: { requestId: string; kind?: Operation["kind"]; accountId?: string; employeeId?: string | null; authUserId?: string | null }): Promise<Operation> {
  const parsed = operationSchema.safeParse(await rpc(db, name, args));
  if (!parsed.success || Object.entries(expected).some(([key, value]) => parsed.data[key as keyof Operation] !== value)) throw unavailable();
  return parsed.data;
}
function secretKey() {
  const value = getServerEnv().SESSION_HASH_PEPPER;
  if (!value || value.length < 32) throw new AppError("SERVER_ERROR", "Khóa bảo vệ cấp tài khoản chưa được cấu hình.");
  return value;
}
function passwordForRequest(requestId: string) {
  return `Dt!${createHmac("sha256", secretKey()).update(`dtech:initial-password:v1:${requestId}`).digest("base64url").slice(0, 28)}9a`;
}
function fingerprint(requestId: string, password: string) {
  return createHmac("sha256", secretKey()).update(`dtech:credential-fingerprint:v1:${requestId}\0`).update(password).digest("hex");
}
function matchingFingerprint(value: string, stored: string) {
  return value.length === stored.length && timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(stored, "hex"));
}
function missingAuth(error: { status?: number; code?: string } | null) {
  return error?.status === 404 && error.code === "user_not_found";
}
async function readAuth(db: SupabaseClient, id: string): Promise<User | null> {
  try {
    const { data, error } = await db.auth.admin.getUserById(id);
    if (error) { if (missingAuth(error)) return null; throw unavailable(); }
    if (!data.user || data.user.id !== id) throw unavailable();
    return data.user;
  } catch (error) { if (error instanceof AppError) throw error; throw unavailable(); }
}
function assertProvisionIdentity(user: User, operation: Operation) {
  if (user.id !== operation.authUserId || user.email?.toLowerCase() !== operation.loginEmail
    || user.app_metadata?.dtech_operation_id !== operation.requestId || user.deleted_at
    || (user.banned_until && Date.parse(user.banned_until) > Date.now())) {
    throw accountLifecycleCommandError({ message: "ACCOUNT_AUTH_IDENTITY_MISMATCH" });
  }
}
function provisionDetails(operation: Operation) {
  if (operation.kind !== "provision" || !operation.employeeId || !operation.authUserId || !operation.loginEmail
    || !operation.credentialMode || !operation.credentialFingerprint || !operation.roleIds?.length || !operation.displayName) throw unavailable();
  return { ...operation, authUserId: operation.authUserId, employeeId: operation.employeeId, loginEmail: operation.loginEmail,
    credentialMode: operation.credentialMode, credentialFingerprint: operation.credentialFingerprint };
}
export function accountOperationResult(operation: Operation) {
  // Internal Auth IDs and credential fingerprints never enter an API response.
  return { requestId: operation.requestId, accountId: operation.accountId, employeeId: operation.employeeId,
    kind: operation.kind, state: operation.state };
}
async function assertProvisionModule() {
  if (!isErpModuleEnabled(await readSettingsGroup("modules"), "human_resources")) {
    throw new AppError("PERMISSION_DENIED", "Module nhân sự chưa được bật cho doanh nghiệp.");
  }
}
async function finishProvision(db: SupabaseClient, original: Operation, actorId: string, suppliedPassword?: string) {
  const operation = provisionDetails(original);
  if (!["prepared", "completed"].includes(operation.state)) throw accountLifecycleCommandError({ message: "ACCOUNT_AUTH_CLEANUP_REQUIRED" });
  const password = operation.credentialMode === "generated" ? passwordForRequest(operation.requestId) : suppliedPassword;
  if (!password) throw new AppError("VALIDATION_ERROR", "Nhập lại mật khẩu ban đầu để tiếp tục yêu cầu.");
  if (!matchingFingerprint(fingerprint(operation.requestId, password), operation.credentialFingerprint)) {
    throw new AppError("CONFLICT", "Mật khẩu không khớp yêu cầu đã tạo.");
  }
  let completed: Operation = operation;
  if (operation.state !== "completed") {
    await assertProvisionModule();
    let user = await readAuth(db, operation.authUserId);
    if (!user) {
      // A timeout may commit in Auth. Reconcile only this reserved ID; never compensate by deleting it.
      let creationError: { code?: string } | null = null;
      try {
        const created = await db.auth.admin.createUser({ id: operation.authUserId, email: operation.loginEmail, password, email_confirm: true,
          app_metadata: { dtech_operation_id: operation.requestId },
          user_metadata: { display_name: operation.displayName, username: operation.username } });
        creationError = created.error;
      } catch { /* The next read establishes the outcome without trusting the create response. */ }
      user = await readAuth(db, operation.authUserId);
      if (!user) {
        if (["email_exists", "user_already_exists"].includes(creationError?.code ?? "")) {
          throw new AppError("CONFLICT", "Email đăng nhập đã được sử dụng. Hủy yêu cầu đang xử lý trước khi tạo lại.");
        }
        if (["weak_password", "email_address_invalid", "validation_failed"].includes(creationError?.code ?? "")) {
          throw new AppError("VALIDATION_ERROR", "Thông tin đăng nhập bị từ chối. Hủy yêu cầu đang xử lý trước khi tạo lại.");
        }
        throw unavailable();
      }
    }
    assertProvisionIdentity(user, operation);
    completed = await command(db, "complete_account_provision", { p_request_id: operation.requestId, p_actor_id: actorId }, {
      requestId: operation.requestId, kind: "provision", accountId: operation.accountId, employeeId: operation.employeeId, authUserId: operation.authUserId
    });
    if (completed.state !== "completed") throw unavailable();
  }
  // Recover the initial generated password briefly for its creator after a lost response.
  // An operation never resets an existing Auth password or extends this window.
  const age = Date.now() - Date.parse(operation.createdAt);
  const temporaryPassword = operation.credentialMode === "generated" && operation.actorId === actorId && age >= 0 && age <= 15 * 60_000 ? password : undefined;
  return { ...accountOperationResult(completed), ...(temporaryPassword ? { temporaryPassword } : {}) };
}
async function removeReservedAuth(db: SupabaseClient, operation: Operation) {
  if (!operation.authUserId) return;
  const user = await readAuth(db, operation.authUserId);
  if (!user) return;
  if (operation.kind === "provision") assertProvisionIdentity(user, operation);
  try {
    const { error } = await db.auth.admin.deleteUser(operation.authUserId);
    if (error && !missingAuth(error)) throw unavailable();
  } catch (error) { if (error instanceof AppError) throw error; throw unavailable(); }
  // SQL completion also checks absence. A lost DELETE response leaves a resumable cleanup operation.
}
async function finishDeletion(db: SupabaseClient, operation: Operation, actorId: string) {
  if (operation.kind !== "delete") throw accountLifecycleCommandError({ message: "ACCOUNT_OPERATION_CONFLICT" });
  if (operation.state === "completed") return accountOperationResult(operation);
  if (operation.state !== "cleanup_required") throw unavailable();
  await removeReservedAuth(db, operation);
  const completed = await command(db, "complete_account_deletion", { p_request_id: operation.requestId, p_actor_id: actorId }, {
    requestId: operation.requestId, kind: "delete", accountId: operation.accountId, authUserId: operation.authUserId
  });
  if (completed.state !== "completed") throw unavailable();
  return accountOperationResult(completed);
}
export async function provisionAccountLifecycle(employeeId: string, input: ProvisionAccountInput, actorId: string) {
  validateId(employeeId); validateId(actorId);
  const parsed = provisionAccountSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Thông tin cấp tài khoản không hợp lệ.");
  const value = parsed.data;
  await assertProvisionModule();
  const db = client();
  const password = value.password || passwordForRequest(value.requestId);
  const operation = await command(db, "prepare_account_provision", {
    p_request_id: value.requestId, p_actor_id: actorId, p_employee_id: employeeId, p_username: value.username,
    p_primary_email: value.loginEmail?.toLowerCase() || internalAuthEmail(value.username), p_phone: value.loginPhone || "",
    p_role_ids: [...new Set(value.roleIds)], p_credential_fingerprint: fingerprint(value.requestId, password),
    p_credential_mode: value.password ? "provided" : "generated", p_event_date: getBusinessDateKey()
  }, { requestId: value.requestId, kind: "provision", employeeId });
  try {
    return await finishProvision(db, operation, actorId, value.password);
  } catch (error) {
    // A prepared operation now owns this identity. Keep the original retry body
    // until the administrator resumes or explicitly cancels that operation.
    if (error instanceof AppError && error.code === "VALIDATION_ERROR") throw new AppError("CONFLICT", error.message);
    throw error;
  }
}
export async function deleteAccountLifecycle(accountId: string, requestId: string, actorId: string) {
  validateId(accountId); validateId(requestId); validateId(actorId);
  const db = client();
  const operation = await command(db, "prepare_account_deletion", {
    p_request_id: requestId, p_actor_id: actorId, p_account_id: accountId, p_event_date: getBusinessDateKey()
  }, { requestId, kind: "delete", accountId });
  return finishDeletion(db, operation, actorId);
}
export async function listPendingAccountOperations(actorId: string): Promise<PendingAccountOperation[]> {
  validateId(actorId);
  const parsed = z.array(pendingAccountOperationSchema).safeParse(await rpc(client(), "list_account_lifecycle_operations", { p_actor_id: actorId }));
  if (!parsed.success || parsed.data.some((item) => !["prepared", "cleanup_required"].includes(item.state))) throw unavailable();
  return parsed.data;
}
export async function recoverAccountOperation(requestId: string, actorId: string, action: "resume" | "cancel", password?: string) {
  validateId(requestId); validateId(actorId);
  const db = client();
  let operation = await command(db, "get_account_lifecycle_operation", { p_request_id: requestId, p_actor_id: actorId }, { requestId });
  if (operation.kind === "delete") {
    if (action === "cancel") throw new AppError("CONFLICT", "Yêu cầu xóa đã thu hồi quyền truy cập và cần được hoàn tất.");
    return finishDeletion(db, operation, actorId);
  }
  if (action === "resume" && operation.state !== "cleanup_required" && operation.state !== "cancelled") return finishProvision(db, operation, actorId, password);
  if (operation.state === "completed") throw accountLifecycleCommandError({ message: "ACCOUNT_OPERATION_CONFLICT" });
  if (operation.state === "cancelled") return accountOperationResult(operation);
  operation = await command(db, "cancel_account_provision", { p_request_id: requestId, p_actor_id: actorId }, {
    requestId, kind: "provision", accountId: operation.accountId, authUserId: operation.authUserId
  });
  if (operation.state === "cancelled") return accountOperationResult(operation);
  if (operation.state !== "cleanup_required") throw unavailable();
  await removeReservedAuth(db, operation);
  const cancelled = await command(db, "complete_account_provision_cleanup", { p_request_id: requestId, p_actor_id: actorId }, {
    requestId, kind: "provision", accountId: operation.accountId, authUserId: operation.authUserId
  });
  if (cancelled.state !== "cancelled") throw unavailable();
  return accountOperationResult(cancelled);
}

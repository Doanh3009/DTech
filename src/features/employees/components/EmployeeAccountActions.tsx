"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Input, PasswordInput } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { RoleAccessSelector } from "@/components/shared/RoleAccessSelector";
import type { ProvisionAccountInput } from "@/features/employees/schemas/employeeSchemas";
import type { EmployeeAccountView } from "@/features/employees/types";
import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { ACCOUNT_PASSWORD_HTML_PATTERN, ACCOUNT_PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { usernameHtmlPattern } from "@/lib/auth/username";
import { normalizeEmployeeRoleIds, toggleEmployeeRole } from "@/services/authorization/employeeAccessPolicy";
import type { RoleDefinition } from "@/services/authorization/rbacService";

import { useAccountProvisionCommand, type ProvisionReceipt } from "./useAccountProvisionCommand";

interface EmployeeAccountActionsProps {
  employeeId: string;
  employeeLabel: string;
  usernameSuggestion?: string;
  account?: EmployeeAccountView;
  permissions: readonly Permission[];
  roles: RoleDefinition[];
}

type ProvisionInput = Omit<ProvisionAccountInput, "requestId">;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function EmployeeAccountActions({ employeeId, employeeLabel, usernameSuggestion, account: initialAccount, permissions, roles }: EmployeeAccountActionsProps) {
  const router = useRouter();
  const provision = useAccountProvisionCommand();
  const provisionRoles = can(permissions, "account.assign_role") ? roles : roles.filter((role) => role.code === "employee");
  const defaultRoleId = provisionRoles.find((role) => role.code === "employee")?.id ?? provisionRoles[0]?.id;
  const [account, setAccount] = useState(initialAccount);
  const [mode, setMode] = useState<"provision" | "roles" | "status" | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    normalizeEmployeeRoleIds(initialAccount?.roleIds ?? (defaultRoleId ? [defaultRoleId] : []), roles)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const mutation = useRef(false);
  const uncertainMutation = useRef(false);
  const provisionMutation = useRef(false);
  const provisionFrozen = Boolean(provision.pending) || provision.submitting;
  const actionsFrozen = submitting || requiresReload || provisionFrozen;

  function clearError() { setError(null); provision.clearError(); }

  function toggleRole(roleId: string) {
    if (mutation.current || provisionMutation.current || provision.pending || uncertainMutation.current) return;
    setSelectedRoleIds((current) => toggleEmployeeRole(current, roleId, mode === "provision" ? provisionRoles : roles));
  }

  function closeProvision() {
    if (provisionMutation.current || provision.submitting) return;
    const shouldRefresh = Boolean(temporaryPassword);
    setMode(null);
    setTemporaryPassword("");
    setCopied(false);
    clearError();
    if (shouldRefresh) router.refresh();
  }

  function closeMutation() { if (!mutation.current) setMode(null); }

  async function copyPassword() {
    setError(null);
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Không thể sao chép. Vui lòng chọn và sao chép mật khẩu.");
    }
  }

  async function submitPatch<T>(url: string, payload: unknown, validate: (data: Record<string, unknown>) => T | null): Promise<T | null> {
    if (mutation.current || uncertainMutation.current || provisionMutation.current || provision.pending) return null;
    mutation.current = true;
    setSubmitting(true);
    setError(null);
    let uncertain = true;
    try {
      const response = await fetch(url, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000)
      });
      uncertain = response.status >= 500 || response.ok;
      const body = objectValue(await response.json());
      if (!response.ok || body?.ok !== true) {
        const message = objectValue(body?.error)?.message;
        throw new Error(typeof message === "string" ? message : "Không thể cập nhật tài khoản.");
      }
      const data = objectValue(body.data);
      const result = data ? validate(data) : null;
      if (!result) throw new Error("Chưa thể xác nhận kết quả. Vui lòng tải lại trang.");
      return result;
    } catch (reason) {
      if (uncertain) { uncertainMutation.current = true; setRequiresReload(true); }
      setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng tải lại trang.");
      return null;
    } finally { mutation.current = false; setSubmitting(false); }
  }

  function completeProvision(receipt: ProvisionReceipt, input: ProvisionInput) {
    setAccount({ id: receipt.accountId, employeeId, displayName: employeeLabel,
      employeeCodeIdentifier: usernameSuggestion ?? "", username: input.username, loginPhone: input.loginPhone,
      status: "active", roleIds: [...input.roleIds], roleNames: roles.filter((role) => input.roleIds.includes(role.id)).map((role) => role.name) });
    if (receipt.temporaryPassword) { setTemporaryPassword(receipt.temporaryPassword); setCopied(false); }
    else { setMode(null); router.refresh(); }
  }

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (provisionMutation.current || mutation.current || uncertainMutation.current) return;
    const formData = new FormData(event.currentTarget);
    const input = provision.pending?.input ?? {
      username: String(formData.get("username") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? "") || undefined,
      loginPhone: String(formData.get("loginPhone") ?? "").trim() || undefined,
      roleIds: [...selectedRoleIds]
    };
    provisionMutation.current = true;
    setError(null);
    try {
      const receipt = await provision.run(employeeId, input);
      if (receipt) completeProvision(receipt, input);
    } finally { provisionMutation.current = false; }
  }

  async function retryProvision() {
    if (provisionMutation.current || !provision.pending) return;
    const input = provision.pending.input;
    provisionMutation.current = true;
    setError(null);
    try {
      const receipt = await provision.retry();
      if (receipt) completeProvision(receipt, input);
    } finally { provisionMutation.current = false; }
  }

  async function handleRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account || selectedRoleIds.length === 0) return;
    const submittedRoleIds = [...selectedRoleIds];
    const result = await submitPatch(`/api/v1/accounts/${encodeURIComponent(account.id)}/roles`, { roleIds: submittedRoleIds }, (data) => {
      const receivedRoleIds = data.roleIds;
      if (data.accountId !== account.id || !Array.isArray(receivedRoleIds) || !receivedRoleIds.every((id) => typeof id === "string")
        || receivedRoleIds.length !== submittedRoleIds.length || new Set(receivedRoleIds).size !== submittedRoleIds.length
        || submittedRoleIds.some((id) => !receivedRoleIds.includes(id))) return null;
      return receivedRoleIds as string[];
    });
    if (result) {
      setAccount({ ...account, roleIds: result, roleNames: roles.filter((role) => result.includes(role.id)).map((role) => role.name) });
      setMode(null); router.refresh();
    }
  }

  async function handleStatusChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    const nextStatus = account.status === "active" ? "disabled" : "active";
    if (nextStatus === "disabled" && statusReason.trim().length < 3) {
      setError("Cần nhập lý do vô hiệu hóa từ 3 ký tự."); return;
    }
    const result = await submitPatch(`/api/v1/accounts/${encodeURIComponent(account.id)}/status`, {
      status: nextStatus, reason: nextStatus === "disabled" ? statusReason.trim() : undefined
    }, (data) => data.accountId === account.id && data.status === nextStatus ? nextStatus : null);
    if (result) { setAccount({ ...account, status: result }); setMode(null); router.refresh(); }
  }

  const reloadAction = requiresReload ? <Button onClick={() => window.location.reload()} variant="primary">Tải lại trang</Button> : null;
  const roleChoices = <RoleAccessSelector onToggle={toggleRole} roles={mode === "provision" ? provisionRoles : roles} selectedRoleIds={selectedRoleIds} />;
  const provisionError = error ?? provision.error;

  return (
    <>
      <div className="account-action-row">
        {!account && can(permissions, "account.create") ? (
          <Button disabled={submitting || requiresReload || provision.submitting} onClick={() => { clearError(); setMode("provision"); }} variant="primary">
            {provision.pending ? "Tiếp tục cấp tài khoản" : "Cấp tài khoản hệ thống"}
          </Button>
        ) : null}
        {account && can(permissions, "account.assign_role") ? (
          <Button disabled={actionsFrozen} onClick={() => { setSelectedRoleIds(normalizeEmployeeRoleIds(account.roleIds, roles)); clearError(); setMode("roles"); }}>Quản lý quyền truy cập</Button>
        ) : null}
        {account && account.status === "active" && can(permissions, "account.disable") ? (
          <Button disabled={actionsFrozen} onClick={() => { clearError(); setStatusReason(""); setMode("status"); }} variant="danger">Vô hiệu hóa</Button>
        ) : null}
        {account && account.status !== "active" && can(permissions, "account.enable") ? (
          <Button disabled={actionsFrozen} onClick={() => { clearError(); setMode("status"); }} variant="primary">Kích hoạt</Button>
        ) : null}
        {mode === null ? reloadAction : null}
      </div>
      {requiresReload && mode === null && error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}

      <Modal open={mode === "provision"} title={temporaryPassword ? "Tài khoản đã được tạo" : "Cấp tài khoản"} onClose={closeProvision}>
        {temporaryPassword ? (
          <div className="overlay-form secret-once">
            <h3>Mật khẩu tạm thời</h3><code>{temporaryPassword}</code>
            {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
            <Button leftIcon={copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />} onClick={() => void copyPassword()} variant="soft">{copied ? "Đã sao chép" : "Sao chép"}</Button>
            <footer><Button onClick={closeProvision} variant="primary">Hoàn tất</Button></footer>
          </div>
        ) : <form className="overlay-form" onSubmit={handleProvision}>
          {provisionError ? <div className="form-alert form-alert--error" role="alert">{provisionError}</div> : null}
          <fieldset className="account-form-group"><legend>Nhân viên</legend><Input label="Hồ sơ" readOnly value={employeeLabel} /></fieldset>
          <fieldset className="account-form-group account-form-group--two-columns" disabled={provisionFrozen}>
            <legend>Đăng nhập</legend>
            <Input autoCapitalize="none" autoComplete="username" defaultValue={provision.pending?.input.username ?? usernameSuggestion?.toLowerCase()} label="Tên tài khoản" maxLength={32} minLength={3} name="username" pattern={usernameHtmlPattern} required />
            <Input defaultValue={provision.pending?.input.loginPhone} label="Số điện thoại đăng nhập" name="loginPhone" />
            <PasswordInput autoComplete="new-password" defaultValue={provision.pending?.input.password} label="Mật khẩu ban đầu (không bắt buộc)" minLength={ACCOUNT_PASSWORD_MIN_LENGTH} name="password" pattern={ACCOUNT_PASSWORD_HTML_PATTERN} />
          </fieldset>
          <fieldset className="account-form-group" disabled={provisionFrozen}><legend>Quyền truy cập</legend>{roleChoices}</fieldset>
          <footer>
            <Button disabled={provision.submitting} onClick={closeProvision}>Hủy</Button>
            {provision.pending ? <Button busy={provision.submitting} disabled={provision.submitting} onClick={() => void retryProvision()} variant="primary">Thử lại</Button>
              : <Button disabled={provision.submitting || selectedRoleIds.length === 0} type="submit" variant="primary" busy={provision.submitting}>Cấp tài khoản</Button>}
          </footer>
        </form>}
      </Modal>

      <Modal open={mode === "roles"} title="Quản lý quyền truy cập" onClose={closeMutation}>
        <form className="overlay-form" onSubmit={handleRoles}>
          {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
          <fieldset className="account-form-group" disabled={submitting || requiresReload}>{roleChoices}</fieldset>
          <footer><Button disabled={submitting} onClick={closeMutation}>Hủy</Button>{reloadAction}<Button busy={submitting} disabled={submitting || requiresReload || selectedRoleIds.length === 0} type="submit" variant="primary">Lưu quyền truy cập</Button></footer>
        </form>
      </Modal>

      <Modal open={mode === "status"} title={account?.status === "active" ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"} onClose={closeMutation}>
        <form className="overlay-form" onSubmit={handleStatusChange}>
          {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
          {account?.status === "active" ? <Input disabled={submitting || requiresReload} label="Lý do" minLength={3} onChange={(event) => setStatusReason(event.target.value)} required value={statusReason} /> : null}
          <footer>
            <Button disabled={submitting} onClick={closeMutation}>Hủy</Button>{reloadAction}
            <Button busy={submitting} disabled={submitting || requiresReload} type="submit" variant={account?.status === "active" ? "danger" : "primary"}>{account?.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}</Button>
          </footer>
        </form>
      </Modal>
    </>
  );
}

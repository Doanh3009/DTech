"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Input, PasswordInput } from "@/components/shared/FormControls";
import { ConfirmDialog, Modal } from "@/components/shared/Overlays";
import { RoleAccessSelector } from "@/components/shared/RoleAccessSelector";
import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { ACCOUNT_PASSWORD_HTML_PATTERN, ACCOUNT_PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { usernameHtmlPattern } from "@/lib/auth/username";
import type { EmployeeAccountView } from "@/features/employees/types";
import { normalizeEmployeeRoleIds, toggleEmployeeRole } from "@/services/authorization/employeeAccessPolicy";
import type { RoleDefinition } from "@/services/authorization/rbacService";

interface EmployeeAccountActionsProps {
  employeeId: string;
  employeeLabel: string;
  usernameSuggestion?: string;
  account?: EmployeeAccountView;
  permissions: readonly Permission[];
  roles: RoleDefinition[];
}

export function EmployeeAccountActions({
  employeeId,
  employeeLabel,
  usernameSuggestion,
  account: initialAccount,
  permissions,
  roles
}: EmployeeAccountActionsProps) {
  const router = useRouter();
  const defaultRoleId = roles.find((role) => role.code === "employee")?.id ?? roles[0]?.id;
  const [account, setAccount] = useState(initialAccount);
  const [mode, setMode] = useState<"provision" | "roles" | "status" | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    normalizeEmployeeRoleIds(initialAccount?.roleIds ?? (defaultRoleId ? [defaultRoleId] : []), roles)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const mutation = useRef(false);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) => toggleEmployeeRole(current, roleId, roles));
  }

  function closeProvision() {
    if (mutation.current) return;
    const shouldRefresh = Boolean(temporaryPassword);
    setMode(null);
    setTemporaryPassword("");
    setCopied(false);
    if (shouldRefresh) router.refresh();
  }

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

  async function submitJson(url: string, method: "POST" | "PATCH", payload: unknown) {
    if (mutation.current) return null;
    mutation.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể cập nhật tài khoản.");
      return body.data as { account: EmployeeAccountView; temporaryPassword?: string };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng thử lại.");
      return null;
    } finally { mutation.current = false; setSubmitting(false); }
  }

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const result = await submitJson(`/api/v1/employees/${employeeId}/accounts`, "POST", {
      username: String(formData.get("username") ?? "").trim().toLowerCase(),
      password: password || undefined,
      loginPhone: String(formData.get("loginPhone") ?? "").trim() || undefined,
      roleIds: selectedRoleIds
    });
    if (result) {
      setAccount(result.account);
      if (result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      else { setMode(null); router.refresh(); }
    }
  }

  async function handleRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    const result = await submitJson(`/api/v1/accounts/${account.id}/roles`, "PATCH", {
      roleIds: selectedRoleIds
    });
    if (result) {
      setAccount(result.account);
      setMode(null);
      router.refresh();
    }
  }

  async function handleStatusChange() {
    if (!account) return;
    const nextStatus = account.status === "active" ? "disabled" : "active";
    const result = await submitJson(`/api/v1/accounts/${account.id}/status`, "PATCH", {
      status: nextStatus,
      reason: nextStatus === "disabled" ? statusReason : undefined
    });
    if (result) {
      setAccount(result.account);
      setMode(null);
      router.refresh();
    }
  }

  const roleChoices = <RoleAccessSelector onToggle={toggleRole} roles={roles} selectedRoleIds={selectedRoleIds} />;

  return (
    <>
      <div className="account-action-row">
        {!account && can(permissions, "account.create") ? (
          <Button onClick={() => { setError(null); setMode("provision"); }} variant="primary">
            Cấp tài khoản hệ thống
          </Button>
        ) : null}
        {account && can(permissions, "account.assign_role") ? (
          <Button
            onClick={() => {
              setSelectedRoleIds(normalizeEmployeeRoleIds(account.roleIds, roles));
              setError(null);
              setMode("roles");
            }}
          >
            Quản lý quyền truy cập
          </Button>
        ) : null}
        {account && account.status === "active" && can(permissions, "account.disable") ? (
          <Button onClick={() => { setError(null); setStatusReason(""); setMode("status"); }} variant="danger">
            Vô hiệu hóa
          </Button>
        ) : null}
        {account && account.status !== "active" && can(permissions, "account.enable") ? (
          <Button onClick={() => { setError(null); setMode("status"); }} variant="primary">
            Kích hoạt
          </Button>
        ) : null}
      </div>

      <Modal open={mode === "provision"} title={temporaryPassword ? "Tài khoản đã được tạo" : "Cấp tài khoản"} onClose={closeProvision}>
        {temporaryPassword ? <div className="overlay-form secret-once"><h3>Mật khẩu tạm thời</h3><code>{temporaryPassword}</code>{error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}<Button leftIcon={copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />} onClick={() => void copyPassword()} variant="soft">{copied ? "Đã sao chép" : "Sao chép"}</Button><footer><Button onClick={closeProvision} variant="primary">Hoàn tất</Button></footer></div> : <form className="overlay-form" onSubmit={handleProvision}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <fieldset className="account-form-group">
            <legend>Nhân viên</legend>
            <Input label="Hồ sơ" readOnly value={employeeLabel} />
          </fieldset>
          <fieldset className="account-form-group account-form-group--two-columns">
            <legend>Đăng nhập</legend>
            <Input autoCapitalize="none" autoComplete="username" defaultValue={usernameSuggestion?.toLowerCase()} label="Tên tài khoản" maxLength={32} minLength={3} name="username" pattern={usernameHtmlPattern} required />
            <Input label="Số điện thoại đăng nhập" name="loginPhone" />
            <PasswordInput autoComplete="new-password" label="Mật khẩu ban đầu (không bắt buộc)" minLength={ACCOUNT_PASSWORD_MIN_LENGTH} name="password" pattern={ACCOUNT_PASSWORD_HTML_PATTERN} />
          </fieldset>
          <fieldset className="account-form-group">
            <legend>Quyền truy cập</legend>
            {roleChoices}
          </fieldset>
          <footer>
            <Button disabled={submitting} onClick={closeProvision}>Hủy</Button>
            <Button disabled={submitting || selectedRoleIds.length === 0} type="submit" variant="primary" busy={submitting}>
              {submitting ? "Đang cấp" : "Cấp tài khoản"}
            </Button>
          </footer>
        </form>}
      </Modal>

      <Modal open={mode === "roles"} title="Quản lý quyền truy cập" onClose={() => { if (!submitting) setMode(null); }}>
        <form className="overlay-form" onSubmit={handleRoles}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          {roleChoices}
          <footer>
            <Button disabled={submitting} onClick={() => setMode(null)}>Hủy</Button>
            <Button busy={submitting} disabled={submitting || selectedRoleIds.length === 0} type="submit" variant="primary">
              {"Lưu quyền truy cập"}
            </Button>
          </footer>
        </form>
      </Modal>

      <ConfirmDialog
        confirmLabel={submitting ? "Đang xử lý…" : account?.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
        danger={account?.status === "active"}
        open={mode === "status"}
        title={account?.status === "active" ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"}
        onClose={() => { if (!submitting) setMode(null); }}
        onConfirm={handleStatusChange}
      >
        {error ? <div className="form-alert form-alert--error">{error}</div> : null}
        {account?.status === "active" ? (
          <Input
            label="Lý do"
            minLength={3}
            onChange={(event) => setStatusReason(event.target.value)}
            required
            value={statusReason}
          />
        ) : (
          <p>Xác nhận kích hoạt lại tài khoản.</p>
        )}
      </ConfirmDialog>
    </>
  );
}

"use client";

import { Check, Copy, KeyRound, Plus, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Input, PasswordInput, Select } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { RoleAccessSelector } from "@/components/shared/RoleAccessSelector";
import { ACCOUNT_PASSWORD_HTML_PATTERN, ACCOUNT_PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { usernameHtmlPattern } from "@/lib/auth/username";
import { toggleEmployeeRole } from "@/services/authorization/employeeAccessPolicy";
import type { RoleDefinition } from "@/services/authorization/rbacService";

import styles from "./AccessManagement.module.css";

interface EmployeeChoice {
  id: string;
  employeeCode: string;
  name: string;
}

interface CreatedCredentials {
  username: string;
  temporaryPassword?: string;
}

function suggestedUsername(employeeCode?: string) {
  const normalized = (employeeCode ?? "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return /^[a-z]/.test(normalized) ? normalized.slice(0, 32) : `nv.${normalized}`.slice(0, 32);
}

export function CreateUserAccountButton({ employees, roles }: { employees: EmployeeChoice[]; roles: RoleDefinition[] }) {
  const router = useRouter();
  const defaultRoleId = roles.find((role) => role.code === "employee")?.id ?? roles[0]?.id;
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(defaultRoleId ? [defaultRoleId] : []);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedCredentials>();
  const [copied, setCopied] = useState(false);
  const employee = useMemo(() => employees.find((item) => item.id === employeeId), [employeeId, employees]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) => toggleEmployeeRole(current, roleId, roles));
  }

  function close() {
    if (submitting) return;
    const shouldRefresh = Boolean(created);
    setOpen(false);
    setError("");
    setCreated(undefined);
    setCopied(false);
    if (shouldRefresh) router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || !selectedRoleIds.length) return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/employees/${employeeId}/accounts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: password || undefined, roleIds: selectedRoleIds })
      });
      const body = await response.json() as { data?: { temporaryPassword?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tạo tài khoản.");
      if (body.data?.temporaryPassword) {
        setCreated({ username, temporaryPassword: body.data.temporaryPassword });
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!created?.temporaryPassword) return;
    await navigator.clipboard.writeText(created.temporaryPassword);
    setCopied(true);
  }

  return <>
    <Button disabled={!employees.length || !roles.length} leftIcon={<Plus aria-hidden="true" size={17} />} onClick={() => setOpen(true)} variant="primary">Tạo tài khoản</Button>
    <Modal className={styles.accountModal} onClose={close} open={open} title={created ? "Tài khoản đã được tạo" : "Tạo tài khoản"}>
      {created ? (
        <div className={styles.credentialResult}>
          <span className={styles.successIcon}><Check aria-hidden="true" size={24} /></span>
          <dl>
            <div><dt>Tên tài khoản</dt><dd>{created.username}</dd></div>
            <div><dt>Mật khẩu tạm thời</dt><dd><code>{created.temporaryPassword}</code><Button aria-label="Sao chép mật khẩu" leftIcon={copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />} onClick={() => void copyPassword()} size="sm" variant="soft">{copied ? "Đã sao chép" : "Sao chép"}</Button></dd></div>
          </dl>
          <footer><Button onClick={close} variant="primary">Hoàn tất</Button></footer>
        </div>
      ) : (
        <form className={styles.accessForm} onSubmit={submit}>
          <section className={styles.formSection}>
            <h3><UserRound aria-hidden="true" size={18} /> Nhân sự</h3>
            <Select label="Nhân viên" name="employeeId" onChange={(event) => setEmployeeId(event.target.value)} options={employees.map((item) => ({ value: item.id, label: item.name }))} placeholder="Chọn nhân viên" required value={employeeId} />
          </section>
          <section className={styles.formSection}>
            <h3><KeyRound aria-hidden="true" size={18} /> Đăng nhập</h3>
            <div className={styles.twoColumns}>
              <Input autoCapitalize="none" autoComplete="username" defaultValue={suggestedUsername(employee?.employeeCode)} key={`username-${employeeId}`} label="Tên tài khoản" maxLength={32} minLength={3} name="username" pattern={usernameHtmlPattern} required />
              <PasswordInput autoComplete="new-password" helperText="Để trống để hệ thống tạo mật khẩu tạm thời." label="Mật khẩu ban đầu (không bắt buộc)" minLength={ACCOUNT_PASSWORD_MIN_LENGTH} name="password" pattern={ACCOUNT_PASSWORD_HTML_PATTERN} />
            </div>
          </section>
          <section className={styles.formSection}>
            <h3><ShieldCheck aria-hidden="true" size={18} /> Quyền truy cập</h3>
            <RoleAccessSelector onToggle={toggleRole} roles={roles} selectedRoleIds={selectedRoleIds} />
          </section>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <footer className={styles.formFooter}><Button onClick={close}>Hủy</Button><Button disabled={submitting || !employeeId || !selectedRoleIds.length} type="submit" variant="primary" busy={submitting}>{"Tạo tài khoản"}</Button></footer>
        </form>
      )}
    </Modal>
  </>;
}

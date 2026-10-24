"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DatePicker, Input } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { sensitiveProfilePatchSchema } from "@/features/employees/schemas/employeeSchemas";
import type { EmployeeSensitiveAllowedView } from "@/features/employees/types";
import styles from "./EmployeeAuxiliary.module.css";

const fields = ["nationalIdNumber", "nationalIdIssuedDate", "nationalIdIssuedPlace", "nationalIdExpiryDate", "bankName", "bankAccountNumber", "bankAccountHolder", "bankBranch", "personalTaxCode", "socialInsuranceCode"] as const;

export function EmployeeSensitiveEdit({ employeeId, rowVersion, profile }: { employeeId: string; rowVersion: number; profile: EmployeeSensitiveAllowedView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || reloadRequired) return;
    setError(null);
    const data = new FormData(event.currentTarget);
    const payload: Record<string, string | number | null> = { rowVersion, reason: String(data.get("reason") ?? "").trim() };
    for (const field of fields) {
      const next = String(data.get(field) ?? "").trim() || null;
      if (next !== (profile[field] || null)) payload[field] = next;
    }
    const result = sensitiveProfilePatchSchema.safeParse(payload);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/employees/${encodeURIComponent(employeeId)}/sensitive`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data), signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (response.status >= 500 || [401, 403, 409].includes(response.status)) setReloadRequired(true);
        setError(response.status >= 500 ? "Chưa xác định được kết quả lưu. Tải lại hồ sơ trước khi tiếp tục." : body.error?.message ?? "Không thể cập nhật thông tin nhạy cảm.");
        return;
      }
      if (body.data?.employeeId !== employeeId || body.data?.rowVersion !== rowVersion + 1) throw new Error("Unconfirmed command receipt");
      setReloadRequired(true);
      setOpen(false);
      router.refresh();
    } catch {
      setReloadRequired(true);
      setError("Chưa xác định được kết quả lưu. Tải lại hồ sơ trước khi tiếp tục.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button disabled={submitting || (reloadRequired && !error)} onClick={() => setOpen(true)} size="sm">Chỉnh sửa</Button>
      <Drawer open={open} title="Thông tin nhạy cảm" onClose={() => { if (!inFlight.current) setOpen(false); }}>
        <form className="overlay-form" onSubmit={handleSubmit}>
          {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
          <fieldset className={styles.fields} disabled={submitting || reloadRequired}>
            <legend className="sr-only">Thông tin nhạy cảm</legend>
            <Input defaultValue={profile.nationalIdNumber} label="Số CCCD/CMND" maxLength={12} name="nationalIdNumber" inputMode="numeric" />
            <DatePicker defaultValue={profile.nationalIdIssuedDate} label="Ngày cấp" name="nationalIdIssuedDate" />
            <Input defaultValue={profile.nationalIdIssuedPlace} label="Nơi cấp" maxLength={200} name="nationalIdIssuedPlace" />
            <DatePicker defaultValue={profile.nationalIdExpiryDate} label="Ngày hết hạn" name="nationalIdExpiryDate" />
            <Input defaultValue={profile.bankName} label="Ngân hàng" maxLength={200} name="bankName" />
            <Input defaultValue={profile.bankAccountNumber} label="Số tài khoản" maxLength={200} name="bankAccountNumber" />
            <Input defaultValue={profile.bankAccountHolder} label="Chủ tài khoản" maxLength={200} name="bankAccountHolder" />
            <Input defaultValue={profile.bankBranch} label="Chi nhánh" maxLength={200} name="bankBranch" />
            <Input defaultValue={profile.personalTaxCode} label="Mã số thuế" maxLength={200} name="personalTaxCode" />
            <Input defaultValue={profile.socialInsuranceCode} label="Mã BHXH" maxLength={200} name="socialInsuranceCode" />
            <Input label="Lý do thay đổi" maxLength={500} minLength={3} name="reason" required />
          </fieldset>
          <footer>
            <Button disabled={submitting} onClick={() => setOpen(false)}>Hủy</Button>
            {reloadRequired ? <Button onClick={() => window.location.reload()}>Tải lại hồ sơ</Button> : null}
            <Button disabled={submitting || reloadRequired} type="submit" variant="primary" busy={submitting}>Lưu</Button>
          </footer>
        </form>
      </Drawer>
    </>
  );
}

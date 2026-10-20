"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DatePicker, Input } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import type { EmployeeSensitiveAllowedView } from "@/features/employees/types";

export function EmployeeSensitiveEdit({ employeeId, profile }: { employeeId: string; profile: EmployeeSensitiveAllowedView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value).trim() || undefined])
    );
    const response = await fetch(`/api/v1/employees/${employeeId}/sensitive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    setSubmitting(false);
    if (!body.ok) {
      setError(body.error?.message ?? "Không thể cập nhật thông tin nhạy cảm.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">Chỉnh sửa</Button>
      <Drawer open={open} title="Thông tin nhạy cảm" onClose={() => setOpen(false)}>
        <form className="overlay-form" onSubmit={handleSubmit}>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <Input defaultValue={profile.nationalIdNumber} label="Số CCCD/CMND" name="nationalIdNumber" inputMode="numeric" />
          <DatePicker defaultValue={profile.nationalIdIssuedDate} label="Ngày cấp" name="nationalIdIssuedDate" />
          <Input defaultValue={profile.nationalIdIssuedPlace} label="Nơi cấp" name="nationalIdIssuedPlace" />
          <DatePicker defaultValue={profile.nationalIdExpiryDate} label="Ngày hết hạn" name="nationalIdExpiryDate" />
          <Input defaultValue={profile.bankName} label="Ngân hàng" name="bankName" />
          <Input defaultValue={profile.bankAccountNumber} label="Số tài khoản" name="bankAccountNumber" />
          <Input defaultValue={profile.bankAccountHolder} label="Chủ tài khoản" name="bankAccountHolder" />
          <Input defaultValue={profile.bankBranch} label="Chi nhánh" name="bankBranch" />
          <Input defaultValue={profile.personalTaxCode} label="Mã số thuế" name="personalTaxCode" />
          <Input defaultValue={profile.socialInsuranceCode} label="Mã BHXH" name="socialInsuranceCode" />
          <Input label="Lý do thay đổi" name="reason" required />
          <footer>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button disabled={submitting} type="submit" variant="primary" busy={submitting}>{"Lưu"}</Button>
          </footer>
        </form>
      </Drawer>
    </>
  );
}

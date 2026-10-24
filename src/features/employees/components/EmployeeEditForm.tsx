"use client";

import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DatePicker, Input, Select, Textarea } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { employeeStatusMeta } from "@/features/employees/services/employeeService";
import { patchEmployeeSchema } from "@/features/employees/schemas/employeeSchemas";
import type {
  Department,
  EmployeePickerOption,
  EmployeeRecord,
  EmploymentType,
  Position
} from "@/features/employees/types";
import styles from "./EmployeeCreateForm.module.css";

interface EmployeeEditFormProps {
  employee: EmployeeRecord;
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  managers: EmployeePickerOption[];
  canOffboard: boolean;
}

function value(formData: FormData, key: string): string | undefined {
  const text = String(formData.get(key) ?? "").trim();
  return text || undefined;
}

export function EmployeeEditForm({
  employee,
  departments,
  positions,
  employmentTypes,
  managers,
  canOffboard
}: EmployeeEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [employmentStatus, setEmploymentStatus] = useState(employee.employmentStatus);
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || reloadRequired) return;
    setError(null);
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string | number | null | undefined> = { rowVersion: employee.rowVersion };
    const fields = ["employeeCode", "fullName", "displayName", "dateOfBirth", "gender", "personalPhone", "personalEmail", "companyEmail", "departmentId", "positionId", "employmentTypeId", "managerEmployeeId", "joinDate", "probationStartDate", "probationEndDate", "officialDate", "currentAddress", "permanentAddress", "province", "contractorName", "note"] as const;
    for (const field of fields) {
      const next = value(formData, field) ?? null;
      if (next !== (employee[field] || null)) payload[field] = next;
    }
    if (employmentStatus !== employee.employmentStatus) payload.employmentStatus = employmentStatus;
    if (canOffboard && employmentStatus === "terminated") {
      for (const field of ["terminationDate", "terminationReason"] as const) {
        const next = value(formData, field) ?? null;
        if (next !== (employee[field] || null) || employee.employmentStatus !== "terminated") payload[field] = next;
      }
    }
    payload.reason = value(formData, "reason");
    const parsed = patchEmployeeSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (response.status >= 500 || response.status === 409) setReloadRequired(true);
        setError(response.status >= 500 ? "Chưa xác định được kết quả lưu. Tải lại hồ sơ trước khi tiếp tục." : body.error?.message ?? "Không thể cập nhật hồ sơ nhân sự.");
        return;
      }
      router.push(`/employees/${employee.id}/profile`);
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
    <form className={`employee-create-form ${styles.editForm}`} onSubmit={handleSubmit}>
      {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
      <fieldset className={styles.editFields} disabled={submitting || reloadRequired}>
      <legend className="sr-only">Hồ sơ nhân sự</legend>
      <FormSection title="Thông tin cơ bản">
        <Input defaultValue={employee.employeeCode} label="Mã nhân viên" name="employeeCode" required />
        <Input defaultValue={employee.fullName} label="Họ và tên" name="fullName" required />
        <Input defaultValue={employee.displayName} label="Tên hiển thị" name="displayName" />
        <DatePicker defaultValue={employee.dateOfBirth} label="Ngày sinh" name="dateOfBirth" />
        <Select defaultValue={employee.gender ?? ""} label="Giới tính" name="gender" options={[{ label: "Nam", value: "male" }, { label: "Nữ", value: "female" }, { label: "Khác", value: "other" }, { label: "Không khai báo", value: "undisclosed" }]} placeholder="Chưa có" />
        <Input defaultValue={employee.personalPhone} label="Số điện thoại" name="personalPhone" type="tel" />
        <Input defaultValue={employee.personalEmail} label="Email cá nhân" name="personalEmail" type="email" />
        <Input defaultValue={employee.companyEmail} label="Email công ty" name="companyEmail" type="email" />
      </FormSection>

      <FormSection title="Thông tin công việc">
        <Select defaultValue={employee.departmentId} label="Phòng ban" name="departmentId" options={departments.map((item) => ({ label: item.name, value: item.id }))} required />
        <Select defaultValue={employee.positionId} label="Chức vụ" name="positionId" options={positions.map((item) => ({ label: item.name, value: item.id }))} required />
        <Select defaultValue={employee.employmentTypeId} label="Nhóm làm việc" name="employmentTypeId" options={employmentTypes.map((item) => ({ label: item.name, value: item.id }))} required />
        <Select defaultValue={employee.managerEmployeeId ?? ""} label="Quản lý trực tiếp" name="managerEmployeeId" options={managers.map((item) => ({ label: item.displayName, value: item.id }))} placeholder="Chưa gán" />
        <DatePicker defaultValue={employee.joinDate} label="Ngày vào làm" name="joinDate" required />
        <DatePicker defaultValue={employee.probationStartDate} label="Ngày thử việc" name="probationStartDate" />
        <DatePicker defaultValue={employee.probationEndDate} label="Ngày kết thúc thử việc" name="probationEndDate" />
        <DatePicker defaultValue={employee.officialDate} label="Ngày chính thức" name="officialDate" />
        <Select label="Trạng thái" name="employmentStatus" onChange={(event) => setEmploymentStatus(event.target.value as EmployeeRecord["employmentStatus"])} options={Object.entries(employeeStatusMeta).filter(([status]) => employee.employmentStatus === "terminated" ? status === "terminated" : status !== "terminated" || canOffboard).map(([value, meta]) => ({ label: meta.label, value }))} required value={employmentStatus} />
        {employmentStatus === "terminated" ? <>
          <DatePicker defaultValue={employee.terminationDate} disabled={!canOffboard} label="Ngày nghỉ việc" name="terminationDate" required />
          <Input defaultValue={employee.terminationReason} disabled={!canOffboard} label="Lý do nghỉ việc" maxLength={500} minLength={3} name="terminationReason" required />
        </> : null}
        <Input label="Lý do thay đổi" maxLength={500} minLength={3} name="reason" />
      </FormSection>

      <FormSection columns={1} title="Liên hệ">
        <Input defaultValue={employee.currentAddress} label="Địa chỉ hiện tại" name="currentAddress" />
        <Input defaultValue={employee.permanentAddress} label="Địa chỉ thường trú" name="permanentAddress" />
        <Input defaultValue={employee.province} label="Tỉnh/Thành" name="province" />
        <Input defaultValue={employee.contractorName} label="Đơn vị / nhà thầu" name="contractorName" />
        <Textarea defaultValue={employee.note} label="Ghi chú" name="note" />
      </FormSection>
      </fieldset>

      <StickyActionBar>
        <Button disabled={submitting} onClick={() => router.back()}>Hủy</Button>
        {reloadRequired ? <Button onClick={() => window.location.reload()}>Tải lại hồ sơ</Button> : null}
        <Button disabled={submitting || reloadRequired} leftIcon={<Save aria-hidden="true" size={16} />} type="submit" variant="primary" busy={submitting}>
          {"Lưu thay đổi"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DatePicker, Input, Select, Textarea } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { employeeStatusMeta } from "@/features/employees/services/employeeService";
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
  managers
}: EmployeeEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const employmentStatus = value(formData, "employmentStatus");
    const payload = {
      employeeCode: value(formData, "employeeCode"),
      fullName: value(formData, "fullName"),
      displayName: value(formData, "displayName"),
      personalPhone: value(formData, "personalPhone"),
      personalEmail: value(formData, "personalEmail"),
      companyEmail: value(formData, "companyEmail"),
      departmentId: value(formData, "departmentId"),
      positionId: value(formData, "positionId"),
      employmentTypeId: value(formData, "employmentTypeId"),
      managerEmployeeId: value(formData, "managerEmployeeId"),
      probationStartDate: value(formData, "probationStartDate"),
      probationEndDate: value(formData, "probationEndDate"),
      officialDate: value(formData, "officialDate"),
      terminationDate: employmentStatus === "terminated" ? value(formData, "terminationDate") : undefined,
      terminationReason: employmentStatus === "terminated" ? value(formData, "reason") : undefined,
      employmentStatus,
      currentAddress: value(formData, "currentAddress"),
      province: value(formData, "province"),
      contractorName: value(formData, "contractorName"),
      note: value(formData, "note"),
      reason: value(formData, "reason"),
      rowVersion: employee.rowVersion
    };

    const response = await fetch(`/api/v1/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    setSubmitting(false);

    if (!body.ok) {
      setError(body.error?.message ?? "Không thể cập nhật hồ sơ nhân sự.");
      return;
    }

    router.push(`/employees/${employee.id}/profile`);
    router.refresh();
  }

  return (
    <form className={`employee-create-form ${styles.editForm}`} onSubmit={handleSubmit}>
      {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
      <FormSection title="Thông tin cơ bản">
        <Input defaultValue={employee.employeeCode} label="Mã nhân viên" name="employeeCode" required />
        <Input defaultValue={employee.fullName} label="Họ và tên" name="fullName" required />
        <Input defaultValue={employee.displayName} label="Tên hiển thị" name="displayName" />
        <Input defaultValue={employee.personalPhone} label="Số điện thoại" name="personalPhone" required type="tel" />
        <Input defaultValue={employee.personalEmail} label="Email cá nhân" name="personalEmail" type="email" />
        <Input defaultValue={employee.companyEmail} label="Email công ty" name="companyEmail" type="email" />
      </FormSection>

      <FormSection title="Thông tin công việc">
        <Select defaultValue={employee.departmentId} label="Phòng ban" name="departmentId" options={departments.map((item) => ({ label: item.name, value: item.id }))} required />
        <Select defaultValue={employee.positionId} label="Chức vụ" name="positionId" options={positions.map((item) => ({ label: item.name, value: item.id }))} required />
        <Select defaultValue={employee.employmentTypeId} label="Nhóm làm việc" name="employmentTypeId" options={employmentTypes.map((item) => ({ label: item.name, value: item.id }))} required />
        <Select defaultValue={employee.managerEmployeeId ?? ""} label="Quản lý trực tiếp" name="managerEmployeeId" options={managers.map((item) => ({ label: item.displayName, value: item.id }))} placeholder="Chưa gán" />
        <DatePicker defaultValue={employee.probationStartDate} label="Ngày thử việc" name="probationStartDate" />
        <DatePicker defaultValue={employee.probationEndDate} label="Ngày kết thúc thử việc" name="probationEndDate" />
        <DatePicker defaultValue={employee.officialDate} label="Ngày chính thức" name="officialDate" />
        <Select defaultValue={employee.employmentStatus} label="Trạng thái" name="employmentStatus" options={Object.entries(employeeStatusMeta).map(([value, meta]) => ({ label: meta.label, value }))} required />
        <DatePicker defaultValue={employee.terminationDate} label="Ngày nghỉ việc" name="terminationDate" />
        <Input defaultValue={employee.terminationReason} label="Lý do thay đổi/nghỉ việc" name="reason" />
      </FormSection>

      <FormSection columns={1} title="Liên hệ">
        <Input defaultValue={employee.currentAddress} label="Địa chỉ hiện tại" name="currentAddress" />
        <Input defaultValue={employee.province} label="Tỉnh/Thành" name="province" />
        <Input defaultValue={employee.contractorName} label="Đơn vị / nhà thầu" name="contractorName" />
        <Textarea defaultValue={employee.note} label="Ghi chú" name="note" />
      </FormSection>

      <StickyActionBar>
        <Button disabled={submitting} onClick={() => router.back()}>Hủy</Button>
        <Button disabled={submitting} leftIcon={<Save aria-hidden="true" size={16} />} type="submit" variant="primary" busy={submitting}>
          {"Lưu thay đổi"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

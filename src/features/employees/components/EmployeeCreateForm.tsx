"use client";

import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DatePicker, Input, Select, Textarea } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { ImageUploader } from "@/components/shared/ImageUploader";
import type { Department, EmployeePickerOption, EmploymentType, Position } from "@/features/employees/types";
import { employeeStatusMeta } from "@/features/employees/services/employeeService";

import styles from "./EmployeeCreateForm.module.css";

export interface EmployeeCreateFormProps {
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  managers: EmployeePickerOption[];
}

function readString(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : undefined;
}

export function EmployeeCreateForm({
  departments,
  positions,
  employmentTypes,
  managers
}: EmployeeCreateFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<File>();
  const [employeeId, setEmployeeId] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarnings([]);

    const formData = new FormData(event.currentTarget);
    const payload = {
      employeeCode: readString(formData, "employeeCode"),
      fullName: readString(formData, "fullName"),
      displayName: readString(formData, "displayName"),
      personalPhone: readString(formData, "personalPhone"),
      personalEmail: readString(formData, "personalEmail"),
      companyEmail: readString(formData, "companyEmail"),
      dateOfBirth: readString(formData, "dateOfBirth"),
      gender: readString(formData, "gender"),
      departmentId: readString(formData, "departmentId"),
      positionId: readString(formData, "positionId"),
      employmentTypeId: readString(formData, "employmentTypeId"),
      managerEmployeeId: readString(formData, "managerEmployeeId"),
      probationStartDate: readString(formData, "probationStartDate"),
      probationEndDate: readString(formData, "probationEndDate"),
      officialDate: readString(formData, "officialDate"),
      employmentStatus: readString(formData, "employmentStatus") ?? "active",
      currentAddress: readString(formData, "currentAddress"),
      permanentAddress: readString(formData, "permanentAddress"),
      province: readString(formData, "province"),
      maritalStatus: readString(formData, "maritalStatus"),
      nationalIdNumber: readString(formData, "nationalIdNumber"),
      nationalIdIssuedDate: readString(formData, "nationalIdIssuedDate"),
      nationalIdIssuedPlace: readString(formData, "nationalIdIssuedPlace"),
      personalTaxCode: readString(formData, "personalTaxCode"),
      emergencyContactName: readString(formData, "emergencyContactName"),
      emergencyContactPhone: readString(formData, "emergencyContactPhone"),
      emergencyContactRelation: readString(formData, "emergencyContactRelation"),
      note: readString(formData, "note")
    };

    try {
      let savedEmployeeId = employeeId;
      if (!savedEmployeeId) {
        const response = await fetch("/api/v1/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể tạo hồ sơ nhân sự.");
        savedEmployeeId = body.data.employee.id;
        setEmployeeId(savedEmployeeId);
        setWarnings(body.data.duplicateWarnings ?? []);
      }
      if (avatar) {
        const imageForm = new FormData();
        imageForm.set("file", avatar);
        const imageResponse = await fetch(`/api/v1/employees/${savedEmployeeId}/avatar`, { method: "POST", body: imageForm });
        const imageBody = await imageResponse.json();
        if (!imageResponse.ok || !imageBody.ok) throw new Error(imageBody.error?.message ?? "Không thể tải ảnh nhân viên.");
      }
      router.push(`/employees/${savedEmployeeId}/profile`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo hồ sơ nhân sự.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={`employee-create-form ${styles.form}`} onSubmit={handleSubmit}>
      {error || warnings.length > 0 ? (
        <div className={styles.alerts}>
          {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
          {warnings.length > 0 ? (
            <div className="form-alert form-alert--warning">
              {warnings.map(warning => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`${styles.sectionCard} ${styles.photoCard}`}>
        <FormSection columns={1} title="Ảnh nhân viên">
          <ImageUploader disabled={submitting} file={avatar} label="Chọn ảnh nhân viên" maxBytes={5 * 1024 * 1024} onFileChange={setAvatar} uploading={submitting && Boolean(avatar)} />
        </FormSection>
      </div>

      <div className={`${styles.sectionCard} ${styles.personalCard}`}>
        <FormSection title="Thông tin cá nhân">
          <Input label="Mã nhân viên" name="employeeCode" required />
          <Input label="Họ và tên" name="fullName" required />
          <Input label="Tên hiển thị" name="displayName" />
          <DatePicker label="Ngày sinh" name="dateOfBirth" />
          <Select label="Giới tính" name="gender" options={[{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }, { value: "other", label: "Khác" }, { value: "undisclosed", label: "Không cung cấp" }]} placeholder="Chưa cập nhật" />
          <Select label="Tình trạng hôn nhân" name="maritalStatus" options={[{ value: "single", label: "Độc thân" }, { value: "married", label: "Đã kết hôn" }, { value: "other", label: "Khác" }]} placeholder="Chưa cập nhật" />
          <Input label="Số điện thoại" name="personalPhone" type="tel" />
          <Input label="Email cá nhân" name="personalEmail" type="email" />
        </FormSection>
      </div>

      <div className={`${styles.sectionCard} ${styles.employmentCard}`}>
        <FormSection title="Thông tin công việc">
        <Select
          label="Phòng ban"
          name="departmentId"
          options={departments.map((department) => ({
            label: department.name,
            value: department.id
          }))}
          placeholder="Chọn phòng ban"
          required
        />
        <Select
          label="Chức vụ"
          name="positionId"
          options={positions.map((position) => ({
            label: position.name,
            value: position.id
          }))}
          placeholder="Chọn chức vụ"
          required
        />
        <Select
          label="Nhóm làm việc"
          name="employmentTypeId"
          options={employmentTypes.map((employmentType) => ({
            label: employmentType.name,
            value: employmentType.id
          }))}
          placeholder="Chọn nhóm làm việc"
          required
        />
        <Select
          label="Quản lý trực tiếp"
          name="managerEmployeeId"
          options={managers.map((manager) => ({
            label: manager.displayName,
            value: manager.id
          }))}
          placeholder="Chưa gán"
        />
        <DatePicker label="Ngày thử việc" name="probationStartDate" />
        <DatePicker label="Ngày kết thúc thử việc" name="probationEndDate" />
        <DatePicker label="Ngày chính thức" name="officialDate" />
        <Select
          label="Trạng thái"
          name="employmentStatus"
          options={Object.entries(employeeStatusMeta).map(([value, meta]) => ({
            label: meta.label,
            value
          }))}
          required
        />
        <Input label="Email công ty" name="companyEmail" type="email" />
        </FormSection>
      </div>

      <div className={`${styles.sectionCard} ${styles.contactCard}`}>
        <FormSection title="Liên hệ">
          <Input label="Địa chỉ hiện tại" name="currentAddress" />
          <Input label="Địa chỉ thường trú" name="permanentAddress" />
          <Input label="Tỉnh/Thành" name="province" />
          <Input label="Người liên hệ khẩn cấp" name="emergencyContactName" />
          <Input label="Quan hệ" name="emergencyContactRelation" />
          <Input label="Số điện thoại khẩn cấp" name="emergencyContactPhone" type="tel" />
        </FormSection>
      </div>

      <div className={`${styles.sectionCard} ${styles.additionalCard}`}>
        <FormSection columns={1} title="Thông tin bổ sung">
          <Input label="CCCD/CMND" name="nationalIdNumber" />
          <DatePicker label="Ngày cấp" name="nationalIdIssuedDate" />
          <Input label="Nơi cấp" name="nationalIdIssuedPlace" />
          <Input label="Mã số thuế cá nhân" name="personalTaxCode" />
          <Textarea label="Ghi chú" name="note" />
        </FormSection>
      </div>

      <StickyActionBar>
        <Button disabled={submitting} onClick={() => router.back()} type="button" variant="secondary">
          Hủy
        </Button>
        <Button
          disabled={submitting}
          leftIcon={<Save aria-hidden="true" size={16} />}
          type="submit"
          variant="primary"
         busy={submitting}>
          {"Lưu hồ sơ"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

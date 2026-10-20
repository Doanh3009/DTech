import { z } from "zod";

import { usernamePattern } from "@/lib/auth/username";
import { ACCOUNT_PASSWORD_MESSAGE, ACCOUNT_PASSWORD_PATTERN } from "@/lib/auth/passwordPolicy";

export const employeeStatusSchema = z.enum([
  "pending_onboarding",
  "probation",
  "active",
  "on_leave",
  "terminated"
]);

export const accountStatusSchema = z.enum([
  "pending_activation",
  "active",
  "disabled",
  "locked",
  "invited"
]);

const optionalText = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().min(1).optional()
);

const dateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD.");

const optionalDateText = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  dateText.optional()
);

const optionalEmail = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().email("Email chưa hợp lệ.").optional()
);

const pageNumber = z.coerce.number().int().positive().default(1);
const pageSizeNumber = z.coerce.number().int().min(1).max(100).default(10);

export const employeeListQuerySchema = z.object({
  q: optionalText,
  departmentId: optionalText,
  positionId: optionalText,
  employmentTypeId: optionalText,
  status: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    employeeStatusSchema.optional()
  ),
  page: pageNumber,
  pageSize: pageSizeNumber
});

const createEmployeeBaseSchema = z.object({
    employeeCode: z.string().trim().min(1, "Mã nhân viên là bắt buộc."),
    fullName: z.string().trim().min(2, "Họ và tên là bắt buộc."),
    displayName: optionalText,
    personalPhone: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.string().trim().min(8, "Số điện thoại chưa hợp lệ.").optional()
    ),
    personalEmail: optionalEmail,
    companyEmail: optionalEmail,
    dateOfBirth: optionalDateText,
    gender: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.enum(["male", "female", "other", "undisclosed"]).optional()
    ),
    departmentId: z.string().uuid("Phòng ban không hợp lệ."),
    positionId: z.string().uuid("Chức vụ không hợp lệ."),
    employmentTypeId: z.string().uuid("Nhóm làm việc không hợp lệ."),
    managerEmployeeId: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.string().uuid("Quản lý trực tiếp không hợp lệ.").optional()
    ),
    joinDate: optionalDateText,
    probationStartDate: optionalDateText,
    probationEndDate: optionalDateText,
    officialDate: optionalDateText,
    employmentStatus: employeeStatusSchema.default("active"),
    currentAddress: optionalText,
    permanentAddress: optionalText,
    province: optionalText,
    contractorName: optionalText,
    maritalStatus: optionalText,
    nationalIdNumber: optionalText,
    nationalIdIssuedDate: optionalDateText,
    nationalIdIssuedPlace: optionalText,
    personalTaxCode: optionalText,
    emergencyContactName: optionalText,
    emergencyContactPhone: optionalText,
    emergencyContactRelation: optionalText,
    note: optionalText
  });

export const createEmployeeSchema = createEmployeeBaseSchema
  .superRefine((value, context) => {
    const employmentStartDate = value.joinDate ?? value.probationStartDate ?? value.officialDate;
    if (value.officialDate && employmentStartDate && value.officialDate < employmentStartDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["officialDate"],
        message: "Ngày chính thức không được trước ngày vào làm."
      });
    }
    if (value.probationStartDate && value.probationEndDate && value.probationEndDate < value.probationStartDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["probationEndDate"], message: "Ngày kết thúc thử việc không được trước ngày bắt đầu." });
    }
    if (value.nationalIdNumber && !/^\d{9,12}$/.test(value.nationalIdNumber)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["nationalIdNumber"], message: "Số CCCD/CMND chưa hợp lệ." });
    }
  });

export const patchEmployeeSchema = createEmployeeBaseSchema
  .partial()
  .extend({
    rowVersion: z.coerce.number().int().positive().optional(),
    terminationDate: optionalDateText,
    terminationReason: optionalText,
    reason: optionalText
  })
  .superRefine((value, context) => {
    if (value.terminationDate && value.joinDate && value.terminationDate < value.joinDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terminationDate"],
        message: "Ngày nghỉ việc không được trước ngày vào làm."
      });
    }
    if (value.probationStartDate && value.probationEndDate && value.probationEndDate < value.probationStartDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["probationEndDate"], message: "Ngày kết thúc thử việc không được trước ngày bắt đầu." });
    }
  });

export const provisionAccountSchema = z.object({
  username: z.string().trim().toLowerCase().regex(usernamePattern, "Tên tài khoản không hợp lệ."),
  password: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().regex(ACCOUNT_PASSWORD_PATTERN, ACCOUNT_PASSWORD_MESSAGE).optional()
  ),
  loginEmail: optionalEmail,
  loginPhone: optionalText,
  roleIds: z.array(z.string().uuid("Vai trò không hợp lệ.")).min(1, "Cần chọn ít nhất một vai trò.")
}).strict();

export const accountStatusPatchSchema = z
  .object({
    status: accountStatusSchema,
    reason: optionalText
  })
  .superRefine((value, context) => {
    if (value.status === "disabled" && !value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Cần nhập lý do vô hiệu hóa tài khoản."
      });
    }
  });

export const accountRolesPatchSchema = z.object({
  roleIds: z.array(z.string().uuid("Vai trò không hợp lệ.")).min(1, "Cần chọn ít nhất một vai trò.")
});

export const archiveEmployeeSchema = z.object({
  reason: z.string().trim().min(3, "Cần nhập lý do lưu trữ.").max(500)
});

export const sensitiveProfilePatchSchema = z
  .object({
    nationalIdNumber: optionalText,
    nationalIdIssuedDate: optionalDateText,
    nationalIdIssuedPlace: optionalText,
    nationalIdExpiryDate: optionalDateText,
    bankName: optionalText,
    bankAccountNumber: optionalText,
    bankAccountHolder: optionalText,
    bankBranch: optionalText,
    personalTaxCode: optionalText,
    socialInsuranceCode: optionalText,
    reason: optionalText
  })
  .superRefine((value, context) => {
    if (value.nationalIdNumber && !/^\d{9,12}$/.test(value.nationalIdNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nationalIdNumber"],
        message: "Số CCCD/CMND chưa hợp lệ."
      });
    }
    if (value.nationalIdNumber && !value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Cần nhập lý do khi cập nhật CCCD."
      });
    }
    if (
      value.nationalIdIssuedDate &&
      value.nationalIdExpiryDate &&
      value.nationalIdExpiryDate < value.nationalIdIssuedDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nationalIdExpiryDate"],
        message: "Ngày hết hạn không được trước ngày cấp."
      });
    }
  });

export const employeeContractInputSchema = z.object({
  contractNumber: z.string().trim().min(2).max(80),
  contractType: z.string().trim().min(2).max(100),
  signedDate: optionalDateText,
  effectiveDate: dateText,
  endDate: optionalDateText,
  status: z.enum(["draft", "active", "expired", "terminated"]).default("draft"),
  note: optionalText
}).superRefine((value, context) => {
  if (value.endDate && value.endDate < value.effectiveDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "Ngày hết hạn không được trước ngày hiệu lực." });
  }
});

export const employeeContractUpdateSchema = employeeContractInputSchema.and(z.object({ rowVersion: z.coerce.number().int().positive() }));

const organizationCode = z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/, "Mã chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.");
const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().uuid().optional()
);

export const departmentInputSchema = z.object({
  code: organizationCode,
  name: z.string().trim().min(2).max(120),
  parentDepartmentId: optionalUuid,
  managerEmployeeId: optionalUuid,
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
}).strict();

export const positionInputSchema = z.object({
  code: organizationCode,
  name: z.string().trim().min(2).max(120),
  departmentId: optionalUuid,
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
}).strict();

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type PatchEmployeeInput = z.infer<typeof patchEmployeeSchema>;
export type ProvisionAccountInput = z.infer<typeof provisionAccountSchema>;
export type AccountStatusPatchInput = z.infer<typeof accountStatusPatchSchema>;
export type AccountRolesPatchInput = z.infer<typeof accountRolesPatchSchema>;
export type SensitiveProfilePatchInput = z.infer<typeof sensitiveProfilePatchSchema>;

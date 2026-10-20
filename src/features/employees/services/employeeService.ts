import { AppError } from "@/lib/api/errors";
import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import {
  departments,
  employeeAccounts,
  employeeContracts,
  employeeDocuments,
  employeeHistoryEvents,
  employeeRecords,
  emergencyContacts,
  employmentTypes,
  positions,
  sensitiveProfiles
} from "@/features/employees/data/employeeFixtures";
import type {
  AppAccountRecord,
  ContractStatus,
  Department,
  EmployeeAccountView,
  EmployeeContract,
  EmployeeDetail,
  EmployeeDocument,
  EmployeeDocumentType,
  EmployeeEmergencyContact,
  EmployeeHistoryEvent,
  EmployeeHistoryEventType,
  EmployeeListFilters,
  EmployeeListResult,
  EmployeePickerOption,
  EmployeeProfileStatus,
  EmployeeRecord,
  EmployeeSensitiveProfile,
  EmployeeSensitiveView,
  EmployeeSnapshot,
  EmployeeStatus,
  EmployeeSummary,
  EmploymentType,
  Position,
  WorkerCategory
} from "@/features/employees/types";
import type {
  CreateEmployeeInput,
  PatchEmployeeInput,
  ProvisionAccountInput,
  SensitiveProfilePatchInput
} from "@/features/employees/schemas/employeeSchemas";
import { assertNoAdminLockout, getEffectivePermissions, resolveRoleNames, roleCatalog, type RoleDefinition } from "@/services/authorization/rbacService";
import { normalizeEmployeeRoleIds, withEmployeeBaseline } from "@/services/authorization/employeeAccessPolicy";
import { getBusinessDateKey } from "@/lib/time/timezone";

export interface EmployeeDataSet {
  employees: EmployeeRecord[];
  departments: Department[];
  positions: Position[];
  employmentTypes: EmploymentType[];
  sensitiveProfiles: EmployeeSensitiveProfile[];
  emergencyContacts: EmployeeEmergencyContact[];
  contracts: EmployeeContract[];
  documents: EmployeeDocument[];
  history: EmployeeHistoryEvent[];
  accounts: AppAccountRecord[];
}

export interface CreateEmployeeResult {
  employee: EmployeeRecord;
  historyEvent: EmployeeHistoryEvent;
  duplicateWarnings: string[];
}

export interface EmployeeMutationResult {
  employee: EmployeeRecord;
  historyEvents: EmployeeHistoryEvent[];
}

export interface ProvisionAccountResult {
  account: AppAccountRecord;
  accountView: EmployeeAccountView;
  historyEvent: EmployeeHistoryEvent;
}

export const defaultEmployeeDataSet: EmployeeDataSet = {
  employees: employeeRecords,
  departments,
  positions,
  employmentTypes,
  sensitiveProfiles,
  emergencyContacts,
  contracts: employeeContracts,
  documents: employeeDocuments,
  history: employeeHistoryEvents,
  accounts: employeeAccounts
};

export const employeeStatusMeta: Record<
  EmployeeStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "error" | "info" }
> = {
  pending_onboarding: { label: "Chờ nhận việc", tone: "info" },
  probation: { label: "Đang thử việc", tone: "warning" },
  active: { label: "Đang làm việc", tone: "success" },
  on_leave: { label: "Tạm nghỉ", tone: "warning" },
  terminated: { label: "Nghỉ việc", tone: "error" }
};

export const employeeProfileStatusLabels: Record<EmployeeProfileStatus, string> = {
  pending_hr_completion: "Chờ HR hoàn thiện",
  complete: "Hoàn chỉnh",
  archived: "Lưu trữ"
};

export const workerCategoryLabels: Record<WorkerCategory, string> = {
  office: "Văn phòng",
  engineer: "Kỹ sư",
  supervisor: "Giám sát",
  worker: "Công nhân",
  seasonal: "Thời vụ",
  contractor: "Nhà thầu phụ",
  support: "Hỗ trợ"
};

export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "Nháp",
  active: "Đang hiệu lực",
  expired: "Hết hạn",
  terminated: "Chấm dứt"
};

export const documentTypeLabels: Record<EmployeeDocumentType, string> = {
  national_id: "CCCD",
  contract: "Hợp đồng",
  cv: "CV",
  degree: "Bằng cấp",
  certificate: "Chứng chỉ",
  health_check: "Giấy khám sức khỏe",
  other: "Tài liệu khác"
};

export const historyEventLabels: Record<EmployeeHistoryEventType, string> = {
  joined: "Gia nhập công ty",
  department_changed: "Thay đổi phòng ban",
  position_changed: "Thay đổi chức vụ",
  manager_changed: "Thay đổi quản lý trực tiếp",
  employment_type_changed: "Thay đổi loại nhân sự",
  probation_confirmed: "Thử việc sang chính thức",
  on_leave: "Tạm nghỉ",
  returned: "Quay lại làm",
  terminated: "Nghỉ việc",
  profile_updated: "Cập nhật hồ sơ",
  sensitive_updated: "Cập nhật thông tin nhạy cảm",
  account_provisioned: "Cấp tài khoản",
  account_disabled: "Vô hiệu hóa tài khoản",
  archived: "Lưu trữ hồ sơ"
};

function getNow(): string {
  return new Date().toISOString();
}

function optionalTrim(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+84")) {
    return `84${cleaned.slice(3)}`;
  }

  if (cleaned.startsWith("84")) {
    return cleaned;
  }

  if (cleaned.startsWith("0")) {
    return `84${cleaned.slice(1)}`;
  }

  return cleaned.replace(/[^\d]/g, "");
}

export function isValidPhone(phone: string): boolean {
  const normalizedPhone = normalizePhone(phone);
  return /^\d{8,15}$/.test(normalizedPhone);
}

export function maskSensitiveValue(value?: string, visibleDigits = 4): string {
  if (!value) {
    return "Chưa có";
  }

  const suffix = value.slice(-visibleDigits);
  return `${"*".repeat(Math.max(4, value.length - suffix.length))}${suffix}`;
}

export function findDepartment(
  departmentId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): Department | undefined {
  return dataSet.departments.find((department) => department.id === departmentId);
}

export function findPosition(
  positionId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): Position | undefined {
  return dataSet.positions.find((position) => position.id === positionId);
}

export function findEmploymentType(
  employmentTypeId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmploymentType | undefined {
  return dataSet.employmentTypes.find((employmentType) => employmentType.id === employmentTypeId);
}

export function findEmployee(
  employeeId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeRecord | undefined {
  return dataSet.employees.find((employee) => employee.id === employeeId);
}

export function findAccountForEmployee(
  employeeId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): AppAccountRecord | undefined {
  return dataSet.accounts.find((account) => account.employeeId === employeeId);
}

export function findEmployeeForAccount(
  accountId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeRecord | undefined {
  const account = dataSet.accounts.find((item) => item.id === accountId);
  if (!account?.employeeId) {
    return undefined;
  }

  return findEmployee(account.employeeId, dataSet);
}

export function toEmployeeAccountView(account: AppAccountRecord, roles: readonly RoleDefinition[] = roleCatalog): EmployeeAccountView {
  const roleIds = normalizeEmployeeRoleIds(account.roleIds, roles);
  return {
    id: account.id,
    employeeId: account.employeeId ?? "",
    displayName: account.displayName,
    username: account.username,
    loginEmail: account.loginEmail,
    loginPhone: account.loginPhone,
    employeeCodeIdentifier: account.employeeCodeIdentifier ?? "",
    status: account.status,
    roleIds,
    roleNames: resolveRoleNames(roleIds, roles),
    activatedAt: account.activatedAt,
    disabledAt: account.disabledAt,
    lastLoginAt: account.lastLoginAt
  };
}

export function buildEmployeeSummary(
  employee: EmployeeRecord,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeSummary {
  const department = findDepartment(employee.departmentId, dataSet);
  const position = findPosition(employee.positionId, dataSet);
  const employmentType = findEmploymentType(employee.employmentTypeId, dataSet);
  const statusMeta = employeeStatusMeta[employee.employmentStatus];

  return {
    id: employee.id,
    avatarAssetId: employee.avatarAssetId,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    displayName: employee.displayName ?? employee.fullName,
    departmentName: department?.name ?? "Không xác định",
    positionName: position?.name ?? "Không xác định",
    employmentTypeName: employmentType?.name ?? "Không xác định",
    workerCategory: employmentType?.workerCategory ?? "office",
    phone: employee.personalPhone,
    companyEmail: employee.companyEmail,
    joinDate: employee.joinDate,
    employmentStatus: employee.employmentStatus,
    employmentStatusLabel: statusMeta.label,
    employmentStatusTone: statusMeta.tone,
    profileStatus: employee.profileStatus,
    profileCompleteness: employee.profileCompleteness,
    hasAccount: Boolean(findAccountForEmployee(employee.id, dataSet))
  };
}

export function getEmployeeFilterOptions(dataSet: EmployeeDataSet = defaultEmployeeDataSet) {
  return {
    departments: dataSet.departments.filter((department) => department.active),
    positions: dataSet.positions.filter((position) => position.active),
    employmentTypes: dataSet.employmentTypes.filter((employmentType) => employmentType.active),
    statuses: Object.entries(employeeStatusMeta).map(([value, meta]) => ({
      value: value as EmployeeStatus,
      label: meta.label
    }))
  };
}

function employeeMatchesQuery(
  employee: EmployeeRecord,
  query: string | undefined,
  permissions: readonly Permission[],
  dataSet: EmployeeDataSet
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeSearch(query);
  const textFields = [
    employee.employeeCode,
    employee.fullName,
    employee.displayName,
    employee.personalPhone,
    employee.normalizedPhone,
    employee.personalEmail,
    employee.companyEmail,
    findDepartment(employee.departmentId, dataSet)?.name,
    findPosition(employee.positionId, dataSet)?.name
  ];

  if (textFields.some((value) => value && normalizeSearch(value).includes(normalizedQuery))) {
    return true;
  }

  if (!can(permissions, "employee.view_sensitive")) {
    return false;
  }

  const sensitive = dataSet.sensitiveProfiles.find((profile) => profile.employeeId === employee.id);
  const sensitiveFields = [
    sensitive?.nationalIdNumber,
    sensitive?.bankAccountNumber,
    sensitive?.personalTaxCode,
    sensitive?.socialInsuranceCode
  ];

  return sensitiveFields.some((value) => value && normalizeSearch(value).includes(normalizedQuery));
}

export function listEmployees(
  filters: EmployeeListFilters,
  permissions: readonly Permission[],
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeListResult {
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(Math.max(1, filters.pageSize), 100);

  const filteredEmployees = dataSet.employees
    .filter((employee) => employee.profileStatus !== "archived")
    .filter((employee) => employeeMatchesQuery(employee, filters.q, permissions, dataSet))
    .filter((employee) => !filters.departmentId || employee.departmentId === filters.departmentId)
    .filter((employee) => !filters.positionId || employee.positionId === filters.positionId)
    .filter((employee) => !filters.employmentTypeId || employee.employmentTypeId === filters.employmentTypeId)
    .filter((employee) => !filters.status || employee.employmentStatus === filters.status)
    .sort((first, second) => first.employeeCode.localeCompare(second.employeeCode));

  const total = filteredEmployees.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;

  return {
    items: filteredEmployees
      .slice(startIndex, startIndex + pageSize)
      .map((employee) => buildEmployeeSummary(employee, dataSet)),
    total,
    page,
    pageSize,
    pageCount,
    filters: {
      ...filters,
      page,
      pageSize
    }
  };
}

function getSensitiveView(
  employeeId: string,
  permissions: readonly Permission[],
  dataSet: EmployeeDataSet
): EmployeeSensitiveView {
  const sensitive = dataSet.sensitiveProfiles.find((profile) => profile.employeeId === employeeId);

  if (!can(permissions, "employee.view_sensitive")) {
    return {
      allowed: false,
      requiredPermission: "employee.view_sensitive"
    };
  }

  return {
    allowed: true,
    employeeId,
    updatedAt: sensitive?.updatedAt ?? "",
    nationalIdNumber: sensitive?.nationalIdNumber,
    nationalIdIssuedDate: sensitive?.nationalIdIssuedDate,
    nationalIdIssuedPlace: sensitive?.nationalIdIssuedPlace,
    nationalIdExpiryDate: sensitive?.nationalIdExpiryDate,
    nationalIdFrontFileId: sensitive?.nationalIdFrontFileId,
    nationalIdBackFileId: sensitive?.nationalIdBackFileId,
    bankName: sensitive?.bankName,
    bankAccountNumber: sensitive?.bankAccountNumber,
    bankAccountHolder: sensitive?.bankAccountHolder,
    bankBranch: sensitive?.bankBranch,
    personalTaxCode: sensitive?.personalTaxCode,
    socialInsuranceCode: sensitive?.socialInsuranceCode,
    updatedBy: sensitive?.updatedBy
  };
}

export function getEmployeeDetail(
  employeeId: string,
  permissions: readonly Permission[],
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeDetail | undefined {
  const employee = findEmployee(employeeId, dataSet);
  if (!employee) {
    return undefined;
  }

  const department = findDepartment(employee.departmentId, dataSet);
  const position = findPosition(employee.positionId, dataSet);
  const employmentType = findEmploymentType(employee.employmentTypeId, dataSet);

  if (!department || !position || !employmentType) {
    throw new AppError("SERVER_ERROR", "Hồ sơ nhân sự thiếu dữ liệu danh mục.");
  }

  return {
    summary: buildEmployeeSummary(employee, dataSet),
    profile: employee,
    department,
    position,
    employmentType,
    manager: employee.managerEmployeeId
      ? buildEmployeeSummary(findEmployee(employee.managerEmployeeId, dataSet) ?? employee, dataSet)
      : undefined,
    sensitive: getSensitiveView(employee.id, permissions, dataSet),
    emergencyContacts: dataSet.emergencyContacts.filter((contact) => contact.employeeId === employee.id),
    account: can(permissions, "account.view") && findAccountForEmployee(employee.id, dataSet)
      ? toEmployeeAccountView(findAccountForEmployee(employee.id, dataSet) as AppAccountRecord)
      : undefined
  };
}

export function getEmployeeHistory(
  employeeId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeHistoryEvent[] {
  return dataSet.history
    .filter((event) => event.employeeId === employeeId)
    .sort((first, second) => {
      const byDate = second.eventDate.localeCompare(first.eventDate);
      return byDate || second.createdAt.localeCompare(first.createdAt);
    });
}

export function getEmployeeContracts(
  employeeId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeContract[] {
  return dataSet.contracts
    .filter((contract) => contract.employeeId === employeeId)
    .sort((first, second) => second.startDate.localeCompare(first.startDate));
}

export function getEmployeeDocuments(
  employeeId: string,
  permissions: readonly Permission[],
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeDocument[] {
  const allowSensitive = can(permissions, "employee.view_sensitive");

  return dataSet.documents
    .filter((document) => document.employeeId === employeeId)
    .filter((document) => !document.deletedAt)
    .filter((document) => allowSensitive || !document.sensitive)
    .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt));
}

export function getEmployeePickerOptions(
  dataSet: EmployeeDataSet = defaultEmployeeDataSet,
  filters: {
    workerCategory?: WorkerCategory;
    activeOnly?: boolean;
    departmentId?: string;
    contractorName?: string;
  } = {}
): EmployeePickerOption[] {
  return dataSet.employees
    .filter((employee) => employee.profileStatus !== "archived")
    .filter((employee) => !filters.activeOnly || employee.employmentStatus === "active")
    .filter((employee) => !filters.departmentId || employee.departmentId === filters.departmentId)
    .map((employee) => buildEmployeeSummary(employee, dataSet))
    .filter((employee) => !filters.workerCategory || employee.workerCategory === filters.workerCategory)
    .map((employee) => ({
      id: employee.id,
      employeeCode: employee.employeeCode,
      displayName: employee.displayName,
      code: employee.employeeCode,
      name: employee.displayName,
      departmentName: employee.departmentName,
      positionName: employee.positionName,
      workerCategory: employee.workerCategory,
      employmentStatus: employee.employmentStatus
    }));
}

export function createEmployeeSnapshot(
  employee: EmployeeRecord,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet,
  capturedAt = getNow()
): EmployeeSnapshot {
  const summary = buildEmployeeSummary(employee, dataSet);

  return {
    employeeId: employee.id,
    employeeCode: summary.employeeCode,
    displayName: summary.displayName,
    departmentName: summary.departmentName,
    positionName: summary.positionName,
    employmentTypeName: summary.employmentTypeName,
    capturedAt
  };
}

export function computeProfileCompleteness(employee: EmployeeRecord): number {
  const fields = [
    employee.employeeCode,
    employee.fullName,
    employee.personalPhone,
    employee.departmentId,
    employee.positionId,
    employee.employmentTypeId,
    employee.joinDate,
    employee.employmentStatus,
    employee.companyEmail,
    employee.currentAddress,
    employee.officialDate,
    employee.managerEmployeeId
  ];

  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}

function assertEmployeeReferences(input: CreateEmployeeInput | PatchEmployeeInput, dataSet: EmployeeDataSet): void {
  if (input.departmentId && !findDepartment(input.departmentId, dataSet)) {
    throw new AppError("VALIDATION_ERROR", "Phòng ban không tồn tại.");
  }

  if (input.positionId && !findPosition(input.positionId, dataSet)) {
    throw new AppError("VALIDATION_ERROR", "Chức vụ không tồn tại.");
  }

  if (input.employmentTypeId && !findEmploymentType(input.employmentTypeId, dataSet)) {
    throw new AppError("VALIDATION_ERROR", "Nhóm làm việc không tồn tại.");
  }

  if (input.managerEmployeeId && !findEmployee(input.managerEmployeeId, dataSet)) {
    throw new AppError("VALIDATION_ERROR", "Quản lý trực tiếp không tồn tại.");
  }
}

function getDuplicateWarnings(input: CreateEmployeeInput, dataSet: EmployeeDataSet): string[] {
  const normalizedPhone = input.personalPhone ? normalizePhone(input.personalPhone) : undefined;
  const warnings: string[] = [];

  if (normalizedPhone && dataSet.employees.some((employee) => employee.normalizedPhone === normalizedPhone)) {
    warnings.push("Có thể đã tồn tại một hồ sơ dùng cùng số điện thoại.");
  }

  const email = optionalTrim(input.personalEmail)?.toLowerCase();
  const companyEmail = optionalTrim(input.companyEmail)?.toLowerCase();

  if (
    email &&
    dataSet.employees.some(
      (employee) =>
        employee.personalEmail?.toLowerCase() === email ||
        employee.companyEmail?.toLowerCase() === email
    )
  ) {
    warnings.push("Có thể đã tồn tại một hồ sơ dùng cùng email cá nhân.");
  }

  if (
    companyEmail &&
    dataSet.employees.some(
      (employee) =>
        employee.companyEmail?.toLowerCase() === companyEmail ||
        employee.personalEmail?.toLowerCase() === companyEmail
    )
  ) {
    warnings.push("Có thể đã tồn tại một hồ sơ dùng cùng email công ty.");
  }

  return warnings;
}

function createHistoryEvent({
  employeeId,
  eventType,
  eventDate,
  actorAccountId,
  before,
  after,
  reason
}: Omit<EmployeeHistoryEvent, "id" | "createdAt">): EmployeeHistoryEvent {
  return {
    id: globalThis.crypto.randomUUID(),
    employeeId,
    eventType,
    eventDate,
    actorAccountId,
    before,
    after,
    reason,
    createdAt: getNow()
  };
}

export function createEmployeeRecord(
  input: CreateEmployeeInput,
  actorAccountId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): CreateEmployeeResult {
  if (input.personalPhone && !isValidPhone(input.personalPhone)) {
    throw new AppError("VALIDATION_ERROR", "Số điện thoại chưa hợp lệ.");
  }

  if (
    dataSet.employees.some(
      (employee) => employee.employeeCode.toLowerCase() === input.employeeCode.toLowerCase()
    )
  ) {
    throw new AppError("CONFLICT", "Mã nhân viên đã tồn tại.");
  }

  assertEmployeeReferences(input, dataSet);

  const now = getNow();
  const employee: EmployeeRecord = {
    id: globalThis.crypto.randomUUID(),
    employeeCode: input.employeeCode,
    fullName: input.fullName,
    displayName: optionalTrim(input.displayName) ?? input.fullName,
    personalPhone: input.personalPhone ?? "",
    normalizedPhone: input.personalPhone ? normalizePhone(input.personalPhone) : "",
    personalEmail: optionalTrim(input.personalEmail),
    companyEmail: optionalTrim(input.companyEmail),
    currentAddress: optionalTrim(input.currentAddress),
    province: optionalTrim(input.province),
    country: "Việt Nam",
    departmentId: input.departmentId,
    positionId: input.positionId,
    employmentTypeId: input.employmentTypeId,
    managerEmployeeId: optionalTrim(input.managerEmployeeId),
    contractorName: optionalTrim(input.contractorName),
    joinDate: input.joinDate ?? input.probationStartDate ?? input.officialDate ?? getBusinessDateKey(now),
    probationStartDate: input.probationStartDate,
    probationEndDate: input.probationEndDate,
    officialDate: input.officialDate,
    employmentStatus: input.employmentStatus,
    profileStatus: "pending_hr_completion",
    profileCompleteness: 0,
    note: optionalTrim(input.note),
    createdBy: actorAccountId,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1
  };

  const completedEmployee = {
    ...employee,
    profileCompleteness: computeProfileCompleteness(employee)
  };
  const summary = buildEmployeeSummary(completedEmployee, {
    ...dataSet,
    employees: [completedEmployee, ...dataSet.employees]
  });
  const historyEvent = createHistoryEvent({
    employeeId: completedEmployee.id,
    eventType: "joined",
    eventDate: completedEmployee.joinDate,
    actorAccountId,
    after: {
      employeeCode: completedEmployee.employeeCode,
      departmentName: summary.departmentName,
      positionName: summary.positionName,
      employmentTypeName: summary.employmentTypeName,
      employmentStatus: completedEmployee.employmentStatus
    },
    reason: "Tạo hồ sơ nhân sự"
  });

  return {
    employee: completedEmployee,
    historyEvent,
    duplicateWarnings: getDuplicateWarnings(input, dataSet)
  };
}

export function updateEmployeeSensitiveProfile(
  employee: EmployeeRecord,
  currentProfile: EmployeeSensitiveProfile | undefined,
  input: SensitiveProfilePatchInput,
  actorAccountId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): { profile: EmployeeSensitiveProfile; historyEvent: EmployeeHistoryEvent } {
  if (
    input.nationalIdNumber &&
    dataSet.sensitiveProfiles.some(
      (profile) =>
        profile.employeeId !== employee.id &&
        profile.nationalIdNumber === input.nationalIdNumber
    )
  ) {
    throw new AppError("CONFLICT", "Số CCCD/CMND đã thuộc hồ sơ khác.");
  }

  const now = getNow();
  const profile: EmployeeSensitiveProfile = {
    employeeId: employee.id,
    nationalIdNumber: input.nationalIdNumber ?? currentProfile?.nationalIdNumber,
    nationalIdIssuedDate: input.nationalIdIssuedDate ?? currentProfile?.nationalIdIssuedDate,
    nationalIdIssuedPlace: input.nationalIdIssuedPlace ?? currentProfile?.nationalIdIssuedPlace,
    nationalIdExpiryDate: input.nationalIdExpiryDate ?? currentProfile?.nationalIdExpiryDate,
    nationalIdFrontFileId: currentProfile?.nationalIdFrontFileId,
    nationalIdBackFileId: currentProfile?.nationalIdBackFileId,
    bankName: input.bankName ?? currentProfile?.bankName,
    bankAccountNumber: input.bankAccountNumber ?? currentProfile?.bankAccountNumber,
    bankAccountHolder: input.bankAccountHolder ?? currentProfile?.bankAccountHolder,
    bankBranch: input.bankBranch ?? currentProfile?.bankBranch,
    personalTaxCode: input.personalTaxCode ?? currentProfile?.personalTaxCode,
    socialInsuranceCode: input.socialInsuranceCode ?? currentProfile?.socialInsuranceCode,
    updatedBy: actorAccountId,
    updatedAt: now
  };

  return {
    profile,
    historyEvent: createHistoryEvent({
      employeeId: employee.id,
      eventType: "sensitive_updated",
      eventDate: now.slice(0, 10),
      actorAccountId,
      before: { hasNationalId: Boolean(currentProfile?.nationalIdNumber), hasBankAccount: Boolean(currentProfile?.bankAccountNumber) },
      after: { hasNationalId: Boolean(profile.nationalIdNumber), hasBankAccount: Boolean(profile.bankAccountNumber) },
      reason: input.reason
    })
  };
}

function historyForChangedField({
  eventType,
  employee,
  actorAccountId,
  beforeValue,
  afterValue,
  reason
}: {
  eventType: EmployeeHistoryEventType;
  employee: EmployeeRecord;
  actorAccountId: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason?: string;
}): EmployeeHistoryEvent | undefined {
  if (beforeValue === afterValue) {
    return undefined;
  }

  return createHistoryEvent({
    employeeId: employee.id,
    eventType,
    eventDate: getNow().slice(0, 10),
    actorAccountId,
    before: { value: beforeValue },
    after: { value: afterValue },
    reason
  });
}

export function updateEmployeeProfile(
  employee: EmployeeRecord,
  input: PatchEmployeeInput,
  actorAccountId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): EmployeeMutationResult {
  if (input.rowVersion && input.rowVersion !== employee.rowVersion) {
    throw new AppError(
      "CONFLICT",
      "Dữ liệu vừa được cập nhật bởi người khác. Vui lòng tải lại trước khi lưu."
    );
  }

  if (input.personalPhone && !isValidPhone(input.personalPhone)) {
    throw new AppError("VALIDATION_ERROR", "Số điện thoại chưa hợp lệ.");
  }

  if (input.managerEmployeeId && input.managerEmployeeId === employee.id) {
    throw new AppError("VALIDATION_ERROR", "Nhân viên không thể tự làm quản lý trực tiếp.");
  }

  if (
    input.employeeCode &&
    dataSet.employees.some(
      (item) =>
        item.id !== employee.id &&
        item.employeeCode.toLowerCase() === input.employeeCode?.toLowerCase()
    )
  ) {
    throw new AppError("CONFLICT", "Mã nhân viên đã tồn tại.");
  }

  if (input.managerEmployeeId) {
    const visited = new Set<string>([employee.id]);
    let managerId: string | undefined = input.managerEmployeeId;

    while (managerId) {
      if (visited.has(managerId)) {
        throw new AppError("VALIDATION_ERROR", "Phân công quản lý tạo thành vòng lặp.");
      }

      visited.add(managerId);
      managerId = findEmployee(managerId, dataSet)?.managerEmployeeId;
    }
  }

  assertEmployeeReferences(input, dataSet);

  if (input.terminationDate && input.terminationDate < (input.joinDate ?? employee.joinDate)) {
    throw new AppError("VALIDATION_ERROR", "Ngày nghỉ việc không được trước ngày vào làm.");
  }

  const nextJoinDate = input.joinDate ?? employee.joinDate;
  const nextProbationStartDate = input.probationStartDate ?? employee.probationStartDate;
  const nextProbationEndDate = input.probationEndDate ?? employee.probationEndDate;
  if (nextProbationStartDate && nextProbationEndDate && nextProbationEndDate < nextProbationStartDate) {
    throw new AppError("VALIDATION_ERROR", "Ngày kết thúc thử việc không được trước ngày bắt đầu.");
  }
  const nextOfficialDate = input.officialDate ?? employee.officialDate;
  if (nextOfficialDate && nextOfficialDate < nextJoinDate) {
    throw new AppError("VALIDATION_ERROR", "Ngày chính thức không được trước ngày vào làm.");
  }

  const updatedEmployee: EmployeeRecord = {
    ...employee,
    employeeCode: input.employeeCode ?? employee.employeeCode,
    fullName: input.fullName ?? employee.fullName,
    displayName: input.displayName ?? employee.displayName,
    personalPhone: input.personalPhone ?? employee.personalPhone,
    normalizedPhone: input.personalPhone ? normalizePhone(input.personalPhone) : employee.normalizedPhone,
    personalEmail: input.personalEmail ?? employee.personalEmail,
    companyEmail: input.companyEmail ?? employee.companyEmail,
    currentAddress: input.currentAddress ?? employee.currentAddress,
    province: input.province ?? employee.province,
    departmentId: input.departmentId ?? employee.departmentId,
    positionId: input.positionId ?? employee.positionId,
    employmentTypeId: input.employmentTypeId ?? employee.employmentTypeId,
    managerEmployeeId: input.managerEmployeeId ?? employee.managerEmployeeId,
    contractorName: input.contractorName ?? employee.contractorName,
    joinDate: input.joinDate ?? employee.joinDate,
    probationStartDate: input.probationStartDate ?? employee.probationStartDate,
    probationEndDate: input.probationEndDate ?? employee.probationEndDate,
    officialDate: input.officialDate ?? employee.officialDate,
    terminationDate: input.terminationDate ?? employee.terminationDate,
    terminationReason: input.terminationReason ?? employee.terminationReason,
    employmentStatus: input.employmentStatus ?? employee.employmentStatus,
    note: input.note ?? employee.note,
    updatedAt: getNow(),
    rowVersion: employee.rowVersion + 1
  };

  const dataWithUpdatedEmployee = {
    ...dataSet,
    employees: dataSet.employees.map((item) => (item.id === employee.id ? updatedEmployee : item))
  };
  const employeeWithCompleteness = {
    ...updatedEmployee,
    profileCompleteness: computeProfileCompleteness(updatedEmployee)
  };
  const historyEvents = [
    historyForChangedField({
      eventType: "department_changed",
      employee,
      actorAccountId,
      beforeValue: buildEmployeeSummary(employee, dataSet).departmentName,
      afterValue: buildEmployeeSummary(employeeWithCompleteness, dataWithUpdatedEmployee).departmentName,
      reason: input.reason
    }),
    historyForChangedField({
      eventType: "position_changed",
      employee,
      actorAccountId,
      beforeValue: buildEmployeeSummary(employee, dataSet).positionName,
      afterValue: buildEmployeeSummary(employeeWithCompleteness, dataWithUpdatedEmployee).positionName,
      reason: input.reason
    }),
    historyForChangedField({
      eventType: "manager_changed",
      employee,
      actorAccountId,
      beforeValue: employee.managerEmployeeId,
      afterValue: employeeWithCompleteness.managerEmployeeId,
      reason: input.reason
    }),
    historyForChangedField({
      eventType: "employment_type_changed",
      employee,
      actorAccountId,
      beforeValue: buildEmployeeSummary(employee, dataSet).employmentTypeName,
      afterValue: buildEmployeeSummary(employeeWithCompleteness, dataWithUpdatedEmployee).employmentTypeName,
      reason: input.reason
    }),
    historyForChangedField({
      eventType: employeeWithCompleteness.employmentStatus === "terminated" ? "terminated" : "profile_updated",
      employee,
      actorAccountId,
      beforeValue: employee.employmentStatus,
      afterValue: employeeWithCompleteness.employmentStatus,
      reason: input.reason
    })
  ].filter((event): event is EmployeeHistoryEvent => Boolean(event));

  if (historyEvents.length === 0) {
    historyEvents.push(
      createHistoryEvent({
        employeeId: employee.id,
        eventType: "profile_updated",
        eventDate: getNow().slice(0, 10),
        actorAccountId,
        before: {
          rowVersion: employee.rowVersion
        },
        after: {
          rowVersion: employeeWithCompleteness.rowVersion
        },
        reason: input.reason
      })
    );
  }

  return {
    employee: employeeWithCompleteness,
    historyEvents
  };
}

export function archiveEmployee(
  employee: EmployeeRecord,
  actorAccountId: string,
  reason?: string
): EmployeeMutationResult {
  const archivedEmployee: EmployeeRecord = {
    ...employee,
    profileStatus: "archived",
    updatedAt: getNow(),
    rowVersion: employee.rowVersion + 1
  };

  return {
    employee: archivedEmployee,
    historyEvents: [
      createHistoryEvent({
        employeeId: employee.id,
        eventType: "archived",
        eventDate: getNow().slice(0, 10),
        actorAccountId,
        before: { profileStatus: employee.profileStatus },
        after: { profileStatus: archivedEmployee.profileStatus },
        reason
      })
    ]
  };
}

export function offboardEmployee({
  employee,
  account,
  terminationDate,
  reason,
  actorAccountId
}: {
  employee: EmployeeRecord;
  account?: AppAccountRecord;
  terminationDate: string;
  reason?: string;
  actorAccountId: string;
}): {
  employee: EmployeeRecord;
  account?: AppAccountRecord;
  historyEvents: EmployeeHistoryEvent[];
} {
  if (terminationDate < employee.joinDate) {
    throw new AppError("VALIDATION_ERROR", "Ngày nghỉ việc không được trước ngày vào làm.");
  }

  const updatedEmployee: EmployeeRecord = {
    ...employee,
    terminationDate,
    terminationReason: reason,
    employmentStatus: "terminated",
    updatedAt: getNow(),
    rowVersion: employee.rowVersion + 1
  };
  const historyEvents = [
    createHistoryEvent({
      employeeId: employee.id,
      eventType: "terminated",
      eventDate: terminationDate,
      actorAccountId,
      before: {
        employmentStatus: employee.employmentStatus,
        terminationDate: employee.terminationDate
      },
      after: {
        employmentStatus: updatedEmployee.employmentStatus,
        terminationDate
      },
      reason
    })
  ];

  if (!account) {
    return {
      employee: updatedEmployee,
      historyEvents
    };
  }

  return {
    employee: updatedEmployee,
    account: {
      ...account,
      status: "disabled",
      disabledAt: getNow(),
      updatedAt: getNow()
    },
    historyEvents: [
      ...historyEvents,
      createHistoryEvent({
        employeeId: employee.id,
        eventType: "account_disabled",
        eventDate: terminationDate,
        actorAccountId,
        before: { status: account.status },
        after: { status: "disabled" },
        reason: reason ?? "Offboarding"
      })
    ]
  };
}

export function provisionAccountForEmployee(
  employee: EmployeeRecord,
  input: ProvisionAccountInput,
  actorAccountId: string,
  dataSet: EmployeeDataSet = defaultEmployeeDataSet
): ProvisionAccountResult {
  if (findAccountForEmployee(employee.id, dataSet)) {
    throw new AppError("CONFLICT", "Nhân sự này đã có tài khoản hệ thống.");
  }

  const unknownRoleIds = input.roleIds.filter((roleId) => !roleCatalog.some((role) => role.id === roleId));
  if (unknownRoleIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "Vai trò không hợp lệ.", { unknownRoleIds });
  }

  const loginEmail = input.loginEmail ?? employee.companyEmail ?? employee.personalEmail;
  const loginPhone = input.loginPhone ?? employee.personalPhone;
  const now = getNow();
  const account: AppAccountRecord = {
    id: globalThis.crypto.randomUUID(),
    employeeId: employee.id,
    displayName: employee.displayName ?? employee.fullName,
    username: input.username,
    loginEmail,
    loginPhone,
    employeeCodeIdentifier: employee.employeeCode,
    status: "active",
    roleIds: Array.from(new Set(input.roleIds)),
    activatedAt: now,
    createdAt: now,
    updatedAt: now
  };

  return {
    account,
    accountView: toEmployeeAccountView(account),
    historyEvent: createHistoryEvent({
      employeeId: employee.id,
      eventType: "account_provisioned",
      eventDate: now.slice(0, 10),
      actorAccountId,
      after: {
        accountId: account.id,
        status: account.status,
        roleIds: account.roleIds
      },
      reason: "Cấp tài khoản hệ thống"
    })
  };
}

export function updateAccountStatus(
  accounts: readonly AppAccountRecord[],
  accountId: string,
  status: AppAccountRecord["status"],
  actorAccountId: string,
  reason?: string
): {
  account: AppAccountRecord;
  historyEvent?: EmployeeHistoryEvent;
} {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) {
    throw new AppError("NOT_FOUND", "Không tìm thấy tài khoản.");
  }

  assertNoAdminLockout({
    accounts: accounts.map((item) => ({
      accountId: item.id,
      status: item.status,
      roleIds: item.roleIds
    })),
    targetAccountId: accountId,
    nextStatus: status
  });

  const now = getNow();
  const updatedAccount: AppAccountRecord = {
    ...account,
    status,
    disabledAt: status === "disabled" ? now : account.disabledAt,
    activatedAt: status === "active" ? now : account.activatedAt,
    updatedAt: now
  };

  return {
    account: updatedAccount,
    historyEvent: account.employeeId
      ? createHistoryEvent({
          employeeId: account.employeeId,
          eventType: status === "disabled" ? "account_disabled" : "profile_updated",
          eventDate: now.slice(0, 10),
          actorAccountId,
          before: { status: account.status },
          after: { status },
          reason
        })
      : undefined
  };
}

export function updateAccountRoles(
  accounts: readonly AppAccountRecord[],
  accountId: string,
  roleIds: readonly string[]
): { account: AppAccountRecord; previousRoleIds: string[] } {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) {
    throw new AppError("NOT_FOUND", "Không tìm thấy tài khoản.");
  }

  const uniqueRoleIds = Array.from(new Set(roleIds));
  if (uniqueRoleIds.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Cần chọn ít nhất một vai trò.");
  }

  const unknownRoleIds = uniqueRoleIds.filter(
    (roleId) => !roleCatalog.some((role) => role.id === roleId)
  );
  if (unknownRoleIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "Vai trò không hợp lệ.", { unknownRoleIds });
  }

  assertNoAdminLockout({
    accounts: accounts.map((item) => ({
      accountId: item.id,
      status: item.status,
      roleIds: item.roleIds
    })),
    targetAccountId: accountId,
    nextRoleIds: uniqueRoleIds
  });

  return {
    account: {
      ...account,
      roleIds: uniqueRoleIds,
      updatedAt: getNow()
    },
    previousRoleIds: account.roleIds
  };
}

export function listAccounts(
  dataSet: EmployeeDataSet = defaultEmployeeDataSet,
  roles: readonly RoleDefinition[] = roleCatalog
): Array<EmployeeAccountView & { employeeName?: string; effectivePermissions: Permission[] }> {
  return dataSet.accounts.map((account) => {
    const employee = account.employeeId ? findEmployee(account.employeeId, dataSet) : undefined;

    return {
      ...toEmployeeAccountView(account, roles),
      employeeName: employee?.fullName,
      effectivePermissions: account.employeeId
        ? withEmployeeBaseline(getEffectivePermissions(account.roleIds, roles))
        : getEffectivePermissions(account.roleIds, roles)
    };
  });
}

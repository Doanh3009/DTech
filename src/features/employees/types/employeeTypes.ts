import type { AccountStatus, Permission } from "@/lib/auth/permissions";
import type { StatusBadgeTone } from "@/components/shared/StatusBadge";

export type EmployeeGender = "male" | "female" | "other" | "undisclosed";

export type EmployeeStatus =
  | "pending_onboarding"
  | "probation"
  | "active"
  | "on_leave"
  | "terminated";

export type EmployeeProfileStatus = "pending_hr_completion" | "complete" | "archived";

export type WorkerCategory =
  | "office"
  | "engineer"
  | "supervisor"
  | "worker"
  | "seasonal"
  | "contractor"
  | "support";

export type ContractStatus = "draft" | "active" | "expired" | "terminated";

export type EmployeeDocumentType =
  | "national_id"
  | "contract"
  | "cv"
  | "degree"
  | "certificate"
  | "health_check"
  | "other";

export type EmployeeHistoryEventType =
  | "joined"
  | "department_changed"
  | "position_changed"
  | "manager_changed"
  | "employment_type_changed"
  | "probation_confirmed"
  | "on_leave"
  | "returned"
  | "terminated"
  | "profile_updated"
  | "sensitive_updated"
  | "account_provisioned"
  | "account_disabled"
  | "archived";

export interface Department {
  id: string;
  code: string;
  name: string;
  parentDepartmentId?: string;
  managerEmployeeId?: string;
  active: boolean;
  sortOrder: number;
}

export interface Position {
  id: string;
  code: string;
  name: string;
  departmentId?: string;
  active: boolean;
  sortOrder: number;
}

export interface EmploymentType {
  id: string;
  code: string;
  name: string;
  workerCategory: WorkerCategory;
  active: boolean;
  sortOrder: number;
}

export interface EmployeeRecord {
  id: string;
  employeeCode: string;
  fullName: string;
  displayName?: string;
  dateOfBirth?: string;
  gender?: EmployeeGender;
  avatarAssetId?: string;
  personalPhone: string;
  normalizedPhone: string;
  personalEmail?: string;
  companyEmail?: string;
  currentAddress?: string;
  permanentAddress?: string;
  province?: string;
  ward?: string;
  country: string;
  departmentId: string;
  positionId: string;
  employmentTypeId: string;
  managerEmployeeId?: string;
  contractorName?: string;
  joinDate: string;
  probationStartDate?: string;
  probationEndDate?: string;
  officialDate?: string;
  terminationDate?: string;
  terminationReason?: string;
  employmentStatus: EmployeeStatus;
  profileStatus: EmployeeProfileStatus;
  profileCompleteness: number;
  note?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface EmployeeSensitiveProfile {
  employeeId: string;
  nationalIdNumber?: string;
  nationalIdIssuedDate?: string;
  nationalIdIssuedPlace?: string;
  nationalIdExpiryDate?: string;
  nationalIdFrontFileId?: string;
  nationalIdBackFileId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankBranch?: string;
  personalTaxCode?: string;
  socialInsuranceCode?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface EmployeeEmergencyContact {
  id: string;
  employeeId: string;
  fullName: string;
  relation: string;
  phone: string;
  note?: string;
  isPrimary: boolean;
}

export interface EmployeeContract {
  id: string;
  employeeId: string;
  contractNumber: string;
  contractType: string;
  signedDate?: string;
  effectiveDate?: string;
  startDate: string;
  endDate?: string;
  status: ContractStatus;
  attachmentFileId?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  templateId?: string;
  fileVersions?: Array<{ fileId: string; fileName: string; mimeType?: string; uploadedAt: string }>;
  note?: string;
  archivedAt?: string;
  rowVersion?: number;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  documentType: EmployeeDocumentType;
  title: string;
  fileId: string;
  issuedDate?: string;
  expiryDate?: string;
  note?: string;
  sensitive: boolean;
  uploadedBy: string;
  uploadedAt: string;
  deletedAt?: string;
}

export interface EmployeeHistoryEvent {
  id: string;
  employeeId: string;
  eventType: EmployeeHistoryEventType;
  eventDate: string;
  actorAccountId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

export interface EmployeeAccountView {
  id: string;
  employeeId: string;
  displayName: string;
  username?: string;
  loginEmail?: string;
  loginPhone?: string;
  employeeCodeIdentifier: string;
  status: AccountStatus;
  roleIds: string[];
  roleNames: string[];
  activatedAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
}

export interface EmployeeSummary {
  id: string;
  avatarAssetId?: string;
  employeeCode: string;
  fullName: string;
  displayName: string;
  departmentName: string;
  positionName: string;
  employmentTypeName: string;
  workerCategory: WorkerCategory;
  phone: string;
  companyEmail?: string;
  joinDate: string;
  employmentStatus: EmployeeStatus;
  employmentStatusLabel: string;
  employmentStatusTone: StatusBadgeTone;
  profileStatus: EmployeeProfileStatus;
  profileCompleteness: number;
  hasAccount: boolean;
}

export interface EmployeeSensitiveDeniedView {
  allowed: false;
  requiredPermission: Permission;
}

export interface EmployeeSensitiveAllowedView extends EmployeeSensitiveProfile {
  allowed: true;
}

export type EmployeeSensitiveView = EmployeeSensitiveAllowedView | EmployeeSensitiveDeniedView;

export interface EmployeeDetail {
  summary: EmployeeSummary;
  profile: EmployeeRecord;
  department: Department;
  position: Position;
  employmentType: EmploymentType;
  manager?: EmployeeSummary;
  sensitive: EmployeeSensitiveView;
  emergencyContacts: EmployeeEmergencyContact[];
  account?: EmployeeAccountView;
}

export interface EmployeeListFilters {
  q?: string;
  departmentId?: string;
  positionId?: string;
  employmentTypeId?: string;
  status?: EmployeeStatus;
  page: number;
  pageSize: number;
}

export interface EmployeeListResult {
  items: EmployeeSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: EmployeeListFilters;
}

export interface EmployeePickerOption {
  id: string;
  employeeCode: string;
  displayName: string;
  code?: string;
  name?: string;
  departmentName: string;
  positionName: string;
  workerCategory: WorkerCategory;
  employmentStatus: EmployeeStatus;
}

export interface EmployeeSnapshot {
  employeeId: string;
  employeeCode: string;
  displayName: string;
  departmentName: string;
  positionName: string;
  employmentTypeName: string;
  capturedAt: string;
}

export interface AppAccountRecord {
  id: string;
  employeeId?: string;
  displayName: string;
  username?: string;
  loginEmail?: string;
  loginPhone?: string;
  employeeCodeIdentifier?: string;
  status: AccountStatus;
  roleIds: string[];
  activatedAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

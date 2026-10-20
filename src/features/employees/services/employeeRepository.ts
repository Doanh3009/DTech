import "server-only";

import {
  archiveEmployee,
  createEmployeeRecord,
  defaultEmployeeDataSet,
  findAccountForEmployee,
  findEmployee,
  offboardEmployee,
  provisionAccountForEmployee,
  updateAccountRoles,
  updateAccountStatus,
  updateEmployeeProfile,
  updateEmployeeSensitiveProfile,
  type CreateEmployeeResult,
  type EmployeeDataSet,
  type ProvisionAccountResult
} from "@/features/employees/services/employeeService";
import { AppError } from "@/lib/api/errors";
import type {
  AppAccountRecord,
  EmployeeContract,
  EmployeeDocument,
  EmployeeEmergencyContact,
  EmployeeHistoryEvent,
  EmployeeRecord,
  EmployeeSensitiveProfile
} from "@/features/employees/types";
import type {
  AccountStatusPatchInput,
  CreateEmployeeInput,
  PatchEmployeeInput,
  ProvisionAccountInput,
  SensitiveProfilePatchInput
} from "@/features/employees/schemas/employeeSchemas";
import { getEmployeeDataSetFromSupabase } from "@/features/employees/services/employeeSupabaseRepository";
import { assertNoAdminLockout } from "@/services/authorization/rbacService";

let employees: EmployeeRecord[] = [...defaultEmployeeDataSet.employees];
let sensitiveProfiles: EmployeeSensitiveProfile[] = [...defaultEmployeeDataSet.sensitiveProfiles];
const emergencyContacts: EmployeeEmergencyContact[] = [...defaultEmployeeDataSet.emergencyContacts];
const contracts: EmployeeContract[] = [...defaultEmployeeDataSet.contracts];
const documents: EmployeeDocument[] = [...defaultEmployeeDataSet.documents];
let history: EmployeeHistoryEvent[] = [...defaultEmployeeDataSet.history];
let accounts: AppAccountRecord[] = [...defaultEmployeeDataSet.accounts];

export function getEmployeeDataSet(): EmployeeDataSet {
  return {
    ...defaultEmployeeDataSet,
    employees,
    sensitiveProfiles,
    emergencyContacts,
    contracts,
    documents,
    history,
    accounts
  };
}

export async function getEmployeeDataSetAsync(): Promise<EmployeeDataSet> {
  const persisted = await getEmployeeDataSetFromSupabase();
  if (persisted) return persisted;
  if (process.env.NODE_ENV === "test") return getEmployeeDataSet();
  throw new AppError("SERVER_ERROR", "Kho dữ liệu nhân sự chưa được cấu hình.");
}

export function createEmployeeInRepository(
  input: CreateEmployeeInput,
  actorAccountId: string
): CreateEmployeeResult {
  const result = createEmployeeRecord(input, actorAccountId, getEmployeeDataSet());
  employees = [result.employee, ...employees];
  history = [result.historyEvent, ...history];

  return result;
}

export function provisionAccountInRepository(
  employeeId: string,
  input: ProvisionAccountInput,
  actorAccountId: string
): ProvisionAccountResult {
  const dataSet = getEmployeeDataSet();
  const employee = findEmployee(employeeId, dataSet);
  if (!employee) {
    throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
  }

  const result = provisionAccountForEmployee(employee, input, actorAccountId, dataSet);
  accounts = [result.account, ...accounts];
  history = [result.historyEvent, ...history];

  return result;
}

export function patchEmployeeInRepository(
  employeeId: string,
  input: PatchEmployeeInput,
  actorAccountId: string
) {
  const dataSet = getEmployeeDataSet();
  const employee = findEmployee(employeeId, dataSet);
  if (!employee) {
    throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
  }

  if (input.employmentStatus === "terminated" && input.terminationDate) {
    const account = findAccountForEmployee(employeeId, dataSet);
    if (account) {
      assertNoAdminLockout({
        accounts: accounts.map((item) => ({
          accountId: item.id,
          status: item.status,
          roleIds: item.roleIds
        })),
        targetAccountId: account.id,
        nextStatus: "disabled"
      });
    }

    const result = offboardEmployee({
      employee,
      account,
      terminationDate: input.terminationDate,
      reason: input.reason ?? input.terminationReason,
      actorAccountId
    });

    employees = employees.map((item) => (item.id === employeeId ? result.employee : item));

    if (result.account) {
      accounts = accounts.map((account) => (account.id === result.account?.id ? result.account : account));
    }

    history = [...result.historyEvents, ...history];

    return result;
  }

  const result = updateEmployeeProfile(employee, input, actorAccountId, dataSet);
  employees = employees.map((item) => (item.id === employeeId ? result.employee : item));
  history = [...result.historyEvents, ...history];

  return result;
}

export function archiveEmployeeInRepository(
  employeeId: string,
  actorAccountId: string,
  reason?: string
) {
  const employee = findEmployee(employeeId, getEmployeeDataSet());
  if (!employee) {
    throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
  }

  const result = archiveEmployee(employee, actorAccountId, reason);
  employees = employees.map((item) => (item.id === employeeId ? result.employee : item));
  history = [...result.historyEvents, ...history];
  return result;
}

export function updateAccountStatusInRepository(
  accountId: string,
  input: AccountStatusPatchInput,
  actorAccountId: string
) {
  const result = updateAccountStatus(accounts, accountId, input.status, actorAccountId, input.reason);
  accounts = accounts.map((account) => (account.id === accountId ? result.account : account));

  if (result.historyEvent) {
    history = [result.historyEvent, ...history];
  }

  return result;
}

export function getAccountForEmployeeFromRepository(employeeId: string): AppAccountRecord | undefined {
  return findAccountForEmployee(employeeId, getEmployeeDataSet());
}

export function updateAccountRolesInRepository(accountId: string, roleIds: string[]) {
  const result = updateAccountRoles(accounts, accountId, roleIds);
  accounts = accounts.map((account) => (account.id === accountId ? result.account : account));
  return result;
}

export function updateSensitiveProfileInRepository(
  employeeId: string,
  input: SensitiveProfilePatchInput,
  actorAccountId: string
) {
  const dataSet = getEmployeeDataSet();
  const employee = findEmployee(employeeId, dataSet);
  if (!employee) throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
  const currentProfile = sensitiveProfiles.find((profile) => profile.employeeId === employeeId);
  const result = updateEmployeeSensitiveProfile(employee, currentProfile, input, actorAccountId, dataSet);
  sensitiveProfiles = currentProfile
    ? sensitiveProfiles.map((profile) => (profile.employeeId === employeeId ? result.profile : profile))
    : [...sensitiveProfiles, result.profile];
  history = [result.historyEvent, ...history];
  return result;
}

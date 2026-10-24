"use client";

import Link from "next/link";

import { Worklist, type DataTableColumn } from "@/components/shared/DataTable";
import { Avatar } from "@/components/shared/Avatar";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArchiveEmployeeButton } from "@/features/employees/components/ArchiveEmployeeButton";
import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import type { EmployeeSummary } from "@/features/employees/types";

function columnsFor(): DataTableColumn<EmployeeSummary>[] {
  return [
  {
    id: "fullName",
    header: "Họ tên",
    priority: "primary",
    cell: (employee) => (
      <span className="employee-name-with-avatar">
        <Avatar imageUrl={employee.avatarAssetId ? `/api/v1/employees/${employee.id}/avatar` : undefined} loading="lazy" name={employee.fullName} />
        <span className="employee-name-cell">
          <Link className="table-link" href={`/employees/${encodeURIComponent(employee.id)}/profile`}><strong>{employee.fullName}</strong></Link>
          {(employee.companyEmail ?? employee.displayName)?.trim() && (employee.companyEmail ?? employee.displayName)?.trim() !== employee.fullName.trim() ? <small title={employee.companyEmail ?? employee.displayName}>{employee.companyEmail ?? employee.displayName}</small> : null}
        </span>
      </span>
    )
  },
  {
    id: "departmentName",
    header: "Phòng ban",
    accessor: "departmentName",
    hiddenOnMobile: true
  },
  {
    id: "positionName",
    header: "Chức vụ",
    accessor: "positionName",
    hiddenOnMobile: true
  },
  {
    id: "employmentTypeName",
    header: "Nhóm",
    accessor: "employmentTypeName"
  },
  {
    id: "phone",
    header: "Số điện thoại",
    width: "compact",
    accessor: "phone",
    hiddenOnMobile: true
  },
  {
    id: "employmentStatus",
    header: "Trạng thái",
    width: "standard",
    cell: (employee) => (
      <StatusBadge tone={employee.employmentStatusTone}>{employee.employmentStatusLabel}</StatusBadge>
    )
  }
  ];
}

export interface EmployeeListTableProps {
  employees: EmployeeSummary[];
  permissions: readonly Permission[];
}

function EmployeeRowActions({ employee, permissions }: { employee: EmployeeSummary; permissions: readonly Permission[] }) {
  const renderMenu = (onArchive?: () => void) => (
    <DropdownMenu label={`Thao tác ${employee.fullName}`} mobileTriggerLabel="Thao tác">
      <Link href={`/employees/${encodeURIComponent(employee.id)}/profile`}>Xem hồ sơ</Link>
      <PermissionGate permissions={permissions} require="employee.edit">
        <Link href={`/employees/${encodeURIComponent(employee.id)}/edit`}>Chỉnh sửa</Link>
      </PermissionGate>
      <PermissionGate permissions={permissions} require="account.view">
        <Link href={`/employees/${encodeURIComponent(employee.id)}/account`}>Tài khoản</Link>
      </PermissionGate>
      {onArchive ? <button onClick={onArchive} type="button">Lưu trữ</button> : null}
    </DropdownMenu>
  );

  return can(permissions, "employee.archive")
    ? <ArchiveEmployeeButton key={`${employee.id}:${employee.rowVersion}`} employeeId={employee.id} rowVersion={employee.rowVersion} renderTrigger={renderMenu} />
    : renderMenu();
}

export function EmployeeListTable({ employees, permissions }: EmployeeListTableProps) {
  return (
    <Worklist
      ariaLabel="Danh sách nhân viên"
      className="employee-table"
      actions={(employee) => <EmployeeRowActions employee={employee} permissions={permissions} />}
      columns={columnsFor()}
      data={employees}
      emptyDescription=""
      emptyTitle="Chưa có nhân viên"
      getRowId={(employee) => employee.id}
      rowHrefPrefix="/employees/"
      rowHrefSuffix="/profile"
    />
  );
}

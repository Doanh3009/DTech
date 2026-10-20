"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteUserAccountButton } from "@/features/settings/components/DeleteUserAccountButton";
import type { listAccounts } from "@/features/employees/services/employeeService";

type AccountRow = ReturnType<typeof listAccounts>[number];

const accountStatusLabels: Record<AccountRow["status"], string> = {
  pending_activation: "Chờ kích hoạt",
  active: "Đang hoạt động",
  disabled: "Đã vô hiệu hóa",
  locked: "Đã khóa",
  invited: "Đã gửi lời mời"
};

function accountColumns(canDelete: boolean, currentAccountId: string): DataTableColumn<AccountRow>[] {
  return [
  {
    id: "displayName",
    header: "Tài khoản",
    cell: (account) => (
      <span className="employee-name-cell">
        <strong>{account.displayName}</strong>
        {account.username ? <small>{account.username}</small> : null}
      </span>
    )
  },
  {
    id: "employee",
    header: "Hồ sơ nhân sự",
    cell: (account) => account.employeeName ?? "Chưa liên kết"
  },
  {
    id: "roles",
    header: "Vai trò",
    cell: (account) => account.roleNames.join(", ")
  },
  {
    id: "effectivePermissions",
    header: "Quyền hiệu lực",
    cell: (account) => `${account.effectivePermissions.length} quyền`
  },
  {
    id: "status",
    header: "Trạng thái",
    cell: (account) => (
      <StatusBadge tone={account.status === "active" ? "success" : "warning"}>
        {accountStatusLabels[account.status]}
      </StatusBadge>
    )
  },
  ...(canDelete ? [{
    id: "actions",
    header: "Thao tác",
    align: "right" as const,
    cell: (account: AccountRow) => account.id === currentAccountId ? null : <DeleteUserAccountButton accountId={account.id} accountName={account.displayName} />
  }] : [])
  ];
}

export function UserAccountsTable({ accounts, canDelete, currentAccountId }: { accounts: AccountRow[]; canDelete: boolean; currentAccountId: string }) {
  return <DataTable columns={accountColumns(canDelete, currentAccountId)} data={accounts} getRowId={(account) => account.id} />;
}

import { Plus } from "lucide-react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { ListToolbar } from "@/features/foundation/components/ListToolbar";
import type { Permission } from "@/lib/auth/permissions";

interface PlaceholderPageProps {
  title: string;
  description: string;
  moduleName: string;
  listPattern?: boolean;
  primaryActionLabel?: string;
  primaryActionPermission?: Permission;
  dateRangeFilter?: boolean;
  permissions?: readonly Permission[];
}

interface PlaceholderRow {
  code: string;
  name: string;
  status: string;
}

const columns: DataTableColumn<PlaceholderRow>[] = [
  { id: "code", header: "Mã", accessor: "code", sortable: true },
  { id: "name", header: "Tên", accessor: "name" },
  { id: "status", header: "Trạng thái", accessor: "status", hiddenOnMobile: true }
];

export function PlaceholderPage({
  title,
  moduleName,
  listPattern = false,
  primaryActionLabel,
  primaryActionPermission = "settings.view",
  dateRangeFilter = true,
  permissions = []
}: PlaceholderPageProps) {
  return (
    <div className="page-stack">
      <PageHeader
        action={
          primaryActionLabel ? (
            <PermissionGate permissions={permissions} require={primaryActionPermission}>
              <Button leftIcon={<Plus aria-hidden="true" size={16} />} variant="primary">
                {primaryActionLabel}
              </Button>
            </PermissionGate>
          ) : null
        }
        title={title}
      />
      {listPattern ? (
        <>
          <ListToolbar columns={columns} dateRange={dateRangeFilter} moduleName={moduleName} />
          <DataTable
            columns={columns}
            data={[]}
            emptyDescription="Dữ liệu sẽ hiển thị tại đây sau khi kết nối nghiệp vụ."
            emptyTitle={`Chưa có dữ liệu ${moduleName.toLowerCase()}`}
          />
          <Pagination page={1} pageCount={1} />
        </>
      ) : (
        <DataTable
          columns={columns}
          data={[]}
          emptyDescription="Nội dung sẽ hiển thị tại đây sau khi kết nối nghiệp vụ."
          emptyTitle={moduleName}
        />
      )}
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { ResponsivePageHeader } from "@/components/shared/PageHeader";
import { ListPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar } from "@/components/shared/Avatar";
import { Inspector, WorkbenchLayout, WorkCanvas } from "@/components/shared/Workbench";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { PermissionDeniedState } from "@/components/shared/States";
import { can } from "@/lib/auth/permissions";
import { employeeListQuerySchema } from "@/features/employees/schemas/employeeSchemas";
import { EmployeeListTable } from "@/features/employees/components/EmployeeListTable";
import { EmployeeListFilters } from "@/features/employees/components/EmployeeListFilters";
import {
  employeeStatusMeta,
  getEmployeeFilterOptions,
  listEmployees
} from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { getEmployeeListFromSupabase } from "@/features/employees/services/employeeSupabaseRepository";
import { getRequestUser } from "@/services/auth/getRequestUser";

export interface EmployeeListPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildFilters(searchParams: EmployeeListPageProps["searchParams"]) {
  const parsed = employeeListQuerySchema.safeParse({
    q: firstParam(searchParams.q),
    departmentId: firstParam(searchParams.departmentId),
    positionId: firstParam(searchParams.positionId),
    employmentTypeId: firstParam(searchParams.employmentTypeId),
    status: firstParam(searchParams.status),
    page: firstParam(searchParams.page),
    pageSize: firstParam(searchParams.pageSize)
  });

  return parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 10
      };
}

function pageHref(
  filters: ReturnType<typeof buildFilters>,
  page: number
): string {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.positionId) params.set("positionId", filters.positionId);
  if (filters.employmentTypeId) params.set("employmentTypeId", filters.employmentTypeId);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(page));
  params.set("pageSize", String(filters.pageSize));

  return `/employees?${params.toString()}`;
}

function selectionHref(filters: ReturnType<typeof buildFilters>, employeeId?: string): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.positionId) params.set("positionId", filters.positionId);
  if (filters.employmentTypeId) params.set("employmentTypeId", filters.employmentTypeId);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (employeeId) params.set("selected", employeeId);
  return `/employees?${params.toString()}`;
}

export async function EmployeeListPage({ searchParams }: EmployeeListPageProps) {
  const user = await getRequestUser();

  if (!user || !can(user.permissions, "employee.view")) {
    return <PermissionDeniedState />;
  }

  const filters = buildFilters(searchParams);
  const persisted = await getEmployeeListFromSupabase(filters, user.permissions);
  const fallback = persisted ? null : await getEmployeeDataSetAsync();
  const result = persisted?.employees ?? listEmployees(filters, user.permissions, fallback!);
  const filterOptions = persisted?.filterOptions ?? getEmployeeFilterOptions(fallback!);
  const selectedId = firstParam(searchParams.selected);
  const selectedEmployee = result.items.find((employee) => employee.id === selectedId);
  const firstRecord = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastRecord = Math.min(result.page * result.pageSize, result.total);

  return (
    <ListPageLayout>
      <ResponsivePageHeader
        action={
          <PermissionGate permissions={user.permissions} require="employee.create">
            <Link className="button button--primary button--md" href="/employees/new">
              <span className="button__icon">
                <Plus aria-hidden="true" size={16} />
              </span>
              <span>Thêm nhân viên</span>
            </Link>
          </PermissionGate>
        }
        title="Nhân viên"
      />

      <WorkbenchLayout className={selectedEmployee ? "employee-roster" : "employee-roster workbench-layout--solo"}>
        <WorkCanvas className="employee-roster__canvas">
          <header className="employee-roster__heading"><h2>Danh sách nhân viên</h2><span>{firstRecord}–{lastRecord} / {result.total} bản ghi</span></header>
          <EmployeeListFilters
            defaults={filters}
            departments={filterOptions.departments.map((item) => ({ label: item.name, value: item.id }))}
            employmentTypes={filterOptions.employmentTypes.map((item) => ({ label: item.name, value: item.id }))}
            positions={filterOptions.positions.map((item) => ({ label: item.name, value: item.id }))}
            statuses={Object.entries(employeeStatusMeta).map(([value, meta]) => ({ label: meta.label, value }))}
          />
          <div className="list-summary-bar"><span>{result.total} hồ sơ</span></div>
          <EmployeeListTable employees={result.items} permissions={user.permissions} />
          <footer className="employee-table-footer">
            <span>{firstRecord}–{lastRecord} / {result.total} bản ghi</span>
            <nav aria-label="Phân trang" className="pagination">
              {result.page <= 1 ? <span aria-hidden="true" className="button button--secondary button--sm is-disabled"><ChevronLeft size={16} /></span> : <Link aria-label="Trang trước" className="button button--secondary button--sm" href={pageHref(filters, result.page - 1)}><ChevronLeft aria-hidden="true" size={16} /></Link>}
              <span>{result.page} / {result.pageCount}</span>
              {result.page >= result.pageCount ? <span aria-hidden="true" className="button button--secondary button--sm is-disabled"><ChevronRight size={16} /></span> : <Link aria-label="Trang sau" className="button button--secondary button--sm" href={pageHref(filters, result.page + 1)}><ChevronRight aria-hidden="true" size={16} /></Link>}
            </nav>
          </footer>
        </WorkCanvas>
        {selectedEmployee ? (
          <Inspector className="employee-roster__inspector" title="Hồ sơ đang chọn">
            <div className="employee-inspector-heading"><Avatar imageUrl={selectedEmployee.avatarAssetId ? `/api/v1/employees/${selectedEmployee.id}/avatar` : undefined} name={selectedEmployee.fullName} /><strong>{selectedEmployee.fullName}</strong><StatusBadge tone={selectedEmployee.employmentStatusTone}>{selectedEmployee.employmentStatusLabel}</StatusBadge></div>
            <dl className="employee-inspector-fields">
              <div><dt>Phòng ban</dt><dd>{selectedEmployee.departmentName}</dd></div>
              <div><dt>Chức vụ</dt><dd>{selectedEmployee.positionName}</dd></div>
              <div><dt>Nhóm làm việc</dt><dd>{selectedEmployee.employmentTypeName}</dd></div>
              <div><dt>Ngày vào làm</dt><dd>{selectedEmployee.joinDate}</dd></div>
              <div><dt>Hồ sơ</dt><dd>{selectedEmployee.profileCompleteness}% hoàn thiện</dd></div>
              <div><dt>Tài khoản</dt><dd>{selectedEmployee.hasAccount ? "Đã liên kết" : "Chưa liên kết"}</dd></div>
            </dl>
            <div className="employee-inspector-actions"><Link className="button button--primary button--md" href={`/employees/${selectedEmployee.id}/profile`}>Mở hồ sơ đầy đủ</Link><Link className="button button--secondary button--md" href={selectionHref(filters)}>Đóng</Link></div>
          </Inspector>
        ) : null}
      </WorkbenchLayout>
    </ListPageLayout>
  );
}

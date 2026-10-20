import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, FileText, ShieldCheck } from "lucide-react";

import { employeeDetailSections } from "@/config/routeRegistry";
import { Avatar } from "@/components/shared/Avatar";
import { BackLink } from "@/components/shared/BackLink";
import { Card } from "@/components/shared/Card";
import { EmptyState, PermissionDeniedState } from "@/components/shared/States";
import { PageHeader } from "@/components/shared/PageHeader";
import { DetailPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { Tabs } from "@/components/shared/Tabs";
import { can, type AccountStatus, type Permission } from "@/lib/auth/permissions";
import { buildInternalFileUrl } from "@/services/storage/storageService";
import { EmployeeAccountActions } from "@/features/employees/components/EmployeeAccountActions";
import { EmployeeSensitiveEdit } from "@/features/employees/components/EmployeeSensitiveEdit";
import { IdentityDocumentPanel } from "@/features/employees/components/IdentityDocumentPanel";
import { EmployeeContractManager } from "@/features/employees/components/EmployeeContractManager";
import {
  documentTypeLabels,
  employeeProfileStatusLabels,
  getEmployeeContracts,
  getEmployeeDetail,
  getEmployeeDocuments,
  maskSensitiveValue
} from "@/features/employees/services/employeeService";
import type { EmployeeDataSet } from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import type { EmployeeDetail, EmployeeHistoryEvent } from "@/features/employees/types";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { listPersistedRoles } from "@/services/authorization/rolePersistenceService";
import type { RoleDefinition } from "@/services/authorization/rbacService";
import { EmployeeLeavePanel } from "@/features/leave/components/EmployeeLeavePanel";
import { attendanceRecordHref } from "@/features/attendance/attendanceNavigation";
import { listEmployeeSalaries } from "@/features/accounting/service";
import { listAttendanceRecords } from "@/features/attendance/services/attendanceRepository";
import { listEmployeeProjects } from "@/features/projects/services/projectRepository";

export interface EmployeeDetailPageProps {
  employeeId: string;
  section: string;
}

const accountStatusLabels: Record<AccountStatus, string> = {
  pending_activation: "Chờ kích hoạt",
  active: "Đang hoạt động",
  disabled: "Vô hiệu hóa",
  locked: "Bị khóa",
  invited: "Đã mời"
};

const accountStatusTones: Record<AccountStatus, StatusBadgeTone> = {
  pending_activation: "warning",
  active: "success",
  disabled: "error",
  locked: "error",
  invited: "info"
};

function valueOrEmpty(value?: string | number): string {
  if (value === undefined || value === null || value === "") {
    return "Chưa có";
  }

  return String(value);
}

function formatDate(value?: string): string {
  if (!value) {
    return "Chưa có";
  }

  return new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00.000Z`));
}

function FieldList({
  items
}: {
  items: Array<{ label: string; value?: string | number; sensitive?: boolean }>;
}) {
  return (
    <dl className="detail-field-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {valueOrEmpty(item.value)}
            {item.sensitive ? <span className="sensitive-dot">Nhạy cảm</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EmployeeProfileTab({ detail, permissions, identityFiles }: { detail: EmployeeDetail; permissions: readonly Permission[]; identityFiles?: { front?: string; back?: string } }) {
  const sensitive = detail.sensitive;

  return (
    <div className="content-grid content-grid--two">
      <Card>
        <h2 className="section-title">Thông tin cơ bản</h2>
        <FieldList
          items={[
            { label: "Họ và tên", value: detail.profile.fullName },
            { label: "Tên hiển thị", value: detail.profile.displayName },
            { label: "Ngày sinh", value: formatDate(detail.profile.dateOfBirth) }
          ]}
        />
      </Card>

      <Card className="employee-profile-assessment">
        <h2 className="section-title">Đánh giá hồ sơ</h2>
        <FieldList items={[
          { label: "Tình trạng hồ sơ", value: employeeProfileStatusLabels[detail.profile.profileStatus] },
          { label: "Mức độ hoàn thành", value: `${detail.profile.profileCompleteness}%` }
        ]} />
        <div className="profile-completeness" aria-label={`Mức độ hoàn thiện hồ sơ ${detail.profile.profileCompleteness}%`}>
          <span style={{ width: `${detail.profile.profileCompleteness}%` }} />
        </div>
      </Card>

      {can(permissions, "employee.identity_document.view") ? <Card>
        <h2 className="section-title">Căn cước công dân</h2>
        <IdentityDocumentPanel backAssetId={identityFiles?.back} canEdit={can(permissions, "employee.identity_document.edit")} employeeId={detail.profile.id} frontAssetId={identityFiles?.front}/>
      </Card> : null}

      <Card>
        <h2 className="section-title">Liên hệ</h2>
        <FieldList
          items={[
            { label: "Số điện thoại", value: detail.profile.personalPhone },
            { label: "Email cá nhân", value: detail.profile.personalEmail },
            { label: "Email công ty", value: detail.profile.companyEmail },
            { label: "Địa chỉ hiện tại", value: detail.profile.currentAddress },
            { label: "Địa chỉ thường trú", value: detail.profile.permanentAddress },
            { label: "Tỉnh/Thành", value: detail.profile.province },
            { label: "Quốc gia", value: detail.profile.country }
          ]}
        />
      </Card>

      <Card>
        <header className="panel-header">
          <div>
            <h2>CCCD, ngân hàng, thuế/BHXH</h2>
          </div>
          <StatusBadge tone={sensitive.allowed ? "success" : "warning"}>
            <ShieldCheck aria-hidden="true" size={14} />
            {sensitive.allowed ? "Có quyền" : "Bị giới hạn"}
          </StatusBadge>
          {sensitive.allowed && can(permissions, "employee.edit_sensitive") ? (
            <EmployeeSensitiveEdit employeeId={detail.profile.id} profile={sensitive} />
          ) : null}
        </header>
        {sensitive.allowed ? (
          <FieldList
            items={[
              { label: "Số CCCD", value: maskSensitiveValue(sensitive.nationalIdNumber), sensitive: true },
              { label: "Ngày cấp", value: formatDate(sensitive.nationalIdIssuedDate), sensitive: true },
              { label: "Nơi cấp", value: sensitive.nationalIdIssuedPlace, sensitive: true },
              { label: "Ngày hết hạn", value: formatDate(sensitive.nationalIdExpiryDate), sensitive: true },
              { label: "Ngân hàng", value: sensitive.bankName, sensitive: true },
              { label: "Số tài khoản", value: maskSensitiveValue(sensitive.bankAccountNumber), sensitive: true },
              { label: "Chủ tài khoản", value: sensitive.bankAccountHolder, sensitive: true },
              { label: "Mã số thuế", value: maskSensitiveValue(sensitive.personalTaxCode), sensitive: true },
              { label: "Mã BHXH", value: maskSensitiveValue(sensitive.socialInsuranceCode), sensitive: true }
            ]}
          />
        ) : (
          <PermissionDeniedState />
        )}
      </Card>

      <Card>
        <h2 className="section-title">Người liên hệ khẩn cấp</h2>
        {detail.emergencyContacts.length === 0 ? (
          <EmptyState
            title="Chưa có liên hệ khẩn cấp"
          />
        ) : (
          <ul className="foundation-list">
            {detail.emergencyContacts.map((contact) => (
              <li key={contact.id}>
                <span>
                  <strong>{contact.fullName}</strong>
                  <small>
                    {contact.relation} - {contact.phone}
                  </small>
                </span>
                {contact.isPrimary ? <StatusBadge tone="info">Chính</StatusBadge> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EmployeeEmploymentTab({ detail }: { detail: EmployeeDetail }) {
  return (
    <div className="content-grid content-grid--two">
      <Card>
        <h2 className="section-title">Thông tin công việc</h2>
        <FieldList
          items={[
            { label: "Phòng ban", value: detail.department.name },
            { label: "Chức vụ", value: detail.position.name },
            { label: "Nhóm làm việc", value: detail.employmentType.name },
            { label: "Trạng thái", value: detail.summary.employmentStatusLabel },
            { label: "Ngày vào làm", value: formatDate(detail.profile.joinDate) },
            { label: "Ngày thử việc", value: formatDate(detail.profile.probationStartDate) },
            { label: "Kết thúc thử việc", value: formatDate(detail.profile.probationEndDate) },
            { label: "Ngày chính thức", value: formatDate(detail.profile.officialDate) },
            { label: "Ngày nghỉ việc", value: formatDate(detail.profile.terminationDate) }
          ]}
        />
      </Card>
      <Card>
        <h2 className="section-title">Quản lý trực tiếp</h2>
        {detail.manager ? (
          <article className="employee-manager-card">
            <Avatar name={detail.manager.fullName} />
            <span>
              <strong>{detail.manager.fullName}</strong>
              <small>
                {detail.manager.positionName}
              </small>
            </span>
          </article>
        ) : (
          <EmptyState title="Chưa có quản lý" />
        )}
      </Card>
    </div>
  );
}

function EmployeeContractsTab({ employeeId, dataSet, permissions }: { employeeId: string; dataSet: EmployeeDataSet; permissions: readonly Permission[] }) {
  const contracts = getEmployeeContracts(employeeId, dataSet);
  return <EmployeeContractManager canEdit={can(permissions,"contract.edit")} canUpload={can(permissions,"contract.file.upload")} canViewFile={can(permissions,"contract.file.view")} employeeId={employeeId} initialContracts={contracts}/>;
}

async function EmployeeSalaryTab({ employeeId, user }: { employeeId: string; user: NonNullable<Awaited<ReturnType<typeof getRequestUser>>> }) {
  const history = await listEmployeeSalaries(user, employeeId);
  if (!history.length) return <EmptyState title="Chưa có dữ liệu lương" />;
  const current = history[0];
  const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
  return (
    <div className="content-grid content-grid--two">
      <Card>
        <h2 className="section-title">Mức lương hiện tại</h2>
        <FieldList items={[
          { label: "Lương cơ bản", value: money(current.baseSalary), sensitive: true },
          { label: "Phụ cấp", value: money(current.allowance), sensitive: true },
          { label: "Thưởng", value: money(current.bonus), sensitive: true },
          { label: "Khấu trừ", value: money(current.deduction), sensitive: true },
          { label: "Ngày áp dụng", value: formatDate(current.effectiveDate) },
          { label: "Ghi chú", value: current.note }
        ]} />
      </Card>
      {can(user.permissions, "salary.history.view") ? <Card className="employee-history-panel">
        <h2 className="section-title">Lịch sử lương</h2>
        <ol className="employee-history">
          {history.map((entry, index) => <li key={entry.id}><span className="employee-history__marker"><BadgeCheck aria-hidden="true" size={16} /></span><article><header><h3>{index + 1 < history.length ? `${money(history[index + 1].baseSalary)} → ${money(entry.baseSalary)}` : money(entry.baseSalary)}</h3><StatusBadge>{formatDate(entry.effectiveDate)}</StatusBadge></header><p>{entry.reason}</p><small>Người thực hiện: {entry.changedByName ?? "Tài khoản hệ thống"}</small></article></li>)}
        </ol>
      </Card> : null}
    </div>
  );
}

export function EmployeeDocumentsTab({
  employeeId,
  permissions,
  dataSet
}: {
  employeeId: string;
  permissions: readonly Permission[];
  dataSet: EmployeeDataSet;
}) {
  const documents = getEmployeeDocuments(employeeId, permissions, dataSet);

  if (documents.length === 0) {
    return (
      <EmptyState
        title="Chưa có tài liệu khả dụng"
      />
    );
  }

  return (
    <Card>
      <h2 className="section-title">Hồ sơ đính kèm</h2>
      <ul className="employee-document-list">
        {documents.map((document) => (
          <li key={document.id}>
            <FileText aria-hidden="true" size={18} />
            <span>
              <strong>{document.title}</strong>
              <small>
                {documentTypeLabels[document.documentType]} · tải lên {formatDate(document.uploadedAt.slice(0, 10))}
              </small>
            </span>
            {document.sensitive ? <StatusBadge tone="warning">Nhạy cảm</StatusBadge> : <StatusBadge>Riêng tư</StatusBadge>}
            <Link className="private-file-link" href={buildInternalFileUrl(document.fileId)}>
              Xem tài liệu
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function EmployeeAttendanceTab({ employeeId, user }: { employeeId: string; user: NonNullable<Awaited<ReturnType<typeof getRequestUser>>> }) {
  const events = await listAttendanceRecords(user, { employeeId });
  if (!events.length) return <EmptyState title="Chưa có lượt chấm công" />;

  const eventLabels = { check_in: "Chấm vào", check_out: "Chấm ra" } as const;
  const syncLabels = { local_pending: "Chờ đồng bộ", syncing: "Đang đồng bộ", synced: "Đã đồng bộ", sync_failed: "Đồng bộ lỗi" } as const;
  return (
    <Card>
      <h2 className="section-title">Lịch sử chấm công</h2>
      <ul className="foundation-list">
        {events.map((event) => (
          <li key={event.id}>
            <span>
              <strong>{eventLabels[event.eventType]} · {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.effectiveAt))}</strong>
              <small>{event.locationName ?? "Không ghi nhận địa điểm"} · {event.geofenceStatus}</small>
            </span>
            <StatusBadge tone={event.syncStatus === "synced" ? "success" : event.syncStatus === "sync_failed" ? "error" : "warning"}>{syncLabels[event.syncStatus]}</StatusBadge>
            <Link href={attendanceRecordHref(event.id, `/employees/${employeeId}/attendance`)}>Xem</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function EmployeeProjectsTab({ employeeId, user }: { employeeId: string; user: NonNullable<Awaited<ReturnType<typeof getRequestUser>>> }) {
  const assignments = await listEmployeeProjects(user, employeeId);
  if (!assignments.length) return <EmptyState title="Chưa có phân công dự án" />;

  return (
    <Card>
      <h2 className="section-title">Dự án đã phân công</h2>
      <ul className="foundation-list">
        {assignments.map((assignment) => (
          <li key={assignment.assignmentId}>
            <span>
              <strong>{assignment.project.code} · {assignment.project.name}</strong>
              <small>{assignment.assignmentRole} · {assignment.worksiteName ?? "Toàn dự án"} · {formatDate(assignment.startDate)}{assignment.endDate ? ` – ${formatDate(assignment.endDate)}` : ""}</small>
            </span>
            <StatusBadge tone={assignment.status === "active" ? "success" : "neutral"}>{assignment.status}</StatusBadge>
            <Link href={`/projects/${assignment.project.id}/team`}>Xem</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function describeHistoryEvent(event: EmployeeHistoryEvent): string {
  const beforeValue = event.before?.value;
  const afterValue = event.after?.value;

  if (beforeValue || afterValue) {
    return `${valueOrEmpty(String(beforeValue ?? ""))} -> ${valueOrEmpty(String(afterValue ?? ""))}`;
  }

  if (event.after) {
    return Object.entries(event.after)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" - ");
  }

  return "Đã ghi nhận thay đổi.";
}

async function EmployeeHistoryTab({ detail, user, canViewProjects }: { detail: EmployeeDetail; user: NonNullable<Awaited<ReturnType<typeof getRequestUser>>>; canViewProjects: boolean }) {
  const assignments = canViewProjects ? await listEmployeeProjects(user, detail.profile.id) : [];
  return <div className="content-grid content-grid--two">
    <Card>
      <h2 className="section-title">Gia nhập công ty</h2>
      <FieldList items={[
        { label: "Ngày tạo hồ sơ", value: formatDate(detail.profile.createdAt.slice(0, 10)) },
        { label: "Ngày bắt đầu làm việc", value: formatDate(detail.profile.joinDate) }
      ]} />
    </Card>
    <Card className="employee-history-panel">
      <h2 className="section-title">Dự án đã tham gia</h2>
      {!canViewProjects ? <PermissionDeniedState /> : assignments.length ? <ul className="foundation-list">{assignments.map((assignment) => <li key={assignment.assignmentId}><span><strong>{assignment.project.code} · {assignment.project.name}</strong><small>{assignment.worksiteName ?? "Toàn dự án"} · {formatDate(assignment.startDate)}{assignment.endDate ? ` – ${formatDate(assignment.endDate)}` : ""}</small></span><StatusBadge tone={assignment.status === "active" ? "success" : "neutral"}>{assignment.status === "active" ? "Đang tham gia" : "Đã kết thúc"}</StatusBadge><Link href={`/projects/${assignment.project.id}/team`}>Xem</Link></li>)}</ul> : <EmptyState title="Chưa có dự án đã tham gia" />}
    </Card>
  </div>;
}

function EmployeeAccountTab({
  detail,
  permissions,
  roles
}: {
  detail: EmployeeDetail;
  permissions: readonly Permission[];
  roles: RoleDefinition[];
}) {
  if (!can(permissions, "account.view")) {
    return <PermissionDeniedState />;
  }

  if (!detail.account) {
    return (
      <Card>
        <EmptyState
          action={
            <EmployeeAccountActions
              employeeId={detail.profile.id}
              employeeLabel={detail.profile.fullName}
              permissions={permissions}
              roles={roles}
              usernameSuggestion={detail.profile.employeeCode}
            />
          }
          title="Nhân sự chưa có tài khoản"
        />
      </Card>
    );
  }

  const roleNames = detail.account.roleIds.map((roleId) => (
    roles.find((role) => role.id === roleId)?.name
    ?? `Vai trò ${roleId.slice(0, 8)}`
  ));

  return (
    <div className="content-grid content-grid--two">
      <Card>
        <header className="panel-header">
          <div>
            <h2>Tài khoản hệ thống</h2>
          </div>
          <StatusBadge tone={accountStatusTones[detail.account.status]}>
            {accountStatusLabels[detail.account.status]}
          </StatusBadge>
        </header>
        <FieldList
          items={[
            { label: "Tên tài khoản", value: detail.account.username ?? "—" },
            { label: "Số điện thoại", value: detail.account.loginPhone },
            { label: "Ngày kích hoạt", value: detail.account.activatedAt },
            { label: "Đăng nhập gần nhất", value: detail.account.lastLoginAt }
          ]}
        />
      </Card>
      <Card>
        <h2 className="section-title">Vai trò</h2>
        <div className="role-chip-list">
          {roleNames.map((roleName, index) => (
            <StatusBadge key={`${detail.account?.roleIds[index]}-${roleName}`} tone="info">
              {roleName}
            </StatusBadge>
          ))}
        </div>
        <EmployeeAccountActions
          account={detail.account}
          employeeId={detail.profile.id}
          employeeLabel={detail.profile.fullName}
          permissions={permissions}
          roles={roles}
          usernameSuggestion={detail.profile.employeeCode}
        />
      </Card>
    </div>
  );
}

export async function EmployeeDetailPage({ employeeId, section }: EmployeeDetailPageProps) {
  if (section === "projects") redirect(`/employees/${employeeId}/history`);
  if (section === "documents") redirect(`/employees/${employeeId}/profile`);
  const currentSection = employeeDetailSections.find((item) => item.value === section);

  if (!currentSection) {
    notFound();
  }

  const user = await getRequestUser();

  if (!user || !can(user.permissions, "employee.view")) {
    return <PermissionDeniedState />;
  }

  if (section === "salary" && !can(user.permissions, "salary.view") && !can(user.permissions, "salary.history.view")) {
    return <PermissionDeniedState />;
  }
  if (section === "contracts" && !can(user.permissions, "contract.view")) {
    return <PermissionDeniedState />;
  }

  const dataSet = await getEmployeeDataSetAsync();
  const detail = getEmployeeDetail(employeeId, user.permissions, dataSet);

  if (!detail) {
    notFound();
  }
  const identityProfile = can(user.permissions, "employee.identity_document.view")
    ? dataSet.sensitiveProfiles.find((profile) => profile.employeeId === employeeId)
    : undefined;
  const canViewEmployeeAttendance = can(user.permissions, "attendance.view_all") || can(user.permissions, "attendance.view_team") || can(user.permissions, "attendance.manage") || can(user.permissions, "attendance.log.view");
  const canViewEmployeeProjects = can(user.permissions, "project.view");
  const roles = section === "account" && can(user.permissions, "account.view")
    ? await listPersistedRoles()
    : [];

  return (
    <DetailPageLayout>
      <BackLink href="/employees" label="Trở lại danh sách nhân viên" />
      <PageHeader
        action={
          can(user.permissions, "employee.edit") ? (
            <Link className="button button--secondary button--md" href={`/employees/${employeeId}/edit`}>
              <span className="button__icon"><BriefcaseBusiness aria-hidden="true" size={16} /></span>
              <span>Chỉnh sửa</span>
            </Link>
          ) : null
        }
        title={detail.summary.fullName}
      />

      <section className="employee-detail-header">
        <Avatar className="employee-detail-header__avatar" imageUrl={detail.profile.avatarAssetId ? `/api/v1/employees/${employeeId}/avatar` : undefined} name={detail.summary.fullName} />
        <div>
          <h2>{detail.summary.displayName}</h2>
          <p>
            {detail.summary.employmentTypeName}
          </p>
        </div>
        <StatusBadge tone={detail.summary.employmentStatusTone}>{detail.summary.employmentStatusLabel}</StatusBadge>
      </section>

      <Tabs
        items={employeeDetailSections.filter((item) => item.value !== "salary" || can(user.permissions, "salary.view") || can(user.permissions, "salary.history.view")).filter((item) => item.value !== "contracts" || can(user.permissions, "contract.view")).filter((item) => item.value !== "attendance" || canViewEmployeeAttendance).map((item) => ({
          label: item.label,
          href: `/employees/${employeeId}/${item.value}`,
          active: item.value === section
        }))}
        label="Tab hồ sơ nhân viên"
      />

      {section === "profile" ? <EmployeeProfileTab detail={detail} identityFiles={{ front: identityProfile?.nationalIdFrontFileId, back: identityProfile?.nationalIdBackFileId }} permissions={user.permissions} /> : null}
      {section === "employment" ? <EmployeeEmploymentTab detail={detail} /> : null}
      {section === "contracts" ? <EmployeeContractsTab dataSet={dataSet} employeeId={employeeId} permissions={user.permissions} /> : null}
      {section === "salary" ? <EmployeeSalaryTab employeeId={employeeId} user={user} /> : null}
      {section === "attendance" ? canViewEmployeeAttendance ? <EmployeeAttendanceTab employeeId={employeeId} user={user} /> : <PermissionDeniedState /> : null}
      {section === "history" ? <EmployeeHistoryTab detail={detail} user={user} canViewProjects={canViewEmployeeProjects} /> : null}
      {section === "leave" ? <EmployeeLeavePanel employeeId={employeeId} /> : null}
      {section === "account" ? <EmployeeAccountTab detail={detail} permissions={user.permissions} roles={roles} /> : null}
    </DetailPageLayout>
  );
}

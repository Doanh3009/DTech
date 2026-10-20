import Link from "next/link";

import { Avatar } from "@/components/shared/Avatar";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { findEmployeeForAccount, getEmployeeDetail } from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { PersonalUiSettings } from "@/features/workspace/PersonalUiSettings";

export default async function Page() {
  const user = await getRequestUser();
  const dataSet = await getEmployeeDataSetAsync();
  const employee = user ? findEmployeeForAccount(user.id, dataSet) : undefined;
  const detail = employee && user ? getEmployeeDetail(employee.id, user.permissions, dataSet) : undefined;

  return (
    <div className="page-stack">
      <PageHeader title="Cá nhân" />

      <Card className="self-profile-card">
        <Avatar className="employee-detail-header__avatar" imageUrl={detail?.profile.avatarAssetId ? "/api/v1/workspace/avatar" : undefined} name={detail?.summary.fullName ?? user?.displayName ?? "User"} />
        <div>
          <h2>{detail?.summary.fullName ?? user?.displayName ?? "Chưa đăng nhập"}</h2>
          <p>
            {detail
              ? `${detail.summary.departmentName} · ${detail.summary.positionName}`
              : user?.username}
          </p>
        </div>
        {detail ? <StatusBadge tone={detail.summary.employmentStatusTone}>{detail.summary.employmentStatusLabel}</StatusBadge> : null}
      </Card>

      {detail ? (
        <div className="content-grid content-grid--two">
          <Card>
            <h2 className="section-title">Thông tin liên hệ</h2>
            <ul className="foundation-list">
              <li>
                <span>
                  <strong>Số điện thoại</strong>
                  <small>{detail.profile.personalPhone}</small>
                </span>
              </li>
              <li>
                <span>
                  <strong>Email công ty</strong>
                  <small>{detail.profile.companyEmail ?? "Chưa có"}</small>
                </span>
              </li>
              <li>
                <span>
                  <strong>Địa chỉ hiện tại</strong>
                  <small>{detail.profile.currentAddress ?? "Chưa có"}</small>
                </span>
              </li>
            </ul>
          </Card>
          <Card>
            <h2 className="section-title">Tài khoản</h2>
            <ul className="foundation-list">
              <li>
                <span>
                  <strong>Trạng thái</strong>
                  <small>{user?.status}</small>
                </span>
                <StatusBadge tone={user?.status === "active" ? "success" : "warning"}>{user?.status}</StatusBadge>
              </li>
              <li>
                <span>
                  <strong>Vai trò/quyền</strong>
                  <small>{user?.permissions.length ?? 0} quyền hiệu lực</small>
                </span>
              </li>
            </ul>
            <div className="account-action-row">
              <ChangePasswordForm />
              <LogoutButton />
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="muted-text">Tài khoản chưa liên kết với hồ sơ nhân sự.</p>
          <Link className="button button--secondary button--md" href="/employees">
            Xem danh sách nhân sự
          </Link>
        </Card>
      )}
      {user ? <PersonalUiSettings initialHasAvatar={Boolean(detail?.profile.avatarAssetId)} /> : null}
    </div>
  );
}

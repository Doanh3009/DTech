import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { LeaveRequestList } from "@/features/leave/components/LeaveRequestList";
import { PermissionDeniedState } from "@/components/shared/States";
import { can, type Permission } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import styles from "@/features/leave/components/LeaveWorkspace.module.css";

const managementLinks = [
  { href: "/leave/manage/balances", label: "Số dư nhân viên", permission: "leave.balance.view_all" },
  { href: "/leave/manage/adjustments", label: "Cấp / điều chỉnh phép", permission: "leave.balance.adjust" },
  { href: "/settings/leave/types", label: "Loại nghỉ", permission: "leave.type.manage" },
  { href: "/settings/leave/workflows", label: "Quy trình duyệt", permission: "leave.workflow.manage" },
  { href: "/settings/leave/policies", label: "Chính sách", permission: "leave.policy.manage" }
];

export default async function Page() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "leave.view_all") && !can(user.permissions, "leave.approve_all") && !can(user.permissions, "leave.view_team")) return <PermissionDeniedState description="" />;
  const links = [
    ...(can(user.permissions, "leave.approve") || can(user.permissions, "leave.approve_all") ? [{ href: "/approvals/pending", label: "Cần tôi duyệt" }] : []),
    ...managementLinks.filter(item => can(user.permissions, item.permission as Permission))
  ];
  return (
    <div className="page-stack leave-management-page">
      <PageHeader title="Quản lý nghỉ phép" />
      <nav aria-label="Quản trị nghỉ phép" className={styles.navigation}>
        {links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <LeaveRequestList scope={can(user.permissions, "leave.view_all") || can(user.permissions, "leave.approve_all") ? "all" : "team"} />
    </div>
  );
}

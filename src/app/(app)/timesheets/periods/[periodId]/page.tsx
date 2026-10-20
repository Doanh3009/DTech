import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { TimesheetPeriodDetail } from "@/features/timesheets/components/TimesheetPeriodDetail";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export default async function Page({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const user = requireAuthenticatedUser(await getRequestUser());
  const canManage = can(user.permissions, "attendance.period.manage");
  return <div className="page-stack">
    <BackLink href="/timesheets" />
    <PageHeader title="Chi tiết kỳ công" />
    <TimesheetPeriodDetail
      canTransferPayroll={can(user.permissions, "payroll.create")}
      canAdjust={can(user.permissions, "timesheet.adjust")}
      canExport={can(user.permissions, "timesheet.export")}
      canLock={canManage || can(user.permissions, "timesheet.lock")}
      canRecompute={canManage || can(user.permissions, "timesheet.adjust") || can(user.permissions, "timesheet.lock")}
      canUnlock={canManage || can(user.permissions, "timesheet.unlock")}
      canViewExceptions={can(user.permissions, "timesheet.adjust") || can(user.permissions, "timesheet.view_all") || can(user.permissions, "timesheet.view_team")}
      periodId={periodId}
    />
  </div>;
}

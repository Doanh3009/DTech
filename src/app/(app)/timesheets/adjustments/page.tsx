import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceAdjustmentRequests } from "@/features/attendance/components/AttendanceAdjustmentRequests";
import { TimesheetAdjustmentForm } from "@/features/timesheets/components/TimesheetAdjustmentForm";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export default async function Page({ searchParams }: { searchParams: Promise<{ periodId?: string; employeeId?: string; date?: string; rowVersion?: string }> }) {
  const defaults = await searchParams;
  const user = requireAuthenticatedUser(await getRequestUser());
  const canReview = can(user.permissions, "attendance.adjust") || can(user.permissions, "attendance.manage");
  const canViewRequests = canReview || can(user.permissions, "attendance.view_all");
  const canEditTimesheet = can(user.permissions, "timesheet.adjust");
  return <div className="page-stack">
    <BackLink href={defaults.periodId ? `/timesheets/periods/${defaults.periodId}` : "/timesheets"} />
    <PageHeader title="Điều chỉnh công" />
    {canViewRequests && !defaults.periodId ? <AttendanceAdjustmentRequests scope="all" canReview={canReview} /> : null}
    {canEditTimesheet ? <TimesheetAdjustmentForm defaults={defaults} /> : null}
  </div>;
}

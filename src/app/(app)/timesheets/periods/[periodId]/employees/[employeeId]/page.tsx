import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmployeeTimesheetMobile } from "@/features/timesheets/components/EmployeeTimesheetMobile";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export default async function Page({ params, searchParams }: {
  params: Promise<{ periodId: string; employeeId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ periodId, employeeId }, { date }, requestUser] = await Promise.all([params, searchParams, getRequestUser()]);
  const user = requireAuthenticatedUser(requestUser);
  return <div className="page-stack">
    <BackLink href={`/timesheets/matrix?periodId=${encodeURIComponent(periodId)}`} />
    <PageHeader title="Công nhân viên" />
    <EmployeeTimesheetMobile key={`${periodId}:${employeeId}`} employeeId={employeeId} periodId={periodId} selectedDate={date} canAdjust={can(user.permissions, "timesheet.adjust")} />
  </div>;
}

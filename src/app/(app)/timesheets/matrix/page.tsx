import { PageHeader } from "@/components/shared/PageHeader";
import { TimesheetMatrix } from "@/features/timesheets/components/TimesheetMatrix";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export default async function Page({ searchParams }: { searchParams: Promise<{ periodId?: string }> }) {
  const [requestUser, { periodId }] = await Promise.all([getRequestUser(), searchParams]);
  const user = requireAuthenticatedUser(requestUser);
  return <div className="page-stack"><PageHeader title="Bảng công" /><TimesheetMatrix key={periodId} initialPeriodId={periodId} canAdjust={can(user.permissions, "timesheet.adjust")} /></div>;
}

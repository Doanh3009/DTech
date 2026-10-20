import { PageHeader } from "@/components/shared/PageHeader";
import { TimesheetPeriodList } from "@/features/timesheets/components/TimesheetPeriodList";
import { listPeriods } from "@/features/timesheets/services/timesheetRepository";
import type { TimesheetPeriod } from "@/features/timesheets/types/timesheetTypes";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export default async function Page() {
  const user = requireAuthenticatedUser(await getRequestUser());
  const canCreate = can(user.permissions, "timesheet.adjust") || can(user.permissions, "timesheet.lock") || can(user.permissions, "attendance.period.manage");
  const canView = (["timesheet.view", "timesheet.self.view", "timesheet.view_all", "timesheet.view_team", "attendance.view_all", "attendance.period.manage"] as const).some((permission) => can(user.permissions, permission));
  let initialItems: TimesheetPeriod[] | undefined;
  let initialError: string | undefined;
  if (canView) {
    try { initialItems = await listPeriods(user); }
    catch (error) { initialError = error instanceof Error ? error.message : "Không thể đọc kỳ công."; }
  }
  return <div className="page-stack"><PageHeader title="Kỳ công" /><TimesheetPeriodList canCreate={canCreate} initialError={initialError} initialItems={initialItems} /></div>;
}

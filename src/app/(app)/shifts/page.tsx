import { PageHeader } from "@/components/shared/PageHeader";
import { ShiftSettings } from "@/features/timesheets/components/ShiftSettings";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  const canEdit = Boolean(user && (can(user.permissions, "shift.manage") || can(user.permissions, "shift.edit")));
  return <div className="page-stack"><PageHeader title="Ca làm" /><ShiftSettings canEdit={canEdit} /></div>;
}

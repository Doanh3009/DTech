import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceAdminDashboard } from "@/features/attendance/components/AttendanceAdminDashboard";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  return <div className="page-stack"><PageHeader title="Kiểm tra ảnh chấm công" /><AttendanceAdminDashboard ownerAccountId={user?.id} /></div>;
}

import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceRecordDetail } from "@/features/attendance/components/AttendanceRecordDetail";
import { attendanceRecordBackHref } from "@/features/attendance/attendanceNavigation";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id },query,user] = await Promise.all([params,searchParams,getRequestUser()]);
  return <div className="page-stack"><PageHeader title="Chi tiết lượt chấm công" /><AttendanceRecordDetail backHref={attendanceRecordBackHref(query.returnTo)} canAdjust={Boolean(user&&(can(user.permissions,"attendance.adjust")||can(user.permissions,"attendance.manage")))} canViewHistory={Boolean(user&&(can(user.permissions,"attendance.log.view")||can(user.permissions,"attendance.adjust")||can(user.permissions,"attendance.manage")))} id={id} /></div>;
}

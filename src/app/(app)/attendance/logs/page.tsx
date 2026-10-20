import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceRecords } from "@/features/attendance/components/AttendanceRecords";
import { attendanceLogBackHref } from "@/features/attendance/attendanceNavigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const { employeeId } = await searchParams;
  const backHref = attendanceLogBackHref(employeeId);

  return (
    <div className="page-stack">
      <BackLink href={backHref} />
      <PageHeader title="Nhật ký công" />
      <AttendanceRecords admin employeeId={employeeId} />
    </div>
  );
}

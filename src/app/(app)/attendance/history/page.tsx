import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceHistory } from "@/features/attendance/components/AttendanceHistory";

export default function Page() {
  return <div className="page-stack"><PageHeader title="Lịch sử chấm công" /><AttendanceHistory /></div>;
}

import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceRecords } from "@/features/attendance/components/AttendanceRecords";

export default function Page() {
  return <div className="page-stack"><PageHeader title="Kiểm tra chấm công" /><AttendanceRecords /></div>;
}

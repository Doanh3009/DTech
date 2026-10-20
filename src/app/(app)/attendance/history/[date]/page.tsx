import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceHistory } from "@/features/attendance/components/AttendanceHistory";

export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <div className="page-stack"><PageHeader title="Chi tiết chấm công" /><AttendanceHistory selectedDate={date} /></div>;
}

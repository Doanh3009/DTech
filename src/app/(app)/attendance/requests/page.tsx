import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceAdjustmentRequests } from "@/features/attendance/components/AttendanceAdjustmentRequests";
import { LeaveRequestList } from "@/features/leave/components/LeaveRequestList";

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return <div className="page-stack">
    <PageHeader title="Đơn của tôi" />
    <AttendanceAdjustmentRequests initialDate={initialDate} />
    <section className="page-stack"><h2 className="section-title">Nghỉ phép</h2><LeaveRequestList scope="self" /></section>
  </div>;
}

import { PageHeader } from "@/components/shared/PageHeader";
import { CalendarSettings } from "@/features/timesheets/components/CalendarSettings";

export default function Page() {
  return <div className="page-stack"><PageHeader title="Lịch ngày làm việc và ngày nghỉ" /><CalendarSettings /></div>;
}

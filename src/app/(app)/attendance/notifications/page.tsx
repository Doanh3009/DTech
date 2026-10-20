import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationCenter } from "@/features/shared-platforms/components/NotificationCenter";

export default function Page() {
  return <div className="page-stack"><PageHeader title="Thông báo của tôi" /><NotificationCenter attendanceOnly /></div>;
}

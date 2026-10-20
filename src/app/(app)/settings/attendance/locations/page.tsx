import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceSettings } from "@/features/attendance/components/AttendanceSettings";
import { BackLink } from "@/components/shared/BackLink";

export default function Page() {
  return <div className="page-stack"><BackLink href="/settings" /><PageHeader title="Địa điểm chấm công" /><AttendanceSettings activeTab="locations" /></div>;
}

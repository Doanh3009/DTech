import { routeMetaByPath } from "@/config/routeRegistry";
import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceSettings } from "@/features/attendance/components/AttendanceSettings";
import { BackLink } from "@/components/shared/BackLink";

const meta = routeMetaByPath["/settings/attendance"];

export default function Page() {
  return <div className="page-stack"><BackLink href="/settings" /><PageHeader title={meta.title} /><AttendanceSettings /></div>;
}

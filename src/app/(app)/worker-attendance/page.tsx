import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { BackLink } from "@/components/shared/BackLink";
import { routeMetaByPath } from "@/config/routeRegistry";
import { WorkerAttendanceSessionList } from "@/features/worker-attendance/components/WorkerAttendanceHome";

const meta = routeMetaByPath["/worker-attendance"];

export default function Page() {
  return (
    <div className="page-stack">
      <BackLink href="/projects" label="Dự án" />
      <PageHeader title={meta.title} />
      <div className="action-row"><Link className="button button--primary button--md" href="/worker-attendance/today">Điểm danh hôm nay</Link></div>
      <WorkerAttendanceSessionList />
    </div>
  );
}

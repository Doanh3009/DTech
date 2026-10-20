import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { WorkerAttendanceToday } from "@/features/worker-attendance/components/WorkerAttendanceHome";

export default async function Page({ searchParams }: PageProps<"/worker-attendance/today">) {
  const query = await searchParams;
  const projectId = Array.isArray(query.projectId) ? query.projectId[0] : query.projectId;
  const worksiteId = Array.isArray(query.worksiteId) ? query.worksiteId[0] : query.worksiteId;
  return <div className="page-stack"><BackLink href={projectId ? `/projects/${projectId}/team${worksiteId ? `?worksite=${worksiteId}` : ""}` : "/worker-attendance"} /><PageHeader title="Điểm danh hôm nay" /><WorkerAttendanceToday projectId={projectId} worksiteId={worksiteId} /></div>;
}

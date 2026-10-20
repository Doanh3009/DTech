import { WorkerAttendanceWizard } from "@/features/worker-attendance/components/WorkerAttendanceWizard";

export default async function Page({ params }: PageProps<"/worker-attendance/sessions/[id]/photos">) {
  const { id } = await params;
  return <WorkerAttendanceWizard sessionId={id} step="photos" />;
}

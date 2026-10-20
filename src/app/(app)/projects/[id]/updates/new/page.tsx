import { redirect } from "next/navigation";

export default async function Page({ params, searchParams }: PageProps<"/projects/[id]/updates/new">) {
  const { id } = await params;
  const query = await searchParams;
  const task = Array.isArray(query.task) ? query.task[0] : query.task;
  const worksite = Array.isArray(query.worksiteId) ? query.worksiteId[0] : query.worksiteId;
  redirect(`/projects/${id}/progress?mode=field-update${task ? `&task=${encodeURIComponent(task)}` : ""}${worksite ? `&worksite=${encodeURIComponent(worksite)}` : ""}`);
}

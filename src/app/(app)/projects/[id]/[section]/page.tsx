import { ProjectDetailPage } from "@/features/projects/pages/ProjectDetailPage";

export default async function Page({
  params
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  const { id, section } = await params;
  return <ProjectDetailPage projectId={id} section={section} />;
}

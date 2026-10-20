import { ProjectUpdateDetailPage } from "@/features/projects/pages/ProjectUpdateDetailPage";
export default async function Page({ params }: PageProps<"/projects/[id]/updates/[updateId]">) { const { id, updateId } = await params; return <ProjectUpdateDetailPage projectId={id} updateId={updateId} />; }

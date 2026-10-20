import { ProjectUpdatesPage } from "@/features/projects/pages/ProjectUpdatesPage";
export default async function Page({ params, searchParams }: PageProps<"/projects/[id]/updates">) { const { id } = await params; return <ProjectUpdatesPage projectId={id} searchParams={await searchParams} />; }

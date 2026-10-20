import { ProjectIssueCenterPage } from "@/features/projects/pages/ProjectIssueCenterPage";
export default async function Page({ searchParams }: PageProps<"/project-monitoring/issues">) { return <ProjectIssueCenterPage searchParams={await searchParams} />; }

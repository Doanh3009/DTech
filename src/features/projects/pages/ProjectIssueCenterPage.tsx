import { Select } from "@/components/shared/FormControls";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";

import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListPageLayout } from "@/components/shared/PageLayouts";
import { ProjectIssueTable } from "@/features/projects/components/ProjectIssueTable";
import { listProjectIssues } from "@/features/projects/services/projectUpdateRepository";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function ProjectIssueCenterPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await connection();
  const value = (key: string) => {
    const current = searchParams[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const projectId = z.string().uuid().optional().parse(value("projectId"));
  const issues = await listProjectIssues(requireAuthenticatedUser(await getRequestUser()), { projectId, status: value("status"), severity: value("severity") });

  return (
    <ListPageLayout>
      <PageHeader action={<Link href="/project-monitoring"><Button variant="secondary">Theo dõi dự án</Button></Link>} title="Trung tâm vấn đề" />
      <form className="project-update-filters">
        {projectId ? <input name="projectId" type="hidden" value={projectId} /> : null}
        <Select label={"Trạng thái"} labelHidden className="select" defaultValue={value("status") ?? ""} name="status" options={[{ label: "Tất cả trạng thái", value: "" }, { label: "Chưa xử lý", value: "open" }, { label: "Đang xử lý", value: "in_progress" }, { label: "Đã xử lý", value: "resolved" }, { label: "Đã đóng", value: "closed" }]} />
        <Select label={"Mức độ"} labelHidden className="select" defaultValue={value("severity") ?? ""} name="severity" options={[{ label: "Tất cả mức độ", value: "" }, { label: "Nghiêm trọng", value: "critical" }, { label: "Cao", value: "high" }, { label: "Trung bình", value: "medium" }, { label: "Thấp", value: "low" }]} />
        <Button type="submit" variant="secondary">Lọc</Button>
      </form>
      <ProjectIssueTable issues={issues} />
    </ListPageLayout>
  );
}

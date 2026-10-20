import { Select } from "@/components/shared/FormControls";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/States";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProjectUpdateCard } from "@/features/projects/components/ProjectUpdateCard";
import { getProject } from "@/features/projects/services/projectRepository";
import { listProjectUpdates } from "@/features/projects/services/projectUpdateRepository";
import { projectUpdateQuerySchema } from "@/features/projects/schemas/projectSchemas";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function ProjectUpdatesPage({ projectId, searchParams }: { projectId: string; searchParams: Record<string, string | string[] | undefined> }) {
  const user = requireAuthenticatedUser(await getRequestUser()); const project = await getProject(projectId, user);
  const flat = Object.fromEntries(Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const filters = projectUpdateQuerySchema.parse(flat); const result = await listProjectUpdates(user, projectId, filters);
  return <div className="page-stack"><PageHeader meta={<span>Nhật ký hiện trường</span>} title={project.name} />
    <div className="project-page-toolbar"><form className="project-update-filters"><input aria-label="Tìm cập nhật" className="input" defaultValue={filters.search} name="search" placeholder="Tìm tiêu đề, nội dung" type="search" /><Select label={"Loại cập nhật"} labelHidden className="select" defaultValue={filters.type ?? ""} name="type" options={[{ label: "Tất cả loại", value: "" }, { label: "Tiến độ", value: "progress" }, { label: "Vấn đề", value: "issue" }, { label: "Vật tư", value: "material" }, { label: "An toàn", value: "safety" }, { label: "Thay đổi", value: "change" }, { label: "Thông tin chung", value: "general" }]} /><Select label={"Trạng thái"} labelHidden className="select" defaultValue={filters.status ?? ""} name="status" options={[{ label: "Tất cả trạng thái", value: "" }, { label: "Đang thực hiện", value: "in_progress" }, { label: "Chờ xử lý", value: "waiting" }, { label: "Hoàn thành", value: "done" }]} /><Button type="submit">Lọc</Button></form><Link href={`/projects/${projectId}/progress?mode=field-update`}><Button leftIcon={<Plus size={16} />} variant="primary">Cập nhật hiện trường</Button></Link></div>
    {result.items.length ? <div className="project-update-timeline">{result.items.map((update) => <ProjectUpdateCard key={update.id} update={update} />)}{result.nextCursor ? <Link className="load-more-link" href={`?cursor=${encodeURIComponent(result.nextCursor)}`}>Xem thêm</Link> : null}</div> : <EmptyState title="Chưa có cập nhật" />}
  </div>;
}

import { BriefcaseBusiness, MapPin, UsersRound } from "lucide-react";

import { BackLink } from "@/components/shared/BackLink";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ProjectDetail, ProjectHealth, ProjectStatus } from "@/features/projects/types/projectTypes";

const projectStatus: Record<ProjectStatus, { label: string; tone: "info" | "success" | "warning" | "neutral" }> = {
  preparing: { label: "Chuẩn bị", tone: "info" },
  active: { label: "Đang thi công", tone: "success" },
  paused: { label: "Tạm dừng", tone: "warning" },
  completed: { label: "Hoàn thành", tone: "success" },
  closed: { label: "Đã đóng", tone: "neutral" }
};

const healthLabel: Record<ProjectHealth, string> = {
  on_track: "Đúng tiến độ",
  at_risk: "Có rủi ro",
  delayed: "Chậm tiến độ",
  paused: "Tạm dừng",
  completed: "Hoàn thành"
};

export function ProjectContextHeader({ project }: { project: ProjectDetail }) {
  const location = project.worksites.length === 1 ? project.worksites[0]?.name : project.worksites.length > 1 ? `${project.worksites.length} công trường` : undefined;
  const details = [
    project.customerName ? { label: "Khách hàng", value: project.customerName, icon: BriefcaseBusiness } : undefined,
    location ? { label: "Địa điểm", value: location, icon: MapPin } : undefined,
    project.projectManagerName ? { label: "Phụ trách", value: project.projectManagerName, icon: UsersRound } : undefined
  ].filter((item): item is { label: string; value: string; icon: typeof BriefcaseBusiness } => Boolean(item));

  return <section className="project-context-header">
    <div className="project-context-header__top"><BackLink href="/projects" label="Danh sách gói" /><StatusBadge tone={projectStatus[project.status].tone}>{projectStatus[project.status].label}</StatusBadge></div>
    <div className="project-context-header__main"><h1>{project.name}</h1></div>
    <div className="project-context-header__meta">
      {details.map((detail) => { const Icon = detail.icon; return <span key={detail.label}><Icon aria-hidden="true" size={15} /><strong>{detail.value}</strong></span>; })}
      <span>{project.startDate} → {project.expectedEndDate ?? "Chưa xác định"}</span>
      <span>{healthLabel[project.health]}</span>
      <span>{project.currentPeople} nhân sự</span>
    </div>
  </section>;
}

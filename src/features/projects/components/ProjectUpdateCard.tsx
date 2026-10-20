import { AlertTriangle, FileText, ImageIcon, MapPin, Pin } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ProjectIssueSeverity, ProjectUpdate, ProjectUpdateStatus, ProjectUpdateType } from "@/features/projects/types/projectTypes";

export const updateTypeLabels: Record<ProjectUpdateType, string> = { progress: "Tiến độ", issue: "Vấn đề", material: "Vật tư", safety: "An toàn", change: "Thay đổi", general: "Thông tin chung" };
export const updateStatusLabels: Record<ProjectUpdateStatus, string> = { in_progress: "Đang thực hiện", waiting: "Chờ xử lý", done: "Hoàn thành" };
export const severityLabels: Record<ProjectIssueSeverity, string> = { low: "Thấp", medium: "Trung bình", high: "Cao", critical: "Nghiêm trọng" };

function toneForSeverity(severity: ProjectIssueSeverity) { return severity === "critical" ? "error" : severity === "high" || severity === "medium" ? "warning" : "info"; }

export function ProjectUpdateCard({ update, showProject = false }: { update: ProjectUpdate; showProject?: boolean }) {
  return <article className={`project-update-card${update.pinned ? " is-pinned" : ""}`}>
    <header className="project-update-card__header">
      <div className="project-update-card__identity"><span className={`update-type update-type--${update.updateType}`}>{updateTypeLabels[update.updateType]}</span>{update.pinned ? <span className="pinned-label"><Pin size={13} /> Đã ghim</span> : null}</div>
      <time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</time>
    </header>
    {showProject ? <Link className="project-update-card__project" href={`/projects/${update.projectId}/progress`}>{update.projectName}</Link> : null}
    <Link href={`/projects/${update.projectId}/updates/${update.id}`}><h3>{update.title}</h3></Link>
    <p className="project-update-card__content">{update.content}</p>
    <div className="project-update-card__meta">
      <span>{update.authorName} · {update.authorProjectRole}</span>
      {update.worksiteName ? <span><MapPin size={14} />{update.worksiteName}</span> : null}
    </div>
    <footer>
      <StatusBadge tone={update.status === "done" ? "success" : update.status === "waiting" ? "warning" : "info"}>{updateStatusLabels[update.status]}</StatusBadge>
      {update.issue ? <StatusBadge tone={toneForSeverity(update.issue.severity)}><AlertTriangle size={13} />{severityLabels[update.issue.severity]}</StatusBadge> : null}
      {update.attachments.some((item) => item.attachmentType === "image") ? <span><ImageIcon size={14} />{update.attachments.filter((item) => item.attachmentType === "image").length} ảnh</span> : null}
      {update.attachments.some((item) => item.attachmentType !== "image") ? <span><FileText size={14} />{update.attachments.filter((item) => item.attachmentType !== "image").length} tệp</span> : null}
      {update.publishStatus === "draft" ? <StatusBadge>Nháp</StatusBadge> : null}
    </footer>
  </article>;
}

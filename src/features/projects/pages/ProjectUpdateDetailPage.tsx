import { FileText, ImageIcon, MapPin, Pin } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { severityLabels, updateStatusLabels, updateTypeLabels } from "@/features/projects/components/ProjectUpdateCard";
import { ProjectUpdateActions } from "@/features/projects/components/ProjectUpdateActions";
import { getProjectUpdate } from "@/features/projects/services/projectUpdateRepository";
import { buildInternalFileUrl } from "@/services/storage/storageService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function ProjectUpdateDetailPage({ projectId, updateId }: { projectId: string; updateId: string }) {
  const update = await getProjectUpdate(requireAuthenticatedUser(await getRequestUser()), updateId);
  if (update.projectId !== projectId) return null;
  return <div className="page-stack project-update-detail"><BackLink href={`/projects/${projectId}/updates`} label="Cập nhật dự án" /><Card>
    <header><div><span className={`update-type update-type--${update.updateType}`}>{updateTypeLabels[update.updateType]}</span>{update.pinned ? <span className="pinned-label"><Pin size={13} /> Đã ghim</span> : null}</div><time>{new Date(update.createdAt).toLocaleString("vi-VN")}</time></header>
    <h1>{update.title}</h1><div className="project-update-card__meta"><span>{update.authorName} · {update.authorProjectRole}</span>{update.worksiteName ? <span><MapPin size={14} />{update.worksiteName}</span> : null}</div><div className="project-update-detail__content">{update.content.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}</div>
    <div className="action-row"><StatusBadge tone={update.status === "done" ? "success" : update.status === "waiting" ? "warning" : "info"}>{updateStatusLabels[update.status]}</StatusBadge>{update.issue ? <StatusBadge tone={update.issue.severity === "critical" ? "error" : "warning"}>{severityLabels[update.issue.severity]}</StatusBadge> : null}{update.version > 1 ? <StatusBadge>Đã chỉnh sửa</StatusBadge> : null}</div><ProjectUpdateActions update={update} />
  </Card>
  {update.issue ? <Card><h3 className="section-title">Vấn đề</h3><dl className="project-meta"><div><dt>Mức độ</dt><dd>{severityLabels[update.issue.severity]}</dd></div><div><dt>Trạng thái</dt><dd>{update.issue.status === "resolved" ? "Đã xử lý" : update.issue.status === "in_progress" ? "Đang xử lý" : "Chưa xử lý"}</dd></div><div><dt>Phụ trách</dt><dd>{update.issue.ownerName ?? "—"}</dd></div><div><dt>Cập nhật</dt><dd>{new Date(update.issue.updatedAt).toLocaleString("vi-VN")}</dd></div></dl>{update.issue.resolutionNote ? <p>{update.issue.resolutionNote}</p> : null}</Card> : null}
  {update.attachments.length ? <Card><h3 className="section-title">Ảnh / tài liệu</h3><div className="project-attachment-grid">{update.attachments.map((attachment) => <a href={buildInternalFileUrl(attachment.fileId)} key={attachment.id} rel="noreferrer" target="_blank">{attachment.attachmentType === "image" ? <ImageIcon size={20} /> : <FileText size={20} />}<span>{attachment.fileName}</span><small>{Math.ceil(attachment.sizeBytes / 1024)} KB</small></a>)}</div></Card> : null}</div>;
}

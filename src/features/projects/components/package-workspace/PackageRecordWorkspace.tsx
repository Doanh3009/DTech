"use client";

import { Building2, CalendarDays, FileText, MapPin, Pencil, Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Overlays";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WorksiteEditor } from "../WorksiteEditor";
import { ProjectHealthControl } from "@/features/projects/components/ProjectHealthControl";
import type { ProjectDetail, ProjectHealth, ProjectUpdate, Worksite } from "@/features/projects/types/projectTypes";
import { formatBusinessDate } from "@/lib/time/timezone";

import styles from "./PackageWorkspace.module.css";
import type { PackageWorkspaceSection } from "./WorkspaceNav";

const healthDisplay: Record<ProjectHealth, { label: string; tone: "success" | "warning" | "error" | "neutral" }> = {
  on_track: { label: "Đúng tiến độ", tone: "success" },
  at_risk: { label: "Có rủi ro", tone: "warning" },
  delayed: { label: "Chậm tiến độ", tone: "error" },
  paused: { label: "Tạm dừng", tone: "neutral" },
  completed: { label: "Hoàn thành", tone: "success" }
};

export function PackageRecordWorkspace({
  project,
  updates,
  canManageWorksites,
  canUpdateHealth,
  canViewDocuments,
  onNavigate
}: {
  project: ProjectDetail;
  updates: ProjectUpdate[];
  canManageWorksites: boolean;
  canUpdateHealth: boolean;
  canViewDocuments: boolean;
  onNavigate: (section: PackageWorkspaceSection) => void;
}) {
  const router = useRouter();
  const [addingWorksite, setAddingWorksite] = useState(false);
  const [worksiteBusy, setWorksiteBusy] = useState(false);
  const [editingWorksite, setEditingWorksite] = useState<Worksite>();
  const documents = useMemo(() => updates.flatMap((update) => update.attachments
    .filter((attachment) => attachment.attachmentType !== "image")
    .map((attachment) => ({ ...attachment, updateTitle: update.title, updatedAt: update.updatedAt }))), [updates]);


  return (
    <section className={styles.recordsWorkspace}>
      <header className={styles.workspaceHeading}>
        <div><h2>Thông tin gói</h2></div>
        {canManageWorksites && project.status !== "closed" ? (
          <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => { setEditingWorksite(undefined); setAddingWorksite(true); }} variant="secondary">
            Thêm công trường
          </Button>
        ) : null}
      </header>

      <div className={styles.packageInfoGrid}>
        <section className={styles.packageInfoMain}>
          <dl className={styles.infoFacts}>
            <div><dt><Building2 aria-hidden="true" size={16} /> Khách hàng</dt><dd>{project.customerName ?? "Chưa có"}</dd></div>
            <div><dt><UserRound aria-hidden="true" size={16} /> Phụ trách</dt><dd>{project.projectManagerName ?? "Chưa phân công"}</dd></div>
            <div><dt><CalendarDays aria-hidden="true" size={16} /> Bắt đầu</dt><dd>{formatBusinessDate(project.startDate)}</dd></div>
            <div><dt><CalendarDays aria-hidden="true" size={16} /> Kết thúc dự kiến</dt><dd>{project.expectedEndDate ? formatBusinessDate(project.expectedEndDate) : "Chưa xác định"}</dd></div>
          </dl>

          {project.summary || project.note ? (
            <section className={styles.infoSection}>
              <h3>Nội dung</h3>
              <p>{project.summary ?? project.note}</p>
            </section>
          ) : null}

          <section className={styles.infoSection}>
            <div className={styles.infoSectionHeader}><h3>Công trường</h3><span>{project.worksites.length}</span></div>
            <div className={styles.worksiteList}>
              {project.worksites.map((site) => (
                <div key={site.id}>
                  <MapPin aria-hidden="true" size={17} />
                  <span><strong>{site.name}</strong>{site.address ? <small>{site.address}</small> : null}</span>
                  <span className={styles.worksiteActions}><StatusBadge tone={site.status === "active" ? "success" : "neutral"}>{site.status === "active" ? "Hoạt động" : site.status === "closed" ? "Đã đóng" : "Tạm ngừng"}</StatusBadge>{canManageWorksites && site.updatedAt ? <IconButton label={`Chỉnh sửa ${site.name}`} onClick={() => { setEditingWorksite(site); setAddingWorksite(true); }}><Pencil size={16}/></IconButton> : null}</span>
                </div>
              ))}
              {!project.worksites.length ? <EmptyState title="Chưa có công trường" /> : null}
            </div>
          </section>
        </section>

        <aside className={styles.packageInfoAside}>
          <section className={styles.infoSection}>
            <h3>Tình trạng gói</h3>
            {canUpdateHealth ? <ProjectHealthControl health={project.health} projectId={project.id} /> : <StatusBadge tone={healthDisplay[project.health].tone}>{healthDisplay[project.health].label}</StatusBadge>}
          </section>
          {canViewDocuments ? <section className={styles.infoSection}>
            <div className={styles.infoSectionHeader}><h3>Tệp liên quan</h3><span>{documents.length}</span></div>
            <div className={styles.recordFiles}>
              {documents.slice(0, 6).map((document) => (
                <a href={`/api/v1/files/${document.fileId}/signed-url`} key={document.id} rel="noreferrer" target="_blank">
                  <FileText aria-hidden="true" size={18} />
                  <span><strong>{document.fileName}</strong><small>{document.updateTitle}</small></span>
                </a>
              ))}
              {!documents.length ? <EmptyState title="Chưa có tệp liên quan" /> : null}
            </div>
            <Button onClick={() => onNavigate("documents")} variant="secondary">Mở tài liệu</Button>
          </section> : null}
        </aside>
      </div>
      <Modal onClose={() => { if (!worksiteBusy) setAddingWorksite(false); }} open={addingWorksite} title={editingWorksite ? "Chỉnh sửa công trường" : "Thêm công trường"}>
        <WorksiteEditor initial={editingWorksite} key={editingWorksite?.id ?? "new"} onBusyChange={setWorksiteBusy} onCancel={() => setAddingWorksite(false)} onSaved={() => { setAddingWorksite(false); router.refresh(); }} projectId={project.id}/>
      </Modal>
    </section>
  );
}

"use client";

import { CalendarDays, MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ProjectDetail, ProjectStatus } from "@/features/projects/types/projectTypes";
import { formatBusinessDate } from "@/lib/time/timezone";

import { WorksiteEditor } from "../WorksiteEditor";
import styles from "./PackageWorkspace.module.css";

const statusMap: Record<ProjectStatus, { label: string; tone: "info" | "success" | "warning" | "neutral" }> = {
  preparing: { label: "Chuẩn bị", tone: "info" },
  active: { label: "Đang thi công", tone: "success" },
  paused: { label: "Tạm dừng", tone: "warning" },
  completed: { label: "Hoàn thành", tone: "success" },
  closed: { label: "Đã đóng", tone: "neutral" }
};

export function PackageContextHeader({
  project,
  selectedWorksiteId,
  onWorksiteChange,
  canManageWorksites
}: {
  project: ProjectDetail;
  completionPercent?: number;
  canManageWorksites: boolean;
  canUpdateHealth: boolean;
  selectedWorksiteId?: string;
  onWorksiteChange: (worksiteId?: string) => void;
}) {
  const router = useRouter();
  const [addingWorksite, setAddingWorksite] = useState(false);
  const [worksiteBusy, setWorksiteBusy] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const status = statusMap[project.status];
  const activeWorksites = project.worksites.filter((site) => site.status === "active");
  const selectedWorksite = activeWorksites.find((site) => site.id === selectedWorksiteId);
  const closeEditor = () => { if (!worksiteBusy) setAddingWorksite(false); };

  return (
    <>
      <header className={styles.contextHeader}>
        <div className={styles.contextTitle}>
          <div className={styles.contextIdentity}>
            <span className={styles.packageCode}>Gói {project.code}</span>
            <h1>{project.name}</h1>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <div className={styles.contextToolbar}>
          <dl className={styles.contextMeta}>
            <div>
              <dt><MapPin aria-hidden="true" size={16} />Công trường</dt>
              <dd className={activeWorksites.length > 1 ? styles.worksiteSwitcher : styles.worksiteName}>
                {activeWorksites.length > 1 ? <Select
                  aria-label="Lọc công trường trong gói"
                  label="Công trường"
                  labelHidden
                  onChange={(event) => onWorksiteChange(event.target.value || undefined)}
                  options={[{ value: "", label: "Toàn bộ gói" }, ...activeWorksites.map((site) => ({ value: site.id, label: site.name }))]}
                  value={selectedWorksite?.id ?? ""}
                /> : activeWorksites[0]?.name ?? "Chưa có công trường hoạt động"}
              </dd>
            </div>
            <div className={styles.contextDates}>
              <dt><CalendarDays aria-hidden="true" size={16} /><span className="sr-only">Thời gian</span></dt>
              <dd>{formatBusinessDate(project.startDate)} – {project.expectedEndDate ? formatBusinessDate(project.expectedEndDate) : "Chưa xác định"}</dd>
            </div>
          </dl>
          {canManageWorksites && project.status !== "closed" ? <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => { setEditorVersion(current => current + 1); setAddingWorksite(true); }} variant="secondary">Thêm công trường</Button> : null}
        </div>
      </header>
      <Drawer onClose={closeEditor} open={addingWorksite} title="Thêm công trường">
        <WorksiteEditor key={editorVersion} onBusyChange={setWorksiteBusy} onCancel={closeEditor} onSaved={() => { setAddingWorksite(false); router.refresh(); }} projectId={project.id} />
      </Drawer>
    </>
  );
}

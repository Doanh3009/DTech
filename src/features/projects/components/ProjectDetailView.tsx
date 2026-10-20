"use client";

import { MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input } from "@/components/shared/FormControls";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProjectDocumentWorkspace } from "@/features/projects/components/ProjectDocumentWorkspace";
import { ProjectHealthControl } from "@/features/projects/components/ProjectHealthControl";
import { ProjectPeopleAttendanceWorkspace } from "@/features/projects/components/ProjectPeopleAttendanceWorkspace";
import { ProjectProgressTree } from "@/features/projects/components/ProjectProgressTree";
import { ProjectRecordWorkspace } from "@/features/projects/components/ProjectRecordWorkspace";
import type { DailySchedule, ProjectAssignment, ProjectDetail, ProjectHealth, ProjectProgressNode, ProjectUpdate } from "@/features/projects/types/projectTypes";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";

const healthLabels: Record<ProjectHealth, string> = {
  on_track: "Đúng tiến độ",
  at_risk: "Có rủi ro",
  delayed: "Chậm tiến độ",
  paused: "Tạm dừng",
  completed: "Hoàn thành"
};

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json() as { error?: { message: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu dữ liệu.");
}

interface ProjectDetailViewProps {
  project: ProjectDetail;
  section: string;
  schedule: DailySchedule[];
  progressNodes?: ProjectProgressNode[];
  progressLoadError?: string;
  scheduleLoadError?: string;
  documentUpdates?: ProjectUpdate[];
  canEditProgress?: boolean;
  canFieldUpdate?: boolean;
  canManageTeam?: boolean;
  canOpenAttendance?: boolean;
  canAdjustAttendance?: boolean;
  canExportAttendance?: boolean;
  canViewAttendance?: boolean;
  canManageWorksites?: boolean;
  canUpdateHealth?: boolean;
  canUploadDocuments?: boolean;
  today: string;
  todayRoster?: ProjectAssignment[];
  attendanceSessions?: WorkerAttendanceSession[];
}

export function ProjectDetailView({ project, section, schedule, progressNodes = [], progressLoadError, scheduleLoadError, documentUpdates = [], canEditProgress = false, canFieldUpdate = false, canManageTeam = false, canOpenAttendance = false, canAdjustAttendance = false, canExportAttendance = false, canViewAttendance = false, canManageWorksites = false, canUpdateHealth = false, canUploadDocuments = false, today, todayRoster = [], attendanceSessions = [] }: ProjectDetailViewProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();

  if (section === "profile") return <div className="project-profile-workspace">
    <div className="project-profile-workspace__top">
      <ProjectRecordWorkspace project={project} />
      <Card className="project-profile-health"><header><span>Vận hành</span><h2>Tình trạng</h2></header>{canUpdateHealth ? <ProjectHealthControl health={project.health} projectId={project.id} /> : <StatusBadge>{healthLabels[project.health]}</StatusBadge>}</Card>
    </div>
    <WorksitePanel canManage={canManageWorksites} project={project} onError={setError} onSaved={() => router.refresh()} />
    {error ? <div className="attendance-notice" role="alert">{error}</div> : null}
  </div>;
  if (section === "documents") return <ProjectDocumentWorkspace canUpload={canUploadDocuments} projectId={project.id} updates={documentUpdates} />;
  if (section === "progress") return <ProjectProgressTree canEdit={canEditProgress} canFieldUpdate={canFieldUpdate} initialLoadError={progressLoadError} initialNodes={progressNodes} projectId={project.id} schedule={schedule} scheduleLoadError={scheduleLoadError} />;
  if (section === "team") return <ProjectPeopleAttendanceWorkspace attendanceSessions={attendanceSessions} canAdjustAttendance={canAdjustAttendance} canExportAttendance={canExportAttendance} canManageTeam={canManageTeam} canOpenAttendance={canOpenAttendance} canViewAttendance={canViewAttendance} project={project} today={today} todayRoster={todayRoster} />;
  return <EmptyState title="Không tìm thấy nội dung gói" />;
}

function WorksitePanel({ project, canManage, onSaved, onError }: { project: ProjectDetail; canManage: boolean; onSaved: () => void; onError: (message: string) => void }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function createWorksite(form: FormData) {
    setSaving(true);
    try {
      await postJson(`/api/v1/projects/${project.id}/worksites`, {
        name: form.get("name"), address: form.get("address") || undefined,
        latitude: form.get("latitude") ? Number(form.get("latitude")) : undefined,
        longitude: form.get("longitude") ? Number(form.get("longitude")) : undefined,
        radiusMeters: Number(form.get("radiusMeters")), gpsRequired: true, allowedAccuracyThresholdMeters: 100
      });
      setShowCreateForm(false);
      onSaved();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Không thể thêm công trường.");
    } finally {
      setSaving(false);
    }
  }

  return <Card className="project-worksite-panel">
    <div className="panel-header"><div><h3>Công trường</h3><StatusBadge>{project.worksites.length}</StatusBadge></div>{canManage ? <Button onClick={() => setShowCreateForm((current) => !current)} size="sm" variant="secondary">{showCreateForm ? "Đóng" : "Thêm công trường"}</Button> : null}</div>
    {project.worksites.length ? <div className="worksite-list">{project.worksites.map((site) => <div key={site.id}><MapPin aria-hidden="true" size={18} /><span><strong>{site.name}</strong>{site.address ? <small>{site.address}</small> : null}</span><span>{site.radiusMeters} m</span><StatusBadge tone={site.status === "active" ? "success" : "neutral"}>{site.status === "active" ? "Hoạt động" : "Ngừng"}</StatusBadge></div>)}</div> : <EmptyState title="Chưa có công trường" />}
    {showCreateForm ? <form action={createWorksite} className="worksite-form"><Input label="Tên địa điểm" name="name" required /><Input label="Địa chỉ" name="address" /><Input label="Vĩ độ" name="latitude" step="any" type="number" /><Input label="Kinh độ" name="longitude" step="any" type="number" /><Input defaultValue="200" label="Bán kính (m)" min={10} name="radiusMeters" type="number" /><div className="form-actions"><Button onClick={() => setShowCreateForm(false)} type="button" variant="secondary">Hủy</Button><Button disabled={saving} leftIcon={<Plus aria-hidden="true" size={16} />} type="submit" variant="primary" busy={saving}>{"Lưu công trường"}</Button></div></form> : null}
  </Card>;
}

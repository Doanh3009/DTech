"use client";

import { AlertTriangle, ArrowRight, Boxes, Camera, CheckCircle2, Clock3, FilePlus2, HardHat, ShieldAlert, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ProjectAssignment, ProjectIssue, ProjectProgressNode, ProjectUpdate } from "@/features/projects/types/projectTypes";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";

import styles from "./PackageWorkspace.module.css";
import type { PackageWorkspaceSection } from "./WorkspaceNav";

function deadlineLabel(deadline?: string, today?: string) {
  if (!deadline) return "Chưa đặt hạn";
  const delta = Math.round((new Date(`${deadline}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  if (delta < 0) return `Quá hạn ${Math.abs(delta)} ngày`;
  if (delta === 0) return "Hạn hôm nay";
  if (delta === 1) return "Hạn ngày mai";
  return `Còn ${delta} ngày`;
}

export function PackageTodayWorkspace({
  projectId,
  today,
  nodes,
  roster,
  sessions,
  updates,
  openIssues,
  issueLoadError,
  selectedWorksiteId,
  canFieldUpdate,
  canOpenAttendance,
  canViewMaterials,
  canViewTeam,
  onNavigate
}: {
  projectId: string;
  today: string;
  nodes: ProjectProgressNode[];
  roster: ProjectAssignment[];
  sessions: WorkerAttendanceSession[];
  updates: ProjectUpdate[];
  openIssues?: ProjectIssue[];
  issueLoadError?: string;
  selectedWorksiteId?: string;
  canFieldUpdate: boolean;
  canOpenAttendance: boolean;
  canViewMaterials?: boolean;
  canViewTeam?: boolean;
  onNavigate: (section: PackageWorkspaceSection, options?: { mode?: "field-update" | "report-issue"; task?: string }) => void;
}) {
  const filteredRoster = useMemo(() => roster.filter((item) => !selectedWorksiteId || item.worksiteId === selectedWorksiteId), [roster, selectedWorksiteId]);
  const filteredSessions = useMemo(() => sessions.filter((item) => item.date === today && (!selectedWorksiteId || item.worksiteId === selectedWorksiteId)), [sessions, selectedWorksiteId, today]);
  const filteredUpdates = useMemo(() => updates.filter((item) => !selectedWorksiteId || item.worksiteId === selectedWorksiteId), [selectedWorksiteId, updates]);
  const attention = useMemo(() => {
    const priority = (node: ProjectProgressNode) => node.status === "blocked" ? 0 : node.deadline && node.deadline < today ? 1 : node.deadline === today ? 2 : 3;
    return nodes.filter(node => !["completed", "cancelled"].includes(node.status) && (node.status === "blocked" || node.status === "in_progress" || Boolean(node.deadline && node.deadline <= today)))
      .sort((a, b) => priority(a) - priority(b) || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.sortOrder - b.sortOrder);
  }, [nodes, today]);
  const issues = openIssues ? openIssues.filter(issue => !selectedWorksiteId || issue.worksiteId === selectedWorksiteId) : filteredUpdates.flatMap(update => update.issue && !["resolved", "closed"].includes(update.issue.status) ? [update.issue] : []);
  const attendanceDone = filteredSessions.length > 0 && filteredSessions.every(session => session.status === "submitted" || session.status === "locked");
  const peopleCount = new Set(filteredRoster.map(assignment => assignment.employeeId)).size;
  return (
    <section className={styles.todayWorkspace}>
      <header className={styles.todayHeading}>
        <h2>Hôm nay</h2>
        <time dateTime={today}>{new Date(`${today}T12:00:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })}</time>
      </header>

      <div className={styles.todayGrid}>
        <section className={styles.todayPrimary}>
          <div className={styles.todaySectionTitle}><div><HardHat aria-hidden="true" size={19} /><h3>Công việc ưu tiên</h3></div><span>{attention.length}</span></div>
          <div className={styles.todayTaskList}>
            {attention.slice(0, 6).map((node) => (
              <article className={styles.todayTask} data-status={node.status} key={node.id}>
                <div className={styles.todayTaskMain}>
                  <div><strong>{node.name}</strong><span>{node.assigneeName ?? "Chưa phân công"}</span></div>
                  <StatusBadge tone={node.status === "blocked" ? "error" : "info"}>{node.status === "blocked" ? "Đang vướng" : `${node.completionPercent}%`}</StatusBadge>
                </div>
                <div className={styles.todayTaskMeta}><span className={node.deadline && node.deadline < today ? styles.dangerText : undefined}><Clock3 aria-hidden="true" size={15} />{deadlineLabel(node.deadline, today)}</span></div>
                {canFieldUpdate ? <div className={styles.todayTaskActions}><button data-action="update" onClick={() => onNavigate("progress", { mode: "field-update", task: node.id })} type="button"><FilePlus2 aria-hidden="true" size={16} />Cập nhật</button><button data-action="issue" onClick={() => onNavigate("progress", { mode: "report-issue", task: node.id })} type="button"><ShieldAlert aria-hidden="true" size={16} />Báo vướng</button></div> : null}
              </article>
            ))}
            {!attention.length ? <div className={styles.todayClear}><CheckCircle2 size={22} /><strong>Không có việc cần ưu tiên hôm nay</strong></div> : null}
          </div>
          <button className={styles.todayMoreLink} onClick={() => onNavigate("progress")} type="button">Xem tất cả công việc <ArrowRight size={16} /></button>
        </section>

        <aside className={styles.todayAside}>
          <section className={styles.todayCard}>
            <div className={styles.todaySectionTitle}><div><UsersRound aria-hidden="true" size={19} /><h3>Nhân lực hôm nay</h3></div><span>{peopleCount}</span></div>
            {canOpenAttendance ? <Link className={styles.todayPrimaryAction} href={`/worker-attendance/today?projectId=${projectId}${selectedWorksiteId ? `&worksiteId=${selectedWorksiteId}` : ""}`}><Camera size={17} />{attendanceDone ? "Xem điểm danh" : "Điểm danh nhanh"}</Link> : null}
            {canViewTeam ? <button className={styles.todayMoreLink} onClick={() => onNavigate("team")} type="button">Xem nhân lực <ArrowRight size={16} /></button> : null}
          </section>
          <section className={styles.todayCard}>
            <div className={styles.todaySectionTitle}><div><AlertTriangle aria-hidden="true" size={19} /><h3>{openIssues ? "Vướng mắc mở" : "Vướng mắc gần đây"}</h3></div><span>{issueLoadError ? "—" : issues.length}</span></div>
            <div className={styles.todayIssueList}>{issueLoadError ? <p className={styles.dangerText} role="status">{issueLoadError}</p> : issues.slice(0, 4).map(issue => <article key={issue.id}><Link href={`/projects/${projectId}/updates/${issue.sourceUpdateId}`}><strong>{issue.title}</strong><ArrowRight aria-hidden="true" size={16} /></Link><span>{issue.severity === "critical" ? "Dừng thi công" : issue.severity === "high" ? "Ưu tiên cao" : issue.severity === "medium" ? "Cảnh báo sớm" : "Theo dõi"}</span>{issue.ownerName ? <span>{issue.ownerName}</span> : null}</article>)}{!issueLoadError && !issues.length ? <p>Không có vướng mắc đang mở</p> : null}</div>
            {openIssues && issues.length > 4 ? <Link className={styles.todayMoreLink} href={`/project-monitoring/issues?projectId=${projectId}`}>Xem tất cả vướng mắc <ArrowRight size={16} /></Link> : null}
          </section>
          {canViewMaterials ? <section className={styles.todayCard}><div className={styles.todaySectionTitle}><div><Boxes aria-hidden="true" size={19} /><h3>Vật tư công trường</h3></div></div><button className={styles.todayMoreLink} onClick={() => onNavigate("materials")} type="button">Xem tồn và chứng từ <ArrowRight size={16} /></button></section> : null}
        </aside>
      </div>

    </section>
  );
}

import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { Card, StatCard } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProjectUpdateCard, severityLabels } from "@/features/projects/components/ProjectUpdateCard";
import { getProjectMonitoring } from "@/features/projects/services/projectUpdateRepository";
import type { ProjectHealth, ProjectMonitoringSummary } from "@/features/projects/types/projectTypes";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const healthLabels: Record<ProjectHealth, string> = { on_track: "Đúng tiến độ", at_risk: "Có rủi ro", delayed: "Chậm tiến độ", paused: "Tạm dừng", completed: "Hoàn thành" };
const healthColors: Record<ProjectHealth, string> = { on_track: "var(--mint-500)", at_risk: "var(--yellow-500)", delayed: "var(--rose-500)", paused: "var(--text-muted)", completed: "var(--cyan-500)" };
function healthTone(health: ProjectHealth) { return health === "on_track" || health === "completed" ? "success" : health === "delayed" ? "error" : "warning"; }

function ProjectHealthChart({ summary }: { summary: ProjectMonitoringSummary }) {
  const counts = new Map<ProjectHealth, number>();
  for (const project of summary.projects) counts.set(project.health, (counts.get(project.health) ?? 0) + 1);
  let cursor = 0;
  const stops = [...counts.entries()].map(([health, count]) => {
    const start = cursor;
    cursor += count / Math.max(summary.projects.length, 1) * 100;
    return `${healthColors[health]} ${start}% ${cursor}%`;
  });
  return <Card className="project-health-chart"><h2>Tình trạng dự án</h2><div className="project-health-chart__body">
    <div aria-label={[...counts.entries()].map(([health, count]) => `${healthLabels[health]}: ${count}`).join(", ")} className="project-health-chart__donut" role="img" style={{ background: stops.length ? `conic-gradient(${stops.join(", ")})` : "var(--surface-2)" }}><span>{summary.projects.length}<small>Dự án</small></span></div>
    <div className="project-health-chart__legend">{([...counts.entries()] as Array<[ProjectHealth, number]>).map(([health, count]) => <div key={health}><i style={{ backgroundColor: healthColors[health] }} /><span>{healthLabels[health]}</span><strong>{count}</strong></div>)}</div>
  </div></Card>;
}

export async function ProjectMonitoringPage({ recentOnly = false }: { recentOnly?: boolean }) {
  await connection();
  const summary = await getProjectMonitoring(requireAuthenticatedUser(await getRequestUser()));
  if (recentOnly) return <div className="page-stack"><PageHeader title="Cập nhật gần đây" /><div className="project-update-timeline">{summary.recentUpdates.map((update) => <ProjectUpdateCard key={update.id} showProject update={update} />)}</div></div>;

  return <div className="page-stack project-monitoring">
    <PageHeader action={<Link className="button button--secondary button--md" href="/project-monitoring/issues">Trung tâm vấn đề</Link>} title="Theo dõi dự án" />
    <div className="monitoring-stats"><StatCard label="Đang hoạt động" value={String(summary.active)} /><StatCard label="Đúng tiến độ" value={String(summary.onTrack)} /><StatCard label="Có rủi ro" value={String(summary.atRisk)} /><StatCard label="Chậm tiến độ" value={String(summary.delayed)} /><StatCard label="Hoàn thành TB" value={`${summary.averageCompletion}%`} /></div>
    <div className="project-visual-grid"><ProjectHealthChart summary={summary} /><Card className="project-completion-chart"><h2>Tiến độ dự án</h2>{summary.projects.length ? summary.projects.slice(0, 7).map((project) => <Link href={`/projects/${project.id}/progress`} key={project.id}><span>{project.name}</span><b><i style={{ width: `${project.completionPercent}%` }} /></b><strong>{project.completionPercent}%</strong></Link>) : <p>Chưa có dự án.</p>}</Card></div>
    <div className="monitoring-grid"><Card className="monitoring-projects"><div className="panel-header"><h3>Dự án</h3><StatusBadge>{summary.projects.length}</StatusBadge></div><div className="monitoring-project-list">{summary.projects.map((project) => <Link href={`/projects/${project.id}/progress`} key={project.id}><span><strong>{project.name}</strong><small>{project.projectManagerName ?? "Chưa phân công"}</small></span><StatusBadge tone={healthTone(project.health)}>{healthLabels[project.health]}</StatusBadge><span className="monitoring-signal">{project.openHighIssues ? <><AlertTriangle size={15} />{project.openHighIssues}</> : project.stale ? <><Clock3 size={15} />Chưa cập nhật gần đây</> : ""}</span><ArrowRight size={16} /></Link>)}</div></Card>
      <Card className="attention-panel"><div className="panel-header"><h3>Cần chú ý</h3><Link href="/project-monitoring/issues">Xem tất cả</Link></div>{summary.attention.slice(0, 6).map((issue) => <Link href={`/projects/${issue.projectId}/updates/${issue.sourceUpdateId}`} key={issue.id}><span><strong>{issue.title}</strong><small>{issue.projectName}</small></span><StatusBadge tone={issue.severity === "critical" ? "error" : "warning"}>{severityLabels[issue.severity]}</StatusBadge><time>{new Date(issue.updatedAt).toLocaleDateString("vi-VN")}</time></Link>)}</Card>
    </div>
    {summary.recentUpdates.length ? <Card><div className="panel-header"><h3>Cập nhật gần đây</h3><Link href="/project-monitoring/recent">Xem tất cả</Link></div><div className="monitoring-recent">{summary.recentUpdates.slice(0, 5).map((update) => <ProjectUpdateCard key={update.id} showProject update={update} />)}</div></Card> : null}
  </div>;
}

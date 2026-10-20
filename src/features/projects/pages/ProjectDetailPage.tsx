import { notFound, redirect } from "next/navigation";

import { projectDetailSections } from "@/config/routeRegistry";
import { PackageWorkspace } from "@/features/projects/components/package-workspace/PackageWorkspace";
import { getProject, getProjectRoster, listProjectProgress } from "@/features/projects/services/projectRepository";
import { listProjectIssues, listProjectUpdates } from "@/features/projects/services/projectUpdateRepository";
import type { ProjectUpdate } from "@/features/projects/types/projectTypes";
import { listWorkerSessions } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { getBusinessDateKey } from "@/lib/time/timezone";

export async function ProjectDetailPage({ projectId, section }: { projectId: string; section: string }) {
  const legacySections: Record<string, string> = {
    overview: "today",
    updates: "progress",
    schedule: "progress",
    "worker-attendance": "team",
    history: "profile"
  };
  if (legacySections[section]) redirect(`/projects/${projectId}/${legacySections[section]}`);
  if (!projectDetailSections.some((item) => item.value === section)) notFound();

  const user = requireAuthenticatedUser(await getRequestUser());
  const project = await getProject(projectId, user);
  const today = new Date();
  const todayKey = getBusinessDateKey(today);
  const monthStart = `${todayKey.slice(0, 7)}-01`;
  const canViewUpdates = can(user.permissions, "project_update.view_project") || can(user.permissions, "project_update.view_all");
  const canViewAttendance = can(user.permissions, "worker_attendance.view")
    || can(user.permissions, "worker_attendance.view_all")
    || can(user.permissions, "worker_attendance.view_project");
  const canViewIssues = can(user.permissions, "project_issue.view");
  const [progressResult, updateResult, rosterResult, sessionResult, issueResult] = await Promise.allSettled([
    listProjectProgress(user, projectId),
    canViewUpdates ? listProjectUpdates(user, projectId, { limit: 100 }) : Promise.resolve({ items: [] as ProjectUpdate[], nextCursor: undefined }),
    getProjectRoster(projectId, todayKey, undefined, user),
    canViewAttendance ? listWorkerSessions(user, { from: monthStart, to: todayKey, projectId }) : Promise.resolve([]),
    canViewIssues ? listProjectIssues(user, { projectId }) : Promise.resolve(undefined)
  ]);
  const progressNodes = progressResult.status === "fulfilled" ? progressResult.value : [];
  const documentUpdates = updateResult.status === "fulfilled" ? updateResult.value.items : [];
  const todayRoster = rosterResult.status === "fulfilled" ? rosterResult.value : [];
  const attendanceSessions = sessionResult.status === "fulfilled" ? sessionResult.value : [];
  const progressLoadError = progressResult.status === "rejected" ? "Không thể tải tiến độ thi công." : undefined;
  const attendanceLoadError = rosterResult.status === "rejected"
    ? "Không thể tải danh sách nhân sự công trường."
    : canViewAttendance && sessionResult.status === "rejected"
      ? sessionResult.reason instanceof Error && sessionResult.reason.message.includes("chưa liên kết hồ sơ nhân viên")
        ? "Tài khoản cần được liên kết hồ sơ nhân viên để xem dữ liệu chấm công theo phạm vi được phân công."
        : "Không thể tải dữ liệu chấm công."
      : undefined;

  const editProgress = can(user.permissions, "project.edit") || can(user.permissions, "project.manage_schedule");
  return <PackageWorkspace
    key={project.id}
    accountId={user.id}
    openIssues={issueResult.status === "fulfilled" ? issueResult.value?.filter(issue => !["resolved", "closed"].includes(issue.status)) : undefined}
    issueLoadError={issueResult.status === "rejected" ? "Không thể tải vướng mắc công trường." : undefined}
    attendanceLoadError={attendanceLoadError}
    attendanceSessions={attendanceSessions}
    permissions={{
      editProgress,
      fieldUpdate: can(user.permissions, "project_update.create"),
      manageTeam: can(user.permissions, "project.manage_team"),
      manageWorksites: can(user.permissions, "worksite.manage"),
      openAttendance: can(user.permissions, "worker_attendance.create"),
      adjustAttendance: can(user.permissions, "worker_attendance.adjust"),
      exportAttendance: can(user.permissions, "timesheet.export"),
      viewAttendance: canViewAttendance,
      updateHealth: can(user.permissions, "project_health.update"),
      uploadDocuments: can(user.permissions, "project_update.create"),
      viewRecords: true,
      viewDocuments: canViewUpdates,
      viewMaterials: can(user.permissions, "warehouse.view"),
      createMaterialReceipt: can(user.permissions, "warehouse.receipt.create"),
      createMaterialIssue: can(user.permissions, "warehouse.issue.create"),
      createMaterialTransfer: can(user.permissions, "warehouse.transfer.create"),
      viewMaterialLedger: can(user.permissions, "warehouse.ledger.view"),
      viewMaterialItems: can(user.permissions, "warehouse.item.view")
    }}
    progressLoadError={progressLoadError}
    progressNodes={progressNodes}
    project={project}
    section={section}
    today={todayKey}
    todayRoster={todayRoster}
    updates={documentUpdates}
  />;
}

"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ProjectAssignment, ProjectDetail, ProjectIssue, ProjectProgressNode, ProjectUpdate } from "@/features/projects/types/projectTypes";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";
import { FIELD_QUEUE_CHANGED, listFieldQueue, saveFieldProjectSnapshot, syncFieldQueue } from "@/features/projects/client/fieldUpdateQueue";
import { useRealtimeConnectionState } from "@/components/providers/RealtimeProvider";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";

import { PackageAttendanceWorkspace } from "./PackageAttendanceWorkspace";
import { PackageConstructionWorkspace } from "./PackageConstructionWorkspace";
import { PackageContextHeader } from "./PackageContextHeader";
import { PackageDocumentWorkspace } from "./PackageDocumentWorkspace";
import { PackageRecordWorkspace } from "./PackageRecordWorkspace";
import { PackageTodayWorkspace } from "./PackageTodayWorkspace";
import { PackageMaterialsWorkspace } from "./PackageMaterialsWorkspace";
import { WorkspaceBody } from "./WorkspaceBody";
import { WorkspaceNav } from "./WorkspaceNav";
import type { PackageWorkspaceSection } from "./WorkspaceNav";
import { PermissionDeniedState } from "@/components/shared/States";
import styles from "./PackageWorkspace.module.css";

export interface PackageWorkspacePermissions {
  editProgress: boolean;
  fieldUpdate: boolean;
  manageTeam: boolean;
  manageWorksites: boolean;
  openAttendance: boolean;
  adjustAttendance: boolean;
  exportAttendance: boolean;
  viewAttendance: boolean;
  updateHealth: boolean;
  uploadDocuments: boolean;
  viewRecords: boolean;
  viewDocuments: boolean;
  viewMaterials?: boolean;
  createMaterialReceipt?: boolean;
  createMaterialIssue?: boolean;
  createMaterialTransfer?: boolean;
  viewMaterialLedger?: boolean;
  viewMaterialItems?: boolean;
}

export function PackageWorkspace({
  project,
  accountId,
  section,
  progressNodes,
  progressLoadError,
  updates,
  openIssues,
  issueLoadError,
  today,
  todayRoster,
  attendanceLoadError,
  attendanceSessions,
  permissions
}: {
  accountId: string;
  project: ProjectDetail;
  section: string;
  progressNodes: ProjectProgressNode[];
  progressLoadError?: string;
  updates: ProjectUpdate[];
  openIssues?: ProjectIssue[];
  issueLoadError?: string;
  today: string;
  todayRoster: ProjectAssignment[];
  attendanceLoadError?: string;
  attendanceSessions: WorkerAttendanceSession[];
  permissions: PackageWorkspacePermissions;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectionState = useRealtimeConnectionState();
  const [currentSection, setCurrentSection] = useState<PackageWorkspaceSection>(() => section as PackageWorkspaceSection);
  const requestedWorksiteId = searchParams.get("worksite") ?? undefined;
  const selectedWorksiteId = project.worksites.some((site) => site.status === "active" && site.id === requestedWorksiteId) ? requestedWorksiteId : undefined;
  const [currentProgressNodes, setCurrentProgressNodes] = useState(progressNodes);
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof listFieldQueue>>>([]);
  const [syncing, setSyncing] = useState(false);
  const [queueError, setQueueError] = useState("");
  useLoadingActivity(syncing);
  const roots = currentProgressNodes.filter((node) => !node.parentId && node.status !== "cancelled");
  const completionPercent = currentSection === "progress" && roots.length
    ? Math.round(roots.reduce((sum, node) => sum + node.completionPercent, 0) / roots.length)
    : currentSection === "progress" ? 0 : undefined;
  const visibleSections = useMemo<PackageWorkspaceSection[]>(() => {
    const next: PackageWorkspaceSection[] = ["today", "progress"];
    if (permissions.viewAttendance || permissions.manageTeam || permissions.openAttendance || permissions.adjustAttendance) next.push("team");
    if (permissions.viewRecords) next.push("profile");
    if (permissions.viewDocuments) next.push("documents");
    if (permissions.viewMaterials) next.push("materials");
    return next;
  }, [permissions.adjustAttendance, permissions.manageTeam, permissions.openAttendance, permissions.viewAttendance, permissions.viewDocuments, permissions.viewRecords, permissions.viewMaterials]);

  const filteredUpdates = useMemo(() => updates.filter((update) => !selectedWorksiteId || update.worksiteId === selectedWorksiteId), [selectedWorksiteId, updates]);
  const filteredRoster = useMemo(() => todayRoster.filter((assignment) => !selectedWorksiteId || assignment.worksiteId === selectedWorksiteId), [selectedWorksiteId, todayRoster]);
  const filteredSessions = useMemo(() => attendanceSessions.filter((session) => !selectedWorksiteId || session.worksiteId === selectedWorksiteId), [attendanceSessions, selectedWorksiteId]);

  const refreshQueue = useCallback(async () => setQueue(await listFieldQueue(accountId, project.id)), [accountId, project.id]);
  const retryQueue = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const syncedNodes = await syncFieldQueue(accountId, project.id);
      if (syncedNodes) setCurrentProgressNodes(syncedNodes);
      await refreshQueue(); setQueueError(""); router.refresh();
    } catch { setQueueError("Chưa đồng bộ được cập nhật. Thử lại khi có kết nối."); }
    finally { setSyncing(false); }
  }, [accountId, project.id, refreshQueue, syncing, router]);
  const reconcileProject = useCallback(() => { router.refresh(); }, [router]);
  useDomainReconciliation("projects", reconcileProject);
  useDomainReconciliation("worker-attendance", reconcileProject);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setCurrentProgressNodes(current => progressNodes.map(incoming => { const local = current.find(node => node.id === incoming.id); return local && local.rowVersion >= incoming.rowVersion ? local : incoming; })); });
    return () => { active = false; };
  }, [progressNodes]);

  useEffect(() => {
    const refresh = () => { void refreshQueue(); };
    refresh();
    window.addEventListener(FIELD_QUEUE_CHANGED, refresh);
    return () => window.removeEventListener(FIELD_QUEUE_CHANGED, refresh);
  }, [refreshQueue]);
  useEffect(() => {
    void saveFieldProjectSnapshot({ ownerAccountId: accountId, projectId: project.id, progressNodes: currentProgressNodes, updates, roster: todayRoster, attendanceSessions }).catch(() => undefined);
  }, [accountId, attendanceSessions, currentProgressNodes, project.id, todayRoster, updates]);
  useEffect(() => {
    if (connectionState === "connected" || connectionState === "reconnecting") queueMicrotask(() => void retryQueue());
  }, [connectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const syncSectionFromLocation = () => {
      const nextSection = window.location.pathname.split("/").filter(Boolean).at(-1) as PackageWorkspaceSection | undefined;
      if (nextSection && visibleSections.includes(nextSection)) setCurrentSection(nextSection);
    };
    window.addEventListener("popstate", syncSectionFromLocation);
    return () => window.removeEventListener("popstate", syncSectionFromLocation);
  }, [visibleSections]);

  function selectWorksite(worksiteId?: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (worksiteId) next.set("worksite", worksiteId); else next.delete("worksite");
    next.delete("task");
    next.delete("mode");
    window.history.replaceState(null, "", next.toString() ? `${pathname}?${next}` : pathname);
  }

  function navigateWorkspace(nextSection: PackageWorkspaceSection, options?: { mode?: "field-update" | "report-issue"; task?: string }) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("mode");
    next.delete("task");
    if (options?.mode) next.set("mode", options.mode);
    if (options?.task) next.set("task", options.task);
    const nextPath = `/projects/${project.id}/${nextSection}`;
    window.history.pushState(null, "", next.toString() ? `${nextPath}?${next}` : nextPath);
    setCurrentSection(nextSection);
  }

  return (
    <div className={styles.packageWorkspace}>
      <PackageContextHeader
        canManageWorksites={permissions.manageWorksites}
        canUpdateHealth={permissions.updateHealth}
        completionPercent={completionPercent}
        onWorksiteChange={selectWorksite}
        project={project}
        selectedWorksiteId={selectedWorksiteId}
      />
      {connectionState === "offline" || queue.length > 0 ? <div className={styles.syncStrip} data-state={connectionState === "offline" ? "offline" : queue.some((item) => item.status === "failed") ? "failed" : "pending"} role="status">
        <span>{connectionState === "offline" ? <WifiOff aria-hidden="true" size={15} /> : <Wifi aria-hidden="true" size={15} />}{connectionState === "offline" ? "Ngoại tuyến" : queue.some((item) => item.status === "failed") ? `${queue.length} cập nhật cần thử lại` : `${queue.length} cập nhật đang chờ`}</span>
        {queue.length && connectionState !== "offline" ? <button aria-busy={syncing} disabled={syncing} onClick={() => void retryQueue()} type="button"><RefreshCw aria-hidden="true" size={15} />Thử lại</button> : null}
      </div> : null}
      {queueError ? <p className={styles.inlineError} role="status">{queueError}</p> : null}
      <WorkspaceNav
        canOpenAttendance={permissions.openAttendance || permissions.adjustAttendance}
        onSelect={navigateWorkspace}
        projectId={project.id}
        section={currentSection}
        selectedWorksiteId={selectedWorksiteId}
        visibleSections={visibleSections}
      />
      <WorkspaceBody>
        <div className={styles.workspaceView} key={currentSection}>
        {currentSection === "today" ? <PackageTodayWorkspace canFieldUpdate={permissions.fieldUpdate} canOpenAttendance={permissions.openAttendance || permissions.adjustAttendance} canViewMaterials={permissions.viewMaterials} canViewTeam={visibleSections.includes("team")} issueLoadError={issueLoadError} nodes={currentProgressNodes} onNavigate={navigateWorkspace} openIssues={openIssues} projectId={project.id} roster={filteredRoster} selectedWorksiteId={selectedWorksiteId} sessions={filteredSessions} today={today} updates={filteredUpdates} /> : null}
        {currentSection === "progress" ? (
          <PackageConstructionWorkspace
            accountId={accountId}
            assignees={[...new Map([...project.assignments.filter(item => item.status === "active").map(item => ({ id: item.employeeId, label: `${item.employeeCode} · ${item.employeeName}` })), ...(project.projectManagerEmployeeId ? [{ id: project.projectManagerEmployeeId, label: project.projectManagerName ?? "Quản lý dự án" }] : [])].map(item => [item.id, item])).values()]}
            canEdit={permissions.editProgress}
            canFieldUpdate={permissions.fieldUpdate}
            initialLoadError={progressLoadError}
            initialNodes={currentProgressNodes}
            onNodesChange={setCurrentProgressNodes}
            projectId={project.id}
            selectedWorksiteId={selectedWorksiteId}
            today={today}
          />
        ) : null}
        {currentSection === "team" ? (
          <PackageAttendanceWorkspace
            attendanceSessions={filteredSessions}
            initialLoadError={attendanceLoadError}
            canAdjustAttendance={permissions.adjustAttendance}
            canExportAttendance={permissions.exportAttendance}
            canManageTeam={permissions.manageTeam}
            canOpenAttendance={permissions.openAttendance}
            canViewAttendance={permissions.viewAttendance}
            project={project}
            key={selectedWorksiteId ?? "all-worksites"}
            selectedWorksiteId={selectedWorksiteId}
            today={today}
            todayRoster={filteredRoster}
          />
        ) : null}
        {currentSection === "profile" ? permissions.viewRecords ? <PackageRecordWorkspace canManageWorksites={permissions.manageWorksites} canUpdateHealth={permissions.updateHealth} canViewDocuments={permissions.viewDocuments} onNavigate={navigateWorkspace} project={project} updates={filteredUpdates} /> : <PermissionDeniedState /> : null}
        {currentSection === "documents" ? permissions.viewDocuments ? <PackageDocumentWorkspace canUpload={permissions.uploadDocuments} projectId={project.id} selectedWorksiteId={selectedWorksiteId} updates={filteredUpdates} /> : <PermissionDeniedState /> : null}
        {currentSection === "materials" ? permissions.viewMaterials ? <PackageMaterialsWorkspace canIssue={permissions.createMaterialIssue} canReceipt={permissions.createMaterialReceipt} canTransfer={permissions.createMaterialTransfer} canViewItems={permissions.viewMaterialItems} canViewLedger={permissions.viewMaterialLedger} key={selectedWorksiteId ?? "all-materials"} projectId={project.id} worksiteId={selectedWorksiteId} /> : <PermissionDeniedState /> : null}
        </div>
      </WorkspaceBody>
    </div>
  );
}

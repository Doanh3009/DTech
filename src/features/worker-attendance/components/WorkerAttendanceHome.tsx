"use client";

import { CalendarDays, ClipboardCheck, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/shared/Button";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Card } from "@/components/shared/Card";
import { Input, Select } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/shared/States";
import { captureAttendanceLocation } from "@/features/attendance/client/locationCapture";
import { cacheWorkerTasks, deleteWorkerDraft, getLatestCachedWorkerTasks, listWorkerDrafts, saveWorkerDraft, type CachedWorkerTasks, type WorkerLocalDraft } from "@/features/worker-attendance/client/workerDraftStore";
import { readWorkerResponse } from "@/features/worker-attendance/client/workerAttendanceSync";
import type { WorkerAttendanceSession, WorkerAttendanceTask } from "@/features/worker-attendance/types/workerAttendanceTypes";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { getBusinessDateKey } from "@/lib/time/timezone";
import { can } from "@/lib/auth/permissions";

const sessionLabels: Record<string, string> = { draft: "Nháp", in_progress: "Đang điểm danh", submitted: "Đã điểm danh", locked: "Đã khóa", needs_review: "Cần rà soát" };
const sessionTones: Record<string, "neutral" | "info" | "success" | "warning"> = { draft: "neutral", in_progress: "info", submitted: "success", locked: "neutral", needs_review: "warning" };

function makeLocalSession(task: WorkerAttendanceTask, clientSessionId: string, location?: WorkerLocalDraft["location"]): WorkerAttendanceSession {
  const now = new Date().toISOString();
  return {
    id: `local-${clientSessionId}`, clientSessionId, projectId: task.projectId, projectName: task.projectName,
    worksiteId: task.worksiteId, worksiteName: task.worksiteName, date: task.date, shiftCode: task.shiftCode,
    shiftName: task.shiftName, sessionType: "morning", supervisorEmployeeId: "local", supervisorName: "",
    startedAt: now, capturedAtClient: now, geofenceStatus: location ? location.accuracy > (task.allowedAccuracyThresholdMeters ?? 100) ? "accuracy_low" : "valid" : task.gpsRequired === false ? "not_required" : "unavailable", latitude: location?.latitude, longitude: location?.longitude, accuracyMeters: location?.accuracy, status: "in_progress", syncStatus: "local_pending",
    photoStatus: "pending_upload", version: 1, photos: [], adjustments: [], checklist: task.checklist, checklistResponses: [],
    entries: task.roster.map((worker) => ({ id: `local-${worker.workerId}`, sessionId: `local-${clientSessionId}`, workerId: worker.workerId, employeeCode: worker.employeeCode, workerName: worker.workerName, assignmentRole: worker.assignmentRole, status: worker.approvedLeave ? "leave" : "unconfirmed", exceptionReason: worker.approvedLeave ? "approved_leave" : undefined, note: worker.approvedLeave ? `${worker.approvedLeave.leaveTypeName} · ${worker.approvedLeave.requestNumber}` : undefined, dayException: "none", isUnplanned: false }))
  };
}

export function WorkerAttendanceToday({ projectId, worksiteId }: { projectId?: string; worksiteId?: string }) {
  const user = useCurrentUser();
  const canCreate = can(user.permissions, "worker_attendance.create");
  const router = useRouter();
  const [data, setData] = useState<CachedWorkerTasks>();
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<string>();
  const [localDrafts, setLocalDrafts] = useState<WorkerLocalDraft[]>([]);
  const date = getBusinessDateKey();
  const visibleTasks = useMemo(() => data?.tasks.filter((task) => (!projectId || task.projectId === projectId) && (!worksiteId || task.worksiteId === worksiteId)) ?? [], [data?.tasks, projectId, worksiteId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    setLocalDrafts(await listWorkerDrafts());
    try {
      const result = await readWorkerResponse<Omit<CachedWorkerTasks, "key" | "date" | "cachedAt">>(await fetch(`/api/v1/worker-attendance/today?date=${date}`, { cache: "no-store" }));
      const cache = { ...result, key: `${result.accountId}:${date}`, date, cachedAt: new Date().toISOString() };
      await cacheWorkerTasks(cache); setData(cache); setOffline(false);
    } catch (caught) {
      const cached = await getLatestCachedWorkerTasks(date);
      if (cached) { setData(cached); setOffline(true); }
      else setError(caught instanceof Error ? caught.message : "Không thể tải lịch điểm danh.");
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => {
    // Initial client-side data load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useDomainReconciliation("worker-attendance", load);

  async function start(task: WorkerAttendanceTask) {
    if (task.existingSessionId) {
      router.push(!canCreate || task.existingStatus === "submitted" || task.existingStatus === "locked" || task.existingStatus === "needs_review" ? `/worker-attendance/sessions/${task.existingSessionId}` : `/worker-attendance/sessions/${task.existingSessionId}/roster`);
      return;
    }
    if (!canCreate) return;
    const resumable = localDrafts.find((item) => item.session.projectId === task.projectId && item.session.worksiteId === task.worksiteId && item.session.date === task.date && item.session.shiftCode === task.shiftCode);
    if (resumable) { router.push(`/worker-attendance/sessions/${resumable.id}/roster`); return; }
    setStarting(`${task.worksiteId}:${task.shiftCode}`);
    setError("");
    const clientSessionId = crypto.randomUUID();
    let location: WorkerLocalDraft["location"];
    try {
      const coordinates = await captureAttendanceLocation(navigator.geolocation, window.isSecureContext);
      location = { latitude: coordinates.latitude, longitude: coordinates.longitude, accuracy: coordinates.accuracy };
    } catch (caught) {
      if (task.gpsRequired !== false) {
        setStarting(undefined);
        setError(caught instanceof Error ? caught.message : "Chưa xác định được GPS.");
        return;
      }
    }
    const localSession = makeLocalSession(task, clientSessionId, location);
    const draft: WorkerLocalDraft = { id: localSession.id, ownerAccountId: data!.accountId, clientSessionId, session: localSession, location, photos: [], pendingSubmit: false, retryCount: 0, updatedAt: new Date().toISOString() };
    try { await saveWorkerDraft(draft); }
    catch { setStarting(undefined); setError("Không thể lưu điểm danh trên thiết bị. Vui lòng thử lại."); return; }
    try {
      const created = await readWorkerResponse<{ session: WorkerAttendanceSession }>(await fetch("/api/v1/worker-attendance/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientSessionId, projectId: task.projectId, worksiteId: task.worksiteId, date: task.date, shiftCode: task.shiftCode, sessionType: "morning", capturedAtClient: localSession.capturedAtClient, location }) }));
      await deleteWorkerDraft(localSession.id);
      await saveWorkerDraft({ ...draft, id: created.session.id, session: created.session });
      router.push(`/worker-attendance/sessions/${created.session.id}/roster`);
    } catch {
      router.push(`/worker-attendance/sessions/${localSession.id}/roster`);
    } finally { setStarting(undefined); }
  }

  if (loading) return <LoadingState title="Đang mở lịch điểm danh" />;
  if (error) return <Card><div className="form-message form-message--error">{error}</div><Button onClick={() => void load()}>Thử lại</Button></Card>;
  return (
    <div className="mobile-task-stack">
      <div className="worker-toolbar">
        <span><CalendarDays aria-hidden="true" size={17} />{new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")}</span>
        {offline ? <StatusBadge tone="warning">Ngoại tuyến</StatusBadge> : <StatusBadge tone="success">Đã đồng bộ</StatusBadge>}
      </div>
      {visibleTasks.length ? visibleTasks.map((task) => {
        const hasLocalDraft = localDrafts.some((item) => item.session.projectId === task.projectId && item.session.worksiteId === task.worksiteId && item.session.date === task.date && item.session.shiftCode === task.shiftCode);
        return (
        <Card className="worker-task-card" key={`${task.projectId}-${task.worksiteId}-${task.shiftCode}`}>
          <header><div><strong>{task.projectName}</strong><span><MapPin size={15} />{task.worksiteName}</span></div>{task.existingStatus ? <StatusBadge tone={sessionTones[task.existingStatus]}>{sessionLabels[task.existingStatus]}</StatusBadge> : hasLocalDraft ? <StatusBadge tone="warning">Bản nháp</StatusBadge> : null}</header>
          <div className="worker-task-stats"><span><Users size={17} />{task.expectedWorkers}</span><span><ClipboardCheck size={17} />{task.shiftName}</span></div>
          {canCreate || task.existingSessionId ? <Button disabled={Boolean(starting)} onClick={() => void start(task)} size="lg" variant="primary" busy={starting === `${task.worksiteId}:${task.shiftCode}`}>
            {task.existingSessionId && (task.existingStatus === "submitted" || task.existingStatus === "locked" || task.existingStatus === "needs_review" || !canCreate) ? "Xem điểm danh" : task.existingSessionId || hasLocalDraft ? "Tiếp tục điểm danh" : "Điểm danh công nhân"}
          </Button> : null}
        </Card>
      ); }) : <Card><div className="empty-compact">Không có ca điểm danh hôm nay.</div></Card>}
    </div>
  );
}

export function WorkerAttendanceSessionList() {
  const [sessions, setSessions] = useState<WorkerAttendanceSession[]>([]);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const load = useCallback(() => fetch("/api/v1/worker-attendance/sessions", { cache: "no-store" }).then(readWorkerResponse<WorkerAttendanceSession[]>).then(setSessions).catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu.")), []);
  useEffect(() => { void load(); }, [load]);
  useDomainReconciliation("worker-attendance", load);
  const visible = useMemo(() => sessions.filter((session) => (!from || session.date >= from) && (!to || session.date <= to) && (!status || session.status === status)), [from, sessions, status, to]);
  if (error) return <Card><div className="form-message form-message--error">{error}</div></Card>;
  return <div className="worker-session-list"><div className="worker-session-filters" data-ui="filter-controls"><Input label="Từ ngày" onChange={(event) => setFrom(event.target.value)} type="date" value={from} /><Input label="Đến ngày" onChange={(event) => setTo(event.target.value)} type="date" value={to} /><Select label="Trạng thái" onChange={(event) => setStatus(event.target.value)} options={Object.entries(sessionLabels).map(([value, label]) => ({ value, label }))} placeholder="Tất cả" value={status} /></div>{visible.length ? visible.map((session) => <Link className="worker-session-row" href={`/worker-attendance/sessions/${session.id}`} key={session.id}><div><strong>{session.projectName}</strong><span>{session.worksiteName} · {new Date(`${session.date}T00:00:00`).toLocaleDateString("vi-VN")}</span></div><StatusBadge tone={sessionTones[session.status]}>{sessionLabels[session.status]}</StatusBadge></Link>) : <Card><div className="empty-compact">Chưa có phiên điểm danh.</div></Card>}</div>;
}

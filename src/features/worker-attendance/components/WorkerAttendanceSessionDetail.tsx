"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { BackLink } from "@/components/shared/BackLink";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Select } from "@/components/shared/FormControls";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { Drawer } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/shared/States";
import { AttendanceLocationAddress } from "@/features/attendance/components/AttendanceLocationAddress";
import { fetchWorkerSession, readWorkerResponse } from "@/features/worker-attendance/client/workerAttendanceSync";
import { countWorkerAttendance } from "@/features/worker-attendance/services/workerAttendanceRules";
import type { WorkerAttendanceEntry, WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { can } from "@/lib/auth/permissions";

import styles from "./WorkerAttendanceSessionDetail.module.css";

const labels: Record<string, string> = { unconfirmed: "Chưa xác nhận", present: "Có mặt", absent: "Vắng", leave: "Nghỉ phép", late: "Đi trễ", transferred: "Điều chuyển", draft: "Nháp", in_progress: "Đang điểm danh", submitted: "Đã điểm danh", locked: "Đã khóa", needs_review: "Cần rà soát" };

export function WorkerAttendanceSessionDetail({ sessionId }: { sessionId: string }) {
  const user = useCurrentUser();
  const [session, setSession] = useState<WorkerAttendanceSession>();
  const [selectedPhoto, setSelectedPhoto] = useState<string>();
  const [editingEntry, setEditingEntry] = useState<string>();
  const [adjustmentStatus, setAdjustmentStatus] = useState<WorkerAttendanceEntry["status"]>("present");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [closingDay, setClosingDay] = useState(false);
  const [dayChanges, setDayChanges] = useState<Record<string, { dayException: WorkerAttendanceEntry["dayException"]; exceptionTime?: string }>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const load = useCallback(() => fetchWorkerSession(sessionId).then(setSession).catch((caught) => setMessage(caught instanceof Error ? caught.message : "Không thể tải phiên.")), [sessionId]);
  useEffect(() => { void load(); }, [load]);
  useDomainReconciliation("worker-attendance", load);
  const counts = useMemo(() => countWorkerAttendance(session?.entries ?? []), [session]);
  const images = useMemo(() => session?.photos.map((photo, index) => ({ id: photo.id, src: `/api/v1/worker-attendance/photos/${photo.id}`, alt: `Ảnh điểm danh ${index + 1}`, title: `${session.projectName} · Ảnh ${index + 1}`, metadata: { "Thời gian": new Date(photo.capturedAt).toLocaleString("vi-VN") } })) ?? [], [session]);

  async function adjust(formData: FormData) {
    if (!session || !editingEntry || saving) return;
    setMessage(""); setActionError(""); setSaving(true);
    try {
      const updated = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${session.id}/adjustments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: session.version, entryId: editingEntry, status: formData.get("status"), reason: formData.get("reason") }) }));
      setSession(updated); setEditingEntry(undefined); setMessage("Đã lưu điều chỉnh.");
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Không thể điều chỉnh."); }
    finally { setSaving(false); }
  }

  function openDayClose() {
    if (!session) return;
    setActionError("");
    setDayChanges(Object.fromEntries(session.entries.filter((entry) => entry.status === "present" || entry.status === "late").map((entry) => [entry.id, { dayException: entry.dayException, exceptionTime: entry.exceptionTime }])));
    setClosingDay(true);
  }

  async function closeDay(formData: FormData) {
    if (!session || saving) return;
    setMessage(""); setActionError(""); setSaving(true);
    try {
      const updated = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${session.id}/close-day`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: session.version, reason: formData.get("reason"), entries: Object.entries(dayChanges).map(([id, value]) => ({ id, dayException: value.dayException, exceptionTime: value.exceptionTime || null })) }) }));
      setSession(updated); setClosingDay(false); setMessage("Đã chốt ngày.");
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Không thể chốt ngày."); }
    finally { setSaving(false); }
  }

  if (!session) return message ? <Card>{message}</Card> : <LoadingState title="Đang mở phiên điểm danh" />;
  const canContinue = can(user.permissions, "worker_attendance.create") && !session.submittedAt && session.status !== "locked";
  const canAdjust = can(user.permissions, "worker_attendance.adjust");
  const canCloseDay = Boolean(session.submittedAt) && !session.dayClosedAt && session.status !== "locked" && (can(user.permissions, "worker_attendance.create") || canAdjust);
  const editedEntry = session.entries.find((entry) => entry.id === editingEntry);
  return <div className="worker-detail">
    <BackLink href="/worker-attendance" />
    <div className="worker-wizard__title"><div><h1>{session.projectName}</h1><span>{session.worksiteName} · {new Date(`${session.date}T00:00:00`).toLocaleDateString("vi-VN")}</span></div><StatusBadge status={session.status}>{labels[session.status]}</StatusBadge></div>
    <div className={styles.actions}>{canContinue ? <Link className="button button--primary button--lg" href={`/worker-attendance/sessions/${session.id}/roster`}>Tiếp tục điểm danh</Link> : null}{session.dayClosedAt ? <StatusBadge tone="success">Đã chốt ngày · {new Date(session.dayClosedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}</StatusBadge> : canCloseDay ? <Button onClick={openDayClose} variant="secondary">Chốt công cuối ngày</Button> : null}</div>
    {message ? <div className="form-message form-message--info">{message}</div> : null}
    <div className="worker-review-grid"><span>Tổng<strong>{counts.total}</strong></span><span>Có mặt<strong>{counts.present}</strong></span><span>Đi trễ<strong>{counts.late}</strong></span><span>Vắng / nghỉ<strong>{counts.absent + counts.leave}</strong></span><span>Ảnh<strong>{session.photos.length}</strong></span><span>Vị trí<strong><AttendanceLocationAddress accuracyMeters={session.accuracyMeters} emptyLabel={session.geofenceStatus === "not_required" ? "Không yêu cầu" : "Chưa có GPS"} knownAddress={session.worksiteAddress} latitude={session.latitude} longitude={session.longitude} referenceName={session.worksiteName} /></strong></span></div>
    <Card><h2 className="section-title">Điểm danh công nhân</h2><div className="worker-detail-table"><div className="worker-detail-table__head"><span>Công nhân</span><span>Trạng thái</span><span></span></div>{session.entries.map((entry) => <div className="worker-detail-table__row" key={entry.id}><span><strong>{entry.workerName}</strong></span><StatusBadge status={entry.status}>{labels[entry.status]}</StatusBadge>{canAdjust ? <Button aria-label={`Điều chỉnh ${entry.workerName}`} onClick={() => { setActionError(""); setAdjustmentStatus(entry.status === "unconfirmed" ? "present" : entry.status); setAdjustmentReason(""); setEditingEntry(entry.id); }} size="sm" variant="ghost">Điều chỉnh</Button> : null}</div>)}</div></Card>
    <Drawer onClose={() => { if (!saving) setEditingEntry(undefined); }} open={Boolean(editedEntry)} title={editedEntry ? `Điểm danh · ${editedEntry.workerName}` : "Điều chỉnh điểm danh"}>{editedEntry ? <form action={adjust} className={styles.form} key={editedEntry.id}><Select disabled={saving} onChange={(event) => setAdjustmentStatus(event.target.value as WorkerAttendanceEntry["status"])} value={adjustmentStatus} label="Trạng thái" name="status" options={[{ value: "present", label: "Có mặt" }, { value: "late", label: "Đi trễ" }, { value: "absent", label: "Vắng" }, { value: "leave", label: "Nghỉ phép" }, { value: "transferred", label: "Điều chuyển" }]} required /><Input label="Lý do điều chỉnh" minLength={3} disabled={saving} name="reason" onChange={(event) => setAdjustmentReason(event.target.value)} required value={adjustmentReason} />{actionError ? <p className="form-message form-message--error" role="alert">{actionError}</p> : null}<div className={styles.footer}><Button disabled={saving} onClick={() => setEditingEntry(undefined)}>Hủy</Button><Button busy={saving} type="submit" variant="primary">Lưu điểm danh</Button></div></form> : null}</Drawer>
    <Drawer onClose={() => { if (!saving) setClosingDay(false); }} open={closingDay} title="Chốt công cuối ngày"><form action={closeDay} className={styles.form}>{Object.entries(dayChanges).map(([id, value]) => { const entry = session.entries.find((item) => item.id === id); if (!entry) return null; return <fieldset className={styles.dayRow} key={id}><legend>{entry.workerName}</legend><Select label="Ngoại lệ" onChange={(event) => setDayChanges((current) => ({ ...current, [id]: { ...current[id], dayException: event.target.value as WorkerAttendanceEntry["dayException"], exceptionTime: event.target.value === "none" ? undefined : current[id].exceptionTime } }))} options={[{ value: "none", label: "Không có" }, { value: "early_leave", label: "Về sớm" }, { value: "transferred", label: "Điều chuyển" }, { value: "half_day", label: "Nửa ngày" }, { value: "overtime", label: "Làm thêm" }, { value: "left_worksite", label: "Rời công trường" }]} value={value.dayException} /><Input disabled={value.dayException === "none"} label="Thời gian" onChange={(event) => setDayChanges((current) => ({ ...current, [id]: { ...current[id], exceptionTime: event.target.value } }))} type="time" value={value.exceptionTime ?? ""} /></fieldset>; })}<Input defaultValue="Chốt công cuối ngày" label="Lý do" minLength={3} name="reason" required />{actionError ? <p className="form-message form-message--error" role="alert">{actionError}</p> : null}<div className={styles.footer}><Button disabled={saving} onClick={() => setClosingDay(false)}>Hủy</Button><Button busy={saving} type="submit" variant="primary">Xác nhận chốt ngày</Button></div></form></Drawer>
    {session.photos.length ? <Card><div className="worker-photo-grid">{session.photos.map((photo, index) => <button className="worker-photo-button" key={photo.id} onClick={() => setSelectedPhoto(photo.id)} type="button"><Image alt={`Ảnh điểm danh ${index + 1}`} height={240} src={`/api/v1/worker-attendance/photos/${photo.id}?size=thumbnail`} unoptimized width={320} /></button>)}</div></Card> : null}
    {session.workNote ? <Card><div className="panel-header"><h3 className="section-title">Nội dung công việc</h3>{session.submittedAt ? <Link href={`/projects/${session.projectId}/updates/new?worksiteId=${session.worksiteId}&attendanceSessionId=${session.id}&content=${encodeURIComponent(session.workNote)}`}><Button variant="primary">Tạo cập nhật dự án</Button></Link> : null}</div><p className="worker-note">{session.workNote}</p></Card> : null}
    {session.adjustments.length ? <Card><h3 className="section-title">Lịch sử điều chỉnh</h3><ol className="worker-adjustments">{session.adjustments.map((item) => <li key={item.id}><span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span><strong>{item.reason}</strong></li>)}</ol></Card> : null}
    <ImageLightbox images={images} initialImageId={selectedPhoto} onClose={() => setSelectedPhoto(undefined)} open={Boolean(selectedPhoto)} />
  </div>;
}

"use client";

import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Lightbox } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AttendanceEvent } from "@/features/attendance/types/attendanceTypes";
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";
import styles from "./AttendanceEvidence.module.css";

const time = (value: string) => new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
const photoLabels = { not_required: "Không có ảnh", pending_upload: "Chờ tải ảnh", uploading: "Đang tải ảnh", uploaded: "Đã có ảnh", upload_failed: "Tải ảnh lỗi" } as const;

function EvidenceImage({ event, employeeName, thumbnail = false, imageUrl, onLoaded }: { event: AttendanceEvent; employeeName: string; thumbnail?: boolean; imageUrl?: string; onLoaded?: (event: AttendanceEvent) => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.imageFailure}><ImageOff aria-hidden="true" size={22} /><span>Ảnh không khả dụng</span></span>;
  // Authenticated API redirects to a short-lived private storage URL.
  return <img alt={`${employeeName} · ${event.eventType === "check_in" ? "Chấm vào" : "Chấm ra"} ${time(event.effectiveAt)}`} decoding="async" height={thumbnail ? 72 : undefined} loading={thumbnail ? "lazy" : "eager"} onError={() => setFailed(true)} onLoad={() => onLoaded?.(event)} src={imageUrl ?? `/api/v1/attendance/photos/${encodeURIComponent(event.photoId!)}${thumbnail ? "?size=thumbnail" : ""}`} width={thumbnail ? 96 : undefined} />; // eslint-disable-line @next/next/no-img-element
}

function GpsEvidence({ event }: { event: AttendanceEvent }) {
  return <AttendanceLocationAddress accuracyMeters={event.accuracyMeters} latitude={event.latitude} longitude={event.longitude} referenceName={event.locationName} />;
}

export function AttendanceEvidence({ event, employeeName, canViewPhotos, onOpen }: { event: AttendanceEvent; employeeName: string; canViewPhotos: boolean; onOpen: () => void }) {
  return <div className={styles.evidence}>
    <strong className={styles.time}>{time(event.effectiveAt)}</strong>
    {event.photoId && event.photoStatus === "uploaded" ? canViewPhotos ? <button aria-label={`Xem ảnh ${event.eventType === "check_in" ? "chấm vào" : "chấm ra"} của ${employeeName} lúc ${time(event.effectiveAt)}`} className={styles.thumbnail} onClick={onOpen} type="button"><EvidenceImage employeeName={employeeName} event={event} key={event.photoId} thumbnail /></button> : <StatusBadge tone="neutral">Không có quyền xem ảnh</StatusBadge> : <StatusBadge tone={event.photoStatus === "upload_failed" ? "error" : event.photoStatus === "not_required" ? "neutral" : "warning"}>{photoLabels[event.photoStatus]}</StatusBadge>}
    <GpsEvidence event={event} />
    {event.attendanceStatus === "rejected" ? <StatusBadge tone="error">Đã từ chối</StatusBadge> : event.attendanceStatus === "needs_review" || event.geofenceStatus === "accuracy_low" ? <StatusBadge tone="warning">Cần kiểm tra</StatusBadge> : null}
  </div>;
}

export interface AttendanceEvidenceItem { employeeName: string; event: AttendanceEvent; imageUrl?: string }

export function AttendanceEvidenceViewer({ items, activeId, onChange, onClose, onPhotoLoaded }: { items: AttendanceEvidenceItem[]; activeId?: string; onChange: (id: string) => void; onClose: () => void; onPhotoLoaded?: (event: AttendanceEvent) => void }) {
  const index = items.findIndex((item) => item.event.id === activeId);
  const current = items[index];
  useEffect(() => {
    if (!current) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const next = event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : undefined;
      if (next === undefined || !items[next]) return;
      event.preventDefault();
      onChange(items[next].event.id);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [current, index, items, onChange]);

  return <Lightbox className={styles.viewer} mediaClassName={styles.viewerMedia} onClose={onClose} open={Boolean(current)} title={current ? `${current.employeeName} · ${current.event.eventType === "check_in" ? "Chấm vào" : "Chấm ra"}` : "Ảnh minh chứng"}>
    {current ? <>
      <div className={styles.viewerImage}><EvidenceImage employeeName={current.employeeName} event={current.event} imageUrl={current.imageUrl} key={`${current.event.id}:${current.event.photoId}`} onLoaded={onPhotoLoaded} /></div>
      <div className={styles.viewerMetadata}><strong>{current.employeeName} · {current.event.attendanceDate.split("-").reverse().join("/")} · {time(current.event.effectiveAt)}</strong><GpsEvidence event={current.event} /></div>
      <footer className={styles.viewerControls}><Button disabled={index === 0} leftIcon={<ChevronLeft aria-hidden="true" size={18} />} onClick={() => onChange(items[index - 1].event.id)}>Ảnh trước</Button><span aria-live="polite">Ảnh {index + 1} / {items.length}</span><Button disabled={index + 1 === items.length} onClick={() => onChange(items[index + 1].event.id)} rightIcon={<ChevronRight aria-hidden="true" size={18} />}>Ảnh sau</Button></footer>
    </> : null}
  </Lightbox>;
}

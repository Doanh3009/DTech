"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, CircleAlert, Clock3, Flag, ImageOff, ListFilter, Maximize2, RefreshCcw, Timer, Undo2, UserCheck, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Input, Select } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/shared/States";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import { useAttendancePhotoReview } from "@/features/attendance/hooks/useAttendancePhotoReview";
import { attendanceEvidenceFingerprint, attendanceReviewReasons, hasReviewablePhotos } from "@/features/attendance/lib/attendancePhotoReview";
import type { AttendanceAdminToday, AttendanceAdminTodayRow, AttendanceEvent, AttendanceType } from "@/features/attendance/types/attendanceTypes";
import styles from "./AttendancePhotoReview.module.css";
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";

const EvidenceViewer = dynamic(() => import("./AttendanceEvidence").then((module) => module.AttendanceEvidenceViewer));
const labels = { present: "Có mặt", late: "Đi muộn", leave: "Nghỉ", not_checked: "Chưa chấm", missing_check: "Thiếu lượt" } as const;
const photoLabels = { not_required: "Không có ảnh", pending_upload: "Chờ đồng bộ ảnh", uploading: "Đang tải ảnh", uploaded: "Đã có ảnh", upload_failed: "Đồng bộ ảnh lỗi" } as const;
const time = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const duration = (minutes: number) => minutes ? [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} giờ` : "", minutes % 60 ? `${minutes % 60} phút` : ""].filter(Boolean).join(" ") : "—";
const uploadedEvents = (row: AttendanceAdminTodayRow) => (row.events ?? []).filter((event) => event.photoId && event.photoStatus === "uploaded");
const evidenceKey = (event: AttendanceEvent) => `${event.id}:${event.photoId}:${event.effectiveAt}`;
const photoUrl = (event: AttendanceEvent, thumbnail = false) => `/api/v1/attendance/photos/${encodeURIComponent(event.photoId!)}${thumbnail ? "?size=thumbnail" : ""}`;
type QueueTab = "unseen" | "flagged" | "waiting" | "all";

interface PhotoReviewProps {
  date: string;
  data?: AttendanceAdminToday;
  error?: string;
  refreshing: boolean;
  ownerAccountId?: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void | Promise<void>;
  resolvePhotoUrl?: (event: AttendanceEvent, thumbnail?: boolean) => string;
}

function QueueThumbnail({ event, name, resolvePhotoUrl }: { event?: AttendanceEvent; name: string; resolvePhotoUrl: typeof photoUrl }) {
  const [failed, setFailed] = useState(false);
  if (!event || failed) return <span className={styles.queueAvatar}><ImageOff aria-hidden="true" size={20} /></span>;
  // Only the small private thumbnail is requested for the contact sheet.
  return <img alt={`Ảnh chấm công của ${name}`} className={styles.queueThumb} decoding="async" height={64} loading="lazy" onError={() => setFailed(true)} src={resolvePhotoUrl(event, true)} width={64} />; // eslint-disable-line @next/next/no-img-element
}

function PhotoCard({ row, eventType, canViewPhotos, onLoaded, onFailed, onOpen, resolvePhotoUrl }: {
  row: AttendanceAdminTodayRow;
  eventType: AttendanceType;
  canViewPhotos: boolean;
  onLoaded: (row: AttendanceAdminTodayRow, event: AttendanceEvent) => void;
  onFailed: (row: AttendanceAdminTodayRow, event: AttendanceEvent) => void;
  onOpen: (id: string) => void;
  resolvePhotoUrl: typeof photoUrl;
}) {
  const events = useMemo(() => (row.events ?? []).filter((event) => event.eventType === eventType).sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)), [row.events, eventType]);
  const [selectedId, setSelectedId] = useState<string>();
  const event = events.find((item) => item.id === selectedId) ?? events[0];
  const [imageState, setImageState] = useState<{ key: string; status: "loaded" | "failed" }>();
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const currentKey = event ? `${evidenceKey(event)}:${attempt}` : "";
  const state = imageState?.key === currentKey ? imageState.status : undefined;
  const hasPhoto = Boolean(event?.photoId && event.photoStatus === "uploaded" && canViewPhotos);
  useLoadingActivity(hasPhoto && !state);
  const heading = eventType === "check_in" ? "Chấm vào" : "Chấm ra";
  const stamp = event?.effectiveAt ?? (eventType === "check_in" ? row.checkIn : row.checkOut);
  const placeholder = event?.photoId && !canViewPhotos ? "Không có quyền xem ảnh" : event ? photoLabels[event.photoStatus] : "Chưa có lượt chấm";

  useEffect(() => {
    // A prerendered/cached image can finish before React attaches its load handler.
    const timer = window.setTimeout(() => {
      const image = imageRef.current;
      if (!event || !image?.complete || image.naturalWidth <= 0) return;
      setImageState((current) => current?.key === currentKey && current.status === "loaded" ? current : { key: currentKey, status: "loaded" });
      onLoaded(row, event);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentKey, event, onLoaded, row]);

  return <article className={styles.photoCard} data-event-type={eventType}>
    <header className={styles.photoHeader}><h3 className={styles.photoLabel}><span className={styles.photoTypeIcon}>{eventType === "check_in" ? <ArrowDownLeft aria-hidden="true" size={18} /> : <ArrowUpRight aria-hidden="true" size={18} />}</span>{heading}</h3><strong className={styles.photoTime}>{time(stamp)}</strong>{events.length > 1 ? <span className={styles.photoCounter}>{events.findIndex((item) => item.id === event?.id) + 1}/{events.length} lượt</span> : null}</header>
    {hasPhoto && event ? state === "failed" ? <div className={styles.photoPlaceholder}><ImageOff aria-hidden="true" size={32} /><strong>Ảnh không khả dụng</strong><Button onClick={() => setAttempt((value) => value + 1)} size="sm">Tải lại ảnh</Button></div> : <button aria-label={`Xem ảnh ${eventType === "check_in" ? "chấm vào" : "chấm ra"} của ${row.employeeName} lúc ${time(stamp)}`} className={styles.photoButton} onClick={() => onOpen(event.id)} type="button">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={`${row.employeeName} · ${heading} ${time(stamp)}`} className={styles.photoImage} decoding="async" fetchPriority="high" key={currentKey} loading="eager" onError={() => { setImageState({ key: currentKey, status: "failed" }); onFailed(row, event); }} onLoad={() => { setImageState({ key: currentKey, status: "loaded" }); onLoaded(row, event); }} ref={imageRef} src={`${resolvePhotoUrl(event)}${attempt ? `?retry=${attempt}` : ""}`} />
      {state === "loaded" ? <span className={styles.photoStatus}><Maximize2 aria-hidden="true" size={14} />Phóng to</span> : null}
    </button> : <div className={styles.photoPlaceholder}><ImageOff aria-hidden="true" size={32} /><strong>{placeholder}</strong>{row.status === "leave" ? <StatusBadge tone="info">Nghỉ</StatusBadge> : null}</div>}
    {events.length > 1 ? <div aria-label={`Các lượt ${heading.toLocaleLowerCase("vi")}`} className={styles.photoStrip}>{events.map((item, index) => <button aria-label={`${heading} lượt ${index + 1} lúc ${time(item.effectiveAt)}`} aria-pressed={item.id === event?.id} className={`${styles.photoStripButton} ${item.id === event?.id ? styles.photoStripActive : ""}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">{time(item.effectiveAt)}{item.photoStatus !== "uploaded" ? <ImageOff aria-hidden="true" size={14} /> : null}</button>)}</div> : null}
    <footer className={styles.photoFooter}>
      <AttendanceLocationAddress accuracyMeters={event?.accuracyMeters} latitude={event?.latitude} longitude={event?.longitude} referenceName={event?.locationName} />
      {event ? <StatusBadge tone={event.attendanceStatus === "rejected" ? "error" : event.attendanceStatus === "needs_review" ? "warning" : "success"}>{event.attendanceStatus === "rejected" ? "Đã từ chối" : event.attendanceStatus === "needs_review" ? "Cần xác minh" : "Đã ghi nhận"}</StatusBadge> : null}
    </footer>
  </article>;
}

export function AttendancePhotoReview({ date, data, error, refreshing, ownerAccountId, onDateChange, onRefresh, resolvePhotoUrl = photoUrl }: PhotoReviewProps) {
  useLoadingActivity(refreshing);
  const [tab, setTab] = useState<QueueTab>("unseen");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [status, setStatus] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const [queueLimit, setQueueLimit] = useState(40);
  const [seenEvidence, setSeenEvidence] = useState<Set<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [undoEmployeeId, setUndoEmployeeId] = useState<string>();
  const rootRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const canViewPhotos = Boolean(data?.canViewPhotos);
  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const review = useAttendancePhotoReview({ ownerAccountId, date, rows: allRows });
  const departments = useMemo(() => [...new Map(allRows.filter((row) => row.departmentId).map((row) => [row.departmentId!, row.departmentName])).entries()], [allRows]);
  const shifts = useMemo(() => [...new Map(allRows.filter((row) => row.shiftId).map((row) => [row.shiftId!, row.shiftName])).entries()], [allRows]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return allRows.filter((row) => {
      if (departmentId && row.departmentId !== departmentId || shiftId && row.shiftId !== shiftId || status && row.status !== status) return false;
      if (keyword && !`${row.employeeName} ${row.employeeCode}`.toLocaleLowerCase("vi").includes(keyword)) return false;
      const events = row.events ?? [];
      if (evidenceFilter === "uploaded") return hasReviewablePhotos(row);
      if (evidenceFilter === "pending") return events.some((event) => ["pending_upload", "uploading", "upload_failed"].includes(event.photoStatus));
      if (evidenceFilter === "missing") return !hasReviewablePhotos(row) || events.some((event) => !event.photoId || event.photoStatus !== "uploaded");
      if (evidenceFilter === "review") return attendanceReviewReasons(row).length > 0;
      return true;
    });
  }, [allRows, search, departmentId, shiftId, status, evidenceFilter]);
  const counts = {
    unseen: filtered.filter((row) => hasReviewablePhotos(row) && !review.getReviewState(row)).length,
    flagged: filtered.filter((row) => review.getReviewState(row) === "flagged").length,
    waiting: filtered.filter((row) => !hasReviewablePhotos(row)).length,
    all: filtered.length
  };
  const queue = filtered.filter((row) => {
    if (tab === "unseen") return hasReviewablePhotos(row) && !review.getReviewState(row);
    if (tab === "flagged") return review.getReviewState(row) === "flagged";
    if (tab === "waiting") return !hasReviewablePhotos(row);
    return true;
  }).sort((a, b) => {
    const priority = (row: AttendanceAdminTodayRow) => review.getReviewState(row) === "reviewed" ? 3 : !hasReviewablePhotos(row) ? 2 : attendanceReviewReasons(row).length ? 0 : 1;
    return priority(a) - priority(b) || a.employeeName.localeCompare(b.employeeName, "vi");
  });
  const activeRow = queue.find((row) => row.employeeId === selectedEmployeeId) ?? queue[0];
  const activeIndex = activeRow ? queue.indexOf(activeRow) : -1;
  const activeEvents = activeRow ? uploadedEvents(activeRow) : [];
  const unseenPhotoCount = activeEvents.filter((event) => !seenEvidence.has(`${attendanceEvidenceFingerprint(activeRow!)}:${evidenceKey(event)}`)).length;
  const pendingPhotos = activeRow?.events?.some((event) => ["pending_upload", "uploading", "upload_failed"].includes(event.photoStatus));
  const canMarkReviewed = Boolean(activeRow && canViewPhotos && review.ready && activeEvents.length && !unseenPhotoCount && !pendingPhotos);
  const photosTotal = allRows.reduce((sum, row) => sum + uploadedEvents(row).length, 0);
  const reviewableRows = allRows.filter(hasReviewablePhotos);
  const reviewedCount = reviewableRows.filter((row) => review.getReviewState(row) === "reviewed").length;
  const flaggedCount = allRows.filter((row) => review.getReviewState(row) === "flagged").length;
  const hasFilters = Boolean(departmentId || shiftId || status || evidenceFilter);
  const reasons = activeRow ? attendanceReviewReasons(activeRow) : [];
  const gallery = useMemo(() => canViewPhotos ? allRows.flatMap((row) => uploadedEvents(row).map((event) => ({ employeeName: row.employeeName, event, imageUrl: resolvePhotoUrl(event) }))) : [], [allRows, canViewPhotos, resolvePhotoUrl]);
  const openPhotoId = gallery.some((item) => item.event.id === activePhotoId) ? activePhotoId : undefined;

  useEffect(() => {
    if (!activePhotoId || openPhotoId) return;
    const timer = window.setTimeout(() => setActivePhotoId(undefined), 0);
    return () => window.clearTimeout(timer);
  }, [activePhotoId, openPhotoId]);

  const onLoaded = useCallback((row: AttendanceAdminTodayRow, event: AttendanceEvent) => {
    const key = `${attendanceEvidenceFingerprint(row)}:${evidenceKey(event)}`;
    setSeenEvidence((current) => current.has(key) ? current : new Set(current).add(key));
  }, []);
  const onFailed = useCallback((row: AttendanceAdminTodayRow, event: AttendanceEvent) => {
    const key = `${attendanceEvidenceFingerprint(row)}:${evidenceKey(event)}`;
    setSeenEvidence((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);
  const focusInspector = () => {
    window.requestAnimationFrame(() => {
      inspectorRef.current?.focus({ preventScroll: true });
      if (window.innerWidth <= 1023) inspectorRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const chooseEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setShowQueue(false);
    focusInspector();
  };
  const moveEmployee = (delta: number) => {
    const index = activeIndex + delta;
    if (index < 0 || index >= queue.length) return;
    setQueueLimit((limit) => Math.max(limit, index + 1));
    chooseEmployee(queue[index].employeeId);
  };
  const markAndNext = (state: "reviewed" | "flagged") => {
    if (!activeRow || !review.ready || !canViewPhotos || state === "reviewed" && !canMarkReviewed) return;
    const next = queue.slice(activeIndex + 1).find((row) => !review.getReviewState(row)) ?? queue.find((row) => row.employeeId !== activeRow.employeeId && !review.getReviewState(row)) ?? queue[activeIndex + 1] ?? queue.find((row) => row.employeeId !== activeRow.employeeId);
    const previousState = review.getReviewState(activeRow);
    const nextState = state === "flagged" && previousState === "flagged" ? undefined : state;
    review.setReviewState(activeRow, nextState);
    if (previousState !== nextState) setUndoEmployeeId(activeRow.employeeId);
    setAnnouncement(`${activeRow.employeeName}: ${nextState === "reviewed" ? "đã xem ảnh" : nextState === "flagged" ? "đã đánh dấu" : "đã bỏ đánh dấu"}`);
    setSelectedEmployeeId(next?.employeeId);
    focusInspector();
  };
  const undo = () => {
    review.undo();
    setTab("all");
    setSelectedEmployeeId(undoEmployeeId);
    setAnnouncement("Đã hoàn tác thao tác vừa rồi");
    focusInspector();
  };
  const changeDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setSelectedEmployeeId(undefined);
    setActivePhotoId(undefined);
    setSeenEvidence(new Set());
    setAnnouncement("");
    onDateChange(value);
  };
  const stepDay = (delta: number) => {
    const day = new Date(`${date}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + delta);
    changeDate(day.toISOString().slice(0, 10));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (openPhotoId || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, select, textarea, [contenteditable], [role=dialog], [role=combobox]")) return;
      if (target && target !== document.body && !rootRef.current?.contains(target)) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); moveEmployee(event.key === "ArrowLeft" ? -1 : 1); }
      else if (event.key === "Enter" && !target?.closest("button,a")) { event.preventDefault(); markAndNext("reviewed"); }
      else if (event.key.toLowerCase() === "f") { event.preventDefault(); markAndNext("flagged"); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // Warm only the next person's first in/out image, after this pair is visible.
  // Do not cache private photo redirects or eagerly download the whole day.
  useEffect(() => {
    if (!canViewPhotos || !activeEvents.length || unseenPhotoCount) return;
    const next = queue[activeIndex + 1];
    if (!next) return;
    const images = (["check_in", "check_out"] as const).flatMap((type) => {
      const event = uploadedEvents(next).find((item) => item.eventType === type);
      if (!event) return [];
      const image = new window.Image();
      image.decoding = "async";
      image.src = resolvePhotoUrl(event);
      return [image];
    });
    return () => { images.forEach((image) => { image.onload = null; image.onerror = null; }); };
  // Queue identity changes as progress changes; preload only when the neighbor changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewPhotos, date, activeRow?.employeeId, queue[activeIndex + 1]?.employeeId, unseenPhotoCount, resolvePhotoUrl]);

  return <div className={styles.workspace} ref={rootRef}>
    {data ? <dl aria-label="Tổng quan chấm công" className={styles.metrics}>
      {[
        { label: "Nhân viên", value: data.totalEmployees, icon: Users, tone: "neutral" },
        { label: "Có mặt", value: data.present, icon: UserCheck, tone: "success" },
        { label: "Đi muộn", value: data.late, icon: Clock3, tone: "warning" },
        { label: "Nghỉ", value: data.leave, icon: UserMinus, tone: "info" },
        { label: "Chưa / thiếu lượt", value: data.notChecked + data.missingCheck, icon: CircleAlert, tone: "warning" }
      ].map(({ label, value, icon: Icon, tone }) => <div className={styles.metric} data-tone={tone} key={label}><dt>{label}</dt><dd>{value}</dd><span aria-hidden="true" className={styles.metricIcon}><Icon size={20} /></span></div>)}
    </dl> : null}
    <header className={styles.toolbar}>
      <div className={styles.toolbarMain} data-ui="filter-controls"><span aria-hidden="true" className={styles.calendarIcon}><CalendarDays size={20} /></span><div className={styles.dayNav}><Button aria-label="Ngày trước" onClick={() => stepDay(-1)} size="sm"><ChevronLeft aria-hidden="true" size={18} /></Button><Input className={styles.dateInput} label="Ngày" labelHidden onChange={(event) => changeDate(event.target.value)} type="date" value={date} /><Button aria-label="Ngày sau" onClick={() => stepDay(1)} size="sm"><ChevronRight aria-hidden="true" size={18} /></Button></div><Button disabled={date === today()} onClick={() => changeDate(today())} size="sm">Hôm nay</Button></div>
      <div className={styles.toolbarActions} data-ui="actions"><Button aria-expanded={showFilters} aria-controls="attendance-photo-filters" leftIcon={<ListFilter aria-hidden="true" size={16} />} onClick={() => setShowFilters((value) => !value)} size="sm">Bộ lọc{hasFilters ? " •" : ""}</Button><Button aria-label="Làm mới ảnh chấm công" busy={refreshing} className={styles.refreshButton} leftIcon={<RefreshCcw aria-hidden="true" size={16} />} onClick={() => void onRefresh()} size="sm">Làm mới</Button><Link className="button button--secondary button--sm" href="/attendance/logs">Nhật ký công</Link></div>
    </header>
    {data ? <div className={styles.progress}><span><CheckCheck aria-hidden="true" size={18} /><strong>{reviewedCount}/{reviewableRows.length}</strong> đã xem</span><div aria-label="Tiến độ xem ảnh" aria-valuemax={reviewableRows.length || 1} aria-valuemin={0} aria-valuenow={reviewedCount} className={styles.progressTrack} role="progressbar"><span className={styles.progressFill} style={{ width: `${reviewableRows.length ? reviewedCount / reviewableRows.length * 100 : 0}%` }} /></div><span>{photosTotal} ảnh</span>{flaggedCount ? <span><Flag aria-hidden="true" size={14} />{flaggedCount} đánh dấu</span> : null}<span>{review.persistenceAvailable ? "Trên thiết bị này" : "Trong phiên này"}</span></div> : null}
    {showFilters ? <div aria-label="Bộ lọc chấm công" className={styles.filters} data-ui="filter-controls" id="attendance-photo-filters"><Select label="Phòng ban" onChange={(event) => { setDepartmentId(event.target.value); setQueueLimit(40); }} options={[{ label: "Tất cả", value: "" }, ...departments.map(([id, name]) => ({ label: name, value: id }))]} value={departmentId} /><Select label="Ca" onChange={(event) => setShiftId(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...shifts.map(([id, name]) => ({ label: name, value: id }))]} value={shiftId} /><Select label="Trạng thái" onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(labels).map(([key, value]) => ({ label: value, value: key }))]} value={status} /><Select label="Minh chứng" onChange={(event) => { setEvidenceFilter(event.target.value); setTab("all"); }} options={[{ label: "Tất cả", value: "" }, { label: "Có ảnh", value: "uploaded" }, { label: "Ảnh chưa đồng bộ", value: "pending" }, { label: "Thiếu ảnh", value: "missing" }, { label: "Bất thường", value: "review" }]} value={evidenceFilter} />{hasFilters ? <Button onClick={() => { setDepartmentId(""); setShiftId(""); setStatus(""); setEvidenceFilter(""); }} size="sm">Xóa lọc</Button> : null}</div> : null}
    {error ? <div className={styles.error} role="alert"><span>{error}</span><Button onClick={() => void onRefresh()} size="sm">Thử lại</Button></div> : null}
    {!data ? !error ? <LoadingState className={styles.loading} title="Đang mở ảnh chấm công" /> : null : <>
      {!canViewPhotos ? <div className={styles.error} role="status"><ImageOff aria-hidden="true" size={20} /><strong>Không có quyền xem ảnh chấm công</strong></div> : null}
      <div aria-label="Nhóm ảnh" className={styles.queueTabs}>{([["unseen", "Chưa xem"], ["flagged", "Đánh dấu"], ["waiting", "Thiếu ảnh"], ["all", "Tất cả"]] as const).map(([value, label]) => <button aria-pressed={tab === value} className={`${styles.queueTab} ${tab === value ? styles.queueTabActive : ""}`} data-tab={value} key={value} onClick={() => { setTab(value); setSelectedEmployeeId(undefined); setQueueLimit(40); }} type="button"><span>{label}</span><strong>{counts[value]}</strong></button>)}</div>
      {queue.length ? <Button aria-controls="attendance-photo-queue" aria-expanded={showQueue} className={styles.mobileQueueToggle} onClick={() => setShowQueue((value) => !value)} size="sm"><span>{showQueue ? "Đóng danh sách" : "Chọn nhân viên"}</span><strong>{queue.length}</strong><ChevronRight aria-hidden="true" size={17} /></Button> : null}
      <div className={styles.reviewLayout}>
        <aside aria-label="Hàng đợi kiểm tra ảnh" className={`${styles.queuePanel} ${showQueue ? styles.mobileQueueOpen : ""}`} id="attendance-photo-queue">
          <div className={styles.queueHeader}><h2>Ảnh theo nhân viên</h2><span>{filtered.length} người</span></div>
          <div className={styles.queueSearch}><Input label="Nhân viên" labelHidden onChange={(event) => { setSearch(event.target.value); setTab(event.target.value ? "all" : "unseen"); setQueueLimit(40); }} placeholder="Tìm tên hoặc mã nhân viên" type="search" value={search} /></div>
          <div className={styles.queueList}>{queue.length ? queue.slice(0, queueLimit).map((row) => {
            const state = review.getReviewState(row);
            const rowReasons = attendanceReviewReasons(row);
            const photo = canViewPhotos ? uploadedEvents(row)[0] : undefined;
            return <button aria-label={`Kiểm tra ${row.employeeName}${state === "reviewed" ? " · Đã xem" : state === "flagged" ? " · Đánh dấu" : ""}`} aria-current={activeRow?.employeeId === row.employeeId ? "true" : undefined} className={`${styles.queueItem} ${activeRow?.employeeId === row.employeeId ? styles.queueItemActive : ""} ${state === "reviewed" ? styles.queueItemReviewed : ""}`} key={row.employeeId} onClick={() => chooseEmployee(row.employeeId)} type="button"><QueueThumbnail event={photo} key={photo?.photoId ?? "none"} name={row.employeeName} resolvePhotoUrl={resolvePhotoUrl} /><span className={styles.queueIdentity}><strong className={styles.queueName}>{row.employeeName}</strong><span className={styles.queueMeta}>{row.employeeCode} · {time(row.checkIn)} – {time(row.checkOut)}</span><span className={styles.queueBadges}>{state === "reviewed" ? <StatusBadge tone="success"><Check aria-hidden="true" size={12} /> Đã xem</StatusBadge> : state === "flagged" ? <StatusBadge tone="warning"><Flag aria-hidden="true" size={12} /> Đánh dấu</StatusBadge> : rowReasons.length ? <StatusBadge tone="warning">{rowReasons[0]}{rowReasons.length > 1 ? ` +${rowReasons.length - 1}` : ""}</StatusBadge> : <StatusBadge tone={photo ? "neutral" : "info"}>{photo ? `${uploadedEvents(row).length} ảnh` : labels[row.status]}</StatusBadge>}</span></span></button>;
          }) : <div className={styles.queueEmpty}>{tab === "unseen" ? "Không còn ảnh chưa xem" : "Không có nhân viên phù hợp"}</div>}{queue.length > queueLimit ? <Button className={styles.queueMore} onClick={() => setQueueLimit((value) => value + 40)} size="sm">Xem thêm {Math.min(queue.length - queueLimit, 40)} người</Button> : null}</div>
        </aside>
        <section aria-label="Kiểm tra ảnh nhân viên" className={styles.inspector} ref={inspectorRef} tabIndex={-1}>
          {activeRow ? <>
            <header className={styles.inspectorHeader}><span aria-hidden="true" className={styles.personAvatar}>{activeRow.employeeName.trim().split(/\s+/).filter((_, index, parts) => index === 0 || index === parts.length - 1).map((part) => part[0]).join("").slice(0, 2)}</span><div className={styles.identity}><h2 className={styles.personName}>{activeRow.employeeName}</h2><div className={styles.personMeta}><span className={styles.employeeCode}>{activeRow.employeeCode}</span><span>{activeRow.departmentName}</span><span>{activeRow.shiftName}</span></div></div><div className={styles.position}><StatusBadge tone={activeRow.status === "late" || activeRow.status === "missing_check" ? "warning" : activeRow.status === "present" ? "success" : "neutral"}>{labels[activeRow.status]}</StatusBadge><span>{activeIndex + 1}/{queue.length} người</span></div></header>
            <dl aria-label="Thời gian công" className={styles.personStats}><div><dt><Timer aria-hidden="true" size={15} />Thời gian làm</dt><dd>{duration(activeRow.totalMinutes)}</dd></div><div data-alert={activeRow.lateMinutes > 0 || undefined}><dt>Đi muộn</dt><dd>{activeRow.lateMinutes} phút</dd></div><div data-alert={activeRow.earlyLeaveMinutes > 0 || undefined}><dt>Về sớm</dt><dd>{activeRow.earlyLeaveMinutes} phút</dd></div></dl>
            {reasons.length ? <div aria-label="Dấu hiệu cần kiểm tra" className={styles.reasonList}>{reasons.map((reason) => <span className={styles.reason} key={reason}><Flag aria-hidden="true" size={13} />{reason}</span>)}</div> : null}
            <div className={styles.photos}><PhotoCard canViewPhotos={canViewPhotos} eventType="check_in" key={`${activeRow.employeeId}:in:${attendanceEvidenceFingerprint(activeRow)}`} onFailed={onFailed} onLoaded={onLoaded} onOpen={setActivePhotoId} resolvePhotoUrl={resolvePhotoUrl} row={activeRow} /><PhotoCard canViewPhotos={canViewPhotos} eventType="check_out" key={`${activeRow.employeeId}:out:${attendanceEvidenceFingerprint(activeRow)}`} onFailed={onFailed} onLoaded={onLoaded} onOpen={setActivePhotoId} resolvePhotoUrl={resolvePhotoUrl} row={activeRow} /></div>
            <footer className={styles.actionBar}>
              <div className={styles.actionGroup}>
                <Button aria-label="Nhân viên trước" disabled={activeIndex <= 0} onClick={() => moveEmployee(-1)} size="sm"><ChevronLeft aria-hidden="true" size={18} /></Button>
                <Button aria-label="Nhân viên sau" disabled={activeIndex + 1 >= queue.length} onClick={() => moveEmployee(1)} size="sm"><ChevronRight aria-hidden="true" size={18} /></Button>
                <span className={styles.shortcut}><kbd>←</kbd><kbd>→</kbd></span>
                <Button disabled={!review.canUndo} leftIcon={<Undo2 aria-hidden="true" size={16} />} onClick={undo} size="sm">Hoàn tác</Button>
              </div>
              <div className={styles.actionGroup}>
                <Button disabled={!review.ready || !canViewPhotos} leftIcon={<Flag aria-hidden="true" size={16} />} onClick={() => markAndNext("flagged")} size="sm">{review.getReviewState(activeRow) === "flagged" ? "Bỏ đánh dấu" : "Đánh dấu"} <kbd className={styles.shortcut}>F</kbd></Button>
                <Button disabled={!canMarkReviewed} leftIcon={<Check aria-hidden="true" size={17} />} onClick={() => markAndNext("reviewed")} title={!canViewPhotos ? "Không có quyền xem ảnh" : pendingPhotos ? "Ảnh chưa đồng bộ đầy đủ" : unseenPhotoCount ? `Còn ${unseenPhotoCount} ảnh chưa xem hoặc chưa tải được` : undefined} variant="primary">Đã xem và tiếp <kbd className={styles.shortcut}>Enter</kbd></Button>
              </div>
            </footer>
            {canViewPhotos && (unseenPhotoCount > 0 || pendingPhotos) ? <div aria-live="polite" className={styles.photoCounter}>{pendingPhotos ? "Còn ảnh chưa đồng bộ" : `${unseenPhotoCount} ảnh chưa xem hoặc đang tải`}</div> : null}
          </> : <div className={styles.complete}>{tab === "unseen" && reviewableRows.length && !search && !hasFilters ? <CheckCheck aria-hidden="true" size={32} /> : <ImageOff aria-hidden="true" size={32} />}<h2>{tab === "unseen" && reviewableRows.length && !search && !hasFilters ? "Đã xem hết ảnh trong ngày" : photosTotal === 0 && !search && !hasFilters ? "Chưa có ảnh chấm công" : "Không có ảnh trong nhóm này"}</h2><div className={styles.emptyActions}>{counts.flagged ? <Button onClick={() => setTab("flagged")} size="sm">Xem {counts.flagged} người đánh dấu</Button> : null}{counts.waiting && tab !== "waiting" ? <Button onClick={() => { setTab("waiting"); setShowQueue(true); }} size="sm">Thiếu ảnh · {counts.waiting} người</Button> : null}{counts.all && tab !== "all" ? <Button onClick={() => { setTab("all"); setShowQueue(true); }} size="sm">Tất cả · {counts.all} người</Button> : null}{review.canUndo ? <Button onClick={undo} size="sm">Hoàn tác</Button> : null}</div></div>}
        </section>
      </div>
    </>}
    <span aria-live="polite" className="sr-only" role="status">{announcement}</span>
    {openPhotoId ? <EvidenceViewer activeId={openPhotoId} items={gallery} onChange={setActivePhotoId} onClose={() => setActivePhotoId(undefined)} onPhotoLoaded={(event) => { const row = allRows.find((item) => item.employeeId === event.employeeId); if (row) onLoaded(row, event); }} /> : null}
  </div>;
}

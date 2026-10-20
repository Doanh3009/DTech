"use client";

import { CalendarDays, Eye, ImageOff, LogIn, LogOut, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Input } from "@/components/shared/FormControls";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs } from "@/components/shared/Tabs";
import { attendanceRecordHref } from "@/features/attendance/attendanceNavigation";
import type { AttendanceEvent } from "@/features/attendance/types/attendanceTypes";
import styles from "./AttendanceRecords.module.css";
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";

function time(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function AttendanceRecords({ admin = false, employeeId }: { admin?: boolean; employeeId?: string }) {
  const [records, setRecords] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (employeeId) query.set("employeeId", employeeId);
      const response = await fetch(`/api/v1/attendance/records?${query}`, { cache: "no-store" });
      const body = await response.json() as { data?: AttendanceEvent[]; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message);
      setRecords(body.data);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách.");
    } finally { setLoading(false); }
  }, [from, to, employeeId]);
  useEffect(() => { queueMicrotask(() => void load()); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const images = useMemo(() => records.filter((record) => record.photoId).map((record) => ({
    id: record.photoId!,
    src: `/api/v1/attendance/photos/${record.photoId}`,
    alt: `Ảnh chấm công ${record.employeeName?.trim() || "Nhân viên"}`,
    title: `${record.employeeName ?? "Nhân viên"} · ${time(record.effectiveAt)}`,
    metadata: { "Nhân viên": record.employeeName ?? "—", "Loại": record.eventType === "check_in" ? "Chấm vào" : "Chấm ra", "Địa điểm": record.locationName ?? "—", "Vị trí": record.geofenceStatus === "valid" ? "Hợp lệ" : "Cần kiểm tra", "Đồng bộ": record.syncStatus === "synced" ? "Đã đồng bộ" : "Đang chờ" }
  })), [records]);

  const columns: DataTableColumn<AttendanceEvent>[] = [
    { id: "employee", header: "Nhân viên", priority: "primary", cell: (row) => <Link className={`text-link ${styles.employee}`} href={attendanceRecordHref(row.id, admin ? "/attendance/logs" : "/attendance/history")}><span aria-hidden="true" className={styles.avatar}>{(row.employeeName?.trim() || "Nhân viên").split(/\s+/).slice(-2).map((part) => part.charAt(0)).join("")}</span><strong>{row.employeeName?.trim() || "Nhân viên"}</strong></Link> },
    { id: "time", header: "Thời gian", cell: (row) => <time className={styles.timestamp} dateTime={row.effectiveAt}><strong>{new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(row.effectiveAt))}</strong><span>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(row.effectiveAt))}</span></time> },
    { id: "type", header: "Loại", width: "compact", cell: (row) => <span className={styles.eventType} data-type={row.eventType}>{row.eventType === "check_in" ? <LogIn aria-hidden="true" size={15} /> : <LogOut aria-hidden="true" size={15} />}{row.eventType === "check_in" ? "Chấm vào" : "Chấm ra"}</span> },
    { id: "location", header: "Địa điểm", cell: (row) => <AttendanceLocationAddress accuracyMeters={row.accuracyMeters} latitude={row.latitude} longitude={row.longitude} referenceName={row.locationName} />, hiddenOnMobile: true },
    { id: "status", header: "Trạng thái", cell: (row) => <StatusBadge status={row.attendanceStatus} /> },
    { id: "photo", header: "Ảnh", width: "compact", cell: (row) => row.photoId ? <Button aria-label="Xem ảnh" className={styles.photoAction} leftIcon={<Eye aria-hidden="true" size={15} />} onClick={() => setActivePhotoId(row.photoId)} size="sm" title="Xem ảnh">Xem ảnh</Button> : <span className={`attendance-no-photo ${styles.noPhoto}`}><ImageOff aria-hidden="true" size={15} />{row.photoStatus === "not_required" ? "Không yêu cầu" : "Chưa đồng bộ"}</span> }
  ];

  return (
    <ListPageLayout className={`attendance-page ${styles.page}`}>
      {!admin ? <Tabs label="Chấm công cá nhân" items={[{ label: "Hôm nay", href: "/attendance/me" }, { label: "Lịch công", href: "/attendance/history" }]} /> : null}
      <DataSurface className={styles.surface}>
        <div className={styles.listHeading}><div><span aria-hidden="true" className={styles.headingIcon}><CalendarDays size={20} /></span><h2>Lượt chấm công</h2></div><span className={styles.recordCount}>{loading ? "—" : records.length} lượt</span></div>
        <div className={`data-surface__toolbar ${styles.toolbar}`}><FilterBar actions={<Button leftIcon={<SlidersHorizontal aria-hidden="true" size={16} />} onClick={() => void load()} variant="primary">Lọc</Button>} onApply={() => void load()} onReset={() => { setFrom(""); setTo(""); }}><Input label="Từ ngày" onChange={(event) => setFrom(event.target.value)} type="date" value={from} /><Input label="Đến ngày" onChange={(event) => setTo(event.target.value)} type="date" value={to} /></FilterBar></div>
        <DataTable ariaLabel="Danh sách lượt chấm công" className={styles.table} columns={columns} data={records} emptyDescription="Chưa có lượt chấm công phù hợp." emptyTitle="Không có dữ liệu" error={error} getRowId={(row) => row.id} loading={loading} />
      </DataSurface>
      <ImageLightbox images={images} initialImageId={activePhotoId} onClose={() => setActivePhotoId(undefined)} open={Boolean(activePhotoId)} />
    </ListPageLayout>
  );
}

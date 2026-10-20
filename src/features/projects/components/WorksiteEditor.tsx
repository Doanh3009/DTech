"use client";
import { LocateFixed } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Checkbox, Input, Select } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Worksite } from "../types/projectTypes";
import styles from "./WorksiteEditor.module.css";
export function WorksiteEditor({ projectId, initial, onSaved, onCancel, onBusyChange }: { projectId: string; initial?: Worksite; onSaved: () => void; onCancel: () => void; onBusyChange?: (busy: boolean) => void }) {
  const pending = useRef(false);
  const [site, setSite] = useState<Partial<Worksite>>(initial ?? { gpsRequired: true, radiusMeters: 200, allowedAccuracyThresholdMeters: 100, status: "active" }), [busy, setBusy] = useState(false), [locating, setLocating] = useState(false), [error, setError] = useState("");
  const change = (patch: Partial<Worksite>) => setSite(current => ({ ...current, ...patch }));
  function locate() {
    if (!navigator.geolocation || locating) return;
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(position => { change({ latitude: Number(position.coords.latitude.toFixed(7)), longitude: Number(position.coords.longitude.toFixed(7)) }); setLocating(false); }, caught => { setError(caught.code === 1 ? "Trình duyệt chưa được cấp quyền vị trí." : "Chưa lấy được vị trí. Nhập tọa độ hoặc thử lại."); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/worksites${initial ? `/${initial.id}` : ""}`, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(45000), body: JSON.stringify({ name: site.name, address: site.address || undefined, latitude: site.latitude, longitude: site.longitude, radiusMeters: site.radiusMeters, gpsRequired: site.gpsRequired, allowedAccuracyThresholdMeters: site.allowedAccuracyThresholdMeters, activeFrom: site.activeFrom || undefined, activeTo: site.activeTo || undefined, ...(initial ? { status: site.status, updatedAt: initial.updatedAt } : {}) }) });
      const body = await response.json() as { error?: { message?: string } }; if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu công trường."); onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu công trường."); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <form className={`drawer-form ${styles.form}`} onSubmit={submit}><fieldset disabled={busy} className={styles.fields}><Input label="Tên công trường" maxLength={160} minLength={2} onChange={event => change({ name: event.target.value })} required value={site.name ?? ""} /><Input label="Địa chỉ" maxLength={300} onChange={event => change({ address: event.target.value })} value={site.address ?? ""} />{initial ? <Select label="Trạng thái" onChange={event => change({ status: event.target.value as Worksite["status"] })} options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Tạm ngừng" }, { value: "closed", label: "Đã đóng" }]} value={site.status ?? "active"} /> : null}<div className={styles.twoColumns}><Input label="Từ ngày" onChange={event => change({ activeFrom: event.target.value })} type="date" value={site.activeFrom ?? ""} /><Input label="Đến ngày" min={site.activeFrom || undefined} onChange={event => change({ activeTo: event.target.value })} type="date" value={site.activeTo ?? ""} /></div><section className={styles.location}><header><strong>Vị trí chấm công</strong><StatusBadge tone={site.latitude != null && site.longitude != null ? "success" : "neutral"}>{site.latitude != null && site.longitude != null ? "Đã có tọa độ" : "Chưa ghi tọa độ"}</StatusBadge></header><Button busy={locating} disabled={busy || locating} leftIcon={<LocateFixed size={17} />} onClick={locate}>Lấy vị trí hiện tại</Button><div className={styles.twoColumns}><Input label="Vĩ độ" max="90" min="-90" onChange={event => change({ latitude: event.target.value === "" ? undefined : Number(event.target.value) })} step="any" type="number" value={site.latitude ?? ""} /><Input label="Kinh độ" max="180" min="-180" onChange={event => change({ longitude: event.target.value === "" ? undefined : Number(event.target.value) })} step="any" type="number" value={site.longitude ?? ""} /><Input label="Bán kính (m)" max="5000" min="10" onChange={event => change({ radiusMeters: Number(event.target.value) })} required type="number" value={site.radiusMeters ?? 200} /><Input label="Sai số GPS tối đa (m)" max="1000" min="10" onChange={event => change({ allowedAccuracyThresholdMeters: Number(event.target.value) })} required type="number" value={site.allowedAccuracyThresholdMeters ?? 100} /></div><Checkbox checked={site.gpsRequired ?? true} label="Yêu cầu GPS khi điểm danh" onChange={event => change({ gpsRequired: event.target.checked })} /></section></fieldset>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><Button disabled={busy} onClick={onCancel}>Hủy</Button><Button busy={busy} disabled={busy || locating} type="submit" variant="primary">Lưu công trường</Button></div></form>;
}

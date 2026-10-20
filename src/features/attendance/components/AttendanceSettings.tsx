"use client";

import { Clock3, MapPin, Plus, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input } from "@/components/shared/FormControls";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs } from "@/components/shared/Tabs";
import type { AttendanceLocation, AttendancePolicy } from "@/features/attendance/types/attendanceTypes";
import styles from "./AttendanceSettings.module.css";

interface Configuration { policy: AttendancePolicy; locations: AttendanceLocation[] }

async function readApi<T>(response: Response): Promise<T> {
  const body = await response.json() as { data?: T; error?: { message: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể lưu dữ liệu.");
  return body.data;
}

export function AttendanceSettings({ activeTab = "policy" }: { activeTab?: "policy" | "locations" }) {
  const [configuration, setConfiguration] = useState<Configuration>();
  const [policy, setPolicy] = useState<AttendancePolicy>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [locationDraft, setLocationDraft] = useState({ name: "", latitude: "", longitude: "", radiusMeters: "200" });
  const load = async () => {
    try {
      const data = await readApi<Configuration>(await fetch("/api/v1/attendance/settings", { cache: "no-store" }));
      setConfiguration(data); setPolicy(data.policy); setError(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải cấu hình."); }
  };
  useEffect(() => { queueMicrotask(() => void load()); }, []);
  if (!configuration || !policy) {
    return error ? <ErrorState description={error} /> : <LoadingState />;
  }
  const patchPolicy = <K extends keyof AttendancePolicy>(key: K, value: AttendancePolicy[K]) => setPolicy({ ...policy, [key]: value });
  const savePolicy = async () => {
    try {
      const updated = await readApi<AttendancePolicy>(await fetch("/api/v1/attendance/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendanceEnabled: policy.attendanceEnabled, photoRequired: policy.photoRequired, gpsRequired: policy.gpsRequired, offlineEnabled: policy.offlineEnabled, allowedAccuracyThresholdMeters: policy.allowedAccuracyThresholdMeters, earlyCheckinWindowMinutes: policy.earlyCheckinWindowMinutes, lateThresholdMinutes: policy.lateThresholdMinutes, shiftName: policy.shiftName, shiftStart: policy.shiftStart, shiftEnd: policy.shiftEnd }) }));
      setPolicy(updated); setSaved("Đã lưu chính sách chấm công."); setError(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu."); }
  };
  const addLocation = async () => {
    try {
      await readApi<AttendanceLocation>(await fetch("/api/v1/attendance/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: locationDraft.name, latitude: Number(locationDraft.latitude), longitude: Number(locationDraft.longitude), radiusMeters: Number(locationDraft.radiusMeters), active: true }) }));
      setLocationDraft({ name: "", latitude: "", longitude: "", radiusMeters: "200" });
      setSaved("Đã thêm địa điểm chấm công."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu địa điểm."); }
  };
  return <div className={`attendance-page ${styles.page}`}>
    <Tabs label="Cấu hình chấm công" items={[{ label: "Chính sách", href: "/settings/attendance", active: activeTab === "policy" }, { label: "Địa điểm", href: "/settings/attendance/locations", active: activeTab === "locations" }]} />
    {saved ? <div className="attendance-notice attendance-notice--success" role="status">{saved}</div> : null}
    {error ? <div className="attendance-notice" role="alert">{error}</div> : null}
    {activeTab === "policy" ? <>
      <div className={styles.policyGrid}>
        <Card className={styles.panel}>
          <header className={styles.heading}><span className={styles.headingIcon}><ShieldCheck aria-hidden="true" size={20} /></span><h3>Chính sách chấm công</h3></header>
          <div className={styles.toggles}>{([
            ["attendanceEnabled", "Bật chấm công"], ["photoRequired", "Bắt buộc ảnh"], ["gpsRequired", "Rà soát khi thiếu GPS"], ["offlineEnabled", "Cho phép offline"]
          ] as const).map(([key, label]) => <label className={styles.toggle} key={key}>
            <input checked={policy[key]} onChange={(event) => patchPolicy(key, event.target.checked)} type="checkbox" />
            <span>{label}</span><StatusBadge tone={policy[key] ? "success" : "neutral"}>{policy[key] ? "Bật" : "Tắt"}</StatusBadge>
          </label>)}</div>
          <div className={styles.policyStatus}><MapPin aria-hidden="true" size={16} /><StatusBadge tone="info">GPS không giới hạn vị trí</StatusBadge></div>
        </Card>
        <Card className={styles.panel}>
          <header className={styles.heading}><span className={styles.headingIcon}><Clock3 aria-hidden="true" size={20} /></span><h3>Ca làm & ngưỡng</h3></header>
          <div className={styles.fields}>
            <div className={styles.fullWidth}><Input label="Tên ca" onChange={(event) => patchPolicy("shiftName", event.target.value)} value={policy.shiftName} /></div>
            <Input label="Bắt đầu" onChange={(event) => patchPolicy("shiftStart", event.target.value)} type="time" value={policy.shiftStart} />
            <Input label="Kết thúc" onChange={(event) => patchPolicy("shiftEnd", event.target.value)} type="time" value={policy.shiftEnd} />
            <Input label="Ngưỡng cảnh báo GPS (m)" min={10} onChange={(event) => patchPolicy("allowedAccuracyThresholdMeters", Number(event.target.value))} type="number" value={policy.allowedAccuracyThresholdMeters} />
            <Input label="Ngưỡng đi trễ (phút)" min={0} onChange={(event) => patchPolicy("lateThresholdMinutes", Number(event.target.value))} type="number" value={policy.lateThresholdMinutes} />
            <Input label="Cho phép chấm sớm (phút)" min={0} onChange={(event) => patchPolicy("earlyCheckinWindowMinutes", Number(event.target.value))} type="number" value={policy.earlyCheckinWindowMinutes} />
          </div>
        </Card>
      </div>
      <div className={styles.actions}><Button leftIcon={<Save size={16} />} onClick={() => void savePolicy()} variant="primary">Lưu chính sách</Button></div>
    </> : <div className={styles.locationGrid}>
      <Card className={styles.panel}>
        <header className={styles.heading}><span className={styles.headingIcon}><MapPin aria-hidden="true" size={20} /></span><h3>Địa điểm chấm công</h3><span className={styles.count}>{configuration.locations.length}</span></header>
        <div className={styles.locations}>{configuration.locations.map((location) => <div className={styles.location} key={location.id}>
          <span className={styles.locationIcon}><MapPin aria-hidden="true" size={18} /></span>
          <div className={styles.locationIdentity}><strong>{location.name}</strong><span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span></div>
          <StatusBadge tone={location.active ? "success" : "neutral"}>{location.active ? "Hoạt động" : "Tắt"}</StatusBadge>
        </div>)}{configuration.locations.length === 0 ? <div className={styles.empty}><MapPin aria-hidden="true" size={28} /><span>Chưa có địa điểm</span></div> : null}</div>
      </Card>
      <Card className={styles.panel}>
        <header className={styles.heading}><span className={styles.headingIcon}><Plus aria-hidden="true" size={20} /></span><h3>Thêm địa điểm</h3></header>
        <div className={styles.fields}>
          <div className={styles.fullWidth}><Input label="Tên địa điểm" onChange={(event) => setLocationDraft({ ...locationDraft, name: event.target.value })} value={locationDraft.name} /></div>
          <Input label="Vĩ độ" onChange={(event) => setLocationDraft({ ...locationDraft, latitude: event.target.value })} step="any" type="number" value={locationDraft.latitude} />
          <Input label="Kinh độ" onChange={(event) => setLocationDraft({ ...locationDraft, longitude: event.target.value })} step="any" type="number" value={locationDraft.longitude} />
        </div>
        <div className={styles.actions}><Button disabled={!locationDraft.name || !locationDraft.latitude || !locationDraft.longitude} leftIcon={<Plus size={16} />} onClick={() => void addLocation()} variant="primary">Thêm địa điểm</Button></div>
      </Card>
    </div>}
  </div>;
}

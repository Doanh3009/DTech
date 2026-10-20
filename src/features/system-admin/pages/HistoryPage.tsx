"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { SettingsVersion } from "@/services/system-settings/systemSettingsService";
import { AdminPage } from "@/features/system-admin/components/AdminPage";

const groupLabels: Record<string, string> = { branding: "Thương hiệu", appearance: "Giao diện", organization: "Tổ chức", localization: "Định dạng & thời gian", navigation: "Điều hướng", modules: "Module" };

export function HistoryPage() {
  const [versions, setVersions] = useState<SettingsVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/v1/system-settings/history");
    const body = await response.json() as { data?: { versions: SettingsVersion[] }; error?: { message: string } };
    setVersions(body.data?.versions ?? []);
    if (!response.ok) setMessage(body.error?.message ?? "Không thể tải lịch sử.");
    setLoading(false);
  }
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/system-settings/history")
      .then(async (response) => ({ response, body: await response.json() as { data?: { versions: SettingsVersion[] }; error?: { message: string } } }))
      .then(({ response, body }) => {
        if (cancelled) return;
        setVersions(body.data?.versions ?? []);
        if (!response.ok) setMessage(body.error?.message ?? "Không thể tải lịch sử.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  async function restore(version: SettingsVersion) {
    if (!window.confirm(`Khôi phục ${groupLabels[version.group] ?? version.group} về phiên bản ${version.version}?`)) return;
    const response = await fetch(`/api/v1/system-settings/history/${version.id}/restore`, { method: "POST" });
    const body = await response.json() as { error?: { message: string } };
    setMessage(response.ok ? "Đã khôi phục cấu hình. Tải lại trang để áp dụng đầy đủ." : body.error?.message ?? "Không thể khôi phục.");
    if (response.ok) await load();
  }
  return <AdminPage title="Lịch sử cấu hình"><section className="settings-form-card"><div className="history-table" role="table" aria-label="Lịch sử cấu hình"><div className="history-table__head" role="row"><span>Nhóm</span><span>Phiên bản</span><span>Thời gian</span><span>Thao tác</span><span /></div>{loading ? <div className="history-table__empty">Đang tải</div> : versions.length === 0 ? <div className="history-table__empty">Chưa có phiên bản</div> : versions.map((version) => <div className="history-table__row" key={version.id} role="row"><strong>{groupLabels[version.group] ?? version.group}</strong><span>v{version.version}</span><time dateTime={version.createdAt}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(version.createdAt))}</time><StatusBadge tone={version.changeType === "restore" ? "warning" : "info"}>{version.changeType === "restore" ? "Khôi phục" : "Xuất bản"}</StatusBadge><Button leftIcon={<RotateCcw aria-hidden="true" size={15} />} onClick={() => void restore(version)} size="sm">Khôi phục</Button></div>)}</div>{message ? <div aria-live="polite" className="save-feedback">{message}</div> : null}</section></AdminPage>;
}

"use client";

import { Select } from "@/components/shared/FormControls";
import { Pin, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { applicationRegistry } from "@/config/moduleRegistry";
import { can } from "@/lib/auth/permissions";
import { dashboardWidgetRegistry } from "@/features/dashboard/registry";

type Preferences = { density: "compact" | "default" | "comfortable"; sidebarCollapsed: boolean; pinnedModules: string[]; dashboardWidgetVisibility: Record<string, boolean>; dashboardWidgetOrder: string[]; themePreference: "system" | "light" };
const defaults: Preferences = { density: "default", sidebarCollapsed: false, pinnedModules: [], dashboardWidgetVisibility: {}, dashboardWidgetOrder: [], themePreference: "system" };

export function PersonalUiSettings({ initialHasAvatar }: { initialHasAvatar: boolean }) {
  const user = useCurrentUser();
  const [preferences, setPreferences] = useState(defaults);
  const [file, setFile] = useState<File>();
  const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [message, setMessage] = useState("");
  const modules = useMemo(() => applicationRegistry.filter((item) => item.launcher && item.requiredAny.some((permission) => can(user.permissions, permission))), [user.permissions]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void fetch("/api/v1/workspace/preferences", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setPreferences(body.data);
    }).catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setMessage(reason instanceof Error ? reason.message : "Không thể tải tùy chọn."); }), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  async function uploadAvatar() {
    if (!file) return;
    setUploading(true); setAvatarError("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/v1/workspace/avatar", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setHasAvatar(true); setMessage("Đã cập nhật ảnh đại diện.");
      window.dispatchEvent(new Event("avatar-updated"));
    } catch (reason) { setAvatarError(reason instanceof Error ? reason.message : "Tải ảnh thất bại."); }
    finally { setUploading(false); }
  }

  async function removeAvatar() {
    const response = await fetch("/api/v1/workspace/avatar", { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { setAvatarError(body.error?.message ?? "Không thể xóa ảnh đại diện."); return; }
    setFile(undefined); setHasAvatar(false); setMessage("Đã xóa ảnh đại diện.");
    window.dispatchEvent(new Event("avatar-updated"));
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/v1/workspace/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(preferences) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error?.message ?? "Không thể lưu tùy chọn."); return; }
    document.documentElement.dataset.density = preferences.density === "default" ? "standard" : preferences.density;
    window.dispatchEvent(new CustomEvent("ui-preferences-updated", { detail: preferences }));
    setMessage("Đã lưu tùy chọn giao diện.");
  }

  function togglePinned(id: string) {
    setPreferences((current) => ({ ...current, pinnedModules: current.pinnedModules.includes(id) ? current.pinnedModules.filter((item) => item !== id) : [...current.pinnedModules, id] }));
  }
  function toggleWidget(key: string) {
    setPreferences((current) => ({ ...current, dashboardWidgetVisibility: { ...current.dashboardWidgetVisibility, [key]: current.dashboardWidgetVisibility[key] === false } }));
  }

  return <Card className="personal-ui-settings">
    <h2 className="section-title">Giao diện cá nhân</h2>
    <div className="personal-ui-settings__avatar">
      <ImageUploader error={avatarError} file={file} label={hasAvatar ? "Thay ảnh" : "Chọn ảnh"} maxBytes={5 * 1024 * 1024} onFileChange={(next) => { setFile(next); setAvatarError(""); }} onRetry={() => void uploadAvatar()} uploading={uploading} />
      <div className="personal-ui-settings__avatar-actions"><Button disabled={!file || uploading} leftIcon={<Upload size={15} />} onClick={() => void uploadAvatar()} size="sm" variant="soft">Tải ảnh</Button>{hasAvatar ? <Button leftIcon={<Trash2 size={15} />} onClick={() => void removeAvatar()} size="sm" variant="ghost">Xóa ảnh</Button> : null}</div>
    </div>
    <form className="personal-ui-settings__form" onSubmit={savePreferences}>
      <Select label={"Mật độ"} className="select" onChange={(event) => setPreferences({ ...preferences, density: event.target.value as Preferences["density"] })} value={preferences.density} options={[{ label: "Gọn", value: "compact" }, { label: "Tiêu chuẩn", value: "default" }, { label: "Thoải mái", value: "comfortable" }]} />
      <label className="choice-field"><input checked={preferences.sidebarCollapsed} onChange={(event) => setPreferences({ ...preferences, sidebarCollapsed: event.target.checked })} type="checkbox" />Thu gọn sidebar mặc định</label>
      <fieldset><legend><Pin size={15} /> Module ghim</legend><div className="personal-ui-settings__modules">{modules.map((module) => <label key={module.id}><input checked={preferences.pinnedModules.includes(module.id)} onChange={() => togglePinned(module.id)} type="checkbox" />{module.label}</label>)}</div></fieldset>
      <fieldset><legend>Widget Dashboard</legend><div className="personal-ui-settings__modules">{dashboardWidgetRegistry.filter((widget) => widget.key !== "quick_actions").map((widget) => <label key={widget.key}><input checked={preferences.dashboardWidgetVisibility[widget.key] !== false} onChange={() => toggleWidget(widget.key)} type="checkbox" />{widget.label}</label>)}</div></fieldset>
      <Button leftIcon={<Save size={15} />} type="submit" variant="primary">Lưu tùy chọn</Button>
    </form>
    {message ? <p aria-live="polite" className="form-message">{message}</p> : null}
  </Card>;
}

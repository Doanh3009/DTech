"use client";

import { Button } from "@/components/shared/Button";
import { Switch } from "@/components/shared/FormControls";
import { StickyActionBar } from "@/components/shared/FormLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ModuleKey } from "@/config/systemSettings";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";

const modules: Array<{ key: ModuleKey; label: string; locked?: boolean }> = [
  { key: "human_resources", label: "Nhân sự", locked: true },
  { key: "attendance", label: "Chấm công" },
  { key: "projects", label: "Dự án" },
  { key: "warehouse", label: "Kho" },
  { key: "import_export", label: "Xuất nhập khẩu" },
  { key: "reports", label: "Báo cáo" }
];

export function ModulesPage() {
  const editor = useSettingsEditor("modules");
  function toggle(key: ModuleKey, checked: boolean, label: string) {
    if (!checked && !window.confirm(`Bạn đang tắt module ${label}. Người dùng sẽ không thể truy cập module này. Dữ liệu không bị xóa.`)) return;
    editor.setDraft({ ...editor.draft, [key]: checked });
  }
  return <AdminPage title="Module"><section className="settings-form-card"><div className="module-list">{modules.map((module) => <div className="module-list__row" key={module.key}><strong>{module.label}</strong><StatusBadge tone={editor.draft[module.key] ? "success" : "neutral"}>{editor.draft[module.key] ? "Đang bật" : "Đang tắt"}</StatusBadge><Switch checked={editor.draft[module.key]} disabled={module.locked} label={editor.draft[module.key] ? "Bật" : "Tắt"} onCheckedChange={(checked) => toggle(module.key, checked, module.label)} /></div>)}</div>{editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}<StickyActionBar><Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>Hoàn tác</Button><Button disabled={!editor.dirty || editor.saving} onClick={() => void editor.save()} variant="primary" busy={editor.saving}>{"Xuất bản"}</Button></StickyActionBar></section></AdminPage>;
}

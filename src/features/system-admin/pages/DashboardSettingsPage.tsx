"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { Select, Switch } from "@/components/shared/FormControls";
import { StickyActionBar } from "@/components/shared/FormLayout";
import { dashboardProfiles, dashboardWidgetRegistry } from "@/features/dashboard/registry";
import type { DashboardLandingPage, DashboardProfileKey, DashboardWidgetKey } from "@/features/dashboard/types";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";

const landingOptions = [
  { label: "Dashboard tổng", value: "/dashboard" },
  { label: "Chấm công", value: "/attendance/me" },
  { label: "Điểm danh hôm nay", value: "/worker-attendance/today" },
  { label: "Dự án", value: "/projects" }
] as const;

export function DashboardSettingsPage() {
  const editor = useSettingsEditor("dashboard");
  const [selected, setSelected] = useState<DashboardProfileKey>("employee");
  const presetIndex = editor.draft.presets.findIndex((item) => item.profile === selected);
  const preset = editor.draft.presets[presetIndex];
  const allowed = dashboardWidgetRegistry.filter((widget) => widget.allowedProfiles.includes(selected));
  const enabledSet = new Set(preset.enabledWidgets);
  const ordered = [...preset.enabledWidgets, ...allowed.map((item) => item.key).filter((key) => !enabledSet.has(key))];

  function updatePreset(patch: Partial<typeof preset>) {
    const presets = editor.draft.presets.map((item, index) => index === presetIndex ? { ...item, ...patch } : item);
    editor.setDraft({ ...editor.draft, presets });
  }

  function toggleWidget(key: DashboardWidgetKey, enabled: boolean) {
    updatePreset({ enabledWidgets: enabled ? [...preset.enabledWidgets, key] : preset.enabledWidgets.filter((item) => item !== key) });
  }

  function moveWidget(key: DashboardWidgetKey, direction: -1 | 1) {
    const index = preset.enabledWidgets.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= preset.enabledWidgets.length) return;
    const next = [...preset.enabledWidgets];
    [next[index], next[target]] = [next[target], next[index]];
    updatePreset({ enabledWidgets: next });
  }

  return (
    <AdminPage title="Bố cục bản tin">
      <section className="settings-form-card dashboard-settings">
        <div className="form-section">
          <div className="form-section__grid">
            <Select label="Nhóm người dùng" onChange={(event) => setSelected(event.target.value as DashboardProfileKey)} options={dashboardProfiles.map((profile) => ({ label: profile.label, value: profile.key }))} value={selected} />
            <Select label="Trang bắt đầu" onChange={(event) => updatePreset({ landingPage: event.target.value as DashboardLandingPage })} options={[...landingOptions]} value={preset.landingPage} />
          </div>
        </div>
        <div className="form-section">
          <div className="form-section__header"><h2>Khu vực hiển thị</h2></div>
          <div className="dashboard-widget-editor">
            {ordered.map((key) => {
              const widget = dashboardWidgetRegistry.find((item) => item.key === key)!;
              const enabled = preset.enabledWidgets.includes(key);
              const index = preset.enabledWidgets.indexOf(key);
              return <div className="dashboard-widget-editor__row" key={key}><div><IconButton disabled={!enabled || index === 0} label="Di chuyển lên" onClick={() => moveWidget(key, -1)}><ArrowUp aria-hidden="true" size={16} /></IconButton><IconButton disabled={!enabled || index === preset.enabledWidgets.length - 1} label="Di chuyển xuống" onClick={() => moveWidget(key, 1)}><ArrowDown aria-hidden="true" size={16} /></IconButton></div><strong>{widget.label}</strong><Switch checked={enabled} label="Hiển thị" onCheckedChange={(checked) => toggleWidget(key, checked)} /></div>;
            })}
          </div>
        </div>
        {editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}
        <StickyActionBar><Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>Hoàn tác</Button><Button disabled={!editor.dirty || editor.saving} onClick={() => void editor.save()} variant="primary" busy={editor.saving}>{"Xuất bản"}</Button></StickyActionBar>
      </section>
    </AdminPage>
  );
}

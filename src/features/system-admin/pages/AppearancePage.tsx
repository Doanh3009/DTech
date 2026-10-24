"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/shared/Button";
import { Select } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { defaultSystemSettings, deriveBrandColorTokens } from "@/config/systemSettings";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";
import { useOrganizationSettings } from "@/components/providers/SystemSettingsProvider";

const colorPresets = ["#19A94A", "#2563EB", "#7C3AED", "#F59E0B", "#DC2625"];

export function AppearancePage() {
  const editor = useSettingsEditor("appearance");
  const organization = useOrganizationSettings();
  const tokens = deriveBrandColorTokens(editor.draft.primaryColor);
  const restoreDefaults = () => {
    if (window.confirm("Khôi phục cấu hình giao diện mặc định?")) {
      editor.setDraft(structuredClone(defaultSystemSettings.appearance));
    }
  };

  return (
    <AdminPage title="Giao diện">
      <section className="settings-form-card">
        <FormSection columns={1} title="Màu thương hiệu">
          <div className="color-field">
            <label htmlFor="primary-color">Màu chính</label>
            <div className="color-field__control">
              <input id="primary-color" onChange={(event) => editor.setDraft({ ...editor.draft, primaryColor: event.target.value.toUpperCase() })} type="color" value={editor.draft.primaryColor} />
              <input aria-label="Mã màu chính" className="input" maxLength={7} onChange={(event) => /^#[0-9A-Fa-f]{0,6}$/.test(event.target.value) && editor.setDraft({ ...editor.draft, primaryColor: event.target.value.toUpperCase() })} value={editor.draft.primaryColor} />
              <span className="contrast-result"><Check aria-hidden="true" size={15} /> Tương phản {tokens.contrast.toFixed(1)}:1</span>
            </div>
            <div className="color-presets" aria-label="Màu gợi ý">
              {colorPresets.map((color) => <button aria-label={`Chọn màu ${color}`} className={editor.draft.primaryColor === color ? "is-selected" : ""} key={color} onClick={() => editor.setDraft({ ...editor.draft, primaryColor: color })} style={{ backgroundColor: color }} type="button" />)}
            </div>
          </div>
        </FormSection>
        <FormSection title="Hiển thị mặc định">
          <Select label="Mật độ giao diện" onChange={(event) => editor.setDraft({ ...editor.draft, density: event.target.value as typeof editor.draft.density })} options={[{ label: "Thoải mái", value: "comfortable" }, { label: "Tiêu chuẩn", value: "standard" }, { label: "Gọn", value: "compact" }]} value={editor.draft.density} />
          <Select label="Mật độ bảng" onChange={(event) => editor.setDraft({ ...editor.draft, tableDensity: event.target.value as typeof editor.draft.tableDensity })} options={[{ label: "Tiêu chuẩn", value: "standard" }, { label: "Gọn", value: "compact" }]} value={editor.draft.tableDensity} />
          <Select label="Số dòng mỗi trang" onChange={(event) => editor.setDraft({ ...editor.draft, defaultPageSize: Number(event.target.value) as typeof editor.draft.defaultPageSize })} options={[10, 20, 50, 100].map((value) => ({ label: String(value), value: String(value) }))} value={editor.draft.defaultPageSize} />
          <Select label="Sidebar" onChange={(event) => editor.setDraft({ ...editor.draft, sidebarDefault: event.target.value as typeof editor.draft.sidebarDefault })} options={[{ label: "Mở rộng", value: "expanded" }, { label: "Thu gọn", value: "collapsed" }]} value={editor.draft.sidebarDefault} />
        </FormSection>
        <FormSection columns={1} title="Xem trước">
          <div className={`appearance-preview density-${editor.draft.density}`} style={{ "--preview-primary": tokens.primary, "--preview-primary-hover": tokens.primaryHover, "--preview-primary-soft": tokens.primarySubtle, "--preview-foreground": tokens.primaryForeground } as React.CSSProperties}>
            <aside><strong>{organization.shortName}</strong><span className="is-active">Nhân viên</span><span>Dự án</span></aside>
            <div className="appearance-preview__body"><div><button type="button">Thao tác chính</button><a>Liên kết</a><span className="preview-badge">Đang hoạt động</span></div><div className="preview-table"><span>NV-001</span><span>Nguyễn Văn An</span><span>Đang làm việc</span></div></div>
          </div>
        </FormSection>
        {editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}
        <StickyActionBar><Button onClick={restoreDefaults} variant="ghost">Khôi phục mặc định</Button><Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>Hoàn tác</Button><Button disabled={!editor.dirty || editor.saving || !/^#[0-9A-F]{6}$/.test(editor.draft.primaryColor)} onClick={() => void editor.save()} variant="primary" busy={editor.saving}>{"Xuất bản"}</Button></StickyActionBar>
      </section>
    </AdminPage>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Paintbrush, Palette } from "lucide-react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Button } from "@/components/shared/Button";
import { Switch } from "@/components/shared/FormControls";
import { StickyActionBar } from "@/components/shared/FormLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { erpModuleCatalog, getIndustryPreset, industryPresets, isErpModuleEnabled, modulesForIndustry, type IndustryKey } from "@/config/erpModules";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";
import { can } from "@/lib/auth/permissions";
import styles from "@/components/shared/ErpPlatform.module.css";

export function ModulesPage() {
  const editor = useSettingsEditor("modules");
  const { settings } = useSystemSettings();
  const user = useCurrentUser();
  const router = useRouter();
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryKey>(editor.source.industryPreset ?? "general");
  const profile = getIndustryPreset(editor.draft.industryPreset);
  const enabledCount = erpModuleCatalog.filter((module) => isErpModuleEnabled(editor.draft, module.key)).length;
  const changed = erpModuleCatalog.filter((module) => isErpModuleEnabled(editor.draft, module.key) !== isErpModuleEnabled(editor.source, module.key));
  const custom = erpModuleCatalog.some((module) => isErpModuleEnabled(editor.draft, module.key) !== profile.modules.includes(module.key));
  async function publish() {
    if (await editor.save()) router.refresh();
  }
  return <AdminPage title="Module" actions={<StatusBadge tone="info">{settings.organization.shortName}</StatusBadge>}>
    <nav aria-label="Thiết lập doanh nghiệp" className={styles.actions}>
      {can(user.permissions, "organization_settings.view") ? <Link href="/system-admin/organization"><Building2 aria-hidden="true" size={17} />Doanh nghiệp</Link> : null}
      {can(user.permissions, "branding.view") ? <Link href="/system-admin/branding"><Paintbrush aria-hidden="true" size={17} />Thương hiệu</Link> : null}
      {can(user.permissions, "appearance.view") ? <Link href="/system-admin/design-dna"><Palette aria-hidden="true" size={17} />Design DNA</Link> : null}
    </nav>
    <section aria-labelledby="erp-industry-title" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="erp-industry-title">Gói theo ngành</h2><StatusBadge tone="neutral">{profile.label}{custom ? " · Tùy chỉnh" : ""}</StatusBadge></div>
      <div aria-label="Ngành doanh nghiệp" className={styles.presetGrid} role="radiogroup">
        {industryPresets.map((preset) => <label className={styles.preset} key={preset.id}><input checked={selectedIndustry === preset.id} disabled={editor.saving} name="erp-industry" onChange={() => setSelectedIndustry(preset.id)} type="radio" value={preset.id} /><span>{preset.label}</span></label>)}
      </div>
      <div className={styles.actions}><Button disabled={editor.saving} onClick={() => editor.setDraft(modulesForIndustry(selectedIndustry))}>Áp dụng gói {getIndustryPreset(selectedIndustry).label}</Button><span className={styles.count}>{getIndustryPreset(selectedIndustry).modules.length} module</span></div>
    </section>
    <section aria-labelledby="erp-module-title" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="erp-module-title">Module triển khai</h2><span aria-atomic="true" aria-live="polite" className={styles.count}>{enabledCount}/{erpModuleCatalog.length} đang bật</span></div>
      <div className={styles.moduleList}>
        <div className={styles.moduleRow}><Switch checked disabled label="Nền tảng & Tài khoản" /><StatusBadge tone="info">Bắt buộc</StatusBadge></div>
        {erpModuleCatalog.map((module) => {
          const enabled = isErpModuleEnabled(editor.draft, module.key);
          return <div className={styles.moduleRow} key={module.key}><Switch checked={enabled} disabled={editor.saving} label={module.label} onCheckedChange={(checked) => editor.setDraft({ ...editor.draft, [module.key]: checked })} /><StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "Đang bật" : "Đang tắt"}</StatusBadge></div>;
        })}
      </div>
    </section>
    <section aria-labelledby="erp-roadmap-title" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="erp-roadmap-title">Lộ trình {profile.label}</h2><StatusBadge tone="neutral">Chưa triển khai</StatusBadge></div>
      <div className={styles.plannedList}>{profile.plannedModules.map((label) => <span className={styles.plannedItem} key={label}>{label}</span>)}</div>
    </section>
    {editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}
    <StickyActionBar><span aria-live="polite" className={styles.count}>{changed.length ? `${changed.length} module thay đổi` : editor.dirty ? "Gói cấu hình thay đổi" : "Đã đồng bộ"}</span><Button disabled={!editor.dirty || editor.saving} onClick={() => { editor.reset(); setSelectedIndustry(editor.source.industryPreset ?? "general"); }}>Hoàn tác</Button><Button busy={editor.saving} disabled={!editor.dirty} onClick={() => void publish()} variant="primary">Lưu cấu hình ERP</Button></StickyActionBar>
  </AdminPage>;
}

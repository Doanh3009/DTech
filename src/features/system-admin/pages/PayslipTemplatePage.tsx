"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { Button } from "@/components/shared/Button";
import { Input, Switch } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { AdminPage } from "@/features/system-admin/components/AdminPage";

export function PayslipTemplatePage() {
  const { settings, updateGroup } = useSystemSettings();
  const [template, setTemplate] = useState(() => structuredClone(settings.payslip));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(template) !== JSON.stringify(settings.payslip);

  useEffect(() => {
    document.body.dataset.systemAdminDirty = String(dirty);
    return () => { delete document.body.dataset.systemAdminDirty; };
  }, [dirty]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/system-settings/payslip", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(template)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu mẫu phiếu lương.");
      updateGroup("payslip", template);
      setMessage("Đã lưu mẫu phiếu lương.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể lưu mẫu phiếu lương.");
    } finally {
      setSaving(false);
    }
  }

  const title = template.title.replace("{month}", "09/2026");

  return (
    <AdminPage title="Mẫu phiếu lương">
      <div className="payslip-template-layout">
        <section className="settings-form-card">
          <FormSection columns={1} title="Nội dung mẫu">
            <Input label="Tên doanh nghiệp" maxLength={120} onChange={(event) => setTemplate({ ...template, companyName: event.target.value })} value={template.companyName} />
            <Input label="Tiêu đề" maxLength={120} onChange={(event) => setTemplate({ ...template, title: event.target.value })} value={template.title} />
            <Input label="Dòng cuối phiếu" maxLength={180} onChange={(event) => setTemplate({ ...template, footer: event.target.value })} value={template.footer} />
            <Input label="Màu chủ đạo" onChange={(event) => setTemplate({ ...template, primaryColor: event.target.value })} type="color" value={template.primaryColor} />
          </FormSection>
          <FormSection columns={1} title="Thông tin hiển thị">
            <Switch checked={template.showWorkDays} label="Ngày công" onCheckedChange={(value) => setTemplate({ ...template, showWorkDays: value })} />
            <Switch checked={template.showBaseSalary} label="Lương cơ bản" onCheckedChange={(value) => setTemplate({ ...template, showBaseSalary: value })} />
            <Switch checked={template.showAllowance} label="Phụ cấp" onCheckedChange={(value) => setTemplate({ ...template, showAllowance: value })} />
            <Switch checked={template.showBonus} label="Thưởng" onCheckedChange={(value) => setTemplate({ ...template, showBonus: value })} />
            <Switch checked={template.showDeduction} label="Khấu trừ" onCheckedChange={(value) => setTemplate({ ...template, showDeduction: value })} />
          </FormSection>
          {message ? <div className="save-feedback" role="status">{message}</div> : null}
          <StickyActionBar>
            <Button disabled={!dirty || saving} onClick={() => setTemplate(structuredClone(settings.payslip))}>Hoàn tác</Button>
            <Button disabled={!dirty || saving} onClick={() => void save()} variant="primary" busy={saving}>{"Lưu mẫu"}</Button>
          </StickyActionBar>
        </section>
        <section className="payslip-template-preview" style={{ "--payslip-accent": template.primaryColor } as CSSProperties}>
          <strong>{template.companyName}</strong>
          <h2>{title}</h2>
          <dl>
            <div><dt>Nhân viên</dt><dd>Nguyễn Văn An</dd></div>
            {template.showWorkDays ? <div><dt>Ngày công</dt><dd>22</dd></div> : null}
            {template.showBaseSalary ? <div><dt>Lương cơ bản</dt><dd>14.000.000 VND</dd></div> : null}
            {template.showAllowance ? <div><dt>Phụ cấp</dt><dd>1.000.000 VND</dd></div> : null}
            {template.showBonus ? <div><dt>Thưởng</dt><dd>500.000 VND</dd></div> : null}
            {template.showDeduction ? <div><dt>Khấu trừ</dt><dd>250.000 VND</dd></div> : null}
          </dl>
          <div className="payslip-template-preview__net"><span>THỰC NHẬN</span><b>15.250.000 VND</b></div>
          <small>{template.footer}</small>
        </section>
      </div>
    </AdminPage>
  );
}

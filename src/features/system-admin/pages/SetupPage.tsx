"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, RefreshCw } from "lucide-react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Button } from "@/components/shared/Button";
import { Input, Select, Switch, Textarea } from "@/components/shared/FormControls";
import { FormErrorSummary, FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { LoadingState, PermissionDeniedState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { erpModuleCatalog, getIndustryPreset, industryPresets, isErpModuleEnabled, modulesForIndustry, type IndustryKey } from "@/config/erpModules";
import { systemSettingsSchemas, type SystemSettingsDocument, type SystemSettingsGroup } from "@/config/systemSettings";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { parseSetupDraftGroups, readStoredSetupDraft, setupDraftStorageKey, setupGroups, storedSetupDraftSchema, type PublishCommand, type SetupDraft, type SetupGroup, type StoredSetupDraft } from "@/features/system-admin/setupDraft";
import { can, type Permission } from "@/lib/auth/permissions";
import platform from "@/components/shared/ErpPlatform.module.css";
import styles from "./SetupPage.module.css";

interface ActivationSnapshot {
  settings: SystemSettingsDocument;
  versions: Record<SystemSettingsGroup, number>;
  ready: boolean;
}
const requiredPermissions: readonly Permission[] = ["system_admin.access", "branding.manage", "organization_settings.manage", "localization.manage", "module.manage"];
const steps = ["Doanh nghiệp", "Thương hiệu", "Module", "Xác nhận"];
const groupLabels: Record<SetupGroup, string> = { organization: "Doanh nghiệp", branding: "Thương hiệu", localization: "Định dạng & thời gian", modules: "Module" };
const assetLabels = { logoMainUrl: "Logo chính", logoCompactUrl: "Logo compact", logoDarkUrl: "Logo nền tối", faviconUrl: "Favicon" } as const;
const fieldLabels: Record<string, string> = { companyName: "Tên công ty", shortName: "Tên viết tắt", taxCode: "Mã số thuế", representativeName: "Người đại diện", phone: "Số điện thoại", email: "Email", address: "Địa chỉ", systemName: "Tên hiển thị hệ thống", loginSubtitle: "Tiêu đề phụ trang đăng nhập", dateFormat: "Định dạng ngày" };

function groupsFrom(settings: SystemSettingsDocument): SetupDraft {
  return structuredClone({ branding: settings.branding, organization: settings.organization, localization: settings.localization, modules: settings.modules });
}

async function readResponse(response: Response): Promise<ActivationSnapshot> {
  const body = await response.json() as { data?: ActivationSnapshot; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể đọc cấu hình ERP.");
  const data = body.data;
  if (typeof data.ready !== "boolean" || !data.settings || !data.versions || setupGroups.some((group) => !systemSettingsSchemas[group].safeParse(data.settings[group]).success || !Number.isInteger(data.versions[group]) || data.versions[group] < 0)) {
    throw new Error("Cấu hình ERP không hợp lệ. Vui lòng tải lại.");
  }
  return data;
}

async function fetchSnapshot(signal?: AbortSignal): Promise<ActivationSnapshot> {
  return readResponse(await fetch("/api/v1/system-settings/activation", { cache: "no-store", signal }));
}

export function SetupPage() {
  const user = useCurrentUser();
  const { updateGroup } = useSystemSettings();
  const router = useRouter();
  const allowed = requiredPermissions.every((permission) => can(user.permissions, permission));
  const [snapshot, setSnapshot] = useState<ActivationSnapshot | null>(null);
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [step, setStep] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [storedDraft, setStoredDraft] = useState<StoredSetupDraft | null>(null);
  const [draftIssue, setDraftIssue] = useState("");
  const [serverChanged, setServerChanged] = useState(false);
  const browserDraftKey = useRef("");
  const liveSnapshot = useRef<ActivationSnapshot | null>(null);
  const pendingCommand = useRef<PublishCommand | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const dirty = !!snapshot && !!draft && JSON.stringify(draft) !== JSON.stringify(groupsFrom(snapshot.settings));
  const locked = loading || saving || pending;

  useEffect(() => {
    if (!allowed) return;
    browserDraftKey.current = setupDraftStorageKey(user.id, window.location.origin, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? window.location.origin).origin);
    try {
      const saved = readStoredSetupDraft(window.localStorage, browserDraftKey.current);
      setStoredDraft(saved.draft);
      if (saved.invalid) setDraftIssue("Bản nháp trên trình duyệt không hợp lệ.");
    } catch { setDraftIssue("Không thể đọc bản nháp trên trình duyệt."); }
    const controller = new AbortController();
    void fetchSnapshot(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setSnapshot(data);
      liveSnapshot.current = data;
      setDraft(groupsFrom(data.settings));
      setSelectedIndustry(data.settings.modules.industryPreset ?? "general");
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải cấu hình ERP.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [allowed, user.id]);

  useEffect(() => {
    const unsaved = dirty || pending;
    document.body.dataset.systemAdminDirty = String(unsaved);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (unsaved) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("beforeunload", beforeUnload); delete document.body.dataset.systemAdminDirty; };
  }, [dirty, pending]);

  useEffect(() => { stepHeading.current?.focus(); }, [step]);
  useEffect(() => { if (Object.keys(fieldErrors).length) errorSummary.current?.focus(); }, [fieldErrors]);

  function update<TGroup extends SetupGroup>(group: TGroup, value: SetupDraft[TGroup]) {
    setDraft((current) => current ? { ...current, [group]: value } : current);
    setConfirmed(false);
    setFieldErrors({});
    setMessage("");
  }

  function validate(groups: readonly SetupGroup[]): boolean {
    if (!draft) return false;
    const errors: Record<string, string> = {};
    for (const group of groups) {
      const parsed = systemSettingsSchemas[group].safeParse(draft[group]);
      if (!parsed.success) for (const issue of parsed.error.issues) errors[`${group}-${String(issue.path[0] ?? "value")}`] = "Giá trị không hợp lệ.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function next() {
    if (!validate(step === 0 ? ["organization", "localization"] : step === 1 ? ["branding"] : ["modules"])) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function reload(discardStored = false) {
    const shouldDiscardStored = discardStored || dirty || pending;
    if (shouldDiscardStored && !window.confirm("Bỏ bản nháp và tải lại cấu hình đã lưu?")) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await fetchSnapshot();
      if (shouldDiscardStored) {
        try { window.localStorage.removeItem(browserDraftKey.current); }
        catch { throw new Error("Không thể bỏ bản nháp trên trình duyệt."); }
        setStoredDraft(null);
        setDraftIssue("");
      }
      setSnapshot(data);
      liveSnapshot.current = data;
      setDraft(groupsFrom(data.settings));
      setSelectedIndustry(data.settings.modules.industryPreset ?? "general");
      pendingCommand.current = null;
      setPending(false);
      setConfirmed(false);
      setFieldErrors({});
      setServerChanged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải cấu hình ERP.");
    } finally { setLoading(false); }
  }

  function persistDraft(command: PublishCommand | null, notify: boolean) {
    if (!snapshot || !draft) return;
    const saved = storedSetupDraftSchema.parse({
      formatVersion: 1, savedAt: new Date().toISOString(), step, selectedIndustry,
      baseline: { groups: groupsFrom(snapshot.settings), versions: Object.fromEntries(setupGroups.map((group) => [group, snapshot.versions[group]])) },
      draft, pendingCommand: command
    });
    try { window.localStorage.setItem(browserDraftKey.current, JSON.stringify(saved)); }
    catch { throw new Error("Không thể lưu bản nháp trên trình duyệt."); }
    setStoredDraft(saved);
    setDraftIssue("");
    if (notify) setMessage("Đã lưu bản nháp trên trình duyệt.");
  }

  function saveDraft() {
    setError("");
    try { persistDraft(pendingCommand.current, true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu bản nháp."); }
  }

  function resumeDraft() {
    const live = liveSnapshot.current;
    if (!storedDraft || !live || ((dirty || pending) && !window.confirm("Thay bản nháp đang mở bằng bản nháp đã lưu?"))) return;
    setSnapshot({ ...live, settings: { ...live.settings, ...structuredClone(storedDraft.baseline.groups) }, versions: { ...live.versions, ...storedDraft.baseline.versions } });
    setDraft(structuredClone(storedDraft.draft));
    setSelectedIndustry(storedDraft.selectedIndustry);
    setStep(storedDraft.step);
    pendingCommand.current = structuredClone(storedDraft.pendingCommand);
    setPending(storedDraft.pendingCommand !== null);
    setConfirmed(storedDraft.pendingCommand !== null);
    setServerChanged(setupGroups.some((group) => storedDraft.baseline.versions[group] !== live.versions[group]));
    setFieldErrors({});
    setError("");
    setMessage("Đã tiếp tục bản nháp.");
  }

  async function publish() {
    if (!draft || !snapshot?.ready || !allowed || !confirmed || saving) return;
    if (!validate(setupGroups)) return;
    if (!pendingCommand.current) {
      pendingCommand.current = {
        requestId: crypto.randomUUID(),
        groups: parseSetupDraftGroups(draft),
        expectedVersions: Object.fromEntries(setupGroups.map((group) => [group, snapshot.versions[group]])) as Record<SetupGroup, number>,
        changeType: "publish"
      };
    }
    setPending(true);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      persistDraft(pendingCommand.current, false);
      const data = await readResponse(await fetch("/api/v1/system-settings/activation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pendingCommand.current) }));
      updateGroup("branding", data.settings.branding);
      updateGroup("organization", data.settings.organization);
      updateGroup("localization", data.settings.localization);
      updateGroup("modules", data.settings.modules);
      setSnapshot(data);
      liveSnapshot.current = data;
      setDraft(groupsFrom(data.settings));
      pendingCommand.current = null;
      setPending(false);
      setConfirmed(false);
      setServerChanged(false);
      try { window.localStorage.removeItem(browserDraftKey.current); setStoredDraft(null); setDraftIssue(""); }
      catch { setDraftIssue("Cấu hình đã xuất bản; chưa xóa được bản nháp trên trình duyệt."); }
      setMessage("Đã xuất bản cấu hình ERP.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xuất bản cấu hình ERP.");
    } finally { setSaving(false); }
  }

  if (!allowed) return <AdminPage title="Thiết lập ERP"><PermissionDeniedState description="" /></AdminPage>;
  if (!draft || !snapshot) return <AdminPage title="Thiết lập ERP">{loading ? <LoadingState title="Đang tải cấu hình ERP" /> : <div className={styles.feedback} role="alert"><span>{error}</span><Button onClick={() => void reload()}>Tải lại cấu hình</Button></div>}</AdminPage>;

  const changedGroups = setupGroups.filter((group) => JSON.stringify(draft[group]) !== JSON.stringify(snapshot.settings[group]));
  const enabledCount = erpModuleCatalog.filter((module) => isErpModuleEnabled(draft.modules, module.key)).length;
  const fieldError = (group: SetupGroup, field: string) => fieldErrors[`${group}-${field}`];
  return <AdminPage title="Thiết lập ERP" actions={<StatusBadge tone={snapshot.ready ? "success" : "warning"}>{snapshot.ready ? "Sẵn sàng cấu hình" : "Chờ cập nhật hệ thống"}</StatusBadge>}>
    {storedDraft || draftIssue ? <section className={styles.draftBar} aria-label="Bản nháp trên trình duyệt"><div><strong>Bản nháp trên trình duyệt</strong>{storedDraft ? <time dateTime={storedDraft.savedAt}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(storedDraft.savedAt))}</time> : null}{draftIssue ? <span role="alert">{draftIssue}</span> : null}{serverChanged ? <StatusBadge tone="warning">Máy chủ có cấu hình mới</StatusBadge> : null}</div><div>{storedDraft ? <Button disabled={saving || loading} onClick={resumeDraft}>Tiếp tục bản nháp</Button> : null}<Button disabled={saving || loading} onClick={() => void reload(true)}>Bỏ bản nháp</Button></div></section> : null}
    <nav aria-label="Các bước thiết lập ERP"><ol className={styles.steps}>{steps.map((label, index) => <li key={label}><button aria-current={step === index ? "step" : undefined} disabled={saving || index > step} onClick={() => { setStep(index); setFieldErrors({}); }} type="button"><span className={styles.stepNumber}>{index < step ? <Check aria-hidden="true" size={16} /> : index + 1}</span><span>{label}</span></button></li>)}</ol></nav>
    <section className="settings-form-card" aria-labelledby="setup-step-heading">
      <div className={styles.stepTitle}><h2 id="setup-step-heading" ref={stepHeading} tabIndex={-1}>{steps[step]}</h2><StatusBadge tone={dirty ? "warning" : "neutral"}>{pending ? "Chờ xác nhận kết quả" : dirty ? "Bản nháp" : "Đã đồng bộ"}</StatusBadge></div>
      <div ref={errorSummary} tabIndex={-1}><FormErrorSummary errors={Object.entries(fieldErrors).map(([field, text]) => ({ fieldId: `setup-${field}`, message: `${fieldLabels[field.split("-").slice(1).join("-")] ?? "Cấu hình"}: ${text}` }))} /></div>
      <fieldset className={styles.fields} disabled={locked}>
        <legend className="sr-only">{steps[step]}</legend>
        {step === 0 ? <>
          <FormSection title="Thông tin doanh nghiệp">
            <Input error={fieldError("organization", "companyName")} id="setup-organization-companyName" label="Tên công ty" maxLength={120} onChange={(e) => update("organization", { ...draft.organization, companyName: e.target.value })} required value={draft.organization.companyName} />
            <Input error={fieldError("organization", "shortName")} id="setup-organization-shortName" label="Tên viết tắt" maxLength={30} onChange={(e) => update("organization", { ...draft.organization, shortName: e.target.value })} required value={draft.organization.shortName} />
            <Input error={fieldError("organization", "taxCode")} id="setup-organization-taxCode" label="Mã số thuế" maxLength={30} onChange={(e) => update("organization", { ...draft.organization, taxCode: e.target.value })} value={draft.organization.taxCode} />
            <Input error={fieldError("organization", "representativeName")} id="setup-organization-representativeName" label="Người đại diện" maxLength={100} onChange={(e) => update("organization", { ...draft.organization, representativeName: e.target.value })} value={draft.organization.representativeName} />
            <Input error={fieldError("organization", "phone")} id="setup-organization-phone" label="Số điện thoại" maxLength={30} onChange={(e) => update("organization", { ...draft.organization, phone: e.target.value })} type="tel" value={draft.organization.phone} />
            <Input error={fieldError("organization", "email")} id="setup-organization-email" label="Email" onChange={(e) => update("organization", { ...draft.organization, email: e.target.value })} type="email" value={draft.organization.email} />
            <Textarea error={fieldError("organization", "address")} id="setup-organization-address" label="Địa chỉ" maxLength={240} onChange={(e) => update("organization", { ...draft.organization, address: e.target.value })} value={draft.organization.address} />
          </FormSection>
          <FormSection title="Định dạng & thời gian">
            <Select disabled label="Ngôn ngữ" options={[{ label: "Tiếng Việt", value: "vi-VN" }]} value={draft.localization.locale} />
            <Select disabled label="Múi giờ" options={[{ label: "Việt Nam (Asia/Ho_Chi_Minh)", value: "Asia/Ho_Chi_Minh" }]} value={draft.localization.timezone} />
            <Select id="setup-localization-dateFormat" label="Định dạng ngày" onChange={(e) => update("localization", { ...draft.localization, dateFormat: e.target.value as typeof draft.localization.dateFormat })} options={[{ label: "DD/MM/YYYY", value: "DD/MM/YYYY" }, { label: "YYYY-MM-DD", value: "YYYY-MM-DD" }]} value={draft.localization.dateFormat} />
          </FormSection>
        </> : null}
        {step === 1 ? <>
          <FormSection title="Nhận diện hệ thống">
            <Input error={fieldError("branding", "systemName")} id="setup-branding-systemName" label="Tên hiển thị hệ thống" maxLength={100} onChange={(e) => update("branding", { ...draft.branding, systemName: e.target.value })} required value={draft.branding.systemName} />
            <Input error={fieldError("branding", "loginSubtitle")} id="setup-branding-loginSubtitle" label="Tiêu đề phụ trang đăng nhập" maxLength={140} onChange={(e) => update("branding", { ...draft.branding, loginSubtitle: e.target.value })} value={draft.branding.loginSubtitle} />
          </FormSection>
          <FormSection title="Logo & favicon"><dl className={styles.dataList}>{Object.entries(assetLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd><StatusBadge tone={draft.branding[key as keyof typeof assetLabels] ? "success" : "neutral"}>{draft.branding[key as keyof typeof assetLabels] ? "Đã thiết lập" : "Chưa thiết lập"}</StatusBadge></dd></div>)}</dl></FormSection>
        </> : null}
        {step === 2 ? <>
          <FormSection columns={1} title="Gói theo ngành">
            <div aria-label="Ngành doanh nghiệp" className={platform.presetGrid} role="radiogroup">{industryPresets.map((preset) => <label className={platform.preset} key={preset.id}><input checked={selectedIndustry === preset.id} name="setup-industry" onChange={() => setSelectedIndustry(preset.id)} type="radio" value={preset.id} /><span>{preset.label}</span></label>)}</div>
            <div className={platform.actions}><Button onClick={() => update("modules", { ...draft.modules, ...modulesForIndustry(selectedIndustry) })}>Áp dụng gói {getIndustryPreset(selectedIndustry).label}</Button><StatusBadge tone="info">{getIndustryPreset(draft.modules.industryPreset).label}</StatusBadge></div>
          </FormSection>
          <FormSection columns={1} title="Module triển khai"><div className={platform.moduleList}><div className={platform.moduleRow}><Switch checked disabled label="Nền tảng & Tài khoản" /><StatusBadge tone="info">Bắt buộc</StatusBadge></div>{erpModuleCatalog.map((module) => { const enabled = isErpModuleEnabled(draft.modules, module.key); return <div className={platform.moduleRow} key={module.key}><Switch checked={enabled} label={module.label} onCheckedChange={(checked) => update("modules", { ...draft.modules, [module.key]: checked })} /><StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "Đang bật" : "Đang tắt"}</StatusBadge></div>; })}</div></FormSection>
        </> : null}
        {step === 3 ? <>
          <FormSection title="Cấu hình doanh nghiệp"><dl className={styles.dataList}><div><dt>Doanh nghiệp</dt><dd>{draft.organization.companyName}</dd></div><div><dt>Tên viết tắt</dt><dd>{draft.organization.shortName}</dd></div><div><dt>Hệ thống</dt><dd>{draft.branding.systemName}</dd></div><div><dt>Gói ngành</dt><dd>{getIndustryPreset(draft.modules.industryPreset).label}</dd></div><div><dt>Module đang bật</dt><dd>{enabledCount}/{erpModuleCatalog.length}</dd></div><div><dt>Định dạng ngày</dt><dd>{draft.localization.dateFormat}</dd></div></dl></FormSection>
          <FormSection columns={1} title="Thay đổi"><dl className={styles.dataList}>{setupGroups.map((group) => <div key={group}><dt>{groupLabels[group]}</dt><dd><span>v{snapshot.versions[group]}</span><StatusBadge tone={changedGroups.includes(group) ? "warning" : "neutral"}>{changedGroups.includes(group) ? "Đã thay đổi" : "Giữ nguyên"}</StatusBadge></dd></div>)}</dl><div className={styles.moduleSummary}>{erpModuleCatalog.map((module) => <div key={module.key}><span>{module.label}</span><StatusBadge tone={isErpModuleEnabled(draft.modules, module.key) ? "success" : "neutral"}>{isErpModuleEnabled(draft.modules, module.key) ? "Bật" : "Tắt"}</StatusBadge></div>)}</div></FormSection>
        </> : null}
      </fieldset>
      {step === 3 ? <label className={styles.confirmation}><input checked={confirmed} disabled={locked || !snapshot.ready || !dirty} onChange={(e) => setConfirmed(e.target.checked)} type="checkbox" /><span>Xác nhận xuất bản cấu hình</span></label> : null}
    </section>
    {error ? <div className={styles.feedback} role="alert">{error}</div> : null}
    {message ? <div aria-live="polite" className="save-feedback">{message}</div> : null}
    <StickyActionBar>
      <span className={platform.count} aria-live="polite">{changedGroups.length ? `${changedGroups.length} nhóm thay đổi` : "Đã đồng bộ"}</span>
      <Button busy={loading} disabled={saving} leftIcon={<RefreshCw aria-hidden="true" size={16} />} onClick={() => void reload()}>Tải lại cấu hình</Button>
      <Button disabled={locked || !dirty} onClick={saveDraft}>Lưu bản nháp</Button>
      {step > 0 ? <Button disabled={saving} leftIcon={<ArrowLeft aria-hidden="true" size={16} />} onClick={() => { setStep(step - 1); setFieldErrors({}); }}>Quay lại</Button> : null}
      {step < 3 ? <Button disabled={loading || saving} onClick={next} rightIcon={<ArrowRight aria-hidden="true" size={16} />} variant="primary">Tiếp tục</Button> : <Button busy={saving} disabled={!snapshot.ready || !dirty || !confirmed || loading} onClick={() => void publish()} variant="primary">{pending ? "Thử xuất bản lại" : "Xuất bản cấu hình"}</Button>}
    </StickyActionBar>
  </AdminPage>;
}

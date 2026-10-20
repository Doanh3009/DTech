"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, RefreshCw, Search, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button, IconButton } from "@/components/shared/Button";
import { Checkbox, Input, Select } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { LeavePolicy, LeaveType } from "@/features/leave/types/leaveTypes";
import { can } from "@/lib/auth/permissions";
import styles from "./LeaveSettings.module.css";

type ApproverSource = "direct_manager" | "department_manager" | "specific_role" | "specific_user" | "hr_role";
type WorkflowStep = { id?: string; stepOrder?: number; approverSource: ApproverSource; specificAccountId?: string; specificRoleCode?: string; specificAccountName?: string; specificRoleName?: string };
type Workflow = { id: string; code: string; name: string; active: boolean; version?: number; steps: WorkflowStep[] };
type WorkflowForm = { code: string; name: string; active: boolean; version?: number; steps: WorkflowStep[] };
type ApproverOptions = { accounts: { id: string; name: string; employeeCode?: string; username?: string }[]; roles: { code: string; name: string }[] };
type TypeForm = Omit<LeaveType, "id">;
type FieldErrors = Record<string, string>;
type Section = "types" | "workflows" | "policies";

const sourceLabels: Record<ApproverSource, string> = {
  direct_manager: "Quản lý trực tiếp", department_manager: "Trưởng phòng", specific_role: "Vai trò chỉ định",
  specific_user: "Người dùng chỉ định", hr_role: "Nhân sự"
};
const toneLabels: Record<LeaveType["tone"], string> = { neutral: "Xám", info: "Xanh dương", success: "Xanh lá", warning: "Cam" };
const dayLabels = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const typeFlags = [
  ["deductsBalance", "Trừ số dư phép"], ["requiresReason", "Yêu cầu lý do"], ["requiresAttachment", "Yêu cầu tài liệu"],
  ["allowsHalfDay", "Cho phép nửa ngày"], ["allowsMultiDay", "Cho phép nhiều ngày"]
] as const;

function newType(workflowId = ""): TypeForm {
  return { code: "", name: "", tone: "info", deductsBalance: true, requiresReason: true, requiresAttachment: false,
    allowsHalfDay: true, allowsMultiDay: true, workflowId, active: true };
}
function newWorkflow(): WorkflowForm {
  return { code: "", name: "", active: true, steps: [{ approverSource: "direct_manager" }] };
}
function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => undefined);
  if (!response.ok || !body || body.data === undefined) throw new Error(body?.error?.message ?? "Không thể tải dữ liệu. Vui lòng thử lại.");
  return body.data as T;
}
function validateIdentity(value: { code: string; name: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(value.code.trim())) errors.code = "Mã gồm 2–30 ký tự: A–Z, 0–9, dấu gạch dưới; bắt đầu bằng chữ.";
  if (value.name.trim().length < 2 || value.name.trim().length > 100) errors.name = "Tên cần từ 2 đến 100 ký tự.";
  return errors;
}
function fieldTarget(key: string) {
  if (key.startsWith("step.")) return `leave-settings-step-${key.slice(5)}`;
  if (key === "weekendDays") return "leave-settings-weekday-1";
  return `leave-settings-${key}`;
}

export function LeaveSettings({ section }: { section: Section }) {
  const user = useCurrentUser();
  const canManage = can(user.permissions, section === "types" ? "leave.type.manage" : section === "workflows" ? "leave.workflow.manage" : "leave.policy.manage");
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [policy, setPolicy] = useState<LeavePolicy>();
  const [savedPolicy, setSavedPolicy] = useState<LeavePolicy>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<{ kind: "type" | "workflow"; id?: string }>();
  const [typeForm, setTypeForm] = useState<TypeForm>(() => newType());
  const [workflowForm, setWorkflowForm] = useState<WorkflowForm>(newWorkflow);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvers, setApprovers] = useState<ApproverOptions>({ accounts: [], roles: [] });
  const [approversLoading, setApproversLoading] = useState(false);
  const [approversError, setApproversError] = useState("");
  const loadId = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const current = ++loadId.current;
    setLoading(true);
    setLoadError("");
    try {
      if (section === "policies") {
        const value = await readApi<LeavePolicy>("/api/v1/leave-policies");
        if (current === loadId.current) { setPolicy(value); setSavedPolicy(value); }
      } else {
        const [nextTypes, nextWorkflows] = await Promise.all([
          readApi<LeaveType[]>("/api/v1/leave-types"), readApi<Workflow[]>("/api/v1/leave-workflows")
        ]);
        if (current === loadId.current) { setTypes(nextTypes); setWorkflows(nextWorkflows); }
      }
    } catch (reason) {
      if (current === loadId.current) setLoadError(errorMessage(reason, "Không thể tải cấu hình nghỉ phép."));
    } finally {
      if (current === loadId.current) setLoading(false);
    }
  }, [section]);

  const loadApprovers = useCallback(async () => {
    setApproversLoading(true);
    setApproversError("");
    try { setApprovers(await readApi<ApproverOptions>("/api/v1/leave-workflows/approvers")); }
    catch (reason) { setApproversError(errorMessage(reason, "Không thể tải người duyệt.")); }
    finally { setApproversLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return load(); });
    return () => { cancelled = true; loadId.current += 1; };
  }, [load]);
  useEffect(() => {
    if (section === "workflows" && canManage) void Promise.resolve().then(loadApprovers);
  }, [canManage, loadApprovers, section]);

  function resetEditor() {
    if (saving) return;
    setEditor(undefined); setFieldErrors({}); setActionError("");
  }
  function openType(item?: LeaveType) {
    setTypeForm(item ? { ...item } : newType(workflows.find((workflow) => workflow.active)?.id));
    setFieldErrors({}); setActionError(""); setNotice(""); setEditor({ kind: "type", id: item?.id });
  }
  function openWorkflow(item?: Workflow) {
    setWorkflowForm(item ? { code: item.code, name: item.name, active: item.active, version: item.version, steps: item.steps.map((step) => ({ ...step })) } : newWorkflow());
    setFieldErrors({}); setActionError(""); setNotice(""); setEditor({ kind: "workflow", id: item?.id });
  }
  function updateType<K extends keyof TypeForm>(key: K, value: TypeForm[K]) {
    setTypeForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }
  function updateWorkflowStep(index: number, next: Partial<WorkflowStep>) {
    setWorkflowForm((current) => ({ ...current, steps: current.steps.map((step, position) => position === index ? { ...step, ...next } : step) }));
    setFieldErrors((current) => ({ ...current, [`step.${index}`]: "" }));
  }
  function moveStep(index: number, direction: -1 | 1) {
    setWorkflowForm((current) => {
      const steps = [...current.steps];
      const target = index + direction;
      if (target < 0 || target >= steps.length) return current;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
    setFieldErrors({});
  }
  function showErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    requestAnimationFrame(() => {
      if (Object.values(errors).filter(Boolean).length > 1) errorSummaryRef.current?.focus();
      else (formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not([hidden])') ?? document.getElementById(fieldTarget(Object.keys(errors)[0])))?.focus();
    });
  }
  async function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const value = editor.kind === "type" ? typeForm : workflowForm;
    const errors = validateIdentity(value);
    if (editor.kind === "type") {
      if (!typeForm.workflowId) errors.workflowId = "Chọn quy trình duyệt.";
      else if (typeForm.active && !workflows.some((workflow) => workflow.id === typeForm.workflowId && workflow.active)) errors.workflowId = "Chọn quy trình đang hoạt động.";
    } else {
      if (!workflowForm.steps.length || workflowForm.steps.length > 10) errors.steps = "Quy trình cần từ 1 đến 10 bước.";
      workflowForm.steps.forEach((step, index) => {
        if (step.approverSource === "specific_user" && !step.specificAccountId) errors[`step.${index}`] = "Chọn người duyệt.";
        if (step.approverSource === "specific_role" && !step.specificRoleCode) errors[`step.${index}`] = "Chọn vai trò duyệt.";
        if (!approversLoading && !approversError && step.approverSource === "specific_user" && step.specificAccountId && !approvers.accounts.some((account) => account.id === step.specificAccountId)) errors[`step.${index}`] = "Người duyệt không còn khả dụng. Vui lòng chọn lại.";
        if (!approversLoading && !approversError && step.approverSource === "specific_role" && step.specificRoleCode && !approvers.roles.some((role) => role.code === step.specificRoleCode)) errors[`step.${index}`] = "Vai trò không còn khả dụng. Vui lòng chọn lại.";
      });
      if (approversLoading && workflowForm.steps.some((step) => ["specific_user", "specific_role"].includes(step.approverSource))) errors.steps = "Đang tải danh sách người duyệt. Vui lòng đợi.";
      if (approversError && workflowForm.steps.some((step) => ["specific_user", "specific_role"].includes(step.approverSource))) errors.steps = "Tải lại danh sách người duyệt trước khi lưu.";
    }
    if (Object.keys(errors).length) { showErrors(errors); return; }
    setSaving(true); setActionError("");
    const endpoint = editor.kind === "type" ? "/api/v1/leave-types" : "/api/v1/leave-workflows";
    const payload = editor.kind === "type" ? {
      ...typeForm, code: typeForm.code.trim(), name: typeForm.name.trim()
    } : {
      code: workflowForm.code.trim(), name: workflowForm.name.trim(), active: workflowForm.active,
      ...(editor.id && workflowForm.version !== undefined ? { version: workflowForm.version } : {}),
      steps: workflowForm.steps.map((step) => ({ approverSource: step.approverSource,
        ...(step.approverSource === "specific_user" ? { specificAccountId: step.specificAccountId } : {}),
        ...(step.approverSource === "specific_role" ? { specificRoleCode: step.specificRoleCode } : {}) }))
    };
    try {
      const result = await readApi<LeaveType | Workflow>(`${endpoint}${editor.id ? `/${editor.id}` : ""}`, {
        method: editor.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      if (editor.kind === "type") setTypes((current) => editor.id ? current.map((item) => item.id === editor.id ? result as LeaveType : item) : [...current, result as LeaveType]);
      else setWorkflows((current) => editor.id ? current.map((item) => item.id === editor.id ? result as Workflow : item) : [...current, result as Workflow]);
      setNotice(editor.id ? "Đã lưu thay đổi" : editor.kind === "type" ? "Đã thêm loại nghỉ" : "Đã thêm quy trình");
      setEditor(undefined); setFieldErrors({});
    } catch (reason) { setActionError(errorMessage(reason, "Không thể lưu thay đổi.")); }
    finally { setSaving(false); }
  }
  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policy || saving) return;
    const errors: FieldErrors = {};
    if (policy.weekendDays.length > 6) errors.weekendDays = "Cần có ít nhất một ngày làm việc trong tuần.";
    if (!Number.isFinite(policy.carryoverMaxDays) || policy.carryoverMaxDays < 0 || policy.carryoverMaxDays > 365) errors.carryoverMaxDays = "Số ngày cần từ 0 đến 365.";
    if (Object.keys(errors).length) { showErrors(errors); return; }
    setSaving(true); setNotice(""); setActionError("");
    try {
      const next = await readApi<LeavePolicy>("/api/v1/leave-policies", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policy)
      });
      setPolicy(next); setSavedPolicy(next); setFieldErrors({}); setNotice("Đã lưu chính sách nghỉ phép");
    } catch (reason) { setActionError(errorMessage(reason, "Không thể lưu chính sách.")); }
    finally { setSaving(false); }
  }

  function targetLabel(step: WorkflowStep) {
    if (step.approverSource === "specific_user") {
      const account = approvers.accounts.find((item) => item.id === step.specificAccountId);
      return account ? `${account.name}${account.employeeCode ? ` · ${account.employeeCode}` : ""}` : step.specificAccountName ?? "Người duyệt chỉ định";
    }
    if (step.approverSource === "specific_role") return approvers.roles.find((role) => role.code === step.specificRoleCode)?.name ?? step.specificRoleName ?? step.specificRoleCode ?? "Chưa chọn vai trò";
    return sourceLabels[step.approverSource] ?? step.approverSource;
  }

  if (loading) return <div className={styles.surface}><LoadingState title="Đang tải cấu hình nghỉ phép" /></div>;
  if (loadError) return <div className={styles.surface}><ErrorState title="Không thể tải cấu hình nghỉ phép" description={loadError} action={<Button onClick={() => void load()} leftIcon={<RefreshCw aria-hidden="true" size={16} />}>Thử lại</Button>} /></div>;

  const filtered = <T extends { code: string; name: string; active: boolean }>(items: T[]) => items.filter((item) =>
    (status === "all" || item.active === (status === "active")) && `${item.name} ${item.code}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const list = section === "types" ? filtered(types) : filtered(workflows);
  const policyDirty = JSON.stringify(policy) !== JSON.stringify(savedPolicy);
  const validationErrors = Object.entries(fieldErrors).filter(([, message]) => Boolean(message));
  const errorSummary = validationErrors.length > 1 ? <div className={styles.errorSummary} ref={errorSummaryRef} role="alert" tabIndex={-1}><strong>Kiểm tra {validationErrors.length} mục</strong><ul>{validationErrors.map(([key, message]) => <li key={key}><a href={`#${fieldTarget(key)}`} onClick={(event) => { event.preventDefault(); document.getElementById(fieldTarget(key))?.focus(); }}>{key.startsWith("step.") ? `Bước ${Number(key.slice(5)) + 1}: ` : ""}{message}</a></li>)}</ul></div> : null;

  return <div className={styles.root}>
    {notice ? <div className={styles.notice} role="status"><Check aria-hidden="true" size={17} />{notice}</div> : null}
    {section === "policies" && policy ? <form className={`${styles.surface} ${styles.policyForm}`} noValidate onSubmit={savePolicy} ref={formRef}>
      {errorSummary}
      <fieldset disabled={!canManage || saving} className={styles.policySection}>
        <legend>Ngày nghỉ hằng tuần</legend>
        <div className={styles.weekdays}>{[1, 2, 3, 4, 5, 6, 0].map((day) => <label className={styles.dayChoice} data-selected={policy.weekendDays.includes(day)} key={day}>
          <input aria-invalid={Boolean(fieldErrors.weekendDays)} aria-describedby={fieldErrors.weekendDays ? "weekend-error" : undefined} checked={policy.weekendDays.includes(day)} id={`leave-settings-weekday-${day}`} type="checkbox" onChange={(event) => {
            setPolicy((current) => current ? { ...current, weekendDays: (event.target.checked ? [...current.weekendDays, day] : current.weekendDays.filter((value) => value !== day)).sort((a, b) => a - b) } : current);
            setFieldErrors((current) => ({ ...current, weekendDays: "" }));
          }} /><span>{dayLabels[day]}</span>
        </label>)}</div>
        {fieldErrors.weekendDays ? <p className={styles.fieldError} id="weekend-error" role="alert">{fieldErrors.weekendDays}</p> : null}
      </fieldset>
      <fieldset disabled={!canManage || saving} className={styles.policySection}><legend>Số dư và đơn nghỉ</legend>
        <div className={styles.options}>
          <Checkbox checked={policy.allowNegativeBalance} label="Cho phép âm số dư phép" onChange={(event) => setPolicy({ ...policy, allowNegativeBalance: event.target.checked })} />
          <Checkbox checked={policy.allowWithdrawPending} label="Cho phép thu hồi đơn chờ duyệt" onChange={(event) => setPolicy({ ...policy, allowWithdrawPending: event.target.checked })} />
          <Checkbox checked={policy.cancellationRequiresApproval} label="Hủy đơn đã duyệt cần Nhân sự phê duyệt" onChange={(event) => setPolicy({ ...policy, cancellationRequiresApproval: event.target.checked })} />
        </div>
      </fieldset>
      {can(user.permissions, "leave.balance.view_all") ? <section className={styles.policySection}><h2>Quyết toán cuối năm</h2><Link className="button button--secondary button--md" href="/leave/settlements">Đơn giá và thanh toán phép dư</Link></section> : null}
      {actionError ? <p className={styles.actionError} role="alert">{actionError}</p> : null}
      {canManage ? <footer className={styles.footer}><Button disabled={saving || !policyDirty} onClick={() => { setPolicy(savedPolicy); setFieldErrors({}); setActionError(""); }}>Hoàn tác</Button><Button busy={saving} disabled={!policyDirty} type="submit" variant="primary">{saving ? "Đang lưu…" : "Lưu chính sách"}</Button></footer> : null}
    </form> : null}

    {section !== "policies" ? <>
      <div className={styles.toolbar} data-ui="filter-controls">
        <div className={styles.search} data-ui="filter-search"><Search aria-hidden="true" size={18} /><input aria-label={section === "types" ? "Tìm loại nghỉ" : "Tìm quy trình"} autoComplete="off" placeholder={section === "types" ? "Tìm mã, tên loại nghỉ" : "Tìm mã, tên quy trình"} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className={styles.statusFilter}><Select label="Trạng thái" labelHidden options={[{ value: "all", label: "Tất cả trạng thái" }, { value: "active", label: "Đang hoạt động" }, { value: "inactive", label: "Ngừng hoạt động" }]} value={status} onChange={(event) => setStatus(event.target.value)} /></div>
        {canManage ? <Button className={styles.addButton} leftIcon={<Plus aria-hidden="true" size={18} />} onClick={() => section === "types" ? openType() : openWorkflow()} variant="primary">{section === "types" ? "Thêm loại nghỉ" : "Thêm quy trình"}</Button> : null}
      </div>
      <div className={styles.resultCount}>{list.length} {section === "types" ? "loại nghỉ" : "quy trình"}</div>
      {!list.length ? <div className={styles.surface}><EmptyState title={query || status !== "all" ? "Không có kết quả" : section === "types" ? "Chưa có loại nghỉ" : "Chưa có quy trình"} action={query || status !== "all" ? <Button onClick={() => { setQuery(""); setStatus("all"); }}>Xóa bộ lọc</Button> : canManage ? <Button onClick={() => section === "types" ? openType() : openWorkflow()} variant="primary">{section === "types" ? "Thêm loại nghỉ" : "Thêm quy trình"}</Button> : undefined} /></div> : section === "types" ? <div className={styles.surface}>
        <table className={styles.typeTable}><thead><tr><th scope="col">Loại nghỉ</th><th scope="col">Số dư / Tài liệu</th><th scope="col">Thời gian nghỉ</th><th scope="col">Quy trình</th><th scope="col">Trạng thái</th>{canManage ? <th scope="col"><span className="sr-only">Thao tác</span></th> : null}</tr></thead><tbody>
          {(list as LeaveType[]).map((item) => <tr key={item.id}>
            <td data-label="Loại nghỉ" className={styles.typeIdentity}><span className={styles.toneDot} data-tone={item.tone} aria-hidden="true" /><div><strong>{item.name}</strong><span>{item.code}</span></div></td>
            <td data-label="Số dư / Tài liệu"><div className={styles.tableValues}><span>{item.deductsBalance ? "Trừ phép" : "Không trừ phép"}</span><span>{item.requiresAttachment ? "Tài liệu bắt buộc" : "Không yêu cầu tài liệu"}</span></div></td>
            <td data-label="Thời gian nghỉ"><div className={styles.tableValues}><span>{item.allowsHalfDay ? "Có nửa ngày" : "Chỉ nguyên ngày"}</span><span>{item.allowsMultiDay ? "Có nhiều ngày" : "Từng ngày"}</span></div></td>
            <td data-label="Quy trình">{workflows.find((workflow) => workflow.id === item.workflowId)?.name ?? "Chưa cấu hình"}</td>
            <td data-label="Trạng thái"><StatusBadge tone={item.active ? "success" : "neutral"}>{item.active ? "Hoạt động" : "Ngừng hoạt động"}</StatusBadge></td>
            {canManage ? <td className={styles.editCell}><Button leftIcon={<Pencil aria-hidden="true" size={15} />} onClick={() => openType(item)} size="sm">Sửa</Button></td> : null}
          </tr>)}
        </tbody></table>
      </div> : <div className={styles.workflowList}>
        {(list as Workflow[]).map((item) => {
          const assignedTypes = types.filter((type) => type.workflowId === item.id);
          return <article className={`${styles.surface} ${styles.workflowCard}`} key={item.id}>
            <header className={styles.workflowHeader}><span className={styles.workflowIcon}><WorkflowIcon aria-hidden="true" size={20} /></span><div className={styles.workflowTitle}><h2>{item.name}</h2><span>{item.code}</span></div><StatusBadge tone={item.active ? "success" : "neutral"}>{item.active ? "Hoạt động" : "Ngừng hoạt động"}</StatusBadge>{canManage ? <Button leftIcon={<Pencil aria-hidden="true" size={15} />} onClick={() => openWorkflow(item)} size="sm">Sửa</Button> : null}</header>
            {item.steps.length ? <ol className={styles.stepSequence}>{item.steps.map((step, index) => <li key={step.id ?? index}><span className={styles.stepNumber}>{index + 1}</span><div><strong>{sourceLabels[step.approverSource] ?? step.approverSource}</strong>{["specific_role", "specific_user"].includes(step.approverSource) ? <span>{targetLabel(step)}</span> : null}</div></li>)}</ol> : <div className={styles.missingSteps}>Chưa có bước duyệt</div>}
            <footer className={styles.workflowUsage}><span>Loại nghỉ áp dụng</span><div>{assignedTypes.length ? assignedTypes.map((type) => <span className={styles.typeChip} key={type.id}>{type.name}</span>) : <span className={styles.unassigned}>Chưa áp dụng</span>}</div></footer>
          </article>;
        })}
      </div>}
    </> : null}

    <Modal className={styles.editorModal} onClose={resetEditor} open={Boolean(editor)} title={editor?.kind === "workflow" ? editor.id ? "Sửa quy trình duyệt" : "Thêm quy trình duyệt" : editor?.id ? "Sửa loại nghỉ" : "Thêm loại nghỉ"}>
      <form className={styles.editorForm} noValidate onSubmit={saveEditor} ref={section === "policies" ? undefined : formRef}>
        {section !== "policies" ? errorSummary : null}
        <fieldset disabled={saving} className={styles.editorFields}>
          <div className={styles.fieldGrid}>
            <Input autoComplete="off" error={fieldErrors.code} id="leave-settings-code" label="Mã" maxLength={30} required value={editor?.kind === "workflow" ? workflowForm.code : typeForm.code} onChange={(event) => {
              const code = event.target.value.toUpperCase();
              if (editor?.kind === "workflow") { setWorkflowForm((current) => ({ ...current, code })); setFieldErrors((current) => ({ ...current, code: "" })); }
              else updateType("code", code);
            }} />
            <Input autoComplete="off" error={fieldErrors.name} id="leave-settings-name" label="Tên" maxLength={100} required value={editor?.kind === "workflow" ? workflowForm.name : typeForm.name} onChange={(event) => {
              if (editor?.kind === "workflow") { setWorkflowForm((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => ({ ...current, name: "" })); }
              else updateType("name", event.target.value);
            }} />
          </div>
          {editor?.kind === "type" ? <>
            <div className={styles.fieldGrid}><Select error={fieldErrors.workflowId} id="leave-settings-workflowId" label="Quy trình duyệt" options={workflows.filter((workflow) => workflow.active || workflow.id === typeForm.workflowId).map((workflow) => ({ value: workflow.id, label: `${workflow.name}${workflow.active ? "" : " · Ngừng hoạt động"}` }))} placeholder="Chọn quy trình" required value={typeForm.workflowId} onChange={(event) => updateType("workflowId", event.target.value)} /><Select label="Màu hiển thị" options={Object.entries(toneLabels).map(([value, label]) => ({ value, label }))} value={typeForm.tone} onChange={(event) => updateType("tone", event.target.value as LeaveType["tone"])} /></div>
            {!workflows.length ? <p className={styles.actionError}>Chưa có quy trình duyệt để chọn.</p> : null}
            <div className={styles.typeOptions}>{typeFlags.map(([key, label]) => <Checkbox checked={typeForm[key]} key={key} label={label} onChange={(event) => updateType(key, event.target.checked)} />)}</div>
            <Checkbox checked={typeForm.active} label="Hoạt động" onChange={(event) => updateType("active", event.target.checked)} />
          </> : <>
            <div className={styles.stepsHeading} id="leave-settings-steps" tabIndex={-1}><h3>Các bước duyệt <span>{workflowForm.steps.length}/10</span></h3><Button disabled={workflowForm.steps.length >= 10} leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => { setWorkflowForm((current) => ({ ...current, steps: [...current.steps, { approverSource: "direct_manager" }] })); setFieldErrors({}); }} size="sm">Thêm bước</Button></div>
            {approversError ? <div className={styles.approverError} role="alert"><span>{approversError}</span><Button busy={approversLoading} onClick={() => void loadApprovers()} size="sm">Thử lại</Button></div> : null}
            {fieldErrors.steps ? <p className={styles.fieldError} role="alert">{fieldErrors.steps}</p> : null}
            <ol className={styles.stepEditor}>{workflowForm.steps.map((step, index) => {
              const accountOptions = approvers.accounts.map((account) => ({ value: account.id, label: `${account.name}${account.employeeCode ? ` · ${account.employeeCode}` : account.username ? ` · ${account.username}` : ""}` }));
              const roleOptions = approvers.roles.map((role) => ({ value: role.code, label: role.name }));
              if (step.specificAccountId && !accountOptions.some((option) => option.value === step.specificAccountId)) accountOptions.push({ value: step.specificAccountId, label: `${step.specificAccountName ?? "Người duyệt hiện tại"} · Cần chọn lại` });
              if (step.specificRoleCode && !roleOptions.some((option) => option.value === step.specificRoleCode)) roleOptions.push({ value: step.specificRoleCode, label: `${step.specificRoleName ?? step.specificRoleCode} · Cần chọn lại` });
              return <li key={index}>
                <div className={styles.stepEditorHeader}><strong><span className={styles.stepNumber}>{index + 1}</span>Bước {index + 1}</strong><div className={styles.stepControls}>
                  <IconButton disabled={index === 0} label={`Đưa bước ${index + 1} lên`} onClick={() => moveStep(index, -1)}><ArrowUp aria-hidden="true" size={16} /></IconButton>
                  <IconButton disabled={index === workflowForm.steps.length - 1} label={`Đưa bước ${index + 1} xuống`} onClick={() => moveStep(index, 1)}><ArrowDown aria-hidden="true" size={16} /></IconButton>
                  <IconButton disabled={workflowForm.steps.length <= 1} label={`Xóa bước ${index + 1}`} onClick={() => { setWorkflowForm((current) => ({ ...current, steps: current.steps.filter((_, position) => position !== index) })); setFieldErrors({}); }} variant="danger"><Trash2 aria-hidden="true" size={16} /></IconButton>
                </div></div>
                <div className={styles.stepFields}><Select label="Người duyệt" options={Object.entries(sourceLabels).map(([value, label]) => ({ value, label }))} value={step.approverSource} onChange={(event) => updateWorkflowStep(index, { approverSource: event.target.value as ApproverSource, specificAccountId: undefined, specificRoleCode: undefined })} />
                  {step.approverSource === "specific_user" ? <Select disabled={approversLoading || Boolean(approversError)} error={fieldErrors[`step.${index}`]} id={`leave-settings-step-${index}`} label="Tài khoản duyệt" options={accountOptions} placeholder={approversLoading ? "Đang tải người duyệt…" : "Chọn người duyệt"} required value={step.specificAccountId ?? ""} onChange={(event) => updateWorkflowStep(index, { specificAccountId: event.target.value })} /> : null}
                  {step.approverSource === "specific_role" ? <Select disabled={approversLoading || Boolean(approversError)} error={fieldErrors[`step.${index}`]} id={`leave-settings-step-${index}`} label="Vai trò duyệt" options={roleOptions} placeholder={approversLoading ? "Đang tải vai trò…" : "Chọn vai trò"} required value={step.specificRoleCode ?? ""} onChange={(event) => updateWorkflowStep(index, { specificRoleCode: event.target.value })} /> : null}
                </div>
              </li>;
            })}</ol>
            <Checkbox checked={workflowForm.active} label="Hoạt động" onChange={(event) => setWorkflowForm((current) => ({ ...current, active: event.target.checked }))} />
          </>}
        </fieldset>
        {actionError ? <p className={styles.actionError} role="alert">{actionError}</p> : null}
        <footer className={styles.footer}><Button disabled={saving} onClick={resetEditor}>Hủy</Button><Button busy={saving} disabled={editor?.kind === "type" && !workflows.length} type="submit" variant="primary">{saving ? "Đang lưu…" : editor?.id ? "Lưu thay đổi" : editor?.kind === "workflow" ? "Tạo quy trình" : "Thêm loại nghỉ"}</Button></footer>
      </form>
    </Modal>
  </div>;
}

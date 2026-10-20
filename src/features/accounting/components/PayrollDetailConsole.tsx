"use client";

import Link from "next/link";
import { Check, ChevronDown, Download, RefreshCw, Send, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { FileDownloadLink } from "@/components/shared/FileDownloadLink";
import { Input, SearchInput } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { DataSurface, DetailPageLayout } from "@/components/shared/PageLayouts";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { payrollInputIssues } from "../payrollRules";
import { payrollWorkflow } from "../payrollWorkflow";
import type { PayrollDetail, PayrollLine } from "../types";
import { PayslipSendDrawer } from "./PayslipSendDrawer";
import styles from "./PayrollDetailConsole.module.css";

type Permissions = { calculate: boolean; edit: boolean; lock: boolean; publish: boolean; export: boolean };
const money = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
const month = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
const labels = { draft: "Chờ cập nhật lương", calculated: "Chờ duyệt lương", reviewed: "Chờ duyệt lương", locked: "Đã duyệt lương", published: "Đã phát hành phiếu lương" };

export function PayrollDetailConsole({ id, permissions }: { id: string; permissions: Permissions }) {
  const mutation = useRef(false), request = useRef(0);
  const [data, setData] = useState<PayrollDetail>();
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<PayrollLine>();
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<{ scope: "individual" | "all"; employeeId?: string }>();
  const [page, setPage] = useState(1), [reopen, setReopen] = useState(false), [reason, setReason] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const key = ++request.current;
    const response = await fetch(`/api/v1/accounting/payroll/${id}`, { cache: "no-store", signal: signal ?? AbortSignal.timeout(20_000) });
    const body = await response.json() as { data?: PayrollDetail; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải bảng lương.");
    if (key === request.current && !signal?.aborted) setData(body.data);
  }, [id]);
  useEffect(() => {
    const counter = request, controller = new AbortController();
    queueMicrotask(() => void load(AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
      .catch((caught: unknown) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Không thể tải bảng lương."); }));
    return () => { controller.abort(); ++counter.current; };
  }, [load]);
  const reconcile = useCallback(async () => { if (!mutation.current) await load(); }, [load]);
  useDomainReconciliation("dashboard", reconcile);
  async function refresh() {
    if (mutation.current || refreshing) return;
    setRefreshing(true); setError("");
    try { await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải bảng lương."); }
    finally { setRefreshing(false); }
  }
  async function act(values: Record<string, unknown>) {
    if (!data || mutation.current) return false;
    mutation.current = true; ++request.current; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/accounting/payroll/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ rowVersion: data.rowVersion, ...values }), signal: AbortSignal.timeout(60_000) });
      const body = await response.json() as { data?: PayrollDetail; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể cập nhật bảng lương.");
      setData(body.data); return true;
    } catch (caught) {
      setError(caught instanceof Error && caught.name !== "TimeoutError" ? caught.message : "Chưa nhận được phản hồi. Vui lòng tải lại để kiểm tra.");
      try { await load(); } catch { /* Keep the original error and entered values. */ }
      return false;
    } finally { mutation.current = false; setBusy(false); }
  }
  async function saveLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const form = new FormData(event.currentTarget);
    if (await act({ action: "update_line", lineId: editing.id, lineRowVersion: editing.rowVersion, baseSalary: Number(form.get("baseSalary")), allowance: Number(form.get("allowance")), bonus: Number(form.get("bonus")), deduction: Number(form.get("deduction")), reason: String(form.get("reason") ?? "").trim() })) setEditing(undefined);
  }
  if (!data) return <DetailPageLayout className={styles.layout}>{error ? <div className={styles.notice}><p className="form-error" role="alert">{error}</p><Button onClick={() => void refresh()} busy={refreshing}>Tải lại</Button></div> : <LoadingState title="Đang mở bảng lương" />}</DetailPageLayout>;
  const flow = payrollWorkflow(data);
  const approved = data.status === "locked" || data.status === "published";
  const issued = data.lines.some(line => line.payslipStatus === "published");
  const editable = permissions.edit && data.lines.length > 0 && !issued;
  const ready = data.status === "draft" ? flow.inputReady : flow.readyToReview;
  const visible = data.lines.filter(line => `${line.employeeName} ${line.employeeCode}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(visible.length / 20)), currentPage = Math.min(page, pages);
  const employeeHref = (line: PayrollLine) => `/accounting/payroll/${id}/employees/${line.employeeId}`;
  const receipt = (line: PayrollLine) => line.payslipStatus !== "published" ? line.deliveryReady === false ? "Chưa có tài khoản" : "Chưa gửi" : line.deliveryStatus === "failed" ? "Gửi lỗi" : line.payslipConfirmedAt ? "Đã xác nhận" : line.payslipViewedAt ? "Đã xem" : line.deliveryStatus === "pending" ? "Đang gửi" : line.deliveryStatus === "delivered" ? "Đã gửi" : "Đã phát hành";
  const openEdit = (line: PayrollLine) => { setError(""); setEditing(line); };
  const columns: DataTableColumn<PayrollLine>[] = [
    { id: "employee", header: "Nhân viên", priority: "primary", cell: line => <Link className={styles.person} href={employeeHref(line)}><strong>{line.employeeName}</strong><small>{line.employeeCode}{permissions.publish && line.deliveryAccount?.username ? ` · @${line.deliveryAccount.username}` : ""}</small></Link> },
    { id: "days", header: "Ngày công", cell: line => line.workDays, align: "right", width: "compact" },
    { id: "salary", header: "Lương", cell: line => money(line.baseSalary), align: "right" },
    { id: "allowance", header: "Phụ cấp", cell: line => money(line.allowance), align: "right" },
    { id: "bonus", header: "Thưởng", cell: line => money(line.bonus), align: "right" },
    ...(data.lines.some(line => (line.leaveCashoutAmount ?? 0) > 0) ? [{ id: "leave", header: "Phép dư", cell: (line: PayrollLine) => money(line.leaveCashoutAmount ?? 0), align: "right" as const }] : []),
    { id: "deduction", header: "Khấu trừ", cell: line => money(line.deduction), align: "right" },
    { id: "net", header: "Thực nhận", cell: line => <strong className={line.netSalary < 0 ? styles.negative : undefined}>{money(line.netSalary)}</strong>, align: "right" },
    { id: "receipt", header: "Phiếu lương", cell: line => <StatusBadge tone={line.deliveryStatus === "failed" ? "error" : line.payslipStatus === "published" ? "success" : "neutral"}>{receipt(line)}</StatusBadge> }
  ];
  const issues = data.readiness ? payrollInputIssues(data.readiness) : [];
  return <DetailPageLayout className={styles.layout}>
    <header className={styles.header}><div className={styles.heading}><h2>Bảng lương tháng {month(data.periodMonth)}</h2><div className={styles.period}><StatusBadge tone={approved ? "success" : "warning"}>{labels[data.status]}</StatusBadge><span>{data.lines.length || data.readiness?.employees.length || 0} nhân viên</span>{data.timesheetPeriodId ? <Link href={`/timesheets/periods/${data.timesheetPeriodId}`}>Bảng công</Link> : null}</div></div>
      <div className={styles.actions} data-ui="actions">
        <Button aria-label="Tải lại bảng lương" busy={refreshing} disabled={busy} leftIcon={<RefreshCw aria-hidden="true" size={17} />} onClick={() => void refresh()} />
        {permissions.export ? approved && data.lines.length > 0 ? <FileDownloadLink className="button button--secondary button--md" format="xlsx" href={`/api/v1/accounting/payroll/${id}/export`}><Download aria-hidden="true" size={17} />Xuất Excel</FileDownloadLink> : <Button disabled leftIcon={<Download aria-hidden="true" size={17} />}>Xuất Excel</Button> : null}
        {!approved && permissions.lock ? <Button busy={busy} disabled={busy || !ready} leftIcon={<Check aria-hidden="true" size={17} />} onClick={() => void act({ action: "approve_salary" })} variant="primary">Duyệt lương</Button> : null}
        {permissions.publish && approved ? <span className={styles.sendAction}><DropdownMenu menuWidth={290} disabled={busy || !data.lines.length} label="Gửi phiếu lương" trigger={<><Send aria-hidden="true" size={17} /><span>Gửi phiếu lương</span><ChevronDown aria-hidden="true" size={16} /></>}>
          <div className={styles.sendMenu}>
            <button disabled={busy} onClick={() => setSending({ scope: "individual" })} type="button"><UserRound aria-hidden="true" size={18} /><span>Chọn tài khoản nhận</span></button>
            <button disabled={busy} onClick={() => setSending({ scope: "all" })} type="button"><Users aria-hidden="true" size={18} /><span>Gửi tất cả nhân viên</span></button>
          </div>
        </DropdownMenu></span> : null}
        {approved && permissions.edit ? <DropdownMenu label="Thao tác bảng lương"><button onClick={() => { setError(""); setReopen(true); }} type="button">Mở lại điều chỉnh</button></DropdownMenu> : null}
      </div>
    </header>
    <section aria-label="Tổng hợp bảng lương" className={styles.summary}><div className={styles.net}><span>Thực nhận</span><strong>{data.lines.length ? money(data.netTotal) : "—"}</strong></div><dl className={styles.facts}><div><dt>Tổng thu nhập</dt><dd>{data.lines.length ? money(data.grossTotal) : "—"}</dd></div><div><dt>Khấu trừ</dt><dd>{data.lines.length ? money(data.deductionTotal) : "—"}</dd></div><div><dt>Đã phát hành</dt><dd>{flow.sent} / {data.lines.length}</dd></div></dl></section>
    {data.syncIssue ? <div className={styles.notice} role="status"><span>{data.syncIssue}</span><Link href={`/timesheets/periods/${data.syncTimesheetPeriodId ?? data.timesheetPeriodId}`}>Bảng công</Link></div> : null}
    {(issues.length > 0 || flow.needsRecalculation) && !issued ? <div className={styles.notice} role="status"><div>{flow.needsRecalculation ? <StatusBadge tone="warning">Cần cập nhật số liệu</StatusBadge> : null}{issues.slice(0, 4).map((issue, index) => <Link href={issue.code === "salary" ? "/accounting/salaries" : `/timesheets/periods/${data.timesheetPeriodId ?? ""}`} key={`${issue.code}-${index}`}>{issue.employeeName ? `${issue.employeeName} · ` : ""}{issue.label}</Link>)}</div>{permissions.calculate && flow.inputReady && !approved ? <Button busy={busy} onClick={() => void act({ action: "calculate", payBasis: data.readiness?.payBasis ?? "actual" })}>Cập nhật số liệu</Button> : null}</div> : null}
    <DataSurface className={styles.lines}>
      <div className={styles.toolbar} data-ui="filter-controls"><SearchInput aria-label="Tìm nhân viên trong bảng lương" onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm nhân viên" value={search} /><span>{visible.length} nhân viên</span></div>
      <div className={styles.desktopLines}><DataTable actions={line => <DropdownMenu label={`Thao tác lương ${line.employeeName}`}><Link href={employeeHref(line)}>Chi tiết lương</Link>{editable ? <button onClick={() => openEdit(line)} type="button">Chỉnh sửa</button> : null}{permissions.publish && approved && line.deliveryStatus !== "delivered" ? <button onClick={() => setSending({ scope: "individual", employeeId: line.employeeId })} type="button">{line.payslipStatus === "published" ? "Gửi lại" : "Gửi phiếu lương"}</button> : null}{line.payslipId ? <Link href={`/accounting/payslips/${line.payslipId}`}>Xem phiếu lương</Link> : null}</DropdownMenu>} ariaLabel="Lương nhân viên" columns={columns} data={visible.slice((currentPage - 1) * 20, currentPage * 20)} emptyDescription="" emptyTitle="Chờ cập nhật từ bảng công đã chốt" getRowId={line => line.id} /></div>
      <div aria-label="Lương nhân viên" className={styles.mobileLines}>{visible.slice((currentPage - 1) * 20, currentPage * 20).map(line => <article className={styles.mobileLine} key={line.id}><Link className={styles.person} href={employeeHref(line)}><strong>{line.employeeName}</strong><small>{line.employeeCode}{permissions.publish && line.deliveryAccount?.username ? ` · @${line.deliveryAccount.username}` : ""}</small></Link><div className={styles.lineNet}><span>Thực nhận</span><strong>{money(line.netSalary)}</strong></div><div className={styles.lineMeta}><span>{line.workDays} ngày công</span><StatusBadge tone={line.deliveryStatus === "failed" ? "error" : line.payslipStatus === "published" ? "success" : "neutral"}>{receipt(line)}</StatusBadge></div><div className={styles.lineActions}><Link className="button button--secondary button--md" href={employeeHref(line)}>Chi tiết</Link>{editable ? <Button onClick={() => openEdit(line)}>Chỉnh sửa</Button> : null}{permissions.publish && approved && line.deliveryStatus !== "delivered" ? <Button onClick={() => setSending({ scope: "individual", employeeId: line.employeeId })}>{line.payslipStatus === "published" ? "Gửi lại" : "Gửi phiếu"}</Button> : null}</div></article>)}</div>
      {pages > 1 ? <Pagination onPageChange={setPage} page={currentPage} pageCount={pages} /> : null}
    </DataSurface>
    {error && !editing && !reopen ? <p className="form-error" role="alert">{error}</p> : null}
    <PayslipSendDrawer initialEmployeeId={sending?.employeeId} initialScope={sending?.scope} onClose={() => setSending(undefined)} onUpdated={(updated) => { ++request.current; setData(updated); setError(""); }} open={Boolean(sending)} payrollId={id} />
    <Drawer onClose={() => { if (!busy) setEditing(undefined); }} open={Boolean(editing)} title={editing ? `Chỉnh sửa lương · ${editing.employeeName}` : "Chỉnh sửa lương"}>{editing ? <form className={`drawer-form ${styles.editForm}`} key={editing.id} onSubmit={saveLine}>{error ? <p className="form-error" role="alert">{error}</p> : null}<Input defaultValue={editing.baseSalary} disabled={busy} label="Lương theo công" min="0" name="baseSalary" required type="number" /><Input defaultValue={editing.allowance} disabled={busy} label="Phụ cấp" min="0" name="allowance" required type="number" /><Input defaultValue={editing.bonus} disabled={busy} label="Thưởng" min="0" name="bonus" required type="number" /><Input defaultValue={editing.deduction} disabled={busy} label="Khấu trừ" min="0" name="deduction" required type="number" /><Input disabled={busy} label="Lý do điều chỉnh" minLength={3} name="reason" required /><div className="form-actions"><Button disabled={busy} onClick={() => setEditing(undefined)}>Hủy</Button><Button busy={busy} type="submit" variant="primary">Lưu thay đổi</Button></div></form> : null}</Drawer>
    <Drawer onClose={() => { if (!busy) setReopen(false); }} open={reopen} title="Mở lại bảng lương"><form className={`drawer-form ${styles.editForm}`} onSubmit={event => { event.preventDefault(); void act({ action: "reopen", reason: reason.trim() }).then(ok => { if (ok) { setReopen(false); setReason(""); } }); }}>{error ? <p className="form-error" role="alert">{error}</p> : null}{issued ? <StatusBadge tone="warning">Phiếu đã gửi sẽ được thu hồi</StatusBadge> : null}<Input disabled={busy} label="Lý do điều chỉnh" minLength={3} onChange={event => setReason(event.target.value)} required value={reason} /><div className="form-actions"><Button disabled={busy} onClick={() => setReopen(false)}>Hủy</Button><Button busy={busy} disabled={busy || reason.trim().length < 3} type="submit" variant="primary">Mở lại điều chỉnh</Button></div></form></Drawer>
  </DetailPageLayout>;
}


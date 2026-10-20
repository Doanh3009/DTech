"use client";

import Link from "next/link";
import { Bell, CheckCheck, CircleAlert, MessageCircle, RefreshCw, Send, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { SearchInput, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { payrollWorkflow } from "../payrollWorkflow";
import type { PayrollDetail, PayrollLine, PayrollStatus } from "../types";
import styles from "./PayslipSendDrawer.module.css";

export interface PayslipSendDrawerProps {
  payrollId: string;
  open: boolean;
  initialScope?: "individual" | "all";
  initialEmployeeId?: string;
  onClose: () => void;
  onUpdated: (payroll: PayrollDetail) => void;
}

type SendAction = "publish" | "publish_employee" | "retry_delivery";
interface SendPlan { action: SendAction; employeeId?: string; employeeIds: string[] }
interface SendReceipt { employeeIds: string[]; action: SendAction }
interface PayrollResponse { data?: PayrollDetail; error?: { message?: string } }

const money = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
const month = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
const periodLabels: Record<PayrollStatus, string> = { draft: "Chưa cập nhật lương", calculated: "Chờ duyệt lương", reviewed: "Chờ duyệt lương", locked: "Đã duyệt lương", published: "Đã phát hành phiếu" };
const hasAccount = (line: PayrollLine) => Boolean(line.deliveryAccount?.id && line.deliveryReady !== false);
const published = (line: PayrollLine) => line.payslipStatus === "published";

function deliveryPresentation(line: PayrollLine): { label: string; tone: StatusBadgeTone } {
  if (!published(line)) return hasAccount(line) ? { label: "Chưa gửi", tone: "neutral" } : { label: "Thiếu tài khoản", tone: "warning" };
  if (line.deliveryStatus === "failed") return { label: "Gửi thông báo lỗi", tone: "error" };
  if (line.deliveryStatus !== "delivered") return { label: line.deliveryStatus === "pending" ? "Chờ gửi thông báo" : "Chưa có biên nhận gửi", tone: "warning" };
  if (line.payslipConfirmedAt) return { label: "Đã xác nhận", tone: "success" };
  if (line.payslipViewedAt) return { label: "Đã xem", tone: "success" };
  return { label: "Đã gửi", tone: "success" };
}

function RecipientStatus({ line }: { line: PayrollLine }) {
  const state = deliveryPresentation(line);
  return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>;
}

function accountLabel(line: PayrollLine) {
  return hasAccount(line) ? line.deliveryAccount!.username ? `@${line.deliveryAccount!.username}` : line.deliveryAccount!.displayName : "Chưa có tài khoản hoạt động";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0]?.[0], parts.length > 1 ? parts.at(-1)?.[0] : ""].join("").toLocaleUpperCase("vi");
}

export function PayslipSendDrawer({ payrollId, open, initialScope = "individual", initialEmployeeId, onClose, onUpdated }: PayslipSendDrawerProps) {
  const [data, setData] = useState<PayrollDetail>();
  const [scope, setScope] = useState<"individual" | "all">(initialScope);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId ?? "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [receipt, setReceipt] = useState<SendReceipt>();
  const mutation = useRef(false);
  const request = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; loadController.current?.abort(); };
  }, []);

  const readLatest = useCallback(async (signal?: AbortSignal): Promise<PayrollDetail> => {
    const response = await fetch(`/api/v1/accounting/payroll/${payrollId}`, { cache: "no-store", signal: signal ?? AbortSignal.timeout(20_000) });
    const body = await response.json() as PayrollResponse;
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải người nhận phiếu lương.");
    return body.data;
  }, [payrollId]);

  useEffect(() => {
    if (!open) return;
    const counter = request, controller = new AbortController();
    loadController.current = controller;
    const key = ++request.current;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setData(undefined); setLoading(true); setError(""); setReceipt(undefined); setVerificationRequired(false);
      setScope(initialScope); setSelectedEmployeeId(initialEmployeeId ?? ""); setSearch(""); setPage(1);
      void readLatest(AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
        .then(updated => { if (!controller.signal.aborted && key === request.current) setData(updated); })
        .catch((caught: unknown) => { if (!controller.signal.aborted && key === request.current) setError(caught instanceof Error ? caught.message : "Không thể tải người nhận phiếu lương."); })
        .finally(() => { if (!controller.signal.aborted && key === request.current) setLoading(false); });
    });
    return () => { controller.abort(); ++counter.current; };
  }, [open, initialEmployeeId, initialScope, readLatest]);

  async function refresh() {
    if (mutation.current || loading) return;
    const key = ++request.current, controller = new AbortController();
    loadController.current?.abort(); loadController.current = controller;
    setLoading(true); setError("");
    try {
      const updated = await readLatest(AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]));
      if (!controller.signal.aborted && key === request.current) { setData(updated); setVerificationRequired(false); onUpdated(updated); }
    } catch (caught) {
      if (!controller.signal.aborted && key === request.current) setError(caught instanceof Error ? caught.message : "Không thể cập nhật tình trạng gửi.");
    } finally { if (!controller.signal.aborted && key === request.current) setLoading(false); }
  }

  const flow = data ? payrollWorkflow(data) : undefined;
  const fresh = data?.lines.filter(line => !published(line)) ?? [];
  const retry = data?.lines.filter(line => published(line) && line.deliveryStatus !== "delivered") ?? [];
  const delivered = data?.lines.filter(line => published(line) && line.deliveryStatus === "delivered") ?? [];
  const missing = fresh.filter(line => !hasAccount(line));
  const selected = data?.lines.find(line => line.employeeId === selectedEmployeeId);
  const canRetry = Boolean(data && ["locked", "published"].includes(data.status));
  const canPublish = Boolean(data?.status === "locked" && flow?.readyToReview);
  const plan: SendPlan | undefined = scope === "individual"
    ? selected ? published(selected)
      ? selected.deliveryStatus === "delivered" ? undefined : { action: "retry_delivery", employeeId: selected.employeeId, employeeIds: [selected.employeeId] }
      : { action: "publish_employee", employeeId: selected.employeeId, employeeIds: [selected.employeeId] }
      : undefined
    : fresh.length ? { action: "publish", employeeIds: fresh.map(line => line.employeeId) }
      : retry.length ? { action: "retry_delivery", employeeIds: retry.map(line => line.employeeId) } : undefined;
  const primaryAllowed = Boolean(plan && (plan.action === "retry_delivery" ? canRetry && (scope === "all" || selected && hasAccount(selected)) : canPublish && (scope === "all" ? !missing.length : selected && hasAccount(selected))));
  const query = search.trim().toLocaleLowerCase("vi");
  const visible = data?.lines.filter(line => `${line.employeeName} ${line.employeeCode} ${line.deliveryAccount?.username ?? ""}`.toLocaleLowerCase("vi").includes(query)) ?? [];
  const pages = Math.max(1, Math.ceil(visible.length / 20)), currentPage = Math.min(page, pages);
  const resultLines = receipt?.employeeIds.map(id => data?.lines.find(line => line.employeeId === id)).filter((line): line is PayrollLine => Boolean(line)) ?? [];
  const resultDelivered = resultLines.filter(line => published(line) && line.deliveryStatus === "delivered").length;
  const resultFailed = resultLines.filter(line => published(line) && line.deliveryStatus === "failed").length;
  const resultWaiting = resultLines.filter(line => published(line) && line.deliveryStatus !== "delivered" && line.deliveryStatus !== "failed").length;
  const resultNotPublished = (receipt?.employeeIds.length ?? 0) - resultDelivered - resultFailed - resultWaiting;
  const blocker = !data ? "" : !canRetry ? "Chưa duyệt lương" : plan?.action !== "retry_delivery" && fresh.length && !canPublish ? "Số liệu công hoặc lương cần cập nhật" : scope === "all" && missing.length ? `${missing.length} nhân viên chưa có tài khoản hoạt động` : scope === "individual" && selected && !hasAccount(selected) ? "Chưa có tài khoản hoạt động" : "";

  async function send(target: SendPlan) {
    if (!data || mutation.current || loading || verificationRequired) return;
    const latestFlow = payrollWorkflow(data);
    if (target.action === "retry_delivery") {
      if (!canRetry || !target.employeeIds.every(id => data.lines.some(line => line.employeeId === id && published(line) && line.deliveryStatus !== "delivered"))) return;
    } else if (data.status !== "locked" || !latestFlow.readyToReview || !target.employeeIds.length || !target.employeeIds.every(id => data.lines.some(line => line.employeeId === id && !published(line) && hasAccount(line)))) return;
    mutation.current = true; ++request.current; loadController.current?.abort(); setBusy(true); setError(""); setReceipt(undefined);
    try {
      const response = await fetch(`/api/v1/accounting/payroll/${payrollId}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ action: target.action, rowVersion: data.rowVersion, ...(target.employeeId ? { employeeId: target.employeeId } : {}) })
      });
      const body = await response.json() as PayrollResponse;
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể gửi phiếu lương.");
      if (mounted.current) { setData(body.data); setReceipt({ employeeIds: target.employeeIds, action: target.action }); setVerificationRequired(false); onUpdated(body.data); }
    } catch (caught) {
      if (mounted.current) {
        setError(caught instanceof Error && !["TimeoutError", "AbortError"].includes(caught.name) ? caught.message : "Chưa nhận được kết quả gửi. Cần cập nhật tình trạng.");
        setVerificationRequired(true);
      }
      try {
        const updated = await readLatest();
        if (mounted.current) { setData(updated); setVerificationRequired(false); onUpdated(updated); }
      } catch { /* Keep sending blocked until the current server state can be read. */ }
    } finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }

  function close() {
    if (mutation.current) return;
    loadController.current?.abort(); ++request.current;
    onClose();
  }
  const actionLabel = !plan ? scope === "individual" && selected && published(selected) && selected.deliveryStatus === "delivered" ? "Đã gửi phiếu lương" : scope === "all" && data?.lines.length ? "Đã gửi tất cả phiếu" : "Gửi phiếu lương" : plan.action === "retry_delivery" ? `Gửi lại ${plan.employeeIds.length} phiếu` : `Gửi ${plan.employeeIds.length} phiếu`;

  return <Drawer className={styles.drawer} onClose={close} open={open} title="Gửi phiếu lương">
    <div className={styles.content}>
      <div aria-busy={loading || busy} className={styles.body}>
        {!data && loading ? <LoadingState title="Đang tải người nhận phiếu lương" /> : null}
        {!data && error ? <div className={styles.loadError} role="alert"><CircleAlert aria-hidden="true" size={24} /><p>{error}</p><Button busy={loading} onClick={() => void refresh()}>Tải lại</Button></div> : null}
        {data ? <>
          <header className={styles.periodHeader}><div><span className={styles.eyebrow}>Bảng lương</span><h3>Tháng {month(data.periodMonth)}</h3></div><div className={styles.periodActions}><StatusBadge tone={canRetry ? "success" : "warning"}>{periodLabels[data.status]}</StatusBadge><Button aria-label="Cập nhật tình trạng gửi phiếu" busy={loading} disabled={busy} leftIcon={<RefreshCw aria-hidden="true" size={16} />} onClick={() => void refresh()} /></div></header>
          <dl aria-label="Tổng hợp gửi phiếu lương" className={styles.stats}><div><dt>Chưa gửi</dt><dd>{fresh.length + retry.length}</dd></div><div><dt>Đã gửi</dt><dd>{delivered.length}</dd></div><div data-attention={missing.length + retry.length > 0 || undefined}><dt>Cần xử lý</dt><dd>{missing.length + retry.length}</dd></div></dl>
          <div className={styles.selection}>
            <Select disabled={busy || loading} label="Người nhận" onChange={event => { setScope(event.target.value as "individual" | "all"); setPage(1); setSearch(""); }} options={[{ value: "individual", label: "Chọn tài khoản" }, { value: "all", label: "Tất cả nhân viên" }]} value={scope} />
            {scope === "individual" ? <Select disabled={busy || loading} label="Tài khoản nhận phiếu" onChange={event => setSelectedEmployeeId(data.lines.find(line => line.deliveryAccount?.id === event.target.value)?.employeeId ?? "")} options={data.lines.filter(hasAccount).map(line => ({ value: line.deliveryAccount!.id, label: `${line.employeeName} · ${accountLabel(line)} · ${line.employeeCode}` }))} placeholder="Chọn tài khoản" value={selected?.deliveryAccount?.id ?? ""} /> : null}
          </div>
          {scope === "individual" ? selected ? <section aria-label="Phiếu lương gửi đến tài khoản" className={styles.recipient}>
            <div className={styles.identity}><span aria-hidden="true" className={styles.avatar}>{initials(selected.employeeName)}</span><div><h4>{selected.employeeName}</h4><span>{selected.employeeCode}</span></div><RecipientStatus line={selected} /></div>
            <div className={styles.account}><UserRound aria-hidden="true" size={17} /><strong>{accountLabel(selected)}</strong>{hasAccount(selected) && selected.deliveryAccount!.displayName !== selected.employeeName ? <span>{selected.deliveryAccount!.displayName}</span> : null}</div>
            <div className={styles.amount}><span>Thực nhận</span><strong>{money(selected.netSalary)}</strong></div>
            {published(selected) ? <div className={styles.receiptMeta}><StatusBadge tone="info">Đã phát hành · v{selected.payslipVersion ?? 1}</StatusBadge>{selected.payslipId ? <Link href={`/accounting/payslips/${selected.payslipId}`}>Xem phiếu lương</Link> : null}</div> : null}
            {selected.deliveryError ? <p className={styles.deliveryError}>{selected.deliveryError}</p> : null}
          </section> : <div className={styles.emptySelection}><UserRound aria-hidden="true" size={24} /><span>{data.lines.some(hasAccount) ? "Chưa chọn tài khoản nhận phiếu" : "Chưa có tài khoản hoạt động"}</span></div> : <section aria-label="Danh sách tài khoản nhận phiếu" className={styles.recipientList}>
            <div className={styles.listHeading}><h3><UsersRound aria-hidden="true" size={17} />Tài khoản nhận phiếu</h3><span>{data.lines.length} nhân viên</span></div>
            {data.lines.length > 20 ? <SearchInput aria-label="Tìm tài khoản nhận phiếu" disabled={busy} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tên, mã nhân viên, tài khoản" value={search} /> : null}
            <ul>{visible.slice((currentPage - 1) * 20, currentPage * 20).map(line => <li key={line.id}><div className={styles.listIdentity}><strong>{line.employeeName}</strong><span>{line.employeeCode}</span><span className={!hasAccount(line) ? styles.missingAccount : styles.accountName}>{accountLabel(line)}</span></div><div className={styles.listAmount}><strong>{money(line.netSalary)}</strong><RecipientStatus line={line} /></div></li>)}</ul>
            {!visible.length ? <div className={styles.emptySelection}>Không có nhân viên phù hợp</div> : null}
            {pages > 1 ? <Pagination onPageChange={nextPage => { if (!busy) setPage(nextPage); }} page={currentPage} pageCount={pages} /> : null}
          </section>}
          <section aria-label="Kênh nhận phiếu lương" className={styles.channels}><h3>Kênh nhận</h3><div><span><Bell aria-hidden="true" size={16} />Thông báo</span><span><MessageCircle aria-hidden="true" size={16} />Tin nhắn nội bộ</span></div></section>
          {scope === "all" && fresh.length > 0 && retry.length > 0 ? <div className={styles.retryNotice}><span><CircleAlert aria-hidden="true" size={17} />{retry.length} phiếu đã phát hành chưa gửi đủ thông báo</span><Button busy={busy} disabled={!canRetry || loading || verificationRequired} onClick={() => void send({ action: "retry_delivery", employeeIds: retry.map(line => line.employeeId) })}>Gửi lại {retry.length} thông báo</Button></div> : null}
          {blocker ? <div className={styles.blocker} role="status"><CircleAlert aria-hidden="true" size={17} /><span>{blocker}</span></div> : null}
          {receipt ? <section aria-atomic="true" className={styles.result} data-complete={resultDelivered === receipt.employeeIds.length || undefined} role="status"><h3><CheckCheck aria-hidden="true" size={19} />Kết quả gửi phiếu</h3><div><StatusBadge tone="success">Đã gửi {resultDelivered}/{receipt.employeeIds.length}</StatusBadge>{resultWaiting ? <StatusBadge tone="warning">Chờ gửi thông báo {resultWaiting}</StatusBadge> : null}{resultFailed ? <StatusBadge tone="error">Gửi thông báo lỗi {resultFailed}</StatusBadge> : null}{resultNotPublished ? <StatusBadge tone="warning">Chưa phát hành {resultNotPublished}</StatusBadge> : null}</div></section> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {verificationRequired ? <div className={styles.blocker} role="status"><CircleAlert aria-hidden="true" size={17} /><span>Cần cập nhật tình trạng trước khi gửi tiếp</span></div> : null}
        </> : null}
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerSummary}><span>{scope === "individual" ? "Tài khoản nhận" : plan?.action === "retry_delivery" ? "Phiếu cần gửi lại thông báo" : "Phiếu chưa gửi"}</span><strong>{scope === "individual" ? selected ? accountLabel(selected) : "Chưa chọn" : `${plan?.employeeIds.length ?? 0} phiếu`}</strong></div>
        <div className={styles.footerActions} data-ui="actions"><Button disabled={busy} onClick={close}>Đóng</Button><Button busy={busy} disabled={!primaryAllowed || loading || verificationRequired} leftIcon={<Send aria-hidden="true" size={17} />} onClick={() => { if (plan) void send(plan); }} variant="primary">{actionLabel}</Button></div>
      </footer>
    </div>
  </Drawer>;
}

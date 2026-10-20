"use client";

import { CheckCircle2, ChevronDown, Download, FileCheck2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { FileDownloadLink } from "@/components/shared/FileDownloadLink";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/time/timezone";
import { formatPayslipPeriod, payslipGross, payslipNumber } from "../payslipPresentation";
import type { Payslip } from "../types";
import styles from "./PayslipDetail.module.css";

const numeric = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const money = (value: unknown) => {
  const amount = payslipNumber(value);
  return amount === undefined ? "—" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
};
const count = (value: unknown) => { const parsed = payslipNumber(value); return parsed === undefined ? "—" : numeric.format(parsed); };
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function PayslipDetail({ id, selfOnly = false }: { id: string; selfOnly?: boolean }) {
  const selfScope = selfOnly;
  const [item, setItem] = useState<Payslip>();
  const [loadedKey, setLoadedKey] = useState("");
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const mutationRef = useRef(false);
  const currentKeyRef = useRef("");
  const requestKey = `${id}:${selfScope}`;
  useLayoutEffect(() => { currentKeyRef.current = requestKey; }, [requestKey]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    void fetch(`/api/v1/accounting/payslips/${id}${selfScope ? "?scope=self" : ""}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải phiếu lương.");
      if (!cancelled) { setItem(body.data); setLoadedKey(requestKey); setFailure(undefined); setConfirmError(""); }
    }).catch((reason) => { if (!cancelled) setFailure({ key: requestKey, message: controller.signal.aborted ? "Tải phiếu lương quá lâu. Vui lòng mở lại." : reason.message }); }).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [id, selfScope, requestKey]);

  if (failure?.key === requestKey) return <ErrorState action={null} description={failure.message} />;
  if (!item || loadedKey !== requestKey) return <LoadingState />;

  async function confirm() {
    if (!item || mutationRef.current || !selfScope || item.status !== "published" || item.confirmedAt) return;
    const mutationKey = requestKey;
    mutationRef.current = true;
    setConfirming(true);
    setConfirmError("");
    try {
      const response = await fetch(`/api/v1/accounting/payslips/${item.id}/confirm`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: item.version }), signal: AbortSignal.timeout(15_000)
      });
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể xác nhận phiếu lương.");
      if (currentKeyRef.current === mutationKey) setItem(body.data);
    } catch (reason) {
      if (currentKeyRef.current === mutationKey) setConfirmError(reason instanceof Error && reason.name === "TimeoutError" ? "Chưa nhận được phản hồi. Bạn có thể mở lại phiếu để kiểm tra xác nhận." : reason instanceof Error ? reason.message : "Không thể xác nhận phiếu lương.");
    } finally { mutationRef.current = false; setConfirming(false); }
  }

  const snapshot = item.snapshot;
  const calculation = asRecord(snapshot.calculation_snapshot ?? snapshot.calculation);
  const rawCashout = snapshot.leaveCashout ?? calculation.leaveCashout;
  const cashout = (Array.isArray(rawCashout) ? rawCashout : []).filter((entry) => entry && typeof entry === "object") as Record<string, unknown>[];
  const gross = payslipGross(snapshot);
  const hasBasis = Object.keys(calculation).length > 0;
  const basis: { label: string; value: string }[] = [
    ...(calculation.contractSalary != null ? [{ label: "Lương thỏa thuận", value: money(calculation.contractSalary) }] : []),
    ...(typeof calculation.effectiveDate === "string" ? [{ label: "Hiệu lực lương", value: formatBusinessDate(calculation.effectiveDate) }] : []),
    ...(calculation.scheduledWorkdays != null ? [{ label: "Công chuẩn", value: `${count(calculation.scheduledWorkdays)} ngày` }] : []),
    ...(snapshot.workDays != null ? [{ label: "Công thực tế", value: `${count(snapshot.workDays)} ngày` }] : []),
    ...(calculation.paidLeaveDays != null ? [{ label: "Phép hưởng lương", value: `${count(calculation.paidLeaveDays)} ngày` }] : []),
    ...(calculation.businessTripPayDays != null ? [{ label: "Công tác hưởng lương", value: `${count(calculation.businessTripPayDays)} ngày` }] : []),
    ...(calculation.payableWorkdays != null ? [{ label: "Công tính lương", value: `${count(calculation.payableWorkdays)} ngày` }] : []),
    ...(payslipNumber(calculation.ratio) !== undefined ? [{ label: "Tỷ lệ công", value: `${count(Number(calculation.ratio) * 100)}%` }] : []),
    ...(calculation.payBasis === "actual" || calculation.payBasis === "paid_time" ? [{ label: "Căn cứ", value: calculation.payBasis === "paid_time" ? "Công, phép và công tác hưởng lương" : "Công thực tế" }] : [])
  ];

  return <div className={styles.layout}>
    <header className={styles.identity}>
      <div><span className={styles.eyebrow}>Tháng {formatPayslipPeriod(item.periodMonth)}</span><h2>{item.employeeName}</h2><span className={styles.code}>{item.employeeCode}</span></div>
      <div className={styles.badges}><span className={styles.version}>Phiên bản {item.version}</span><StatusBadge status={item.status} /></div>
    </header>
    {item.status === "revoked" ? <section className={styles.revoked} aria-label="Thông tin thu hồi"><strong>Phiếu lương đã thu hồi</strong>{item.revokedAt ? <time dateTime={item.revokedAt}>{formatBusinessDateTime(item.revokedAt)}</time> : null}{item.revokeReason ? <p>{item.revokeReason}</p> : null}</section> : null}
    <section className={styles.netPanel} aria-label="Thực nhận">
      <div className={styles.netAmount}><span>Thực nhận</span><strong>{money(snapshot.netSalary)}</strong><span className={styles.netPeriod}>Tháng {formatPayslipPeriod(item.periodMonth)}</span></div>
      <dl className={styles.totals}><div><dt>Tổng thu nhập</dt><dd>{money(gross)}</dd></div><div><dt>Khấu trừ</dt><dd>{money(snapshot.deduction)}</dd></div></dl>
    </section>
    {selfScope ? <div className={styles.quickActions}>
      {item.status === "published" && !item.confirmedAt ? <Button busy={confirming} leftIcon={<CheckCircle2 aria-hidden="true" size={18} />} onClick={() => void confirm()} variant="primary">Xác nhận phiếu lương</Button> : null}
      {item.confirmedAt ? <StatusBadge tone="success">Đã xác nhận</StatusBadge> : null}
      <FileDownloadLink format="pdf" className="button button--secondary button--md" href={`/api/v1/accounting/payslips/${item.id}/download`}><Download aria-hidden="true" size={16} /><span>Tải PDF</span></FileDownloadLink>
      {confirmError ? <p className="form-error" role="alert">{confirmError}</p> : null}
    </div> : null}
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="payslip-income-heading">
        <header className={styles.sectionHeader}><h3 id="payslip-income-heading">Thu nhập và khấu trừ</h3>{snapshot.workDays != null ? <span>{count(snapshot.workDays)} ngày công</span> : null}</header>
        <dl className={styles.amounts}>
          <div><dt>Lương theo công</dt><dd>{money(snapshot.baseSalary)}</dd></div>
          <div><dt>Phụ cấp</dt><dd>{money(snapshot.allowance)}</dd></div>
          <div><dt>Thưởng</dt><dd>{money(snapshot.bonus)}</dd></div>
          {Number(snapshot.leaveCashoutAmount ?? 0) > 0 ? <div><dt>Thanh toán phép dư</dt><dd>{money(snapshot.leaveCashoutAmount)}</dd></div> : null}
          <div className={styles.subtotal}><dt>Tổng thu nhập</dt><dd>{money(gross)}</dd></div>
          <div className={styles.deduction}><dt>Khấu trừ</dt><dd>{payslipNumber(snapshot.deduction) ? `− ${money(snapshot.deduction)}` : money(snapshot.deduction)}</dd></div>
          <div className={styles.netRow}><dt>Thực nhận</dt><dd>{money(snapshot.netSalary)}</dd></div>
        </dl>
        {cashout.length > 0 ? <details className={styles.disclosure}><summary><span>Thanh toán phép cuối năm</span><ChevronDown aria-hidden="true" size={18} /></summary><dl className={styles.cashout}>{cashout.map((entry, index) => <div key={index}><dt>{String(entry.leaveTypeName ?? "Phép năm")} · {String(entry.year ?? "—")}</dt><dd><span>{count(entry.days)} ngày × {money(entry.dailyRate)}</span><strong>{money(payslipNumber(entry.amount) ?? (payslipNumber(entry.days) !== undefined && payslipNumber(entry.dailyRate) !== undefined ? Math.round(Number(entry.days) * Number(entry.dailyRate)) : undefined))}</strong></dd></div>)}</dl></details> : null}
        {hasBasis && basis.length > 0 ? <details className={styles.disclosure}><summary><span>Căn cứ tính lương</span><ChevronDown aria-hidden="true" size={18} /></summary><dl className={styles.basis}>{basis.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl></details> : null}
        {typeof calculation.lastAdjustment === "string" ? <details className={styles.disclosure}><summary><span>Điều chỉnh gần nhất</span><ChevronDown aria-hidden="true" size={18} /></summary><p className={styles.adjustment}>{calculation.lastAdjustment}</p></details> : null}
      </section>
      <section className={styles.panel} aria-labelledby="payslip-receipt-heading">
        <header className={styles.sectionHeader}><h3 id="payslip-receipt-heading">Tiếp nhận phiếu lương</h3><FileCheck2 aria-hidden="true" size={20} /></header>
        <ol className={styles.receipt}>
          <li data-complete={Boolean(item.publishedAt)}><span className={styles.receiptDot} aria-hidden="true" /><div><strong>Phát hành</strong>{item.publishedAt ? <time dateTime={item.publishedAt}>{formatBusinessDateTime(item.publishedAt)}</time> : <span>Chưa phát hành</span>}</div></li>
          <li data-complete={Boolean(item.viewedAt)}><span className={styles.receiptDot} aria-hidden="true" /><div><strong>{item.viewedAt ? "Đã xem" : "Chưa xem"}</strong>{item.viewedAt ? <time dateTime={item.viewedAt}>{formatBusinessDateTime(item.viewedAt)}</time> : null}</div></li>
          <li data-complete={Boolean(item.confirmedAt)}><span className={styles.receiptDot} aria-hidden="true" /><div><strong>{item.confirmedAt ? "Đã xác nhận" : item.status === "published" ? "Chờ xác nhận" : "Chưa xác nhận"}</strong>{item.confirmedAt ? <time dateTime={item.confirmedAt}>{formatBusinessDateTime(item.confirmedAt)}</time> : null}</div></li>
        </ol>
        {!selfScope ? <div className={styles.actions}>
          <FileDownloadLink format="pdf" className="button button--secondary button--md" href={`/api/v1/accounting/payslips/${item.id}/download`}><Download aria-hidden="true" size={16} /><span>Tải PDF</span></FileDownloadLink>
        </div> : null}
      </section>
    </div>
  </div>;
}

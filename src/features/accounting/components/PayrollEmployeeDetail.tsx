"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { BackLink } from "@/components/shared/BackLink";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DetailPageLayout } from "@/components/shared/PageLayouts";
import type { PayrollLine, PayrollStatus } from "../types";
import { formatBusinessDate } from "@/lib/time/timezone";
import { PayslipSendDrawer } from "./PayslipSendDrawer";
import styles from "./PayrollEmployeeDetail.module.css";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const payrollStatusLabel: Record<PayrollStatus, string> = { draft: "Chờ cập nhật lương", calculated: "Chờ duyệt lương", reviewed: "Chờ duyệt lương", locked: "Đã duyệt lương", published: "Đã phát hành phiếu lương" };
const value = (snapshot: Record<string, unknown> | undefined, key: string) => snapshot?.[key] == null ? "—" : String(snapshot[key]);

export function PayrollEmployeeDetail({ payrollId, payrollMonth, payrollStatus, rowVersion, line, timesheetPeriodId, canPublish, canEdit }: {
  payrollId: string; payrollMonth: string; payrollStatus: PayrollStatus; rowVersion: number; line: PayrollLine; timesheetPeriodId?: string; canPublish: boolean; canEdit: boolean;
}) {
  const [current, setCurrent] = useState(line);
  const [periodState, setPeriodState] = useState(payrollStatus);
  const [version, setVersion] = useState(rowVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const mutationRef = useRef(false);
  const calculation = current.calculation ?? {};
  const sent = current.payslipStatus === "published";
  async function updateLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationRef.current) return;
    mutationRef.current = true;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/accounting/payroll/${payrollId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ action: "update_line", lineId: current.id, lineRowVersion: current.rowVersion, rowVersion: version, baseSalary: Number(form.get("baseSalary")), allowance: Number(form.get("allowance")), bonus: Number(form.get("bonus")), deduction: Number(form.get("deduction")), reason: String(form.get("reason") ?? "") })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể cập nhật dòng lương.");
      const updated = body.data.lines.find((item: PayrollLine) => item.employeeId === current.employeeId);
      if (updated) setCurrent(updated);
      setPeriodState(body.data.status);
      setVersion(body.data.rowVersion);
      setEditOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật dòng lương.");
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  return <DetailPageLayout className={styles.layout}>
    <BackLink href={`/accounting/payroll/${payrollId}`} label="Chi tiết bảng lương" />
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Kỳ {payrollMonth.slice(0, 7)}</span><h1>{current.employeeName}</h1><span className={styles.employeeCode}>{current.employeeCode}{canPublish && current.deliveryAccount?.username ? ` · @${current.deliveryAccount.username}` : ""}</span></div>
      <div className={styles.headerActions} data-ui="actions">
        <StatusBadge status={periodState}>{payrollStatusLabel[periodState]}</StatusBadge>
        {canEdit && ["calculated", "reviewed"].includes(periodState) ? <Button onClick={() => setEditOpen(true)}>Điều chỉnh lương</Button> : null}
        {canPublish && periodState === "locked" && !sent ? <Button disabled={busy} onClick={() => setSendOpen(true)} variant="primary" busy={busy}>Gửi phiếu lương</Button> : null}
        {sent ? <StatusBadge tone="success">Đã phát hành · v{current.payslipVersion}</StatusBadge> : null}
        {sent && current.payslipId ? <Link className="button button--secondary button--md" href={`/accounting/payslips/${current.payslipId}`}>Xem phiếu lương</Link> : null}
      </div>
    </header>
    {error && !editOpen ? <p className="form-error" role="alert">{error}</p> : null}
    {canPublish && !sent && current.deliveryReady === false ? <StatusBadge tone="warning">Chưa có tài khoản nhận phiếu</StatusBadge> : null}
    {sent ? <section className={styles.delivery} aria-label="Gửi thông báo phiếu lương"><StatusBadge tone={current.deliveryStatus === "delivered" ? "success" : current.deliveryStatus === "failed" ? "error" : "warning"}>{current.deliveryStatus === "delivered" ? "Đã gửi thông báo" : current.deliveryStatus === "failed" ? "Gửi thông báo lỗi" : current.deliveryStatus === "pending" ? "Chờ gửi thông báo" : "Chưa có biên nhận"}</StatusBadge><StatusBadge tone={current.payslipConfirmedAt ? "success" : current.payslipViewedAt ? "info" : "neutral"}>{current.payslipConfirmedAt ? "Đã xác nhận" : current.payslipViewedAt ? "Đã xem" : "Chưa xem"}</StatusBadge>{canPublish && current.deliveryStatus !== "delivered" ? <Button busy={busy} onClick={() => setSendOpen(true)}>Gửi lại</Button> : null}</section> : null}
    <section className={styles.total} aria-label="Thực nhận">
      <span>Thực nhận</span><strong>{money(current.netSalary)}</strong>
      {timesheetPeriodId ? <Link href={`/timesheets/periods/${timesheetPeriodId}`}>Kỳ công</Link> : null}
    </section>
    <div className={styles.grid}>
      <section className={styles.panel}>
        <h2>Thu nhập và khấu trừ</h2>
        <dl className={styles.amounts}>
          <div><dt>Lương theo công</dt><dd>{money(current.baseSalary)}</dd></div>
          <div><dt>Phụ cấp</dt><dd>{money(current.allowance)}</dd></div>
          <div><dt>Thưởng</dt><dd>{money(current.bonus)}</dd></div>
          {(current.leaveCashoutAmount ?? 0) > 0 ? <div><dt>Thanh toán phép dư</dt><dd>{money(current.leaveCashoutAmount ?? 0)}</dd></div> : null}
          <div><dt>Khấu trừ</dt><dd>− {money(current.deduction)}</dd></div>
          <div className={styles.netRow}><dt>Thực nhận</dt><dd>{money(current.netSalary)}</dd></div>
        </dl>
      </section>
      <section className={styles.panel}>
        <h2>Căn cứ tính</h2>
        <dl className={styles.basis}>
          <div><dt>Lương thỏa thuận</dt><dd>{typeof calculation.contractSalary === "number" ? money(calculation.contractSalary) : "—"}</dd></div>
          <div><dt>Ngày hiệu lực</dt><dd>{typeof calculation.effectiveDate === "string" ? formatBusinessDate(calculation.effectiveDate) : "—"}</dd></div>
          <div><dt>Ngày công chuẩn</dt><dd>{value(calculation, "scheduledWorkdays")}</dd></div>
          <div><dt>Ngày công thực tế</dt><dd>{current.workDays}</dd></div>
          <div><dt>Phép hưởng lương</dt><dd>{value(calculation, "paidLeaveDays")}</dd></div>
          <div><dt>Công tác hưởng lương</dt><dd>{value(calculation, "businessTripPayDays")}</dd></div>
          <div><dt>Công tính lương</dt><dd>{value(calculation, "payableWorkdays")}</dd></div>
          <div><dt>Tỷ lệ công</dt><dd>{typeof calculation.ratio === "number" ? `${(calculation.ratio * 100).toFixed(2)}%` : "—"}</dd></div>
          <div><dt>Phương thức</dt><dd>{calculation.payBasis === "paid_time" ? "Công thực tế, phép và công tác" : calculation.payBasis === "actual" ? "Công thực tế" : "—"}</dd></div>
        </dl>
      </section>
    </div>
    {Array.isArray(calculation.leaveCashout) && calculation.leaveCashout.length ? <section className={styles.panel}><h2>Thanh toán phép cuối năm</h2><dl className={styles.basis}>{calculation.leaveCashout.map((entry: Record<string, unknown>, index: number) => <div key={index}><dt>{String(entry.leaveTypeName ?? "Phép năm")} · {String(entry.year)} · {String(entry.days)} ngày</dt><dd>{money(Number(entry.dailyRate))} / ngày · {money(Math.round(Number(entry.days) * Number(entry.dailyRate)))}</dd></div>)}</dl></section> : null}
    {typeof calculation.lastAdjustment === "string" ? <section className={styles.panel}><h2>Điều chỉnh gần nhất</h2><p>{calculation.lastAdjustment}</p></section> : null}
    <PayslipSendDrawer initialEmployeeId={current.employeeId} initialScope="individual" onClose={() => setSendOpen(false)} onUpdated={(updated) => { const latest = updated.lines.find((item) => item.employeeId === current.employeeId); if (latest) setCurrent(latest); setPeriodState(updated.status); setVersion(updated.rowVersion); setError(""); }} open={sendOpen} payrollId={payrollId} />
    <Drawer onClose={() => { if (!busy) setEditOpen(false); }} open={editOpen} title={`Điều chỉnh lương · ${current.employeeName}`}>
      <form className={`drawer-form ${styles.editForm}`} onSubmit={updateLine}>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <Input defaultValue={current.baseSalary} label="Lương theo công" min="0" name="baseSalary" required type="number" />
        <Input defaultValue={current.allowance} label="Phụ cấp" min="0" name="allowance" required type="number" />
        <Input defaultValue={current.bonus} label="Thưởng" min="0" name="bonus" required type="number" />
        <Input defaultValue={current.deduction} label="Khấu trừ" min="0" name="deduction" required type="number" />
        <Input label="Lý do điều chỉnh" minLength={3} name="reason" required />
        <div className="form-actions"><Button disabled={busy} onClick={() => setEditOpen(false)} type="button">Hủy</Button><Button disabled={busy} type="submit" variant="primary" busy={busy}>Lưu điều chỉnh</Button></div>
      </form>
    </Drawer>
  </DetailPageLayout>;
}

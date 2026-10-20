"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, StatCard } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/shared/States";
import styles from "./AccountingOverview.module.css";

type Summary = {
  salaryProfiles: number;
  openPayrolls: number;
  lockedPayrolls: number;
  publishedPayslips: number;
  viewedPayslips: number;
  unseenPayslips: number;
  revokedPayslips: number;
  recentPayrolls: Array<{ id: string; periodMonth: string; status: string; netTotal: number }>;
};
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const payrollLabels: Record<string, string> = { draft: "Chờ cập nhật lương", calculated: "Chờ duyệt lương", reviewed: "Chờ duyệt lương", locked: "Đã duyệt lương", published: "Đã duyệt phiếu lương" };

export function AccountingOverview() {
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/v1/accounting/summary", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setData(body.data);
    }).catch((reason) => setError(reason.message));
  }, []);
  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!data) return <LoadingState title="Đang tải tổng quan lương" />;
  const latest = data?.recentPayrolls[0];
  const slipTotal = Math.max(data?.publishedPayslips ?? 0, 1);
  return (
    <div className="page-stack">
      <div className="content-grid dashboard-kpi-grid">
        <StatCard label="Kỳ lương gần nhất" value={latest?.periodMonth.slice(0, 7) ?? "—"} />
        <StatCard label="Kỳ đang xử lý" value={String(data?.openPayrolls ?? 0)} />
        <StatCard label="Phiếu đã phát hành" value={String(data?.publishedPayslips ?? 0)} />
        <StatCard label="Phiếu chưa xem" value={String(data?.unseenPayslips ?? 0)} />
      </div>
      {data && data.publishedPayslips > 0 ? <Card className="accounting-slip-chart"><h2>Trạng thái phiếu lương</h2><div className="accounting-slip-chart__rows"><div><span>Đã xem</span><b><i style={{ width: `${data.viewedPayslips / slipTotal * 100}%` }} /></b><strong>{data.viewedPayslips}</strong></div><div><span>Chưa xem</span><b><i style={{ width: `${data.unseenPayslips / slipTotal * 100}%` }} /></b><strong>{data.unseenPayslips}</strong></div></div></Card> : null}
      <Card>
        <div className="panel-header"><h2>Kỳ lương gần đây</h2>{data?.recentPayrolls.length ? <Link className="button button--secondary button--sm" href="/accounting/payroll">Xem bảng lương</Link> : null}</div>
        {data?.recentPayrolls.length ? <div className={`compact-list ${styles.recent}`}>
          {data.recentPayrolls.map((item) => <Link href={`/accounting/payroll/${item.id}`} key={item.id}><strong>{item.periodMonth.slice(0, 7)}</strong><StatusBadge status={item.status}>{payrollLabels[item.status] ?? item.status}</StatusBadge><span className={styles.amount}>{money(item.netTotal)}</span></Link>)}
        </div> : <p>Chưa có kỳ lương.</p>}
      </Card>
    </div>
  );
}

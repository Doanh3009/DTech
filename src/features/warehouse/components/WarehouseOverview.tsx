"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, Boxes, ChevronDown, ClipboardCheck, Clock3, PackageOpen, Repeat2, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useWarehouseResource } from "../client/useWarehouseResource";
import type { WarehouseDashboard } from "../types/warehouseTypes";
import styles from "./WarehouseUi.module.css";

const paths = { receipt: "receipts", issue: "issues", transfer: "transfers", adjustment: "adjustments", reversal: "ledger" };
const labels = { receipt: "Nhập kho", issue: "Xuất kho", transfer: "Chuyển kho", adjustment: "Điều chỉnh", reversal: "Đảo chứng từ" };
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const actionConfig = {
  receipt: { label: "Nhập kho", href: "/warehouse/receipts/new", Icon: ArrowDownToLine },
  issue: { label: "Xuất kho", href: "/warehouse/issues/new", Icon: ArrowUpFromLine },
  transfer: { label: "Chuyển kho", href: "/warehouse/transfers/new", Icon: Repeat2 }
};

export function WarehouseOverview({ actions }: { actions: Array<"receipt" | "issue" | "transfer" | "count"> }) {
  const result = useWarehouseResource<WarehouseDashboard>("/api/v1/warehouse/dashboard");
  const data = result.data;
  if (!data) return result.error
    ? <div className={styles.formCard}><p className="form-error" role="alert">{result.error}</p><Button onClick={() => void result.reload()}>Tải lại</Button></div>
    : <LoadingState title="Đang mở kho vật tư" />;

  const primaryActions = actions.filter((action): action is keyof typeof actionConfig => action !== "count");
  const openCounts = data.pendingStockCounts ?? [];

  return (
    <div className="page-stack">
      {primaryActions.length ? <div className={styles.actionLinks}>{primaryActions.map(action => {
        const item = actionConfig[action];
        return <Link className="button button--secondary button--md" href={item.href} key={action}><item.Icon aria-hidden="true" size={18} />{item.label}</Link>;
      })}</div> : null}

      <div className={styles.summaryGrid}>
        <Link className={styles.summaryCard} href="/warehouse/warehouses"><span>Kho hàng <WarehouseIcon aria-hidden="true" size={18} /></span><strong>{data.warehouseCount}</strong></Link>
        <a className={styles.summaryCard} href="#warehouse-pending"><span>Chờ ghi sổ <Clock3 aria-hidden="true" size={18} /></span><strong>{data.pendingDocuments}</strong></a>
        <Link className={styles.summaryCard} data-tone="warning" href="/warehouse/inventory?status=low_stock"><span>Sắp hết <Boxes aria-hidden="true" size={18} /></span><strong>{data.lowStock}</strong></Link>
        <Link className={styles.summaryCard} data-tone="danger" href="/warehouse/inventory?status=out_of_stock"><span>Hết hàng <PackageOpen aria-hidden="true" size={18} /></span><strong>{data.outOfStock}</strong></Link>
      </div>

      <div className={styles.overviewGrid}>
        <section className={styles.panel} id="warehouse-pending">
          <header className={styles.panelHeading}><h2>Chứng từ chờ ghi sổ</h2><span>{data.pendingDocuments} phiếu</span></header>
          <div className={styles.recordList}>
            {(data.pendingDocumentItems ?? []).map(row => <Link className={styles.recordRow} href={`/warehouse/${paths[row.type]}/${row.id}`} key={row.id}><span><strong>{row.documentNumber}</strong><small>{labels[row.type]} · {row.sourceWarehouseName ?? row.targetWarehouseName} · {row.lineCount} mặt hàng</small></span><StatusBadge tone="warning">{row.status === "submitted" ? "Đã gửi" : "Nháp"}</StatusBadge></Link>)}
            {!data.pendingDocuments ? <div className={styles.blankState}><ClipboardCheck aria-hidden="true" size={24} /><strong>Đã xử lý hết chứng từ</strong></div> : null}
          </div>
        </section>
        <section className={styles.panel}>
          <header className={styles.panelHeading}><h2>Vật tư cần bổ sung</h2><Link className="text-link" href="/warehouse/inventory?status=low_stock">Xem tồn kho <ArrowUpRight aria-hidden="true" size={15} /></Link></header>
          <div className={styles.recordList}>
            {data.lowStockItems.map(row => <Link className={styles.recordRow} href={`/warehouse/inventory?warehouseId=${row.warehouseId}&itemId=${row.itemId}`} key={`${row.warehouseId}:${row.itemId}`}><span><strong>{row.itemName}</strong><small>{row.itemCode} · {row.warehouseName}</small></span><StatusBadge tone={row.status === "out_of_stock" ? "error" : "warning"}>{number.format(row.onHand)} {row.uomCode}</StatusBadge></Link>)}
            {!data.lowStockItems.length ? <div className={styles.blankState}><Boxes aria-hidden="true" size={24} /><strong>Không có cảnh báo tồn kho</strong></div> : null}
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <header className={styles.panelHeading}><h2>Giao dịch gần đây</h2></header>
        <div className={styles.recordList}>
          {data.recentDocuments.map(row => <Link className={styles.recordRow} href={`/warehouse/${paths[row.type]}/${row.id}`} key={row.id}><span><strong>{row.documentNumber}</strong><small>{labels[row.type]} · {row.documentDate.split("-").reverse().join("/")} · {row.targetWarehouseName ?? row.sourceWarehouseName}</small></span><StatusBadge tone={row.status === "posted" ? "success" : "neutral"}>{row.status === "posted" ? "Đã ghi sổ" : row.status === "draft" ? "Nháp" : row.status === "cancelled" ? "Đã hủy" : row.status === "reversed" ? "Đã đảo" : "Đã gửi"}</StatusBadge></Link>)}
          {!data.recentDocuments.length ? <div className={styles.blankState}><Clock3 aria-hidden="true" size={24} /><strong>Chưa có giao dịch kho</strong></div> : null}
        </div>
      </section>

      {actions.includes("count") || openCounts.length ? <details className={styles.secondaryTools}>
        <summary><ClipboardCheck aria-hidden="true" size={18} /><span>Kiểm kê</span>{openCounts.length ? <StatusBadge tone="warning">{openCounts.length} đang mở</StatusBadge> : null}<ChevronDown aria-hidden="true" size={18} /></summary>
        <div className={styles.secondaryToolsBody}>
          <div className={styles.actionLinks}>
            <Link className="button button--secondary button--md" href="/warehouse/stock-counts">Danh sách kiểm kê</Link>
            {actions.includes("count") ? <Link className="button button--secondary button--md" href="/warehouse/stock-counts/new">Tạo kiểm kê</Link> : null}
          </div>
          {openCounts.length ? <div className={styles.recordList}>{openCounts.slice(0, 6).map(row => <Link className={styles.recordRow} href={`/warehouse/stock-counts/${row.id}`} key={row.id}><span><strong>{row.countNumber}</strong><small>{row.warehouseName} · {row.transactionPolicy === "freeze" ? "Đang khóa giao dịch" : "Đối chiếu phát sinh"}</small></span><StatusBadge tone="warning">{row.status === "reviewed" ? "Chờ ghi sổ" : "Đang kiểm"}</StatusBadge></Link>)}</div> : null}
        </div>
      </details> : null}
    </div>
  );
}

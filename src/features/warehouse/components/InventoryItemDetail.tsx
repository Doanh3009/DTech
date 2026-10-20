"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BackLink } from "@/components/shared/BackLink";
import { Card, StatCard } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ItemImagePreview } from "@/features/warehouse/components/ItemImagePreview";
import type { InventoryBalance, InventoryItem, StockLedgerEntry } from "@/features/warehouse/types/warehouseTypes";
import styles from "./WarehouseUi.module.css";

type ApiBody<T> = { ok: boolean; data?: T; error?: { message?: string } };
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const documentPaths: Record<string, string> = {
  receipt: "receipts",
  issue: "issues",
  transfer: "transfers",
  adjustment: "adjustments",
  reversal: "receipts"
};

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || !body.data) throw new Error(body.error?.message || "Không thể tải dữ liệu.");
  return body.data;
}

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="item-detail-field">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export function InventoryItemDetail({ id, canManage, canViewLedger }: { id: string; canManage: boolean; canViewLedger: boolean }) {
  const [item, setItem] = useState<InventoryItem>();
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requests: [Promise<InventoryItem>, Promise<StockLedgerEntry[]>] = [
      get<InventoryItem>(`/api/v1/items/${id}`),
      canViewLedger ? get<StockLedgerEntry[]>(`/api/v1/warehouse/ledger?itemId=${id}&limit=100`) : Promise.resolve([])
    ];
    void Promise.all(requests)
      .then(([current, movements]) => {
        setItem(current);
        setLedger(movements);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
  }, [canViewLedger, id]);

  if (loading) return <LoadingState description="" title="Đang tải hàng hóa" />;
  if (error || !item) return <ErrorState description={error} title="Không thể tải hàng hóa" />;

  const balanceColumns: DataTableColumn<InventoryBalance>[] = [
    { id: "warehouse", header: "Kho", cell: (row) => `${row.warehouseCode} · ${row.warehouseName}` },
    { id: "onHand", header: "Tồn hiện tại", cell: (row) => `${number.format(row.onHand)} ${row.uomCode}`, align: "right" },
    { id: "minimum", header: "Tồn tối thiểu", cell: (row) => row.minimumStock === undefined ? "—" : number.format(row.minimumStock), align: "right" },
    { id: "status", header: "Trạng thái", cell: (row) => <StatusBadge status={row.status} /> }
  ];
  const ledgerColumns: DataTableColumn<StockLedgerEntry>[] = [
    { id: "date", header: "Ngày", accessor: "postingDate" },
    { id: "document", header: "Chứng từ", cell: (row) => <Link className="text-link" href={`/warehouse/${documentPaths[row.transactionType] ?? "receipts"}/${row.documentId}`}>{row.documentNumber}</Link> },
    { id: "warehouse", header: "Kho", accessor: "warehouseName" },
    { id: "in", header: "Nhập", cell: (row) => row.quantityIn ? number.format(row.quantityIn) : "—", align: "right" },
    { id: "out", header: "Xuất", cell: (row) => row.quantityOut ? number.format(row.quantityOut) : "—", align: "right" },
    { id: "balance", header: "Tồn sau", cell: (row) => `${number.format(row.runningBalance)} ${row.uomCode}`, align: "right" }
  ];

  return (
    <div className={`page-stack ${styles.itemDetail}`}>
      <BackLink href="/warehouse/items" />
      <Card className="item-detail-card">
        <div className="item-detail-heading">
          <ItemImagePreview assetId={item.imageAssetId} itemName={item.name} variant="detail" />
          <div>
            <div className="item-detail-title">
              <div>
                <span className="eyebrow">{item.itemCode}</span>
                <h2>{item.name}</h2>
              </div>
              <StatusBadge status={item.status}>{item.status === "active" ? "Hoạt động" : "Ngừng dùng"}</StatusBadge>
            </div>
            <dl className="item-detail-grid">
              <DetailField label="Nhóm hàng" value={item.categoryName} />
              <DetailField label="Đơn vị cơ sở" value={`${item.uomCode} · ${item.uomName}`} />
              <DetailField label="Tên ngắn" value={item.shortName} />
              <DetailField label="Quy cách" value={item.specification} />
              <DetailField label="Nhãn hiệu" value={item.brand} />
              <DetailField label="Nhà sản xuất" value={item.manufacturer} />
              <DetailField label="Xuất xứ" value={item.countryOfOrigin} />
              <DetailField label="Theo dõi tồn" value={item.trackedInventory ? "Có" : "Không"} />
            </dl>
          </div>
        </div>
        {item.note ? <div className="item-detail-note"><strong>Ghi chú</strong><p>{item.note}</p></div> : null}
        {canManage ? <div className="item-detail-actions"><Link className="button button--primary button--md" href={`/warehouse/items/${item.id}/edit`}><Pencil aria-hidden="true" size={16} /><span>Chỉnh sửa</span></Link></div> : null}
      </Card>

      <div className="content-grid warehouse-kpis">
        <StatCard label="Tổng tồn" value={`${number.format(item.totalOnHand)} ${item.uomCode}`} />
        <StatCard label="Số kho có số dư" value={String(item.balances?.length ?? 0)} />
      </div>

      <Card>
        <h3 className="section-title">Tồn theo kho</h3>
        <DataTable ariaLabel="Tồn theo kho" columns={balanceColumns} data={item.balances ?? []} emptyDescription="" emptyTitle="Chưa có số dư tồn kho" getRowId={(row) => `${row.warehouseId}-${row.itemId}`} />
      </Card>

      {canViewLedger ? (
        <Card>
          <h3 className="section-title">Lịch sử biến động</h3>
          <DataTable ariaLabel="Lịch sử biến động hàng hóa" columns={ledgerColumns} data={ledger} emptyDescription="" emptyTitle="Chưa có biến động kho" getRowId={(row) => row.id} />
        </Card>
      ) : null}
    </div>
  );
}

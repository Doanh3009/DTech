"use client";
import Link from "next/link";
import { Boxes, PackagePlus, PackageMinus, Repeat2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { SearchInput, Select } from "@/components/shared/FormControls";
import { DataSurface } from "@/components/shared/PageLayouts";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useWarehouseResource, warehouseSearchText as normalize, warehouseUrl } from "@/features/warehouse/client/useWarehouseResource";
import type { InventoryBalance } from "@/features/warehouse/types/warehouseTypes";
import type { ProjectMaterials } from "@/features/projects/types/projectMaterials";
import styles from "@/features/warehouse/components/WarehouseUi.module.css";
const paths = { receipt: "receipts", issue: "issues", transfer: "transfers", adjustment: "adjustments", reversal: "ledger" };
const statusLabels = { draft: "Nháp", submitted: "Chờ ghi sổ", posted: "Đã ghi sổ", cancelled: "Đã hủy", reversed: "Đã đảo" };
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
export function PackageMaterialsWorkspace({ projectId, worksiteId, canReceipt, canIssue, canTransfer, canViewLedger, canViewItems }: { projectId: string; worksiteId?: string; canReceipt?: boolean; canIssue?: boolean; canTransfer?: boolean; canViewLedger?: boolean; canViewItems?: boolean }) {
  const [search, setSearch] = useState(""), [warehouseId, setWarehouseId] = useState(""), [stockStatus, setStockStatus] = useState(""), [page, setPage] = useState(1);
  const result = useWarehouseResource<ProjectMaterials>(warehouseUrl(`/api/v1/projects/${projectId}/materials`, { worksiteId }));
  const inventory = result.data?.inventory ?? [], warehouses = result.data?.warehouses ?? [];
  const rows = inventory.filter(row => (!warehouseId || row.warehouseId === warehouseId) && (!stockStatus || (stockStatus === "attention" ? row.status !== "in_stock" : row.status === stockStatus)) && normalize(`${row.itemName} ${row.itemCode}`).includes(normalize(search)));
  const pageCount = Math.max(1, Math.ceil(rows.length / 20)), current = Math.min(page, pageCount), defaultWarehouse = warehouseId || (warehouses.length === 1 ? warehouses[0].id : undefined);
  const columns: DataTableColumn<InventoryBalance>[] = [
    { id: "item", header: "Vật tư", priority: "primary", cell: row => canViewItems ? <Link className={`text-link ${styles.itemIdentity}`} href={`/warehouse/items/${row.itemId}`}><strong>{row.itemName}</strong><small className={styles.itemCode}>{row.itemCode}</small></Link> : <span><strong>{row.itemName}</strong><small className={styles.itemCode}>{row.itemCode}</small></span> },
    { id: "warehouse", header: "Kho", cell: row => <Link className="text-link" href={`/warehouse/warehouses/${row.warehouseId}`}>{row.warehouseName}</Link> },
    { id: "quantity", header: "Tồn kho", cell: row => <strong className={styles.quantity}>{number.format(row.onHand)} {row.uomCode}</strong>, align: "right" },
    { id: "minimum", header: "Tối thiểu", cell: row => row.minimumStock === undefined ? "—" : `${number.format(row.minimumStock)} ${row.uomCode}`, align: "right" },
    { id: "status", header: "Tình trạng", cell: row => <StatusBadge tone={row.status === "out_of_stock" ? "error" : row.status === "low_stock" ? "warning" : "success"}>{row.status === "out_of_stock" ? "Hết hàng" : row.status === "low_stock" ? "Sắp hết" : "Còn hàng"}</StatusBadge> }
  ];
  const create = (type: "receipts" | "issues" | "transfers") => warehouseUrl(`/warehouse/${type}/new`, { projectId, worksiteId, warehouseId: defaultWarehouse });
  return <section aria-label="Vật tư công trường" className={`page-stack ${styles.materialsWorkspace}`}><header className={`${styles.panelHeading} ${styles.materialHeading}`}><h2>Vật tư công trường</h2><div className={`${styles.actionLinks} ${styles.materialActions}`}>{canReceipt ? <Link className="button button--secondary button--md" href={create("receipts")}><PackagePlus size={17} />Nhập kho</Link> : null}{canIssue ? <Link className="button button--secondary button--md" href={create("issues")}><PackageMinus size={17} />Xuất dùng</Link> : null}{canTransfer ? <Link className="button button--secondary button--md" href={create("transfers")}><Repeat2 size={17} />Chuyển kho</Link> : null}</div></header>
    <div className={styles.materialMetrics}><div className={styles.summaryCard}><span>Kho công trường</span><strong>{result.loading ? "—" : warehouses.length}</strong></div><div className={styles.summaryCard}><span>Mặt hàng theo dõi</span><strong>{result.loading ? "—" : new Set(inventory.map(row => row.itemId)).size}</strong></div><button className={styles.summaryCard} data-tone="warning" onClick={() => { setStockStatus(stockStatus === "attention" ? "" : "attention"); setPage(1); }} type="button"><span>Cảnh báo tồn</span><strong>{result.loading ? "—" : inventory.filter(row => row.status !== "in_stock").length}</strong></button></div>
    <DataSurface><div className={styles.filterRow}><SearchInput aria-label="Tìm vật tư công trường" onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tên hoặc mã vật tư" value={search} /><Select label="Kho công trường" labelHidden onChange={event => { setWarehouseId(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả kho" }, ...warehouses.map(row => ({ value: row.id, label: row.name }))]} value={warehouseId} /></div><DataTable actions={canViewLedger ? row => <Link className="button button--secondary button--sm" href={warehouseUrl("/warehouse/ledger", { warehouseId: row.warehouseId, itemId: row.itemId })}>Sổ kho</Link> : undefined} ariaLabel="Vật tư tại công trường" columns={columns} data={rows.slice((current - 1) * 20, current * 20)} emptyDescription="" emptyTitle={!warehouses.length ? "Công trường chưa liên kết kho" : "Không có vật tư phù hợp"} error={result.error} getRowId={row => `${row.warehouseId}:${row.itemId}`} loading={result.loading} />{result.error ? <Button onClick={() => void result.reload()}>Tải lại</Button> : null}{pageCount > 1 ? <Pagination onPageChange={setPage} page={current} pageCount={pageCount} /> : null}</DataSurface>
    {result.data?.canViewDocuments ? <section className={styles.panel}><header className={styles.panelHeading}><h2>Chứng từ vật tư gần đây</h2></header><div className={styles.recordList}>{result.data.documents.map(row => <Link className={styles.recordRow} href={`/warehouse/${paths[row.type]}/${row.id}`} key={row.id}><span><strong>{row.documentNumber}</strong><small>{row.documentDate.split("-").reverse().join("/")} · {row.targetWarehouseName ?? row.sourceWarehouseName} · {row.lineCount} mặt hàng</small></span><StatusBadge tone={row.status === "posted" ? "success" : "neutral"}>{statusLabels[row.status]}</StatusBadge></Link>)}{!result.data.documents.length ? <div className={styles.blankState}><Boxes size={24} /><strong>Chưa có chứng từ vật tư</strong></div> : null}</div></section> : null}
  </section>;
}

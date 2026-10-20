"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Input, SearchInput, Select } from "@/components/shared/FormControls";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { ItemImagePreview } from "./ItemImagePreview";
import { useWarehouseResource, warehouseSearchText as normalize, warehouseUrl } from "../client/useWarehouseResource";
import type { InventoryBalance, InventoryDocument, InventoryDocumentType, InventoryItem, StockCount, StockLedgerEntry, Warehouse } from "../types/warehouseTypes";
import styles from "./WarehouseUi.module.css";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const statusLabels: Record<string, string> = { draft: "Nháp", submitted: "Chờ ghi sổ", posted: "Đã ghi sổ", cancelled: "Đã hủy", reversed: "Đã đảo", counting: "Đang kiểm kê", reviewed: "Đã kiểm đủ", active: "Hoạt động", inactive: "Ngừng dùng", in_stock: "Còn hàng", low_stock: "Sắp hết", out_of_stock: "Hết hàng" };
const typeConfig: Record<Exclude<InventoryDocumentType, "reversal">, { label: string; path: string }> = { receipt: { label: "Nhập kho", path: "receipts" }, issue: { label: "Xuất kho", path: "issues" }, transfer: { label: "Chuyển kho", path: "transfers" }, adjustment: { label: "Điều chỉnh", path: "adjustments" } };
const warehouseTypeLabels = { main: "Kho chính", worksite: "Kho công trường", temporary: "Kho tạm", bonded: "Kho ngoại quan" };
const date = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
function badge(value: string) { const tone: StatusBadgeTone = ["posted", "active", "in_stock"].includes(value) ? "success" : ["low_stock", "submitted", "reviewed"].includes(value) ? "warning" : ["out_of_stock", "cancelled"].includes(value) ? "error" : "neutral"; return <StatusBadge tone={tone}>{statusLabels[value] ?? value}</StatusBadge>; }
function Pager({ page, hasMore, onChange }: { page: number; hasMore: boolean; onChange: (page: number) => void }) { return <div className={styles.pageBar}><Button disabled={page === 1} onClick={() => onChange(page - 1)}>Trang trước</Button><span>Trang {page}</span><Button disabled={!hasMore} onClick={() => onChange(page + 1)}>Trang sau</Button></div>; }
function useDebounced(value: string) { const [result, setResult] = useState(value); useEffect(() => { const timer = setTimeout(() => setResult(value), 250); return () => clearTimeout(timer); }, [value]); return result; }

export function ItemListView() {
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const { data = [], error, loading, reload } = useWarehouseResource<InventoryItem[]>("/api/v1/items");
  const filtered = data.filter(row => normalize(`${row.itemCode} ${row.name} ${row.categoryName ?? ""}`).includes(normalize(search)) && (!status || row.status === status));
  const columns: DataTableColumn<InventoryItem>[] = [
    { id: "image", header: "Ảnh", cell: row => <ItemImagePreview assetId={row.imageAssetId} itemName={row.name} />, align: "center", hiddenOnMobile: true },
    { id: "item", header: "Hàng hóa", priority: "primary", cell: row => <Link className={`text-link ${styles.itemIdentity}`} href={`/warehouse/items/${row.id}`}><strong>{row.name}</strong><small className={styles.itemCode}>{row.itemCode}</small></Link> },
    { id: "category", header: "Nhóm hàng", cell: row => row.categoryName ?? "—" },
    { id: "unit", header: "Đơn vị", accessor: "uomCode" },
    { id: "stock", header: "Tổng tồn", align: "right", cell: row => number.format(row.totalOnHand) },
    { id: "status", header: "Trạng thái", cell: row => badge(row.status) }
  ];
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25)), current = Math.min(page, pageCount);
  return <ListPageLayout><DataSurface><div className={styles.filterRow} data-ui="filter-controls"><SearchInput aria-label="Tìm hàng hóa" onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Mã, tên hoặc nhóm hàng" value={search} /><Select label="Trạng thái hàng hóa" labelHidden onChange={event => { setStatus(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả trạng thái" }, { value: "active", label: "Hoạt động" }, { value: "inactive", label: "Ngừng dùng" }]} value={status} /></div><DataTable ariaLabel="Danh sách hàng hóa" columns={columns} data={filtered.slice((current - 1) * 25, current * 25)} emptyDescription="" emptyTitle="Không có hàng hóa phù hợp" error={error} getRowId={row => row.id} loading={loading} rowHrefPrefix="/warehouse/items/" />{error ? <Button onClick={() => void reload()}>Tải lại</Button> : null}{pageCount > 1 ? <Pagination onPageChange={setPage} page={current} pageCount={pageCount} /> : null}</DataSurface></ListPageLayout>;
}

export function WarehouseListView() {
  const [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const { data = [], error, loading } = useWarehouseResource<Warehouse[]>("/api/v1/warehouses");
  const visible = data.filter(row => normalize(`${row.code} ${row.name} ${row.projectName ?? ""} ${row.worksiteName ?? ""} ${row.managerName ?? ""}`).includes(normalize(search)) && (!status || row.status === status));
  const columns: DataTableColumn<Warehouse>[] = [
    { id: "warehouse", header: "Kho hàng", priority: "primary", cell: row => <Link className="text-link" href={`/warehouse/warehouses/${row.id}`}><strong>{row.name}</strong><small className={styles.itemCode}>{row.code}</small></Link> },
    { id: "type", header: "Loại kho", cell: row => warehouseTypeLabels[row.type] },
    { id: "project", header: "Dự án / công trường", cell: row => [row.projectName, row.worksiteName].filter(Boolean).join(" · ") || "—" },
    { id: "manager", header: "Quản lý", cell: row => row.managerName ?? "—" },
    { id: "status", header: "Trạng thái", cell: row => badge(row.status) }
  ];
  return <DataSurface><div className={styles.filterRow} data-ui="filter-controls"><SearchInput aria-label="Tìm kho" onChange={event => setSearch(event.target.value)} placeholder="Kho, dự án, người quản lý" value={search} /><Select label="Trạng thái kho" labelHidden onChange={event => setStatus(event.target.value)} options={[{ value: "", label: "Tất cả trạng thái" }, { value: "active", label: "Hoạt động" }, { value: "inactive", label: "Ngừng dùng" }]} value={status} /></div><DataTable ariaLabel="Danh sách kho" columns={columns} data={visible} emptyDescription="" emptyTitle="Không có kho phù hợp" error={error} getRowId={row => row.id} loading={loading} rowHrefPrefix="/warehouse/warehouses/" /></DataSurface>;
}

export function DocumentListView({ type }: { type: Exclude<InventoryDocumentType, "reversal"> }) {
  const params = useSearchParams(), config = typeConfig[type];
  const [search, setSearch] = useState(""), [status, setStatus] = useState(params.get("status") ?? ""), [warehouseId, setWarehouseId] = useState(params.get("warehouseId") ?? ""), [from, setFrom] = useState(""), [to, setTo] = useState(""), [page, setPage] = useState(1);
  const debounced = useDebounced(search), stores = useWarehouseResource<Warehouse[]>("/api/v1/warehouses");
  const result = useWarehouseResource<InventoryDocument[]>(warehouseUrl(`/api/v1/warehouse/${config.path}`, { search: debounced, status, warehouseId, from, to, projectId: params.get("projectId") ?? undefined, limit: 26, offset: (page - 1) * 25 }));
  const rows = result.data ?? [];
  const columns: DataTableColumn<InventoryDocument>[] = [
    { id: "number", header: "Chứng từ", priority: "primary", cell: row => <Link className="text-link" href={`/warehouse/${config.path}/${row.id}`}>{row.documentNumber}</Link> },
    { id: "date", header: "Ngày chứng từ", cell: row => date(row.documentDate) },
    { id: "warehouse", header: type === "transfer" ? "Kho nguồn → Kho đích" : "Kho", cell: row => type === "transfer" ? `${row.sourceWarehouseName ?? "—"} → ${row.targetWarehouseName ?? "—"}` : row.targetWarehouseName ?? row.sourceWarehouseName ?? "—" },
    { id: "project", header: "Dự án / công trường", cell: row => [row.projectName, row.worksiteName].filter(Boolean).join(" · ") || "—" },
    { id: "lines", header: "Mặt hàng", cell: row => row.lineCount, align: "right" },
    { id: "creator", header: "Người lập", cell: row => row.createdByName ?? "—", hiddenOnMobile: true },
    { id: "status", header: "Trạng thái", cell: row => badge(row.status) }
  ];
  return <ListPageLayout><DataSurface><div className={styles.filterRow} data-ui="filter-controls"><SearchInput aria-label="Tìm chứng từ kho" onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Số chứng từ" value={search} /><Select label="Trạng thái chứng từ" labelHidden onChange={event => { setStatus(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả trạng thái" }, ...["draft", "submitted", "posted", "cancelled", "reversed"].map(value => ({ value, label: statusLabels[value] }))]} value={status} /><Select label="Kho" labelHidden onChange={event => { setWarehouseId(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả kho" }, ...(stores.data ?? []).map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }))]} value={warehouseId} /><Input label="Từ ngày" onChange={event => { setFrom(event.target.value); setPage(1); }} type="date" value={from} /><Input label="Đến ngày" min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} type="date" value={to} /></div><DataTable ariaLabel={`Danh sách ${config.label.toLocaleLowerCase("vi")}`} columns={columns} data={rows.slice(0, 25)} emptyDescription="" emptyTitle="Không có chứng từ phù hợp" error={result.error ?? stores.error} getRowId={row => row.id} loading={result.loading} rowHrefPrefix={`/warehouse/${config.path}/`} />{result.error ? <Button onClick={() => void result.reload()}>Tải lại</Button> : null}<Pager hasMore={rows.length > 25} onChange={setPage} page={page} /></DataSurface></ListPageLayout>;
}

export function InventoryView({ canViewItems = false, canViewLedger = false, canCreateReceipt = false }: { canViewItems?: boolean; canViewLedger?: boolean; canCreateReceipt?: boolean }) {
  const params = useSearchParams();
  const [warehouseId, setWarehouseId] = useState(params.get("warehouseId") ?? ""), [projectId, setProjectId] = useState(params.get("projectId") ?? ""), [status, setStatus] = useState(params.get("status") ?? ""), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const stores = useWarehouseResource<Warehouse[]>("/api/v1/warehouses"), inventory = useWarehouseResource<InventoryBalance[]>(warehouseUrl("/api/v1/warehouse/inventory", { warehouseId }));
  const warehouses = stores.data ?? [], warehouseById = new Map(warehouses.map(row => [row.id, row]));
  const projects = [...new Map(warehouses.filter(row => row.projectId).map(row => [row.projectId!, { value: row.projectId!, label: row.projectName ?? row.name }])).values()];
  const base = (inventory.data ?? []).filter(row => (!projectId || warehouseById.get(row.warehouseId)?.projectId === projectId) && (!params.get("itemId") || row.itemId === params.get("itemId")) && normalize(`${row.itemCode} ${row.itemName} ${row.warehouseName}`).includes(normalize(search)));
  const visible = base.filter(row => !status || row.status === status), pageCount = Math.max(1, Math.ceil(visible.length / 25)), current = Math.min(page, pageCount);
  const columns: DataTableColumn<InventoryBalance>[] = [
    { id: "item", header: "Vật tư / hàng hóa", priority: "primary", cell: row => canViewItems ? <Link className={`text-link ${styles.itemIdentity}`} href={`/warehouse/items/${row.itemId}`}><strong>{row.itemName}</strong><small className={styles.itemCode}>{row.itemCode}</small></Link> : <span>{row.itemCode} · {row.itemName}</span> },
    { id: "warehouse", header: "Kho", cell: row => <Link className="text-link" href={`/warehouse/warehouses/${row.warehouseId}`}>{row.warehouseCode} · {row.warehouseName}</Link> },
    { id: "onHand", header: "Tồn thực tế", cell: row => <strong className={styles.quantity}>{number.format(row.onHand)} {row.uomCode}</strong>, align: "right" },
    { id: "minimum", header: "Tồn tối thiểu", cell: row => row.minimumStock === undefined ? "—" : `${number.format(row.minimumStock)} ${row.uomCode}`, align: "right" },
    { id: "status", header: "Tình trạng", cell: row => badge(row.status) }
  ];
  return <ListPageLayout><div className={styles.stockPills}>{[{ value: "", label: "Tất cả", count: base.length }, ...["in_stock", "low_stock", "out_of_stock"].map(value => ({ value, label: statusLabels[value], count: base.filter(row => row.status === value).length }))].map(option => <button aria-pressed={status === option.value} key={option.value} onClick={() => { setStatus(option.value); setPage(1); }} type="button">{option.label}<strong>{option.count}</strong></button>)}</div><DataSurface><div className={styles.filterRow} data-ui="filter-controls"><SearchInput aria-label="Tìm tồn kho" onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Mã hàng, vật tư hoặc kho" value={search} /><Select label="Dự án" labelHidden onChange={event => { setProjectId(event.target.value); setWarehouseId(""); setPage(1); }} options={[{ value: "", label: "Tất cả dự án" }, ...projects]} value={projectId} /><Select label="Kho" labelHidden onChange={event => { setWarehouseId(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả kho" }, ...warehouses.filter(row => !projectId || row.projectId === projectId).map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }))]} value={warehouseId} /></div><DataTable actions={canViewLedger || canCreateReceipt ? row => <div className={styles.rowActions}>{canViewLedger ? <Link aria-label={`Sổ kho ${row.itemCode}`} className="button button--secondary button--sm" href={warehouseUrl("/warehouse/ledger", { warehouseId: row.warehouseId, itemId: row.itemId })}>Sổ kho</Link> : null}{canCreateReceipt && row.status !== "in_stock" ? <Link aria-label={`Nhập bổ sung ${row.itemCode}`} className="button button--secondary button--sm" href={warehouseUrl("/warehouse/receipts/new", { warehouseId: row.warehouseId, itemId: row.itemId })}><ArrowUpRight size={16} />Nhập thêm</Link> : null}</div> : undefined} ariaLabel="Tồn kho theo vật tư" className={styles.inventoryTable} columns={columns} data={visible.slice((current - 1) * 25, current * 25)} emptyDescription="" emptyTitle="Không có tồn kho phù hợp" error={inventory.error ?? stores.error} getRowId={row => `${row.warehouseId}:${row.itemId}`} loading={inventory.loading || stores.loading} />{pageCount > 1 ? <Pagination onPageChange={setPage} page={current} pageCount={pageCount} /> : null}</DataSurface></ListPageLayout>;
}

export function LedgerView() {
  const params = useSearchParams(), [warehouseId, setWarehouseId] = useState(params.get("warehouseId") ?? ""), [itemId, setItemId] = useState(params.get("itemId") ?? ""), [from, setFrom] = useState(""), [to, setTo] = useState(""), [page, setPage] = useState(1);
  const stores = useWarehouseResource<Warehouse[]>("/api/v1/warehouses"), stock = useWarehouseResource<InventoryBalance[]>(warehouseUrl("/api/v1/warehouse/inventory", { warehouseId }));
  const ledger = useWarehouseResource<StockLedgerEntry[]>(warehouseUrl("/api/v1/warehouse/ledger", { warehouseId, itemId, from, to, limit: 26, offset: (page - 1) * 25 }));
  const itemOptions = [...new Map((stock.data ?? []).map(row => [row.itemId, { value: row.itemId, label: `${row.itemCode} · ${row.itemName}` }])).values()];
  const columns: DataTableColumn<StockLedgerEntry>[] = [
    { id: "document", header: "Chứng từ", priority: "primary", cell: row => row.transactionType === "reversal" ? <span>{row.documentNumber}<small className={styles.itemCode}>Đảo chứng từ</small></span> : <Link className="text-link" href={`/warehouse/${typeConfig[row.transactionType].path}/${row.documentId}`}>{row.documentNumber}</Link> },
    { id: "date", header: "Ngày ghi sổ", cell: row => date(row.postingDate) }, { id: "warehouse", header: "Kho", accessor: "warehouseName" },
    { id: "item", header: "Vật tư", cell: row => `${row.itemCode} · ${row.itemName}` },
    { id: "in", header: "Nhập", cell: row => row.quantityIn ? <span className={styles.incoming}>+{number.format(row.quantityIn)} {row.uomCode}</span> : "—", align: "right" },
    { id: "out", header: "Xuất", cell: row => row.quantityOut ? <span className={styles.outgoing}>−{number.format(row.quantityOut)} {row.uomCode}</span> : "—", align: "right" },
    { id: "balance", header: "Tồn sau giao dịch", cell: row => <strong className={styles.quantity}>{number.format(row.runningBalance)} {row.uomCode}</strong>, align: "right" }
  ];
  return <ListPageLayout><DataSurface><div className={styles.filterRow} data-ui="filter-controls"><Select label="Kho" onChange={event => { setWarehouseId(event.target.value); setItemId(""); setPage(1); }} options={[{ value: "", label: "Tất cả kho" }, ...(stores.data ?? []).map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }))]} value={warehouseId} /><Select label="Vật tư / hàng hóa" onChange={event => { setItemId(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả mặt hàng" }, ...itemOptions]} value={itemId} /><Input label="Từ ngày" onChange={event => { setFrom(event.target.value); setPage(1); }} type="date" value={from} /><Input label="Đến ngày" min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} type="date" value={to} /></div><DataTable ariaLabel="Sổ kho" columns={columns} data={(ledger.data ?? []).slice(0, 25)} emptyDescription="" emptyTitle="Không có giao dịch trong khoảng đã chọn" error={ledger.error ?? stores.error ?? stock.error} getRowId={row => row.id} loading={ledger.loading} /><Pager hasMore={(ledger.data?.length ?? 0) > 25} onChange={setPage} page={page} /></DataSurface></ListPageLayout>;
}

export function StockCountListView() {
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const result = useWarehouseResource<StockCount[]>("/api/v1/warehouse/stock-counts"), rows = (result.data ?? []).filter(row => normalize(`${row.countNumber} ${row.warehouseName}`).includes(normalize(search)) && (!status || row.status === status));
  const pageCount = Math.max(1, Math.ceil(rows.length / 25)), current = Math.min(page, pageCount);
  const columns: DataTableColumn<StockCount>[] = [
    { id: "number", header: "Phiếu kiểm kê", priority: "primary", cell: row => <Link className="text-link" href={`/warehouse/stock-counts/${row.id}`}>{row.countNumber}</Link> },
    { id: "warehouse", header: "Kho", accessor: "warehouseName" }, { id: "date", header: "Ngày kiểm", cell: row => date(row.countDate) },
    { id: "policy", header: "Giao dịch kho", cell: row => ["posted", "cancelled"].includes(row.status) ? "Đã mở giao dịch" : row.transactionPolicy === "freeze" ? "Đang tạm khóa" : "Đối chiếu phát sinh" },
    { id: "status", header: "Trạng thái", cell: row => badge(row.status) }
  ];
  return <ListPageLayout><DataSurface><div className={styles.filterRow} data-ui="filter-controls"><SearchInput aria-label="Tìm kiểm kê" onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Số kiểm kê hoặc kho" value={search} /><Select label="Trạng thái kiểm kê" labelHidden onChange={event => { setStatus(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả trạng thái" }, ...["counting", "reviewed", "posted", "cancelled"].map(value => ({ value, label: statusLabels[value] }))]} value={status} /></div><DataTable ariaLabel="Danh sách kiểm kê" columns={columns} data={rows.slice((current - 1) * 25, current * 25)} emptyDescription="" emptyTitle="Không có phiên kiểm kê phù hợp" error={result.error} getRowId={row => row.id} loading={result.loading} rowHrefPrefix="/warehouse/stock-counts/" />{pageCount > 1 ? <Pagination onPageChange={setPage} page={current} pageCount={pageCount} /> : null}</DataSurface></ListPageLayout>;
}

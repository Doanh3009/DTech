"use client";

import Link from "next/link";
import { Check, Plus, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, IconButton } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Checkbox, Input, SearchInput, Select, Textarea } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { warehouseRequest as api, warehouseWrite as write } from "../client/warehouseClient";
import type { InventoryItem, StockCount, Warehouse } from "../types/warehouseTypes";
import { warehouseSearchText as normalize } from "../client/useWarehouseResource";
import styles from "./WarehouseUi.module.css";
const statusLabels: Record<string, string> = { draft: "Nháp", counting: "Đang kiểm kê", reviewed: "Đã kiểm đủ", posted: "Đã ghi sổ", cancelled: "Đã hủy" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });

export function NewStockCount() {
  const router = useRouter(), params = useSearchParams(), pending = useRef(false), creationKey = useRef<string | undefined>(undefined);
  const [selectionSearch, setSelectionSearch] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]), [warehouseId, setWarehouseId] = useState(params.get("warehouseId") ?? ""), [countDate, setCountDate] = useState(today), [policy, setPolicy] = useState("freeze"), [scope, setScope] = useState("all"), [selected, setSelected] = useState<string[]>([]), [inventory, setInventory] = useState<InventoryItem[]>([]), [note, setNote] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { void api<Warehouse[]>("/api/v1/warehouses").then(rows => setWarehouses(rows.filter(row => row.status === "active"))).catch(caught => setError(caught.message)); }, []);
  useEffect(() => { if (!warehouseId || scope !== "selected") return; const controller = new AbortController(); void api<InventoryItem[]>("/api/v1/items?status=active", { signal: controller.signal }).then(rows => setInventory(rows.filter(row => row.trackedInventory))).catch(caught => { if (!controller.signal.aborted) setError(caught.message); }); return () => controller.abort(); }, [scope, warehouseId]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { const saved = await write<StockCount>("/api/v1/warehouse/stock-counts", "POST", { warehouseId, countDate, scope, transactionPolicy: policy, clientRequestId: creationKey.current ??= crypto.randomUUID(), itemIds: scope === "selected" ? selected : undefined, note: note || undefined }); router.push(`/warehouse/stock-counts/${saved.id}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tạo kiểm kê."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form className="warehouse-form page-stack" onSubmit={submit}><Card className={styles.formCard}><div className="form-grid"><Select disabled={busy} label="Kho kiểm kê" onChange={event => { setWarehouseId(event.target.value); setSelected([]); setInventory([]); }} options={warehouses.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }))} placeholder="Chọn kho" required value={warehouseId} /><Input disabled={busy} label="Ngày kiểm kê" onChange={event => setCountDate(event.target.value)} required type="date" value={countDate} /><Select disabled={busy} label="Phạm vi" onChange={event => setScope(event.target.value)} options={[{ value: "all", label: "Tất cả hàng hóa trong kho" }, { value: "selected", label: "Chọn mặt hàng" }]} value={scope} /><Select disabled={busy} label="Giao dịch trong lúc kiểm kê" onChange={event => setPolicy(event.target.value)} options={[{ value: "freeze", label: "Tạm khóa nhập, xuất và chuyển kho" }, { value: "reconcile", label: "Cho giao dịch, đối chiếu khi hoàn tất" }]} value={policy} /></div>{scope === "selected" ? <section className={styles.selectionSection}><SearchInput aria-label="Tìm hàng để kiểm kê" onChange={event => setSelectionSearch(event.target.value)} placeholder="Tên hoặc mã hàng" value={selectionSearch} /><strong>Đã chọn {selected.length} mặt hàng</strong><div className={styles.selectionList}>{inventory.filter(row => normalize(`${row.itemCode} ${row.name}`).includes(normalize(selectionSearch))).map(row => <Checkbox checked={selected.includes(row.id)} disabled={busy} key={row.id} label={`${row.itemCode} · ${row.name}`} onChange={event => setSelected(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} />)}{warehouseId && !inventory.length ? <span>Chưa có hàng hóa theo dõi tồn</span> : null}</div></section> : null}<Textarea disabled={busy} label="Ghi chú" onChange={event => setNote(event.target.value)} rows={3} value={note} /></Card>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className={`warehouse-sticky-actions ${styles.actions}`}><Button disabled={busy} onClick={() => router.back()}>Quay lại</Button><Button busy={busy} disabled={busy || !warehouseId || scope === "selected" && !selected.length} leftIcon={<Plus size={17} />} type="submit" variant="primary">Tạo kiểm kê</Button></div></form>;
}

export function StockCountDetail({ id, canEdit, canPost }: { id: string; canEdit: boolean; canPost: boolean }) {
  const mutation = useRef(false), postingKey = useRef<string | undefined>(undefined);
  const [item, setItem] = useState<StockCount>(), [counts, setCounts] = useState<Record<string, string>>({}), [search, setSearch] = useState(""), [filter, setFilter] = useState("all"), [dirty, setDirty] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false), [cancel, setCancel] = useState(false), [reason, setReason] = useState(""), [cancelError, setCancelError] = useState("");
  function accept(value: StockCount) { setItem(value); setCounts(Object.fromEntries(value.lines.map(line => [line.id, line.countedQuantity?.toString() ?? ""]))); setDirty(false); }
  const load = useCallback(async () => { try { const value = await api<StockCount>(`/api/v1/warehouse/stock-counts/${id}`); accept(value); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải kiểm kê."); } }, [id]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const entered = (lineId: string) => counts[lineId] !== undefined && counts[lineId].trim() !== "" && Number.isFinite(Number(counts[lineId])) && Number(counts[lineId]) >= 0;
  const filled = item?.lines.filter(line => entered(line.id)).length ?? 0;
  const closed = item?.status === "posted" || item?.status === "cancelled";
  const complete = Boolean(item?.lines.length && filled === item.lines.length);
  async function save(finalize = false) {
    if (!item || mutation.current) return;
    if (item.lines.some(line => counts[line.id]?.trim() && !entered(line.id))) { setError("Số thực kiểm phải là số không âm."); return; }
    if (finalize && !complete) { setError("Còn mặt hàng chưa nhập số thực kiểm."); return; }
    mutation.current = true; setBusy(true); setError("");
    try {
      let current = item;
      if (dirty) {
        current = await write<StockCount>(`/api/v1/warehouse/stock-counts/${id}`, "PATCH", { rowVersion: item.rowVersion, lines: item.lines.map(line => ({ id: line.id, countedQuantity: entered(line.id) ? Number(counts[line.id]) : null, note: line.note })) }); accept(current);
      }
      if (finalize) { postingKey.current ??= crypto.randomUUID(); accept(await write<StockCount>(`/api/v1/warehouse/stock-counts/${id}/post`, "POST", { rowVersion: current.rowVersion, postingDate: today(), idempotencyKey: postingKey.current })); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu kiểm kê."); }
    finally { mutation.current = false; setBusy(false); }
  }
  async function cancelCount(event: FormEvent) {
    event.preventDefault(); if (!item || mutation.current) return;
    mutation.current = true; setBusy(true); setCancelError("");
    try { accept(await write<StockCount>(`/api/v1/warehouse/stock-counts/${id}`, "PATCH", { action: "cancel", rowVersion: item.rowVersion, reason: reason.trim() })); setCancel(false); }
    catch (caught) { setCancelError(caught instanceof Error ? caught.message : "Không thể hủy kiểm kê."); }
    finally { mutation.current = false; setBusy(false); }
  }
  if (!item) return error ? <div className={styles.formCard}><p className="form-error" role="alert">{error}</p><Button onClick={() => void load()}>Tải lại</Button></div> : <LoadingState title="Đang mở kiểm kê" />;
  const variance = (line: StockCount["lines"][number]) => entered(line.id) ? Number(counts[line.id]) - line.expectedQuantity : undefined;
  const different = item.lines.filter(line => variance(line) !== undefined && Math.abs(variance(line)!) > 0.00001).length;
  const filtered = item.lines.filter(line => `${line.itemCode} ${line.itemName}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")) && (filter === "all" || filter === "missing" && !entered(line.id) || filter === "variance" && variance(line) !== undefined && Math.abs(variance(line)!) > 0.00001));
  const columns: DataTableColumn<StockCount["lines"][number]>[] = [
    { id: "item", header: "Hàng hóa", priority: "primary", cell: line => <Link className={`text-link ${styles.itemIdentity}`} href={`/warehouse/items/${line.itemId}`}><strong>{line.itemName}</strong><small className={styles.itemCode}>{line.itemCode}</small></Link> },
    { id: "expected", header: "Tồn hệ thống", cell: line => `${number.format(line.expectedQuantity)} ${line.uomCode}`, align: "right" },
    { id: "counted", header: "Thực kiểm", cell: line => <input aria-label={`Thực kiểm ${line.itemCode}`} className={`input ${styles.countInput}`} disabled={closed || !canEdit || busy} inputMode="decimal" min="0" onChange={event => { setCounts(current => ({ ...current, [line.id]: event.target.value })); setDirty(true); }} placeholder="Chưa kiểm" step="0.0001" type="number" value={counts[line.id] ?? ""} /> },
    { id: "variance_status", header: "Chênh lệch", align: "right", cell: line => { const value = variance(line); return <span className={styles.variance} data-direction={value === undefined || value === 0 ? undefined : value < 0 ? "negative" : "positive"}>{value === undefined ? "—" : `${value > 0 ? "+" : ""}${number.format(value)}`}</span>; } }
  ];
  return <div className="page-stack"><Card className={styles.countHeader}><div className={styles.panelHeading}><h2>{item.countNumber}</h2><StatusBadge tone={item.status === "posted" ? "success" : "neutral"}>{statusLabels[item.status]}</StatusBadge></div><dl className={styles.countFacts}><div><dt>Kho</dt><dd>{item.warehouseName}</dd></div><div><dt>Ngày kiểm</dt><dd>{item.countDate.split("-").reverse().join("/")}</dd></div><div><dt>Chụp tồn</dt><dd>{new Date(item.snapshotAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</dd></div><div><dt>Giao dịch kho</dt><dd>{closed ? "Đã mở giao dịch" : item.transactionPolicy === "freeze" ? "Đang tạm khóa" : "Đối chiếu phát sinh"}</dd></div></dl><div className={styles.countProgress}><div><span>Đã nhập {filled} / {item.lines.length} mặt hàng</span><strong>{different} chênh lệch</strong></div><progress aria-label="Tiến độ kiểm kê" max={Math.max(1, item.lines.length)} value={filled} /></div>{item.note ? <p className={styles.savedNote}>{item.note}</p> : null}</Card>
    <div className={styles.countToolbar} data-ui="filter-controls"><SearchInput aria-label="Tìm hàng kiểm kê" onChange={event => setSearch(event.target.value)} placeholder="Tìm mã hoặc tên hàng" value={search} /><div className={styles.stockPills}>{[{ value: "all", label: "Tất cả", count: item.lines.length }, { value: "missing", label: "Chưa kiểm", count: item.lines.length - filled }, { value: "variance", label: "Chênh lệch", count: different }].map(option => <button aria-pressed={filter === option.value} key={option.value} onClick={() => setFilter(option.value)} type="button">{option.label}<strong>{option.count}</strong></button>)}</div></div>
    <Card><DataTable ariaLabel="Hàng hóa kiểm kê" columns={columns} data={filtered} emptyDescription="" emptyTitle="Không có mặt hàng trong nhóm này" getRowId={line => line.id} /></Card>{error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className={`warehouse-sticky-actions ${styles.actions}`}><IconButton disabled={busy} label="Tải lại kiểm kê" onClick={() => void load()}><RefreshCw size={17} /></IconButton>{!closed && canEdit ? <><Button disabled={busy} onClick={() => { setCancel(true); setCancelError(""); }} variant="danger">Hủy kiểm kê</Button><Button busy={busy} disabled={busy || !dirty} onClick={() => void save()}>Lưu số kiểm</Button></> : null}{!closed && canPost ? <Button busy={busy} disabled={busy || !complete || dirty && !canEdit} leftIcon={<Check size={17} />} onClick={() => void save(true)} variant="primary">Hoàn tất & ghi sổ</Button> : null}{item.adjustmentDocumentId ? <Link className="button button--secondary button--md" href={`/warehouse/adjustments/${item.adjustmentDocumentId}`}>Xem phiếu điều chỉnh</Link> : null}</div>
    <Modal onClose={() => { if (!busy) setCancel(false); }} open={cancel} title="Hủy kiểm kê"><form className={`drawer-form ${styles.formCard}`} onSubmit={cancelCount}><Textarea disabled={busy} label="Lý do hủy" maxLength={1000} minLength={3} onChange={event => setReason(event.target.value)} required rows={3} value={reason} />{cancelError ? <p className="form-error" role="alert">{cancelError}</p> : null}<div className="form-actions"><Button disabled={busy} onClick={() => setCancel(false)}>Quay lại</Button><Button busy={busy} disabled={busy || reason.trim().length < 3} type="submit" variant="danger">Hủy kiểm kê</Button></div></form></Modal>
  </div>;
}

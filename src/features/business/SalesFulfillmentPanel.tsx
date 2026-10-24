"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { DataTable } from "@/components/shared/DataTable";
import { Input, Select } from "@/components/shared/FormControls";
import { salesDeliveryReceiptSchema, salesDeliverySchema, type SalesDeliveryInput, type SalesFulfillment } from "./salesFulfillment";
import styles from "./SalesFulfillmentPanel.module.css";

interface DraftLine { key: string; itemId: string; stock: string; quantity: number; unitCost: number }
const stockKey = (stock: SalesFulfillment["stock"][number]) => `${stock.warehouseId}:${stock.lotId ?? "none"}`;
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function SalesFulfillmentPanel({ slug, orderId, viewer, disabled, onBusyChange, onPendingChange, onCommitted }: {
  slug: string; orderId: string; viewer: boolean; disabled: boolean;
  onBusyChange: (busy: boolean) => void; onPendingChange: (pending: boolean) => void; onCommitted: () => void;
}) {
  const endpoint = `/api/v1/business/${slug}/sales-orders/${orderId}`;
  const [snapshot, setSnapshot] = useState<SalesFulfillment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [documentDate, setDocumentDate] = useState(today);
  const [pending, setPending] = useState<SalesDeliveryInput | null>(null);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${endpoint}/fulfillment`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok || !body.ok || body.data?.orderId !== orderId || !Array.isArray(body.data.items) || !Array.isArray(body.data.stock)) throw new Error(body.error?.message || "Không thể tải tiến độ giao hàng.");
      setSnapshot(body.data); setStale(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải tiến độ giao hàng."); }
    finally { setLoading(false); }
  }, [endpoint, orderId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { onPendingChange(!!pending || lines.length > 0); }, [pending, lines.length, onPendingChange]);
  useEffect(() => {
    if (!pending && !lines.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, lines.length]);

  function markPending(command: SalesDeliveryInput | null) { setPending(command); onPendingChange(!!command); }
  function addLine() {
    const item = snapshot?.items.find(entry => entry.ordered > entry.shipped);
    if (!item) return;
    setLines(current => [...current, { key: crypto.randomUUID(), itemId: item.itemId, stock: "", quantity: Math.min(1, item.ordered - item.shipped), unitCost: item.unitCost }]);
  }
  function patch(key: string, fields: Partial<DraftLine>) { setLines(current => current.map(line => line.key === key ? { ...line, ...fields } : line)); }
  async function send(command: SalesDeliveryInput) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); onBusyChange(true); setError(""); markPending(command);
    try {
      const response = await fetch(`${endpoint}/deliveries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        if (response.status < 500 && response.status !== 429) { markPending(null); setStale(response.status === 409); }
        throw new Error(body.error?.message || "Chưa xác nhận được kết quả giao hàng.");
      }
      const receipt = salesDeliveryReceiptSchema.safeParse(body.data);
      if (!receipt.success || receipt.data.orderId !== orderId || receipt.data.rowVersion !== command.rowVersion + command.lines.length || receipt.data.stockMoveIds.length !== command.lines.length) throw new Error("Chưa xác nhận được phiếu xuất. Thử lại cùng yêu cầu.");
      markPending(null); setLines([]); onCommitted();
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa xác nhận được kết quả. Thử lại cùng yêu cầu."); }
    finally { inFlight.current = false; setBusy(false); onBusyChange(false); }
  }
  function deliver(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || pending || stale) return;
    const parsed = salesDeliverySchema.safeParse({ requestId: crypto.randomUUID(), rowVersion: snapshot.rowVersion, documentDate, lines: lines.map(line => {
      const stock = snapshot.stock.find(entry => entry.itemId === line.itemId && stockKey(entry) === line.stock);
      return { itemId: line.itemId, warehouseId: stock?.warehouseId, lotId: stock?.lotId ?? null, quantity: line.quantity, unitCost: line.unitCost };
    }) });
    if (!parsed.success) { setError("Chọn hàng, kho / lô và nhập số lượng lớn hơn 0, tối đa 4 chữ số thập phân."); return; }
    void send(parsed.data);
  }
  const locked = disabled || busy || !!pending || stale || loading;
  const progress = snapshot?.items.map(item => ({ ...item, remaining: item.ordered - item.shipped })) ?? [];
  return <section className={styles.panel} aria-label="Giao hàng theo đơn">
    <div className={styles.heading}><h3>Tiến độ giao hàng</h3><Button disabled={busy || !!pending || disabled} onClick={() => void load()}>Cập nhật giao hàng</Button></div>
    {error ? <div ref={errorRef} tabIndex={-1} className="form-alert form-alert--error" role="alert">{error}</div> : null}
    <DataTable ariaLabel="Tiến độ giao hàng" loading={loading} data={progress} getRowId={row => row.itemId} columns={[
      { id: "code", header: "Mã hàng", accessor: "code", priority: "primary" },
      { id: "name", header: "Hàng hóa", accessor: "name" },
      ...([['ordered', 'Đặt'], ['shipped', 'Đã giao'], ['remaining', 'Còn giao']] as const).map(([key, label]) => ({ id: key, header: label, cell: (row: typeof progress[number]) => row[key].toLocaleString("vi-VN") }))
    ]} emptyTitle="Đơn hàng chưa có chi tiết" />
    {pending && !busy ? <Button onClick={() => void send(pending)}>Thử lại giao hàng cùng yêu cầu</Button> : null}
    {!viewer && snapshot?.status === "released" ? <form className={styles.form} onSubmit={deliver}>
      <Input label="Ngày giao hàng" type="date" required value={documentDate} max={today()} disabled={locked} onChange={e => setDocumentDate(e.target.value)} />
      {lines.map((line, index) => <fieldset className={styles.line} key={line.key} disabled={locked}><legend>Hàng giao {index + 1}</legend>
        <Select label={`Hàng hóa ${index + 1}`} value={line.itemId} required options={snapshot.items.filter(item => item.ordered > item.shipped).map(item => ({ value: item.itemId, label: `${item.code} · ${item.name} · Còn ${item.ordered - item.shipped} ${item.unit}` }))} onChange={event => { const item = snapshot.items.find(entry => entry.itemId === event.target.value); patch(line.key, { itemId: event.target.value, stock: "", quantity: 1, unitCost: item?.unitCost ?? 0 }); }} />
        <Select label={`Kho / lô ${index + 1}`} value={line.stock} required options={[{ value: "", label: "Chọn kho / lô" }, ...snapshot.stock.filter(stock => stock.itemId === line.itemId).map(stock => ({ value: stockKey(stock), label: `${stock.warehouse}${stock.lot ? ` · ${stock.lot}` : ""} · Tồn ${stock.available}` }))]} onChange={event => patch(line.key, { stock: event.target.value })} />
        <Input label={`Số lượng ${index + 1}`} type="number" required min="0.0001" step="0.0001" max={1e12} value={line.quantity} onChange={event => patch(line.key, { quantity: Number(event.target.value) })} />
        <Input label={`Đơn giá ${index + 1}`} type="number" required min={0} step="0.0001" max={1e12} value={line.unitCost} onChange={event => patch(line.key, { unitCost: Number(event.target.value) })} />
        <Button onClick={() => setLines(current => current.filter(entry => entry.key !== line.key))}>Bỏ dòng {index + 1}</Button>
      </fieldset>)}
      <div className={styles.heading}><Button disabled={locked || lines.length >= 50 || !progress.some(item => item.remaining > 0)} onClick={addLine}>Thêm hàng giao</Button><Button type="submit" variant="primary" busy={busy} disabled={locked || lines.length === 0}>Giao hàng & xuất kho</Button></div>
    </form> : null}
  </section>;
}

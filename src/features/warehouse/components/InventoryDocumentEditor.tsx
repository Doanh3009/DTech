"use client";

import Link from "next/link";
import { ChevronDown, Download, PackageCheck, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button, IconButton } from "@/components/shared/Button";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CommandBar, Inspector, WorkbenchLayout, WorkCanvas } from "@/components/shared/Workbench";
import { can } from "@/lib/auth/permissions";
import { ItemImagePreview } from "./ItemImagePreview";
import { warehouseRequest as api, warehouseWrite as write } from "../client/warehouseClient";
import type { InventoryBalance, InventoryDocument, InventoryDocumentLine, InventoryDocumentType, InventoryItem, Warehouse } from "../types/warehouseTypes";
import styles from "./WarehouseUi.module.css";

type DocumentType = Exclude<InventoryDocumentType, "reversal">;
type EditLine = Omit<InventoryDocumentLine, "id" | "rowVersion"> & { key: string };
type References = { projects: Array<{ id: string; code: string; name: string }>; worksites: Array<{ id: string; projectId: string; name: string }> };
type TransactionType = { code: string; label: string; projectRequired?: boolean; project_required?: boolean };
type Attachment = { id: string; fileId: string; fileName: string; sizeBytes: number };
const paths = { receipt: "receipts", issue: "issues", transfer: "transfers", adjustment: "adjustments" };
const labels = { receipt: "Phiếu nhập kho", issue: "Phiếu xuất kho", transfer: "Phiếu chuyển kho", adjustment: "Phiếu điều chỉnh kho" };
const statusLabels: Record<string, string> = { draft: "Nháp", submitted: "Chờ ghi sổ", posted: "Đã ghi sổ", cancelled: "Đã hủy", reversed: "Đã đảo" };
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const blank = (): EditLine => ({ key: crypto.randomUUID(), itemId: "", itemCode: "", itemName: "", quantity: 1, uomId: "", uomCode: "" });
const editLines = (document: InventoryDocument): EditLine[] => document.lines.map(({ id, rowVersion, ...line }) => { void rowVersion; return { ...line, key: id }; });

export function InventoryDocumentEditor({ type, id, canCreate, canPost, canReverse, canViewProjects = false }: { type: DocumentType; id?: string; canCreate: boolean; canPost: boolean; canReverse: boolean; canViewProjects?: boolean }) {
  const user = useCurrentUser();
  const router = useRouter(), query = useSearchParams(), form = useRef<HTMLFormElement>(null), mutation = useRef(false), creationId = useRef<string | undefined>(undefined), postKey = useRef<string | undefined>(undefined), reversalKey = useRef<string | undefined>(undefined);
  const [items, setItems] = useState<InventoryItem[]>([]), [warehouses, setWarehouses] = useState<Warehouse[]>([]), [types, setTypes] = useState<TransactionType[]>([]), [references, setReferences] = useState<References>({ projects: [], worksites: [] });
  const [document, setDocument] = useState<Partial<InventoryDocument>>({ type, documentDate: today() }), [lines, setLines] = useState<EditLine[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [stock, setStock] = useState<{ warehouseId: string; rows: InventoryBalance[] }>(), [stockError, setStockError] = useState("");
  const [reasonAction, setReasonAction] = useState<"reverse" | "cancel">(), [reason, setReason] = useState(""), [postingDate, setPostingDate] = useState(today), [reasonError, setReasonError] = useState("");
  const initial = useRef(query.toString());
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [catalog, stores, transactionTypes, refs, current] = await Promise.all([
        canCreate ? api<InventoryItem[]>("/api/v1/items?status=active") : Promise.resolve([]), api<Warehouse[]>("/api/v1/warehouses"), api<TransactionType[]>(`/api/v1/warehouse/transaction-types?type=${type}`), api<References>("/api/v1/warehouse/references"), id ? api<InventoryDocument>(`/api/v1/warehouse/${paths[type]}/${id}`) : Promise.resolve(undefined)
      ]);
      setItems(catalog); setWarehouses(stores); setTypes(transactionTypes.filter(row => row.code !== "COUNT_VARIANCE")); setReferences(refs);
      if (current) { setDocument(current); setLines(editLines(current)); }
      else {
        const params = new URLSearchParams(initial.current), warehouseId = params.get("warehouseId") ?? "", warehouse = stores.find(row => row.id === warehouseId), item = catalog.find(row => row.id === params.get("itemId"));
        setDocument({ type, documentDate: today(), transactionTypeCode: transactionTypes.find(row => row.code !== "COUNT_VARIANCE")?.code, ...(type === "receipt" ? { targetWarehouseId: warehouse?.id } : { sourceWarehouseId: warehouse?.id }), projectId: params.get("projectId") ?? warehouse?.projectId, worksiteId: params.get("worksiteId") ?? warehouse?.worksiteId });
        setLines([item ? { ...blank(), itemId: item.id, itemCode: item.itemCode, itemName: item.name, uomId: item.baseUomId, uomCode: item.uomCode } : blank()]);
      }
      setDirty(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải chứng từ."); }
    finally { setLoading(false); }
  }, [canCreate, id, type]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  const sourceId = document.sourceWarehouseId;
  useEffect(() => {
    if (!sourceId || document.status && !["draft", "submitted"].includes(document.status)) return;
    const controller = new AbortController();
    void api<InventoryBalance[]>(`/api/v1/warehouse/inventory?warehouseId=${sourceId}`, { signal: controller.signal }).then(rows => { setStock({ warehouseId: sourceId, rows }); setStockError(""); }).catch(caught => { if (!controller.signal.aborted) setStockError(caught instanceof Error ? caught.message : "Không thể đọc tồn kho."); });
    return () => controller.abort();
  }, [sourceId, document.status]);
  const locked = Boolean(document.id && document.status !== "draft") || !canCreate;
  const change = (patch: Partial<InventoryDocument>) => { setDocument(current => ({ ...current, ...patch })); setDirty(true); };
  const changeLine = (key: string, patch: Partial<EditLine>) => { setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line)); setDirty(true); };
  const currentStock = stock && stock.warehouseId === sourceId ? stock.rows : undefined;
  const shortage = lines.some(line => {
    const available = currentStock?.find(row => row.itemId === line.itemId)?.onHand ?? 0;
    return currentStock && line.itemId && available + (type === "adjustment" ? line.adjustmentQuantity ?? 0 : -line.quantity) < -0.00001;
  });
  const needsStock = type !== "receipt" && sourceId && (!document.status || ["draft", "submitted"].includes(document.status));
  const canSubmitPost = !needsStock || Boolean(currentStock && !stockError && !shortage);
  function accept(saved: InventoryDocument) { setDocument(saved); setLines(editLines(saved)); setDirty(false); }
  async function persist(operation: "save" | "post") {
    if (mutation.current || !form.current?.reportValidity()) return;
    if (operation === "post" && !postingDate) { setError("Chọn ngày ghi sổ."); return; }
    if (type === "transfer" && document.sourceWarehouseId === document.targetWarehouseId) { setError("Kho nguồn và kho đích phải khác nhau."); return; }
    mutation.current = true; setBusy(true); setError("");
    let current = document;
    try {
      if (!current.id || dirty) {
        creationId.current ??= crypto.randomUUID();
        const payload = { documentDate: current.documentDate, sourceWarehouseId: current.sourceWarehouseId || undefined, targetWarehouseId: current.targetWarehouseId || undefined, transactionTypeCode: current.transactionTypeCode, supplierReference: current.supplierReference || undefined, shipmentId: current.shipmentId, shipmentReceiptReference: current.shipmentReceiptReference, projectId: current.projectId || undefined, worksiteId: current.worksiteId || undefined, deliveredBy: current.deliveredBy || undefined, receivedBy: current.receivedBy || undefined, recipient: current.recipient || undefined, receivingDepartment: current.receivingDepartment || undefined, note: current.note || undefined, lines: lines.map(({ key, ...line }) => { void key; return line; }), ...(current.id ? { rowVersion: current.rowVersion } : { clientRequestId: creationId.current }) };
        current = await write<InventoryDocument>(`/api/v1/warehouse/${paths[type]}${current.id ? `/${current.id}` : ""}`, current.id ? "PATCH" : "POST", payload);
        accept(current as InventoryDocument);
      }
      if (operation === "post") {
        postKey.current ??= crypto.randomUUID();
        current = await write<InventoryDocument>(`/api/v1/warehouse/${paths[type]}/${current.id}/post`, "POST", { rowVersion: current.rowVersion, postingDate, idempotencyKey: postKey.current, allowNegativeOverride: false });
        accept(current as InventoryDocument);
      }
      router.replace(`/warehouse/${paths[type]}/${current.id}`); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu chứng từ.");
      if (current.id) try { const actual = await api<InventoryDocument>(`/api/v1/warehouse/${paths[type]}/${current.id}`); if (actual.status !== "draft") accept(actual); } catch { /* Retain entered data until the user reloads. */ }
    } finally { mutation.current = false; setBusy(false); }
  }
  async function applyReason(event: FormEvent) {
    event.preventDefault(); if (!document.id || mutation.current || reason.trim().length < 3) return;
    mutation.current = true; setBusy(true); setReasonError("");
    try {
      const saved = reasonAction === "cancel" ? await write<InventoryDocument>(`/api/v1/warehouse/${paths[type]}/${document.id}`, "PATCH", { action: "cancel", rowVersion: document.rowVersion, reason: reason.trim() }) : await write<InventoryDocument>(`/api/v1/warehouse/${paths[type]}/${document.id}/reverse`, "POST", { postingDate, reason: reason.trim(), idempotencyKey: reversalKey.current ??= crypto.randomUUID() });
      accept(saved); setReasonAction(undefined); setReason("");
    } catch (caught) { setReasonError(caught instanceof Error ? caught.message : "Không thể xử lý chứng từ."); }
    finally { mutation.current = false; setBusy(false); }
  }
  if (loading) return <LoadingState title="Đang mở chứng từ kho" />;
  if (!types.length && error) return <div className={styles.formCard}><p className="form-error" role="alert">{error}</p><Button onClick={() => void load()}>Tải lại</Button></div>;
  const warehouseOptions = warehouses.filter(row => row.status === "active" || [document.sourceWarehouseId, document.targetWarehouseId].includes(row.id)).map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const submitter = (event.nativeEvent as SubmitEvent).submitter; void persist(submitter?.getAttribute("value") === "post" ? "post" : "save"); };
  return <WorkbenchLayout className={`warehouse-workbench ${styles.documentEditor}`}>
    <form className="warehouse-workbench__main" onSubmit={submit} ref={form}>
      <CommandBar label="Thao tác chứng từ kho"><div className="warehouse-document-heading"><strong>{document.documentNumber ?? labels[type]}</strong><StatusBadge tone={document.status === "posted" ? "success" : "neutral"}>{statusLabels[document.status ?? ""] ?? "Chưa lưu"}</StatusBadge>{dirty ? <StatusBadge tone="warning">Chưa lưu thay đổi</StatusBadge> : null}</div><div className="warehouse-command-actions"><IconButton disabled={busy} label="Tải lại chứng từ" onClick={() => void load()}><RefreshCw size={17} /></IconButton>{!locked ? <Button busy={busy} disabled={busy} name="operation" type="submit" value="save" variant={canPost ? "secondary" : "primary"}>Lưu nháp</Button> : null}{canPost && (!document.id || ["draft", "submitted"].includes(document.status ?? "")) ? <Button busy={busy} disabled={busy || !canSubmitPost} leftIcon={<PackageCheck size={17} />} name="operation" type="submit" value="post" variant="primary">{!document.id || dirty ? "Lưu & ghi sổ" : "Ghi sổ"}</Button> : null}</div></CommandBar>
      <WorkCanvas><fieldset className={styles.editorFields} disabled={locked || busy}>
        <section className="warehouse-document-section"><h2>Thông tin chứng từ</h2><div className="form-grid">
          <Input label="Ngày chứng từ" onChange={event => change({ documentDate: event.target.value })} required type="date" value={document.documentDate ?? ""} />
          <Select disabled={Boolean(document.shipmentId)} label="Loại giao dịch" onChange={event => change({ transactionTypeCode: event.target.value })} options={types.map(row => ({ value: row.code, label: row.label }))} placeholder="Chọn loại giao dịch" required value={document.transactionTypeCode ?? ""} />
          {type !== "receipt" ? <Select label={type === "adjustment" ? "Kho điều chỉnh" : "Kho xuất"} onChange={event => change({ sourceWarehouseId: event.target.value })} options={warehouseOptions} placeholder="Chọn kho" required value={document.sourceWarehouseId ?? ""} /> : null}
          {type === "receipt" || type === "transfer" ? <Select label={type === "receipt" ? "Kho nhận" : "Kho đích"} onChange={event => { const warehouse = warehouses.find(row => row.id === event.target.value); change({ targetWarehouseId: event.target.value, ...(warehouse?.projectId ? { projectId: warehouse.projectId, worksiteId: warehouse.worksiteId } : {}) }); }} options={warehouseOptions.filter(row => type !== "transfer" || row.value !== sourceId)} placeholder="Chọn kho" required value={document.targetWarehouseId ?? ""} /> : null}
          <Select label="Dự án" onChange={event => change({ projectId: event.target.value, worksiteId: undefined })} options={references.projects.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }))} placeholder="Không gắn dự án" value={document.projectId ?? ""} />
          <Select disabled={!document.projectId} label="Công trường" onChange={event => change({ worksiteId: event.target.value })} options={references.worksites.filter(row => row.projectId === document.projectId).map(row => ({ value: row.id, label: row.name }))} placeholder="Không gắn công trường" value={document.worksiteId ?? ""} />
          {type === "receipt" ? <><Input label="Người giao" onChange={event => change({ deliveredBy: event.target.value })} value={document.deliveredBy ?? ""} /><Input label="Người nhận" onChange={event => change({ receivedBy: event.target.value })} value={document.receivedBy ?? ""} /></> : null}
          {type === "issue" ? <><Input label="Người nhận" onChange={event => change({ recipient: event.target.value })} value={document.recipient ?? ""} /><Input label="Bộ phận nhận" onChange={event => change({ receivingDepartment: event.target.value })} value={document.receivingDepartment ?? ""} /></> : null}
        </div><Textarea label={type === "adjustment" ? "Lý do điều chỉnh" : "Ghi chú"} onChange={event => change({ note: event.target.value })} required={type === "adjustment"} rows={2} value={document.note ?? ""} /></section>
        <section className="warehouse-document-section warehouse-lines-section"><div className="warehouse-lines-heading"><h2>Hàng hóa <small>{lines.length}</small></h2>{!locked && !document.shipmentId ? <Button leftIcon={<Plus size={16} />} onClick={() => { setLines(current => [...current, blank()]); setDirty(true); }}>Thêm hàng</Button> : null}</div>
          <div className={styles.documentLines}>{lines.map((line, index) => {
            const item = items.find(row => row.id === line.itemId), balance = currentStock?.find(row => row.itemId === line.itemId)?.onHand ?? 0;
            const delta = type === "adjustment" ? line.adjustmentQuantity ?? 0 : type === "issue" || type === "transfer" ? -line.quantity : line.quantity;
            const options = items.filter(row => row.id === line.itemId || !lines.some(other => other.itemId === row.id)).map(row => ({ value: row.id, label: `${row.itemCode} · ${row.name}` }));
            if (line.itemId && !items.some(row => row.id === line.itemId)) options.push({ value: line.itemId, label: `${line.itemCode} · ${line.itemName}` });
            return <article className={styles.documentLine} key={line.key}><div className={styles.lineHeading}><span>{String(index + 1).padStart(2, "0")}</span><strong>{(item?.name ?? line.itemName) || "Chọn hàng hóa"}</strong>{!locked ? <IconButton disabled={busy || lines.length === 1} label={`Xóa dòng ${index + 1}`} onClick={() => { setLines(current => current.filter(row => row.key !== line.key)); setDirty(true); }} variant="danger"><Trash2 size={16} /></IconButton> : null}</div><div className={styles.lineFields}><div className={styles.itemPicker}><ItemImagePreview assetId={item?.imageAssetId} itemName={item?.name ?? line.itemName} /><Select disabled={Boolean(line.shipmentLineId)} label={`Hàng hóa ${index + 1}`} onChange={event => { const selected = items.find(row => row.id === event.target.value); changeLine(line.key, { itemId: event.target.value, itemName: selected?.name ?? "", itemCode: selected?.itemCode ?? "", uomId: selected?.baseUomId ?? "", uomCode: selected?.uomCode ?? "" }); }} options={options} placeholder="Tìm hoặc chọn hàng hóa" required value={line.itemId} /></div><Input label={type === "adjustment" ? "Chênh lệch (+/−)" : "Số lượng"} min={type === "adjustment" ? undefined : 0.0001} onChange={event => changeLine(line.key, type === "adjustment" ? { adjustmentQuantity: event.target.value === "" ? undefined : Number(event.target.value), quantity: Math.abs(Number(event.target.value)) || 1 } : { quantity: event.target.value === "" ? NaN : Number(event.target.value) })} required step="0.0001" type="number" value={type === "adjustment" ? line.adjustmentQuantity ?? "" : Number.isFinite(line.quantity) ? line.quantity : ""} /><Input label="Đơn vị" readOnly value={line.uomCode || item?.uomCode || ""} /></div>{needsStock && line.itemId ? <div className={styles.stockFacts} data-shortage={currentStock && balance + delta < 0 || undefined}><span>Tồn kho <strong>{currentStock ? number.format(balance) : "—"} {line.uomCode}</strong></span><span>Sau ghi sổ <strong>{currentStock && Number.isFinite(delta) ? number.format(balance + delta) : "—"} {line.uomCode}</strong></span></div> : null}<details className={styles.lineOptions}><summary><span>Chi tiết dòng hàng</span><ChevronDown aria-hidden="true" size={15} /></summary><div className="form-grid"><Input label="Đơn giá" min="0" onChange={event => changeLine(line.key, { unitPrice: event.target.value === "" ? undefined : Number(event.target.value) })} step="any" type="number" value={line.unitPrice ?? ""} /><Input label="Tham chiếu" onChange={event => changeLine(line.key, { reference: event.target.value })} value={line.reference ?? ""} /><Input label="Mục đích" onChange={event => changeLine(line.key, { purpose: event.target.value })} value={line.purpose ?? ""} /><Input label="Ghi chú dòng" onChange={event => changeLine(line.key, { note: event.target.value })} value={line.note ?? ""} /></div></details></article>;
          })}</div>
        </section>
      </fieldset>{stockError && needsStock ? <p className="form-error" role="alert">{stockError}</p> : null}{shortage && needsStock ? <p className="form-error" role="status">Có mặt hàng vượt tồn kho khả dụng.</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}</WorkCanvas>
    </form>
    <Inspector title="Thông tin ghi sổ"><dl className="warehouse-inspector-summary"><div><dt>Trạng thái</dt><dd>{statusLabels[document.status ?? ""] ?? "Chưa lưu"}</dd></div><div><dt>Mặt hàng</dt><dd>{lines.length}</dd></div>{document.createdByName ? <div><dt>Người lập</dt><dd>{document.createdByName}</dd></div> : null}{document.postedAt ? <div><dt>Ghi sổ lúc</dt><dd>{new Date(document.postedAt).toLocaleString("vi-VN")}</dd></div> : null}{document.postedByName ? <div><dt>Người ghi sổ</dt><dd>{document.postedByName}</dd></div> : null}</dl>{["draft", "submitted"].includes(document.status ?? "") && canPost ? <Input disabled={busy} label="Ngày ghi sổ" onChange={event => setPostingDate(event.target.value)} required type="date" value={postingDate} /> : !document.id && canPost ? <Input label="Ngày ghi sổ" onChange={event => setPostingDate(event.target.value)} required type="date" value={postingDate} /> : null}<div className={styles.recordLinks}>{can(user.permissions, "warehouse.view") && (document.sourceWarehouseId || document.targetWarehouseId) ? <Link href={`/warehouse/inventory?warehouseId=${document.sourceWarehouseId ?? document.targetWarehouseId}`}>Xem tồn kho</Link> : null}{document.projectId && canViewProjects ? <Link href={`/projects/${document.projectId}/today`}>Công trường</Link> : null}{document.status === "draft" && canCreate ? <Button disabled={busy} onClick={() => { setReasonAction("cancel"); setReason(""); setReasonError(""); }} variant="danger">Hủy phiếu</Button> : null}{document.status === "posted" && canReverse && ["receipt", "issue"].includes(type) ? <Button disabled={busy} onClick={() => { setReasonAction("reverse"); setReason(""); setReasonError(""); }} variant="danger">Đảo chứng từ</Button> : null}</div>{document.id ? <DocumentAttachments canCreate={canCreate} id={document.id} /> : null}</Inspector>
    <Modal onClose={() => { if (!busy) setReasonAction(undefined); }} open={Boolean(reasonAction)} title={reasonAction === "reverse" ? "Đảo chứng từ" : "Hủy phiếu"}><form className={`drawer-form ${styles.formCard}`} onSubmit={applyReason}><Textarea disabled={busy} label="Lý do" maxLength={1000} minLength={3} onChange={event => setReason(event.target.value)} required rows={3} value={reason} />{reasonAction === "reverse" ? <Input disabled={busy} label="Ngày ghi sổ đảo" onChange={event => setPostingDate(event.target.value)} required type="date" value={postingDate} /> : null}{reasonError ? <p className="form-error" role="alert">{reasonError}</p> : null}<div className="form-actions"><Button disabled={busy} onClick={() => setReasonAction(undefined)}>Quay lại</Button><Button busy={busy} disabled={busy || reason.trim().length < 3} type="submit" variant="danger">{reasonAction === "reverse" ? "Đảo chứng từ" : "Hủy phiếu"}</Button></div></form></Modal>
  </WorkbenchLayout>;
}

function DocumentAttachments({ id, canCreate }: { id: string; canCreate: boolean }) {
  const [files, setFiles] = useState<Attachment[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); void api<Attachment[]>(`/api/v1/warehouse/documents/${id}/attachments`, { signal: controller.signal }).then(setFiles).catch(caught => { if (!controller.signal.aborted) setError(caught.message); }); return () => controller.abort(); }, [id]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const element = event.currentTarget, data = new FormData(element); setBusy(true); setError("");
    try { const file = await api<Attachment>(`/api/v1/warehouse/documents/${id}/attachments`, { method: "POST", body: data }); setFiles(current => [...current, file]); element.reset(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải tệp."); } finally { setBusy(false); }
  }
  return <section className={styles.attachments}><h3>Tệp đính kèm <small>{files.length}</small></h3>{canCreate ? <form className="warehouse-upload" onSubmit={upload}><input accept=".pdf,.xlsx,.docx,.jpg,.jpeg,.png,.webp" aria-label="Chọn tệp chứng từ" disabled={busy} name="file" required type="file" /><Button busy={busy} disabled={busy} leftIcon={<Upload size={16} />} type="submit">Tải lên</Button></form> : null}{files.map(file => <a className={styles.attachment} href={`/api/v1/files/${file.fileId}/signed-url`} key={file.id} rel="noreferrer" target="_blank"><Download aria-hidden="true" size={16} /><span>{file.fileName}<small>{number.format(Math.ceil(file.sizeBytes / 1024))} KB</small></span></a>)}{error ? <p className="form-error" role="alert">{error}</p> : null}</section>;
}

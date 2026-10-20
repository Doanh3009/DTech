"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ArrowRight, CalendarClock, Check, ChevronDown, ClipboardList, Clock3, FileText, History, MapPin, Package, Plus, RefreshCw, Ship, Truck, Upload } from "lucide-react";
import { useCallback, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button, IconButton } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { DataTable } from "@/components/shared/DataTable";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs } from "@/components/shared/Tabs";
import { can } from "@/lib/auth/permissions";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { useIsPhone } from "@/lib/ui/useIsPhone";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import { canTransitionShipment } from "../services/shipmentRules";
import type { DocumentChecklistItem, Partner, ReceivingSummary, Shipment, ShipmentDocument, ShipmentStatus } from "../types/importExportTypes";
import { requestImportExport as api, useImportExportData as useApi } from "./importExportClient";
import styles from "./ShipmentWorkspace.module.css";

const sections = [
  { value: "overview", label: "Tổng quan" }, { value: "lines", label: "Hàng hóa" },
  { value: "containers", label: "Container" }, { value: "documents", label: "Chứng từ" },
  { value: "customs", label: "Thông quan" }, { value: "receiving", label: "Nhận hàng" },
  { value: "history", label: "Lịch sử & Lịch trình" }
];
const labels: Record<string, string> = {
  planned: "Kế hoạch", booked: "Đã đặt chỗ", in_transit: "Đang vận chuyển", arrived_port: "Đã cập cảng",
  customs_processing: "Đang thông quan", customs_cleared: "Đã thông quan", delivering_to_warehouse: "Đang giao kho",
  partially_received: "Nhận một phần", received: "Đã nhận", completed: "Hoàn tất", cancelled: "Đã hủy",
  not_started: "Chưa bắt đầu", preparing_documents: "Chuẩn bị hồ sơ", declared: "Đã khai", inspection: "Kiểm hóa",
  pending_duty: "Chờ thuế", cleared: "Đã thông quan", issue: "Vướng mắc", missing: "Thiếu", valid: "Hợp lệ",
  expired: "Hết hạn", replaced: "Đã thay", archived: "Lưu trữ", draft: "Nháp", submitted: "Chờ ghi sổ", posted: "Đã ghi sổ", reversed: "Đã đảo", approved: "Đã duyệt",
  loaded: "Đã xếp hàng", arrived: "Đã đến", delivered: "Đã giao", empty_returned: "Đã trả rỗng"
};
const modes: Record<string, string> = { sea: "Đường biển", air: "Đường hàng không", road: "Đường bộ", rail: "Đường sắt", courier: "Chuyển phát", other: "Khác" };
const shipmentStatuses: readonly ShipmentStatus[] = ["planned", "booked", "in_transit", "arrived_port", "customs_processing", "customs_cleared", "delivering_to_warehouse", "partially_received", "received", "completed", "cancelled"];
const quantity = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const date = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`)) : "—";
const stamp = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
const today = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const badge = (value: string) => <StatusBadge status={value}>{labels[value] ?? value}</StatusBadge>;
type Reload = () => Promise<Shipment | void>;
type References = { documentTypes: Array<{ id: string; name: string; active: boolean }>; warehouses: Array<{ id: string; code: string; name: string }>; partners: Partner[] };

function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function run(work: () => Promise<unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await work(); setNotice("Đã cập nhật"); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật."); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, notice, run };
}
function Feedback({ error, notice }: { error: string; notice: string }) {
  return <>{error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <span className={styles.notice} role="status"><Check aria-hidden="true" size={16} />{notice}</span> : null}</>;
}
function useVersionedDraft<T extends { rowVersion: number }>(current: T) {
  const [draft, setDraft] = useState<T>();
  return {
    value: draft ?? current,
    change: setDraft,
    reset: () => setDraft(undefined),
    conflict: Boolean(draft && draft.rowVersion !== current.rowVersion)
  };
}
function DraftConflict({ reset }: { reset: () => void }) {
  return <div className={styles.conflict} role="alert"><span>Dữ liệu đã được cập nhật bởi người khác.</span><Button onClick={reset} size="sm">Tải bản mới</Button></div>;
}
function Heading({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return <header className={styles.sectionHeading}><span>{icon}<h2>{title}</h2></span>{action}</header>;
}
function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className={styles.facts}>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>;
}
function EditSection({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const mobile = useIsPhone();
  return <details className={styles.editSection} open={!mobile}><summary><span>{icon}{label}</span><ChevronDown aria-hidden="true" size={17} /></summary><div className={styles.editBody}>{children}</div></details>;
}

// Keep each visited form mounted so tab navigation preserves unsaved input.
function ShipmentSection({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return <section aria-label={label} hidden={!active}>{active || visited ? children : null}</section>;
}

export function ShipmentDetailView({ id }: { id: string }) {
  const section = useSelectedLayoutSegment() ?? "overview";
  const state = useApi<Shipment>(`/api/v1/shipments/${id}`);
  const router = useRouter();
  const [changingSection, startTransition] = useTransition();
  useLoadingActivity(changingSection, "page");
  if (state.loading) return <LoadingState title="Đang mở lô hàng" />;
  if (!state.data) return <ErrorState description={state.error} action={<Button onClick={() => void state.reload()}>Thử lại</Button>} />;
  const shipment = state.data;
  const base = `/import-export/shipments/${id}`;
  return <div className={`page-stack ${styles.workspace}`}>
    <PageHeader title="Chi tiết lô hàng" />
    {state.error ? <div className={styles.refreshError} role="alert"><span>{state.error}</span><Button onClick={() => void state.reload()} size="sm">Thử lại</Button></div> : null}
    <Card className={`${styles.identity}${section !== "overview" ? ` ${styles.compactIdentity}` : ""}`}>
      <header className={styles.identityHeading}><div><span className={styles.eyebrow}>Lô hàng</span><h2>{shipment.shipmentNumber}</h2></div><div className={styles.identityActions}>{badge(shipment.status)}<IconButton aria-busy={state.refreshing || undefined} className={styles.refreshButton} disabled={state.refreshing} label="Làm mới lô hàng" onClick={() => void state.reload()}><RefreshCw aria-hidden="true" size={16} /></IconButton></div></header>
      <div className={styles.supplier}>{shipment.supplierName}{shipment.contractNumber && shipment.contractId ? <Link className="text-link" href={`/import-export/contracts/${shipment.contractId}`}>{shipment.contractNumber}</Link> : null}</div>
      <div className={`${styles.route}${!shipment.origin && !shipment.portOfLoading && !shipment.destination && !shipment.portOfDischarge ? ` ${styles.routeEmpty}` : ""}`}>{shipment.origin || shipment.portOfLoading || shipment.destination || shipment.portOfDischarge ? <><span><MapPin aria-hidden="true" size={17} /><strong>{shipment.origin || shipment.portOfLoading || "—"}</strong></span><ArrowRight aria-hidden="true" size={18} /><span><MapPin aria-hidden="true" size={17} /><strong>{shipment.destination || shipment.portOfDischarge || "—"}</strong></span></> : <span><MapPin aria-hidden="true" size={17} /><strong>Chưa có tuyến vận chuyển</strong></span>}</div>
      <div className={styles.identityFooter}><span>{shipment.transportMode === "sea" ? <Ship aria-hidden="true" size={17} /> : <Truck aria-hidden="true" size={17} />}{modes[shipment.transportMode] ?? shipment.transportMode.toUpperCase()}</span><span><CalendarClock aria-hidden="true" size={17} />ETA <strong>{date(shipment.currentEta)}</strong></span></div>
      <nav aria-label="Dữ liệu lô hàng" className={styles.metrics}>{[
        { href: "lines", icon: <Package aria-hidden="true" size={18} />, label: "Dòng hàng", value: shipment.lines.length },
        { href: "containers", icon: <Truck aria-hidden="true" size={18} />, label: "Container", value: shipment.containers.length },
        { href: "documents", icon: <FileText aria-hidden="true" size={18} />, label: "Chứng từ", value: shipment.documents.length }
      ].map((item) => <Link href={`${base}/${item.href}`} key={item.href} scroll={false}>{item.icon}<strong>{item.value}</strong><span>{item.label}</span></Link>)}</nav>
    </Card>
    <div className={styles.desktopTabs}><Tabs label="Chi tiết lô hàng" items={sections.map((item) => ({ label: item.label, href: `${base}/${item.value}`, scroll: false, active: section === item.value }))} /></div>
    <div className={styles.mobileSections}><Select disabled={changingSection} label="Mục lô hàng" labelHidden options={sections.map((item) => ({ value: item.value, label: item.label }))} value={section} onChange={(event) => startTransition(() => router.push(`${base}/${event.target.value}`, { scroll: false }))} /></div>
    <div className={styles.sectionContent}>
      <ShipmentSection active={section === "overview"} label="Tổng quan"><ShipmentOverview shipment={shipment} reload={state.reload} /></ShipmentSection>
      <ShipmentSection active={section === "lines"} label="Hàng hóa"><ShipmentLines shipment={shipment} /></ShipmentSection>
      <ShipmentSection active={section === "containers"} label="Container"><ShipmentContainers shipment={shipment} reload={state.reload} /></ShipmentSection>
      <ShipmentSection active={section === "documents"} label="Chứng từ"><ShipmentDocuments shipment={shipment} reload={state.reload} /></ShipmentSection>
      <ShipmentSection active={section === "customs"} label="Thông quan"><ShipmentCustomsView shipment={shipment} reload={state.reload} /></ShipmentSection>
      <ShipmentSection active={section === "receiving"} label="Nhận hàng"><ShipmentReceiving shipment={shipment} reload={state.reload} /></ShipmentSection>
      <ShipmentSection active={section === "history"} label="Lịch sử & Lịch trình"><ShipmentHistory shipment={shipment} reload={state.reload} /></ShipmentSection>
    </div>
  </div>;
}

function ShipmentOverview({ shipment, reload }: { shipment: Shipment; reload: Reload }) {
  const user = useCurrentUser();
  const statusDraft = useVersionedDraft({ status: shipment.status, rowVersion: shipment.rowVersion });
  const [reason, setReason] = useState("");
  const mutation = useMutation();
  const status = statusDraft.value.status;
  const allowedStatuses = shipmentStatuses.filter((value) =>
    (value === shipment.status || canTransitionShipment(shipment.status, value))
    && (value === shipment.status || can(user.permissions, value === "cancelled" ? "shipment.cancel" : value === "completed" ? "shipment.close" : "shipment.edit"))
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (statusDraft.conflict) return;
    if (await mutation.run(async () => {
      await api(`/api/v1/shipments/${shipment.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, rowVersion: statusDraft.value.rowVersion, reason: reason || undefined }) });
      await reload();
    })) { statusDraft.reset(); setReason(""); }
  }
  return <div className={styles.overview}>
    <Card className={styles.schedule}>
      <Heading icon={<CalendarClock aria-hidden="true" size={19} />} title="Lịch trình" action={<Link className={styles.sectionLink} href={`/import-export/shipments/${shipment.id}/history`}>Lịch sử<History aria-hidden="true" size={16} /></Link>} />
      <div className={styles.plannedDates}><div><span>Khởi hành · ETD</span><strong>{date(shipment.currentEtd)}</strong></div><ArrowRight aria-hidden="true" size={20} /><div><span>Dự kiến đến · ETA</span><strong>{date(shipment.currentEta)}</strong></div></div>
      <Facts items={[["Khởi hành thực tế", date(shipment.actualDeparture)], ["Cập cảng thực tế", date(shipment.actualArrival)], ["ETA ban đầu", date(shipment.originalEta)], ["Thông quan", badge(shipment.customs.status)]]} />
      {shipment.scheduleHistory[0] ? <div className={styles.lastSchedule}><Clock3 aria-hidden="true" size={16} /><span>{shipment.scheduleHistory[0].scheduleType.toUpperCase()} {date(shipment.scheduleHistory[0].oldValue)} <ArrowRight aria-hidden="true" size={13} /> {date(shipment.scheduleHistory[0].newValue)}</span><time dateTime={shipment.scheduleHistory[0].changedAt}>{stamp(shipment.scheduleHistory[0].changedAt)}</time></div> : null}
    </Card>
    <Card>
      <Heading icon={<Ship aria-hidden="true" size={19} />} title="Vận chuyển" />
      <Facts items={[["Phương thức", modes[shipment.transportMode] ?? shipment.transportMode.toUpperCase()], ["Hãng vận chuyển", shipment.carrierName], ["Đơn vị giao nhận", shipment.forwarderName], ["Booking", shipment.bookingNumber], ["Vận đơn · B/L", shipment.billOfLadingNumber], ["Cảng xếp", shipment.portOfLoading], ["Cảng dỡ", shipment.portOfDischarge], ["Incoterm", shipment.incoterm]]} />
    </Card>
    <div className={styles.overviewActions}>
      {shipment.attention?.length ? <Card><Heading icon={<ClipboardList aria-hidden="true" size={19} />} title="Cần xử lý" /><ul className={styles.checklist}>{shipment.attention.map((item, index) => <li key={`${item.code}:${index}`}>{item.label}</li>)}</ul></Card> : null}
      {allowedStatuses.length > 1 ? <EditSection label="Cập nhật trạng thái" icon={<ClipboardList aria-hidden="true" size={18} />}><form className={styles.form} onSubmit={save}>{statusDraft.conflict ? <DraftConflict reset={() => { statusDraft.reset(); setReason(""); }} /> : null}<Select disabled={mutation.busy} label="Trạng thái mới" options={allowedStatuses.map((value) => ({ value, label: labels[value] }))} value={status} onChange={(event) => statusDraft.change({ ...statusDraft.value, status: event.target.value as ShipmentStatus })} /><Textarea disabled={mutation.busy} label="Lý do" required={status === "cancelled"} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /><Feedback {...mutation} /><Button busy={mutation.busy} disabled={statusDraft.conflict || status === shipment.status} type="submit" variant="primary">Cập nhật trạng thái</Button></form></EditSection> : null}
      {shipment.note ? <Card><Heading icon={<FileText aria-hidden="true" size={19} />} title="Ghi chú" /><p className={styles.note}>{shipment.note}</p></Card> : null}
    </div>
  </div>;
}

function ShipmentLines({ shipment }: { shipment: Shipment }) {
  return <div className={styles.dataSection}><Heading icon={<Package aria-hidden="true" size={19} />} title={`Hàng hóa · ${shipment.lines.length}`} /><DataTable columns={[
    { id: "item", header: "Hàng hóa", priority: "primary", cell: (row) => <><strong>{row.itemName}</strong><small>{row.itemCode}</small></> },
    { id: "qty", header: "Dự kiến", cell: (row) => `${quantity.format(row.expectedQuantity)} ${row.uomCode}`, align: "right" },
    { id: "packages", header: "Số kiện", cell: (row) => row.packageCount ?? "—" },
    { id: "gross", header: "Trọng lượng cả bì", cell: (row) => row.grossWeight === undefined ? "—" : quantity.format(row.grossWeight), hiddenOnMobile: true },
    { id: "net", header: "Trọng lượng tịnh", cell: (row) => row.netWeight === undefined ? "—" : quantity.format(row.netWeight), hiddenOnMobile: true },
    { id: "volume", header: "Thể tích", cell: (row) => row.volume === undefined ? "—" : quantity.format(row.volume), hiddenOnMobile: true },
    { id: "marks", header: "Ký mã hiệu", cell: (row) => row.marksNumbers ?? "—", hiddenOnMobile: true },
    { id: "note", header: "Ghi chú", cell: (row) => row.note ?? "—", hiddenOnMobile: true }
  ]} data={shipment.lines} emptyDescription="" emptyTitle="Chưa có hàng hóa" getRowId={(row) => row.id} /></div>;
}

function ShipmentContainers({ shipment, reload }: { shipment: Shipment; reload: Reload }) {
  const user = useCurrentUser();
  const [form, setForm] = useState({ containerNumber: "", sealNumber: "", containerType: "40HQ", size: "40", status: "planned" });
  const mutation = useMutation();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await mutation.run(async () => { await api(`/api/v1/shipments/${shipment.id}/containers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); await reload(); })) setForm({ ...form, containerNumber: "", sealNumber: "" });
  }
  return <div className={styles.sectionStack}>
    <div className={styles.dataSection}><Heading icon={<Truck aria-hidden="true" size={19} />} title={`Container · ${shipment.containers.length}`} /><DataTable columns={[
      { id: "number", header: "Container", priority: "primary", accessor: "containerNumber" }, { id: "seal", header: "Số seal", cell: (row) => row.sealNumber ?? "—" },
      { id: "type", header: "Loại", cell: (row) => row.containerType ?? "—" }, { id: "status", header: "Trạng thái", cell: (row) => badge(row.status) }
    ]} data={shipment.containers} emptyDescription="" emptyTitle="Chưa có container" getRowId={(row) => row.id} /></div>
    {can(user.permissions, "shipment.edit") ? <EditSection label="Thêm container" icon={<Plus aria-hidden="true" size={18} />}><form className={styles.form} onSubmit={submit}><div className="form-grid"><Input disabled={mutation.busy} label="Số container" required value={form.containerNumber} onChange={(event) => setForm({ ...form, containerNumber: event.target.value.toUpperCase() })} /><Input disabled={mutation.busy} label="Số seal" value={form.sealNumber} onChange={(event) => setForm({ ...form, sealNumber: event.target.value })} /><Select disabled={mutation.busy} label="Loại container" options={["20GP", "40GP", "40HQ", "20OT", "40OT", "FR", "OTHER"].map((value) => ({ value, label: value }))} value={form.containerType} onChange={(event) => setForm({ ...form, containerType: event.target.value, size: event.target.value.startsWith("20") ? "20" : event.target.value.startsWith("40") ? "40" : form.size })} /></div><Feedback {...mutation} /><Button busy={mutation.busy} type="submit" variant="primary">Thêm container</Button></form></EditSection> : null}
  </div>;
}

function ShipmentDocuments({ shipment, reload }: { shipment: Shipment; reload: Reload }) {
  const user = useCurrentUser();
  const docs = useApi<{ documents: ShipmentDocument[]; checklist: DocumentChecklistItem[] }>(`/api/v1/shipments/${shipment.id}/documents`);
  const refs = useApi<References>("/api/v1/import-export/references");
  const [documentTypeId, setType] = useState("");
  const [file, setFile] = useState<File>();
  const [documentInfo, setDocumentInfo] = useState({ documentNumber: "", issueDate: "", expiryDate: "", issuer: "" });
  const mutation = useMutation();
  const mobile = useIsPhone();
  const requiredDocuments = docs.data?.checklist.filter((item) => item.required || item.requiredBeforeCustoms) ?? [];
  const optionalDocuments = docs.data?.checklist.filter((item) => !item.required && !item.requiredBeforeCustoms) ?? [];
  const checklistRows = (items: DocumentChecklistItem[]) => items.map((item) => <li key={item.documentTypeId}><span>{item.name}{item.required ? <b className={styles.required} aria-label="Bắt buộc"> *</b> : null}</span>{badge(item.state)}</li>);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData();
    if (!(file instanceof File) || !file.size) return;
    form.set("file", file);
    form.set("metadata", JSON.stringify({ documentTypeId, status: "received", ...Object.fromEntries(Object.entries(documentInfo).filter(([, value]) => value)) }));
    if (await mutation.run(async () => { await api(`/api/v1/shipments/${shipment.id}/documents`, { method: "POST", body: form }); await docs.reload(); await reload(); })) { formElement.reset(); setFile(undefined); setDocumentInfo({ documentNumber: "", issueDate: "", expiryDate: "", issuer: "" }); }
  }
  return <div className={styles.sectionStack}>
    {can(user.permissions, "shipment_document.upload") ? <EditSection label="Tải chứng từ" icon={<Upload aria-hidden="true" size={18} />}><form className={styles.form} onSubmit={upload}><Select disabled={mutation.busy || refs.loading} label="Loại chứng từ" required placeholder="Chọn loại chứng từ" options={(refs.data?.documentTypes ?? []).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name }))} value={documentTypeId} onChange={(event) => setType(event.target.value)} /><ImageUploader accept="" compact file={file} label="Chọn tệp chứng từ" maxBytes={15 * 1024 * 1024} onFileChange={setFile} uploading={mutation.busy} /><details className={styles.optionalChecklist}><summary>Thông tin chứng từ<ChevronDown aria-hidden="true" size={16} /></summary><div className="form-grid"><Input disabled={mutation.busy} label="Số chứng từ" value={documentInfo.documentNumber} onChange={(event) => setDocumentInfo({ ...documentInfo, documentNumber: event.target.value })} /><Input disabled={mutation.busy} label="Ngày cấp" type="date" value={documentInfo.issueDate} onChange={(event) => setDocumentInfo({ ...documentInfo, issueDate: event.target.value })} /><Input disabled={mutation.busy} label="Ngày hết hạn" type="date" value={documentInfo.expiryDate} onChange={(event) => setDocumentInfo({ ...documentInfo, expiryDate: event.target.value })} /><Input disabled={mutation.busy} label="Đơn vị cấp" value={documentInfo.issuer} onChange={(event) => setDocumentInfo({ ...documentInfo, issuer: event.target.value })} /></div></details>{refs.error ? <p className="form-error" role="alert">{refs.error}</p> : null}<Feedback {...mutation} /><Button busy={mutation.busy} disabled={!documentTypeId || !file} leftIcon={<Upload aria-hidden="true" size={16} />} type="submit" variant="primary">Tải lên</Button></form></EditSection> : null}
    <Card><Heading icon={<ClipboardList aria-hidden="true" size={19} />} title="Kiểm tra chứng từ" />{docs.loading ? <LoadingState /> : docs.error ? <ErrorState description={docs.error} action={<Button onClick={() => void docs.reload()}>Thử lại</Button>} /> : <><ul className={styles.checklist}>{requiredDocuments.length ? checklistRows(requiredDocuments) : !optionalDocuments.length ? <li>Chưa có danh mục kiểm tra</li> : null}</ul>{optionalDocuments.length ? <details className={styles.optionalChecklist} open={!mobile}><summary>Chứng từ khác · {optionalDocuments.length}<ChevronDown aria-hidden="true" size={16} /></summary><ul className={styles.checklist}>{checklistRows(optionalDocuments)}</ul></details> : null}</>}</Card>
    <div className={styles.dataSection}><Heading icon={<FileText aria-hidden="true" size={19} />} title={`Tệp chứng từ · ${docs.data?.documents.length ?? shipment.documents.length}`} /><DataTable columns={[
      { id: "type", header: "Loại chứng từ", priority: "primary", accessor: "typeName" },
      { id: "number", header: "Số chứng từ", cell: (row) => row.documentNumber ?? "—" }, { id: "status", header: "Trạng thái", cell: (row) => badge(row.status) },
      { id: "file", header: "Tệp", cell: (row) => <a className="text-link" href={`/api/v1/files/${row.fileId}/signed-url`} target="_blank" rel="noreferrer">{row.fileName}</a> },
      { id: "version", header: "Phiên bản", cell: (row) => String(row.version), hiddenOnMobile: true }, { id: "date", header: "Ngày cấp", cell: (row) => date(row.issueDate), hiddenOnMobile: true },
      { id: "expires", header: "Hết hạn", cell: (row) => date(row.expiryDate), hiddenOnMobile: true }
    ]} data={docs.data?.documents ?? []} emptyDescription="" emptyTitle="Chưa có chứng từ" getRowId={(row) => row.id} loading={docs.loading} /></div>
  </div>;
}

function ShipmentCustomsView({ shipment, reload }: { shipment: Shipment; reload: Reload }) {
  const user = useCurrentUser();
  const draft = useVersionedDraft(shipment.customs);
  const { value, change: setValue } = draft;
  const mutation = useMutation();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (draft.conflict) return;
    if (await mutation.run(async () => { await api(`/api/v1/shipments/${shipment.id}/customs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); await reload(); })) draft.reset();
  }
  return <div className={styles.sectionStack}>
    <Card><Heading icon={<ClipboardList aria-hidden="true" size={19} />} title="Hồ sơ thông quan" /><Facts items={[["Trạng thái", badge(shipment.customs.status)], ["Số tờ khai", shipment.customs.declarationNumber], ["Ngày khai", date(shipment.customs.declarationDate)], ["Ngày thông quan", date(shipment.customs.clearanceDate)], ["Đại lý hải quan", shipment.customs.customsBrokerName], ["Phân luồng", shipment.customs.channel]]} />{shipment.customs.issueNote ? <p className={styles.issue} role="status">{shipment.customs.issueNote}</p> : null}</Card>
    {can(user.permissions, "customs.manage") ? <EditSection label="Cập nhật thông quan" icon={<ClipboardList aria-hidden="true" size={18} />}><form className={styles.form} onSubmit={save}>{draft.conflict ? <DraftConflict reset={draft.reset} /> : null}<div className="form-grid"><Select disabled={mutation.busy} label="Trạng thái" options={["not_started", "preparing_documents", "declared", "inspection", "pending_duty", "cleared", "issue"].map((status) => ({ value: status, label: labels[status] }))} value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value as typeof value.status })} /><Input disabled={mutation.busy} label="Số tờ khai" value={value.declarationNumber ?? ""} onChange={(event) => setValue({ ...value, declarationNumber: event.target.value })} /><Input disabled={mutation.busy} label="Ngày khai" type="date" value={value.declarationDate ?? ""} onChange={(event) => setValue({ ...value, declarationDate: event.target.value })} /><Input disabled={mutation.busy} label="Ngày thông quan" type="date" value={value.clearanceDate ?? ""} onChange={(event) => setValue({ ...value, clearanceDate: event.target.value })} /></div>{value.status === "issue" ? <Textarea disabled={mutation.busy} label="Nội dung vướng mắc" required value={value.issueNote ?? ""} onChange={(event) => setValue({ ...value, issueNote: event.target.value })} /> : null}<Textarea disabled={mutation.busy} label="Ghi chú" rows={2} value={value.note ?? ""} onChange={(event) => setValue({ ...value, note: event.target.value })} /><Feedback {...mutation} /><Button busy={mutation.busy} disabled={draft.conflict} type="submit" variant="primary">Lưu thông quan</Button></form></EditSection> : null}
  </div>;
}

function ShipmentReceiving({ shipment, reload }: { shipment: Shipment; reload: Reload }) {
  const user = useCurrentUser();
  const router = useRouter();
  const state = useApi<ReceivingSummary>(`/api/v1/shipments/${shipment.id}/receiving`);
  const { reload: reloadReceiving } = state;
  const reconcileReceiving = useCallback(async () => { await Promise.all([reloadReceiving(), reload()]); }, [reloadReceiving, reload]);
  useDomainReconciliation("warehouse", reconcileReceiving);
  const refs = useApi<References>("/api/v1/import-export/references");
  const [warehouseId, setWarehouse] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const receiptRequest = useRef<{ signature: string; id: string } | undefined>(undefined);
  const mutation = useMutation();
  const canReceive = can(user.permissions, "shipment_receiving.create_receipt") && can(user.permissions, "warehouse.receipt.create") && !["planned", "cancelled", "completed"].includes(shipment.status);
  const selectedLines = (state.data?.lines ?? []).filter((line) => (amounts[line.shipmentLineId] ?? 0) > 0);
  const needsOverReceiptReason = selectedLines.some((line) => amounts[line.shipmentLineId] > line.remainingQuantity);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canReceive || !state.data || state.error || !warehouseId || !selectedLines.length || refs.loading || refs.error) return;
    const payload = { warehouseId, receivedDate, reason: needsOverReceiptReason ? reason : undefined, lines: selectedLines.map((line) => ({ shipmentLineId: line.shipmentLineId, quantity: amounts[line.shipmentLineId] })) };
    const signature = JSON.stringify(payload);
    if (receiptRequest.current?.signature !== signature) receiptRequest.current = { signature, id: crypto.randomUUID() };
    const clientRequestId = receiptRequest.current.id;
    await mutation.run(async () => {
      const receipt = await api<{ id: string }>(`/api/v1/shipments/${shipment.id}/create-warehouse-receipt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, clientRequestId }) });
      receiptRequest.current = undefined;
      setAmounts({}); setReason("");
      await state.reload(); await reload();
      router.push(`/warehouse/receipts/${receipt.id}`);
    });
  }
  if (state.loading) return <LoadingState title="Đang mở dữ liệu nhận hàng" />;
  if (!state.data) return <ErrorState description={state.error} action={<Button onClick={() => void state.reload()}>Thử lại</Button>} />;
  const summary = state.data;
  return <div className={styles.sectionStack}>
    <Card><Heading icon={<Package aria-hidden="true" size={19} />} title="Tiến độ nhận hàng" /><dl className={styles.receivingStats}>{[["Dự kiến", summary.expectedQuantity], ["Đã nhận", summary.receivedQuantity], ["Còn lại", summary.remainingQuantity]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{quantity.format(Number(value))}</dd></div>)}</dl><div className={styles.receivingProgress}><div aria-label="Tiến độ nhận hàng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progress} role="progressbar"><span style={{ width: `${Math.max(0, Math.min(100, summary.progress))}%` }} /></div><strong>{quantity.format(summary.progress)}%</strong></div></Card>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <form className={styles.receivingForm} onSubmit={create}>
      <div className={styles.dataSection}>
      <Heading icon={<Package aria-hidden="true" size={19} />} title={`Hàng nhận · ${summary.lines.length}`} action={canReceive && summary.remainingQuantity > 0 ? <Button disabled={mutation.busy} onClick={() => setAmounts(Object.fromEntries(summary.lines.map(line => [line.shipmentLineId, line.remainingQuantity])))} size="sm">Điền số còn lại</Button> : undefined} />
      <DataTable columns={[
        { id: "item", header: "Hàng hóa", priority: "primary", cell: (row) => <><strong>{row.itemName}</strong><small>{row.itemCode}</small></> },
        { id: "expected", header: "Dự kiến", cell: (row) => <>{quantity.format(row.expectedQuantity)}<small className={styles.unit}>{row.uomCode}</small></>, align: "right", hiddenOnMobile: true },
        { id: "received", header: "Đã nhận", cell: (row) => <>{quantity.format(row.receivedQuantity)}<small className={styles.unit}>{row.uomCode}</small></>, align: "right", hiddenOnMobile: true },
        { id: "remaining", header: "Còn lại", cell: (row) => <><strong>{quantity.format(row.remainingQuantity)}</strong><small className={styles.unit}>{row.uomCode}</small></>, align: "right" },
        ...(canReceive ? [{ id: "actual", header: "Nhận lần này", cell: (row: ReceivingSummary["lines"][number]) => <input aria-label={`Số lượng nhận ${row.itemCode}`} className="input" disabled={mutation.busy} inputMode="decimal" min="0" step="0.0001" type="number" value={amounts[row.shipmentLineId] ?? ""} onChange={(event) => setAmounts({ ...amounts, [row.shipmentLineId]: Number(event.target.value) })} /> }] : [])
      ]} data={summary.lines} emptyDescription="" emptyTitle="Chưa có dòng nhận" getRowId={(row) => row.shipmentLineId} />
      </div>
      {canReceive ? <Card><Heading icon={<Truck aria-hidden="true" size={19} />} title="Lập phiếu nhập" /><div className={styles.form}><div className="form-grid"><Select disabled={mutation.busy || refs.loading} label="Kho nhận" required options={(refs.data?.warehouses ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} placeholder="Chọn kho" value={warehouseId} onChange={(event) => setWarehouse(event.target.value)} /><Input disabled={mutation.busy} label="Ngày nhận hàng" onChange={(event) => setReceivedDate(event.target.value)} required type="date" value={receivedDate} /></div>{needsOverReceiptReason ? <Textarea disabled={mutation.busy} label="Lý do nhận vượt" required rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /> : null}{refs.error ? <p className="form-error" role="alert">{refs.error}</p> : !refs.loading && !refs.data?.warehouses.length ? <span className="form-error" role="status">Chưa được phân kho nhận hàng.</span> : null}<Feedback {...mutation} /><Button busy={mutation.busy} disabled={refs.loading || Boolean(refs.error) || Boolean(state.error) || !warehouseId || !selectedLines.length} type="submit" variant="primary">Lập phiếu nhập{selectedLines.length ? ` · ${selectedLines.length} dòng` : ""}</Button></div></Card> : null}
    </form>
    <Card><Heading icon={<FileText aria-hidden="true" size={19} />} title={`Phiếu nhập kho · ${summary.receipts.length}`} /><ul className={styles.checklist}>{summary.receipts.length ? summary.receipts.map((receipt) => <li key={receipt.id}><div><Link className="text-link" href={`/warehouse/receipts/${receipt.id}`}>{receipt.documentNumber}</Link><small>{date(receipt.documentDate)}{receipt.warehouseName ? ` · ${receipt.warehouseName}` : ""}</small></div>{badge(receipt.status)}</li>) : <li>Chưa có phiếu nhập kho</li>}</ul></Card>
  </div>;
}

function ShipmentHistory({ shipment, reload }: { shipment: Shipment; reload: Reload }) {
  const user = useCurrentUser();
  const [type, setType] = useState<"eta" | "etd">("eta");
  const [newValue, setNew] = useState("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("manual");
  const draft = useVersionedDraft({ rowVersion: shipment.rowVersion });
  const requestIdentity = useRef<{ signature: string; id: string } | undefined>(undefined);
  const mutation = useMutation();
  const sourceLabels: Record<string, string> = { manual: "Thủ công", forwarder: "Đơn vị giao nhận", carrier: "Hãng vận chuyển", supplier: "Nhà cung cấp" };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (draft.conflict) return;
    const payload = { newValue, reason: reason || undefined, source, rowVersion: draft.value.rowVersion };
    const signature = JSON.stringify({ type, ...payload });
    if (requestIdentity.current?.signature !== signature) requestIdentity.current = { signature, id: crypto.randomUUID() };
    const clientRequestId = requestIdentity.current.id;
    if (await mutation.run(async () => { await api(`/api/v1/shipments/${shipment.id}/update-${type}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, clientRequestId }) }); await reload(); })) { setNew(""); setReason(""); draft.reset(); requestIdentity.current = undefined; }
  }
  return <div className={styles.sectionStack}>
    <Card><Heading icon={<History aria-hidden="true" size={19} />} title="Lịch sử ETD / ETA" />{shipment.scheduleHistory.length ? <ol className={styles.timeline}>{shipment.scheduleHistory.map((event) => <li key={event.id}><span className={styles.timelineMarker}><CalendarClock aria-hidden="true" size={17} /></span><div><header><strong>{event.scheduleType.toUpperCase()}</strong><time dateTime={event.changedAt}>{stamp(event.changedAt)}</time></header><div className={styles.changedDates}><span>{date(event.oldValue)}</span><ArrowRight aria-hidden="true" size={16} /><strong>{date(event.newValue)}</strong></div><span className={styles.eventMeta}>{[event.changedByName, sourceLabels[event.source] ?? event.source].filter(Boolean).join(" · ")}</span>{event.reason ? <p>{event.reason}</p> : null}</div></li>)}</ol> : <div className={styles.smallEmpty}><History aria-hidden="true" size={24} /><span>Chưa có thay đổi lịch trình</span></div>}</Card>
    {can(user.permissions, "shipment.update_schedule") ? <EditSection label="Cập nhật lịch trình" icon={<CalendarClock aria-hidden="true" size={18} />}><form className={styles.form} onSubmit={save}>{draft.conflict ? <DraftConflict reset={() => { draft.reset(); setNew(""); setReason(""); requestIdentity.current = undefined; }} /> : null}<div className="form-grid"><Select disabled={mutation.busy} label="Mốc thời gian" options={[{ value: "eta", label: "ETA · Dự kiến đến" }, { value: "etd", label: "ETD · Dự kiến khởi hành" }]} value={type} onChange={(event) => { draft.change(draft.value); setType(event.target.value as "eta" | "etd"); }} /><Input disabled={mutation.busy} label={type === "eta" ? "ETA mới" : "ETD mới"} required type="date" value={newValue} onChange={(event) => { draft.change(draft.value); setNew(event.target.value); }} /><Select disabled={mutation.busy} label="Nguồn cập nhật" options={Object.entries(sourceLabels).map(([value, label]) => ({ value, label }))} value={source} onChange={(event) => { draft.change(draft.value); setSource(event.target.value); }} /><Input disabled={mutation.busy} label="Lý do" value={reason} onChange={(event) => { draft.change(draft.value); setReason(event.target.value); }} /></div><Feedback {...mutation} /><Button busy={mutation.busy} disabled={draft.conflict} type="submit" variant="primary">Cập nhật lịch trình</Button></form></EditSection> : null}
  </div>;
}

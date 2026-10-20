"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { warehouseRequest as api, warehouseWrite as write } from "../client/warehouseClient";
import type { InventoryBalance, Warehouse } from "../types/warehouseTypes";
import styles from "./WarehouseUi.module.css";

type References = { projects: Array<{ id: string; code: string; name: string }>; worksites: Array<{ id: string; projectId: string; name: string }>; employees: Array<{ id: string; label: string }> };
export function WarehouseEditor({ id, canEdit = true, canViewLedger = false, canViewProjects = false }: { id?: string; canEdit?: boolean; canViewLedger?: boolean; canViewProjects?: boolean }) {
  const router = useRouter(), pending = useRef(false);
  const [item, setItem] = useState<Partial<Warehouse>>({ type: "main", status: "active" }), [refs, setRefs] = useState<References>({ projects: [], worksites: [], employees: [] }), [inventory, setInventory] = useState<InventoryBalance[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [current, reference, balances] = await Promise.all([id ? api<Warehouse>(`/api/v1/warehouses/${id}`) : Promise.resolve(undefined), api<References>("/api/v1/warehouse/references"), id ? api<InventoryBalance[]>(`/api/v1/warehouse/inventory?warehouseId=${id}`) : Promise.resolve([])]);
      if (current) setItem(current); setRefs(reference); setInventory(balances);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể mở kho."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!canEdit || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const saved = await write<Warehouse>(`/api/v1/warehouses${id ? `/${id}` : ""}`, id ? "PATCH" : "POST", { code: item.code, name: item.name, type: item.type, address: item.address || undefined, managerEmployeeId: item.managerEmployeeId || undefined, projectId: item.projectId || undefined, worksiteId: item.worksiteId || undefined, status: item.status, note: item.note || undefined, ...(id ? { rowVersion: item.rowVersion } : {}) });
      setItem(saved); router.replace(`/warehouse/warehouses/${saved.id}`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu kho."); }
    finally { pending.current = false; setBusy(false); }
  }
  if (loading) return <LoadingState title="Đang mở thông tin kho" />;
  if (error && !item.id && id) return <div className={styles.formCard}><p className="form-error" role="alert">{error}</p><Button onClick={() => void load()}>Tải lại</Button></div>;
  const projects = refs.projects.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` })), worksites = refs.worksites.filter(row => row.projectId === item.projectId).map(row => ({ value: row.id, label: row.name })), managers = refs.employees.map(row => ({ value: row.id, label: row.label }));
  if (item.projectId && !projects.some(row => row.value === item.projectId)) projects.push({ value: item.projectId, label: item.projectName ?? "Dự án đã lưu" });
  if (item.worksiteId && !worksites.some(row => row.value === item.worksiteId)) worksites.push({ value: item.worksiteId, label: item.worksiteName ?? "Công trường đã lưu" });
  if (item.managerEmployeeId && !managers.some(row => row.value === item.managerEmployeeId)) managers.push({ value: item.managerEmployeeId, label: item.managerName ?? "Người quản lý đã lưu" });
  const change = (patch: Partial<Warehouse>) => setItem(current => ({ ...current, ...patch }));
  return <div className="page-stack">{id ? <div className={styles.summaryGrid}><Link className={styles.summaryCard} href={`/warehouse/inventory?warehouseId=${id}`}><span>Mặt hàng <Boxes size={18} /></span><strong>{inventory.length}</strong></Link><div className={styles.summaryCard} data-tone="warning"><span>Sắp hết</span><strong>{inventory.filter(row => row.status === "low_stock").length}</strong></div><div className={styles.summaryCard} data-tone="danger"><span>Hết hàng</span><strong>{inventory.filter(row => row.status === "out_of_stock").length}</strong></div><div className={styles.summaryCard}><span>Trạng thái</span><StatusBadge tone={item.status === "active" ? "success" : "neutral"}>{item.status === "active" ? "Hoạt động" : "Ngừng sử dụng"}</StatusBadge></div></div> : null}
    <form className="warehouse-form page-stack" onSubmit={submit}><Card className={styles.formCard}><fieldset className={styles.editorFields} disabled={!canEdit || busy}><div className="form-grid"><Input label="Mã kho" onChange={event => change({ code: event.target.value })} required value={item.code ?? ""} /><Input label="Tên kho" onChange={event => change({ name: event.target.value })} required value={item.name ?? ""} /><Select label="Loại kho" onChange={event => change({ type: event.target.value as Warehouse["type"] })} options={[{ value: "main", label: "Kho chính" }, { value: "worksite", label: "Kho công trường" }, { value: "temporary", label: "Kho tạm" }, { value: "bonded", label: "Kho ngoại quan" }]} value={item.type ?? "main"} /><Select label="Trạng thái" onChange={event => change({ status: event.target.value as Warehouse["status"] })} options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Ngừng sử dụng" }]} value={item.status ?? "active"} /><Select label="Dự án" onChange={event => change({ projectId: event.target.value, worksiteId: undefined })} options={projects} placeholder="Chọn dự án" required={item.type === "worksite"} value={item.projectId ?? ""} /><Select disabled={!item.projectId} label="Công trường" onChange={event => change({ worksiteId: event.target.value })} options={worksites} placeholder="Chọn công trường" value={item.worksiteId ?? ""} /><Select label="Người quản lý" onChange={event => change({ managerEmployeeId: event.target.value })} options={managers} placeholder="Chưa phân công" value={item.managerEmployeeId ?? ""} /><Input label="Địa chỉ kho" onChange={event => change({ address: event.target.value })} value={item.address ?? ""} /></div><Textarea label="Ghi chú" onChange={event => change({ note: event.target.value })} rows={3} value={item.note ?? ""} /></fieldset></Card>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className={styles.actionLinks}>{id ? <Link className="button button--secondary button--md" href={`/warehouse/inventory?warehouseId=${id}`}>Tồn kho <ArrowUpRight size={17} /></Link> : <Button disabled={busy} onClick={() => router.back()}>Quay lại</Button>}{id && canViewLedger ? <Link className="button button--secondary button--md" href={`/warehouse/ledger?warehouseId=${id}`}>Sổ kho</Link> : null}{item.projectId && canViewProjects ? <Link className="button button--secondary button--md" href={`/projects/${item.projectId}/materials`}>Vật tư công trường</Link> : null}{canEdit ? <Button busy={busy} disabled={busy} leftIcon={<Save size={17} />} type="submit" variant="primary">Lưu kho</Button> : null}</div></form>
  </div>;
}

"use client";

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { Checkbox, Input, Switch } from "@/components/shared/FormControls";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import type { WorkerChecklistConfigItem } from "@/features/worker-attendance/services/workerChecklistService";

type ApiBody<T> = { ok: boolean; data?: T; error?: { message?: string } };

async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", body?: object): Promise<T> {
  const response = await fetch("/api/v1/worker-attendance/checklist", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json() as ApiBody<T>;
  if (!response.ok || !result.ok || result.data === undefined) throw new Error(result.error?.message ?? "Không thể cập nhật checklist.");
  return result.data;
}

export function WorkerChecklistPage() {
  const [items, setItems] = useState<WorkerChecklistConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await api<WorkerChecklistConfigItem[]>("GET")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải checklist."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void api<WorkerChecklistConfigItem[]>("GET")
      .then((data) => { if (active) setItems(data); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Không thể tải checklist."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function change(id: string, patch: Partial<WorkerChecklistConfigItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function save(item: WorkerChecklistConfigItem) {
    setBusyId(item.id);
    setError("");
    try {
      const saved = await api<WorkerChecklistConfigItem>("PATCH", item);
      change(item.id, saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu checklist.");
    } finally { setBusyId(""); }
  }

  async function move(index: number, direction: -1 | 1) {
    const other = items[index + direction];
    const item = items[index];
    if (!other || !item) return;
    setBusyId(item.id);
    setError("");
    try {
      const [first, second] = await Promise.all([
        api<WorkerChecklistConfigItem>("PATCH", { ...item, sortOrder: other.sortOrder }),
        api<WorkerChecklistConfigItem>("PATCH", { ...other, sortOrder: item.sortOrder })
      ]);
      setItems((current) => current
        .map((value) => value.id === first.id ? first : value.id === second.id ? second : value)
        .sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đổi thứ tự.");
      await load();
    } finally { setBusyId(""); }
  }

  async function remove(item: WorkerChecklistConfigItem) {
    if (!window.confirm(`Xóa mục “${item.content}”?`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await api<{ id: string }>("DELETE", { id: item.id });
      setItems((current) => current.filter((value) => value.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa checklist.");
    } finally { setBusyId(""); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusyId("new");
    setError("");
    try {
      const created = await api<WorkerChecklistConfigItem>("POST", {
        group: String(form.get("group") ?? "").trim(),
        content: String(form.get("content") ?? "").trim(),
        required: form.get("required") === "on",
        active: true,
        sortOrder: (items.at(-1)?.sortOrder ?? 0) + 10
      });
      setItems((current) => [...current, created]);
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thêm checklist.");
    } finally { setBusyId(""); }
  }

  return (
    <AdminPage title="Checklist điểm danh">
      <section className="settings-form-card">
        <form className="form-grid" onSubmit={create}>
          <Input label="Nhóm" name="group" required />
          <Input label="Nội dung" name="content" required />
          <Checkbox defaultChecked label="Bắt buộc" name="required" />
          <Button disabled={busyId === "new"} leftIcon={<Plus size={16} />} type="submit" variant="primary">Thêm mục</Button>
        </form>
        {loading ? <LoadingState /> : items.length ? (
          <div className="navigation-editor worker-checklist-editor">
            {items.map((item, index) => (
              <div className="navigation-editor__row" key={item.id}>
                <div className="navigation-editor__move">
                  <IconButton disabled={index === 0 || Boolean(busyId)} label="Di chuyển lên" onClick={() => void move(index, -1)}><ArrowUp size={16} /></IconButton>
                  <IconButton disabled={index === items.length - 1 || Boolean(busyId)} label="Di chuyển xuống" onClick={() => void move(index, 1)}><ArrowDown size={16} /></IconButton>
                </div>
                <Input label="Nhóm checklist" labelHidden onChange={(event) => change(item.id, { group: event.target.value })} value={item.group} />
                <Input label="Nội dung checklist" labelHidden onChange={(event) => change(item.id, { content: event.target.value })} value={item.content} />
                <Checkbox checked={item.required} label="Bắt buộc" onChange={(event) => change(item.id, { required: event.target.checked })} />
                <Switch checked={item.active} label={item.active ? "Đang bật" : "Đang tắt"} onCheckedChange={(active) => { const next = { ...item, active }; change(item.id, { active }); void save(next); }} />
                <IconButton disabled={busyId === item.id} label="Lưu" onClick={() => void save(item)}><Save size={16} /></IconButton>
                <IconButton disabled={busyId === item.id} label="Xóa" onClick={() => void remove(item)}><Trash2 size={16} /></IconButton>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Chưa có mục checklist" />}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
    </AdminPage>
  );
}

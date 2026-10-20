"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ListTodo, Pencil, Plus, Save, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { useIsPhone } from "@/lib/ui/useIsPhone";

type PersonalTodo = { id: string; title: string; dueDate?: string; priority: "low" | "medium" | "high"; completed: boolean };

function PersonalNoteWidget() {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/v1/workspace/note", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error?.message);
          setNote(body.data.content ?? "");
        })
        .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Không thể tải ghi chú."); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  async function saveNote() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/v1/workspace/note", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu ghi chú."); }
    finally { setSaving(false); }
  }

  return (
    <section className="dashboard-note" data-editor-open={editorOpen}>
      <header><span><StickyNote aria-hidden="true" size={17} /><h2>Ghi chú nhanh</h2></span><div className="dashboard-note__actions"><Button className="dashboard-note__save" disabled={saved || saving} leftIcon={<Save aria-hidden="true" size={15} />} onClick={() => void saveNote()} size="sm" variant="ghost" busy={saving}>{"Lưu"}</Button><Button aria-expanded={editorOpen} className="workspace-mobile-toggle" leftIcon={editorOpen ? <X aria-hidden="true" size={16} /> : <Pencil aria-hidden="true" size={16} />} onClick={() => setEditorOpen((current) => !current)} size="sm" variant="ghost">{editorOpen ? "Đóng" : "Sửa"}</Button></div></header>
      <p className="dashboard-note__preview">{note || "Chưa có ghi chú"}</p>
      <div className="dashboard-note__editor"><Textarea label="Ghi chú cá nhân" onChange={(event) => { setNote(event.target.value); setSaved(false); }} value={note} /></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}

function PersonalTodoWidget() {
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const loadTodos = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/workspace/todos", { cache: "no-store", signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message);
    setTodos(body.data ?? []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTodos(controller.signal).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Không thể tải việc cá nhân.");
    }), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadTodos]);

  async function createTodo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget, form = new FormData(formElement);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/workspace/todos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), dueDate: form.get("dueDate") || undefined, priority: form.get("priority") || "medium" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setTodos((current) => [body.data, ...current]);
      formElement.reset();
      setComposerOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo việc cá nhân."); }
    finally { setBusy(false); }
  }

  async function patchTodo(todo: PersonalTodo, patch: Partial<Pick<PersonalTodo, "completed" | "title" | "dueDate" | "priority">>) {
    setBusy(true); setError("");
    try {
    const response = await fetch(`/api/v1/workspace/todos/${todo.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    const body = await response.json();
    if (!response.ok) { setError(body.error?.message ?? "Không thể cập nhật việc cá nhân."); return; }
    setTodos((current) => current.map((item) => item.id === todo.id ? body.data : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật việc cá nhân."); }
    finally { setBusy(false); }
  }

  async function removeTodo(todo: PersonalTodo) {
    setBusy(true); setError("");
    try {
    const response = await fetch(`/api/v1/workspace/todos/${todo.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { setError(body.error?.message ?? "Không thể xóa việc cá nhân."); return; }
    setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xóa việc cá nhân."); }
    finally { setBusy(false); }
  }

  return (
    <section className="dashboard-personal-todos"><header><span><ListTodo aria-hidden="true" className="workspace-mobile-icon" size={18} /><h2>Việc cá nhân</h2><span className="dashboard-personal-todos__count">{todos.filter((todo) => !todo.completed).length}</span></span><Button aria-expanded={composerOpen} className="workspace-mobile-toggle" leftIcon={composerOpen ? <X aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />} onClick={() => setComposerOpen((current) => !current)} size="sm" variant="ghost">{composerOpen ? "Đóng" : "Thêm"}</Button></header>
      <form className="dashboard-personal-todos__form" data-open={composerOpen} onSubmit={createTodo}>
        <Input label="Tên việc" maxLength={240} name="title" required />
        <Input label="Hạn hoàn thành" name="dueDate" type="date" />
        <Select defaultValue="medium" label="Mức ưu tiên" name="priority" options={[{ value: "low", label: "Thấp" }, { value: "medium", label: "Vừa" }, { value: "high", label: "Cao" }]} />
        <Button aria-label="Thêm việc" disabled={busy} size="sm" type="submit" variant="soft"><Plus size={15} /></Button>
      </form>
      <ul className="dashboard-personal-todos__list">
        {todos.slice(0, 8).map((todo) => <li className={todo.completed ? "is-complete" : ""} key={todo.id}><input aria-label={todo.completed ? "Mở lại việc" : "Hoàn thành việc"} checked={todo.completed} disabled={busy} onChange={() => void patchTodo(todo, { completed: !todo.completed })} type="checkbox" /><span><strong>{todo.title}</strong><small>{todo.dueDate ?? "Không có hạn"} · {todo.priority === "high" ? "Cao" : todo.priority === "low" ? "Thấp" : "Vừa"}</small></span><button aria-label="Xóa việc" disabled={busy} onClick={() => void removeTodo(todo)} type="button"><Trash2 size={15} /></button></li>)}
        {!todos.length ? <li className="dashboard-personal-todos__empty">Chưa có việc cá nhân.</li> : null}
      </ul>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}


export function PersonalWorkspaceCards() {
  const mobile = useIsPhone();
  return <details className="personal-workspace-tools" open={!mobile}>
    <summary><StickyNote aria-hidden="true" size={18} /><span>Ghi chú & Việc cá nhân</span><ChevronDown aria-hidden="true" size={17} /></summary>
    <div className="personal-workspace-cards"><PersonalTodoWidget /><PersonalNoteWidget /></div>
  </details>;
}

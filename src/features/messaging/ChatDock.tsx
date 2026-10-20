"use client";

/* eslint-disable react-hooks/set-state-in-effect -- chat state is reconciled with the API and realtime feed. */
import { ArrowLeft, ChevronDown, ExternalLink, LoaderCircle, MessageCircle, Search, Send, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { getAuthenticatedSupabaseRealtimeClient } from "@/lib/supabase/client";
import { ChatTranscript } from "./ChatTranscript";
import type { ChatMessage, ConversationSummary } from "./types";
import styles from "./ChatDock.module.css";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toLocaleUpperCase("vi-VN") || "CT";
}

function lastActivity(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  return new Intl.DateTimeFormat("vi-VN", day.format(date) === day.format(new Date())
    ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }
    : { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

export function ChatDock({ initiallyOpen = false }: { initiallyOpen?: boolean } = {}) {
  const bottom = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const activeConversation = useRef<string | undefined>(undefined);
  const drafts = useRef(new Map<string, { body: string; file?: File }>());
  const [open, setOpen] = useState(initiallyOpen);
  const [minimized, setMinimized] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selfId, setSelfId] = useState("");
  const [search, setSearch] = useState("");
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const [attachmentError, setAttachmentError] = useState("");
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const active = conversations.find((item) => item.id === activeId);
  const visibleConversations = conversations.filter((item) => item.title.toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")));

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/v1/chat/conversations", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải hội thoại.");
    setConversations(body.data ?? []);
  }, []);
  const loadMessages = useCallback(async () => {
    if (!activeId) return;
    const response = await fetch(`/api/v1/chat/conversations/${activeId}/messages`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải tin nhắn.");
    if (activeConversation.current !== activeId) return;
    setMessages(body.data.items ?? []);
    setSelfId(body.data.selfAccountId ?? "");
    await fetch(`/api/v1/chat/conversations/${activeId}/read`, { method: "POST" });
    await loadConversations();
  }, [activeId, loadConversations]);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setLoading(true);
    setError("");
    const load = activeId ? loadMessages() : loadConversations();
    void load.catch((reason: unknown) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : "Không thể tải tin nhắn.");
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [activeId, loadConversations, loadMessages, open]);
  useEffect(() => {
    if (open && !minimized && !loading && activeId) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [activeId, loading, messages, minimized, open]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dockRef.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let cleanup = () => {};
    void getAuthenticatedSupabaseRealtimeClient().then((client) => {
      if (!client || disposed) return;
      const refresh = () => {
        const load = activeId ? loadMessages() : loadConversations();
        void load.catch((reason: unknown) => { if (!disposed) setError(reason instanceof Error ? reason.message : "Không thể cập nhật tin nhắn."); });
      };
      const channel = client.channel("global-chat-dock").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        if (activeId && (payload.new as { conversation_id?: string }).conversation_id === activeId) refresh();
        else void loadConversations().catch(() => undefined);
      }).subscribe();
      cleanup = () => { void client.removeChannel(channel); };
      if (disposed) cleanup();
    }).catch(() => undefined);
    return () => { disposed = true; cleanup(); };
  }, [activeId, loadConversations, loadMessages, open]);

  function selectConversation(id?: string) {
    if (sending) return;
    if (activeId) drafts.current.set(activeId, { body: draftText, file: attachmentFile });
    const draft = id ? drafts.current.get(id) : undefined;
    activeConversation.current = id;
    setActiveId(id);
    setMessages([]);
    setSelfId("");
    setDraftText(draft?.body ?? "");
    setAttachmentFile(draft?.file);
    setAttachmentError("");
    setError("");
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || sending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const bodyText = String(form.get("body") ?? "").trim();
    if (!bodyText) return;
    setSending(true);
    setError("");
    setAttachmentError("");
    try {
      const payload = new FormData();
      payload.set("body", bodyText);
      if (attachmentFile) payload.set("file", attachmentFile);
      const response = await fetch(`/api/v1/chat/conversations/${activeId}/messages`, { method: "POST", body: payload });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      formElement.reset();
      drafts.current.delete(activeId);
      setDraftText("");
      setAttachmentFile(undefined);
      await loadMessages();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể gửi tin nhắn.";
      setError(message);
      if (attachmentFile) setAttachmentError(message);
    } finally {
      setSending(false);
    }
  }

  if (!open) return <button aria-label={unread ? `Mở tin nhắn, ${unread} tin chưa đọc` : "Mở tin nhắn"} className={`chat-dock-launcher ${styles.launcher}`} onClick={() => { setOpen(true); setMinimized(false); }} type="button"><MessageCircle aria-hidden="true" size={22} />{unread ? <span>{unread > 99 ? "99+" : unread}</span> : null}</button>;

  return (
    <aside aria-label="Tin nhắn nội bộ" className={`chat-dock ${styles.dock}${minimized ? ` is-minimized ${styles.minimized}` : ""}`} ref={dockRef}>
      <header className={styles.header}>
        {activeId && !minimized ? <IconButton className={styles.iconControl} disabled={sending} label="Danh sách hội thoại" onClick={() => selectConversation()}><ArrowLeft size={19} /></IconButton> : null}
        <button className={styles.identity} onClick={() => setMinimized(false)} type="button">
          <span aria-hidden="true" className={`${styles.avatar} ${active?.type === "group" ? styles.groupAvatar : ""}`}>{active ? active.type === "group" ? <Users size={19} /> : initials(active.title) : <MessageCircle size={21} />}</span>
          <span className={styles.heading}><strong>{active?.title ?? "Tin nhắn"}</strong><small>{active ? active.type === "group" ? `${active.members.length} thành viên` : "Hội thoại riêng" : unread ? `${unread} tin chưa đọc` : "Hộp thư nội bộ"}</small></span>
        </button>
        <Link aria-label="Mở trang tin nhắn" className={styles.iconControl} href={activeId ? `/messages/${activeId}` : "/messages"} onClick={() => setOpen(false)} title="Mở trang tin nhắn"><ExternalLink aria-hidden="true" size={17} /></Link>
        <IconButton aria-expanded={!minimized} className={`${styles.iconControl} ${minimized ? styles.expandControl : ""}`} label={minimized ? "Mở rộng" : "Thu nhỏ"} onClick={() => setMinimized((value) => !value)}><ChevronDown size={19} /></IconButton>
        <IconButton className={styles.iconControl} label="Đóng tin nhắn" onClick={() => setOpen(false)}><X size={18} /></IconButton>
      </header>
      {!minimized ? <>
        {activeId ? <>
          {loading && messages.length === 0 ? <div aria-live="polite" className={styles.loading}><LoaderCircle aria-hidden="true" size={23} /><span>Đang tải tin nhắn…</span></div> : <ChatTranscript bottomRef={bottom} className={styles.transcript} compact conversationId={activeId} messages={messages} selfId={selfId} />}
          <form className={styles.composer} onSubmit={send} ref={composer}>
            <ImageUploader accept="image/jpeg,image/png,image/webp,application/pdf" className={styles.uploader} compact disabled={sending} error={attachmentError} file={attachmentFile} label="Đính kèm tệp" onFileChange={(file) => { setAttachmentFile(file); setAttachmentError(""); }} onRetry={() => composer.current?.requestSubmit()} uploading={sending && Boolean(attachmentFile)} />
            <input aria-label="Tin nhắn" autoComplete="off" className={styles.messageInput} disabled={sending} name="body" onChange={(event) => setDraftText(event.target.value)} placeholder="Nhập tin nhắn…" required value={draftText} />
            <Button aria-label={sending ? "Đang gửi tin nhắn" : "Gửi tin nhắn"} busy={sending} className={styles.sendButton} size="sm" type="submit" variant="primary">{sending ? <LoaderCircle aria-hidden="true" size={18} /> : <Send aria-hidden="true" size={18} />}</Button>
          </form>
        </> : <>
          <div className={styles.search}><Search aria-hidden="true" size={17} /><input aria-label="Tìm hội thoại" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm hội thoại" value={search} />{search ? <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")} type="button"><X aria-hidden="true" size={15} /></button> : null}</div>
          <div aria-busy={loading} className={styles.conversations}>
            {loading && conversations.length === 0 ? <div className={styles.loading}><LoaderCircle aria-hidden="true" size={23} /><span>Đang tải hội thoại…</span></div> : visibleConversations.map((item) => <button className={`${styles.conversation} ${item.unreadCount ? styles.unreadConversation : ""}`} key={item.id} onClick={() => selectConversation(item.id)} type="button">
              <span aria-hidden="true" className={`${styles.avatar} ${item.type === "group" ? styles.groupAvatar : ""}`}>{item.type === "group" ? <Users size={20} /> : initials(item.title)}</span>
              <span className={styles.conversationBody}><span className={styles.conversationTop}><strong>{item.title}</strong><time dateTime={item.lastMessage?.createdAt ?? item.updatedAt}>{lastActivity(item.lastMessage?.createdAt ?? item.updatedAt)}</time></span><span className={styles.conversationBottom}><small>{item.lastMessage?.body ?? "Chưa có tin nhắn"}</small>{item.unreadCount ? <b aria-label={`${item.unreadCount} tin chưa đọc`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</b> : null}</span></span>
            </button>)}
            {!loading && visibleConversations.length === 0 ? <div className={styles.empty}><MessageCircle aria-hidden="true" size={30} /><strong>{search ? "Không có hội thoại phù hợp" : "Chưa có hội thoại"}</strong><Link href="/messages" onClick={() => setOpen(false)}>Mở trang tin nhắn</Link></div> : null}
          </div>
        </>}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </> : null}
    </aside>
  );
}

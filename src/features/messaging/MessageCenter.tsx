"use client";

/* eslint-disable react-hooks/set-state-in-effect -- conversation state is reconciled asynchronously. */
import { ArrowLeft, Check, ChevronUp, LoaderCircle, MessageCircle, MessageSquarePlus, Search, Send, UserRound, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, IconButton } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Drawer } from "@/components/shared/Overlays";
import { getAuthenticatedSupabaseRealtimeClient } from "@/lib/supabase/client";
import { ChatTranscript } from "./ChatTranscript";
import type { ChatMessage, ConversationSummary } from "./types";
import styles from "./MessageCenter.module.css";

type Account = { id: string; name: string; employeeCode?: string; department?: string; roleLabel?: string };
const previewTime = (value: string) => {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
  return day.format(date) === day.format(new Date())
    ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
    : new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(date);
};
const initials = (value: string) => value.trim().split(/\s+/).slice(-2).map((word) => word[0] ?? "").join("").toLocaleUpperCase("vi-VN");
const errorMessage = (reason: unknown, fallback: string) => reason instanceof Error && reason.message ? reason.message : fallback;

export function MessageCenter({ activeId, canCreateGroup }: { activeId?: string; canCreateGroup: boolean }) {
  const router = useRouter();
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const draft = useRef<HTMLTextAreaElement>(null);
  const messageRequest = useRef(0);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selfId, setSelfId] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [group, setGroup] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [directAccountId, setDirectAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(Boolean(activeId));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [conversationSearch, setConversationSearch] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const [attachmentError, setAttachmentError] = useState("");
  const invalidateMessageRequest = useCallback(() => { ++messageRequest.current; }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/v1/chat/conversations", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Không thể tải hội thoại.");
    setConversations(body.data ?? []);
  }, []);

  const loadMessages = useCallback(async () => {
    const request = ++messageRequest.current;
    if (!activeId) {
      setMessages([]);
      setNextCursor(undefined);
      return;
    }
    const response = await fetch(`/api/v1/chat/conversations/${activeId}/messages`, { cache: "no-store" });
    const body = await response.json();
    if (request !== messageRequest.current) return;
    if (!response.ok) throw new Error(body.error?.message || "Không thể tải tin nhắn.");
    setMessages(body.data.items ?? []);
    setNextCursor(body.data.nextCursor);
    setSelfId(body.data.selfAccountId ?? "");
    await fetch(`/api/v1/chat/conversations/${activeId}/read`, { method: "POST" });
    await loadConversations();
    if (request === messageRequest.current) requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "nearest" }));
  }, [activeId, loadConversations]);

  async function loadOlderMessages() {
    if (!activeId || !nextCursor || loadingOlder) return;
    const request = messageRequest.current;
    const scroller = bottom.current?.parentElement;
    const previousHeight = scroller?.scrollHeight ?? 0;
    const previousTop = scroller?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const response = await fetch(`/api/v1/chat/conversations/${activeId}/messages?cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store" });
      const body = await response.json();
      if (request !== messageRequest.current) return;
      if (!response.ok) throw new Error(body.error?.message || "Không thể tải tin cũ.");
      setMessages((current) => [...body.data.items, ...current]);
      setNextCursor(body.data.nextCursor);
      requestAnimationFrame(() => { if (scroller) scroller.scrollTop = previousTop + scroller.scrollHeight - previousHeight; });
    } catch (reason) {
      setError(errorMessage(reason, "Không thể tải tin cũ."));
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    void loadConversations().catch((reason) => setError(errorMessage(reason, "Không thể tải hội thoại."))).finally(() => setConversationsLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!showCreate) return;
    const controller = new AbortController();
    setAccountsLoading(true);
    setCreateError("");
    void fetch("/api/v1/chat/accounts", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Không thể tải tài khoản.");
      if (!controller.signal.aborted) setAccounts(body.data ?? []);
    }).catch((reason) => { if (!controller.signal.aborted) setCreateError(errorMessage(reason, "Không thể tải tài khoản.")); })
      .finally(() => { if (!controller.signal.aborted) setAccountsLoading(false); });
    return () => controller.abort();
  }, [showCreate]);

  useEffect(() => {
    let disposed = false;
    setMessages([]);
    setNextCursor(undefined);
    setMessagesLoading(Boolean(activeId));
    setError("");
    setAttachmentFile(undefined);
    setAttachmentError("");
    composer.current?.reset();
    if (draft.current) draft.current.style.height = "";
    void loadMessages().catch((reason) => { if (!disposed) setError(errorMessage(reason, "Không thể tải tin nhắn.")); })
      .finally(() => { if (!disposed) setMessagesLoading(false); });
    return () => { disposed = true; invalidateMessageRequest(); };
  }, [activeId, invalidateMessageRequest, loadMessages]);

  useEffect(() => {
    if (!activeId) return;
    let disposed = false;
    let cleanup = () => {};
    const refresh = () => void loadMessages().catch((reason) => { if (!disposed) setError(errorMessage(reason, "Không thể cập nhật tin nhắn.")); });
    void getAuthenticatedSupabaseRealtimeClient().then((client) => {
      if (!client || disposed) return;
      const channel = client.channel(`conversation-${activeId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, refresh)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_attachments", filter: `conversation_id=eq.${activeId}` }, refresh)
        .subscribe();
      cleanup = () => { void client.removeChannel(channel); };
      if (disposed) cleanup();
    }).catch(() => undefined);
    return () => { disposed = true; cleanup(); };
  }, [activeId, loadMessages]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const element = center.current;
      if (!element || !window.matchMedia("(max-width: 767px)").matches) return;
      const top = element.getBoundingClientRect().top;
      element.style.setProperty("--chat-mobile-height", `${Math.max(180, (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0) - top - 12)}px`);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [activeId]);

  function openCreate() {
    setCreateError("");
    setAccountSearch("");
    setDirectAccountId("");
    setGroupMembers([]);
    setShowCreate(true);
  }

  function toggleGroupMember(accountId: string) {
    setGroupMembers((current) => current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const form = new FormData(event.currentTarget);
    const payload = group
      ? { type: "group", title: String(form.get("title") ?? ""), accountIds: groupMembers }
      : { type: "direct", accountId: String(form.get("accountId") ?? "") };
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/v1/chat/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Không thể tạo hội thoại.");
      setShowCreate(false);
      setGroupMembers([]);
      await loadConversations();
      router.push(`/messages/${body.data.id}`);
    } catch (reason) {
      setCreateError(errorMessage(reason, "Không thể tạo hội thoại."));
    } finally {
      setCreating(false);
    }
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
      if (!response.ok) throw new Error(body.error?.message || "Không thể gửi tin nhắn.");
      formElement.reset();
      if (draft.current) draft.current.style.height = "";
      setAttachmentFile(undefined);
      await loadMessages();
      draft.current?.focus({ preventScroll: true });
    } catch (reason) {
      const message = errorMessage(reason, "Không thể gửi tin nhắn.");
      setError(message);
      if (attachmentFile) setAttachmentError(message);
    } finally {
      setSending(false);
    }
  }

  const activeConversation = conversations.find((item) => item.id === activeId);
  const visibleConversations = conversations.filter((item) => item.title.toLocaleLowerCase("vi").includes(conversationSearch.trim().toLocaleLowerCase("vi")));
  const visibleAccounts = accounts.filter((item) => [item.name, item.employeeCode, item.department, item.roleLabel].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(accountSearch.trim().toLocaleLowerCase("vi")));
  const unread = conversations.reduce((total, item) => total + item.unreadCount, 0);

  return (
    <>
      <div className={`message-center ${styles.center}`} data-view={activeId ? "thread" : "list"} ref={center}>
        <aside aria-label="Cuộc trò chuyện" className={`message-sidebar ${styles.sidebar}`}>
          <header className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}><h1>Tin nhắn</h1>{unread > 0 ? <span aria-label={`${unread} tin chưa đọc`}>{unread > 99 ? "99+" : unread}</span> : null}</div>
            <IconButton className={styles.newButton} label="Tạo hội thoại" onClick={openCreate}><MessageSquarePlus aria-hidden="true" size={20} /></IconButton>
          </header>
          <label className={styles.search}><Search aria-hidden="true" size={18} /><input aria-label="Tìm hội thoại" onChange={(event) => setConversationSearch(event.target.value)} placeholder="Tìm cuộc trò chuyện" type="search" value={conversationSearch} />{conversationSearch ? <button aria-label="Xóa tìm kiếm" onClick={() => setConversationSearch("")} type="button"><X aria-hidden="true" size={16} /></button> : null}</label>
          <div className={styles.listHeading}><span>Cuộc trò chuyện</span><span>{conversations.length}</span></div>
          <nav aria-label="Danh sách hội thoại" className={styles.conversations}>
            {conversationsLoading ? <div className={styles.loading} role="status"><LoaderCircle aria-hidden="true" className={styles.spinner} size={22} /><span>Đang tải</span></div> : null}
            {visibleConversations.map((item) => <button aria-current={item.id === activeId ? "page" : undefined} className={styles.conversation} data-unread={item.unreadCount > 0 || undefined} key={item.id} onClick={() => router.push(`/messages/${item.id}`)} type="button">
              <span aria-hidden="true" className={styles.avatar} data-group={item.type === "group" || undefined}>{item.type === "group" ? <Users size={21} /> : initials(item.title)}</span>
              <span className={styles.conversationBody}><strong>{item.title}</strong><small>{item.lastMessage ? `${item.type === "group" ? `${item.lastMessage.senderName}: ` : ""}${item.lastMessage.body}` : "Chưa có tin nhắn"}</small></span>
              <span className={styles.conversationMeta}><time dateTime={item.lastMessage?.createdAt ?? item.updatedAt}>{previewTime(item.lastMessage?.createdAt ?? item.updatedAt)}</time>{item.unreadCount > 0 ? <b aria-label={`${item.unreadCount} tin chưa đọc`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</b> : null}</span>
            </button>)}
            {!conversationsLoading && !visibleConversations.length ? <div className={styles.sidebarEmpty}><span className={styles.emptyIcon}><MessageCircle aria-hidden="true" size={28} /></span><strong>{conversationSearch ? "Không tìm thấy hội thoại" : "Chưa có cuộc trò chuyện"}</strong>{!conversationSearch ? <Button onClick={openCreate} size="sm" variant="soft">Tin nhắn mới</Button> : null}</div> : null}
          </nav>
          {!activeId && error ? <p className={styles.error} role="alert">{error}</p> : null}
        </aside>
        <section aria-label={activeConversation?.title ?? "Tin nhắn"} className={`message-thread ${styles.thread}`}>
          {activeId ? <>
            <header className={styles.threadHeader}>
              <IconButton className={styles.mobileBack} label="Danh sách tin nhắn" onClick={() => router.push("/messages")}><ArrowLeft aria-hidden="true" size={21} /></IconButton>
              <span aria-hidden="true" className={styles.avatar} data-group={activeConversation?.type === "group" || undefined}>{activeConversation?.type === "group" ? <Users size={21} /> : initials(activeConversation?.title ?? "HT")}</span>
              <div className={styles.threadTitle}><h2>{activeConversation?.title ?? "Hội thoại"}</h2><span>{activeConversation?.type === "group" ? `Nhóm · ${activeConversation.members.length} thành viên` : "Tin nhắn riêng"}</span></div>
            </header>
            {messagesLoading ? <div className={styles.loading} role="status"><LoaderCircle aria-hidden="true" className={styles.spinner} size={24} /><span>Đang tải tin nhắn</span></div> : <ChatTranscript bottomRef={bottom} className={styles.transcript} conversationId={activeId} leading={nextCursor ? <Button busy={loadingOlder} className={styles.older} leftIcon={<ChevronUp aria-hidden="true" size={16} />} onClick={() => void loadOlderMessages()} size="sm" variant="ghost">Tin nhắn trước</Button> : undefined} messages={messages} selfId={selfId} />}
            <div className={styles.composerArea}>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <form className={styles.composer} data-has-attachment={Boolean(attachmentFile) || undefined} onSubmit={send} ref={composer}>
                <ImageUploader accept="image/jpeg,image/png,image/webp,application/pdf" className={styles.uploader} compact disabled={messagesLoading || sending} error={attachmentError} file={attachmentFile} label="Đính kèm tệp" onFileChange={(file) => { setAttachmentFile(file); setAttachmentError(""); }} onRetry={() => composer.current?.requestSubmit()} uploading={sending && Boolean(attachmentFile)} />
                <textarea aria-label="Tin nhắn" autoComplete="off" className={styles.draft} disabled={messagesLoading || sending} maxLength={8000} name="body" onInput={(event) => { const input = event.currentTarget; input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 128)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); composer.current?.requestSubmit(); } }} placeholder="Nhập tin nhắn…" ref={draft} required rows={1} />
                <IconButton className={styles.send} disabled={sending || messagesLoading} label={sending ? "Đang gửi tin nhắn" : "Gửi tin nhắn"} type="submit" variant="primary">{sending ? <LoaderCircle aria-hidden="true" className={styles.spinner} size={20} /> : <Send aria-hidden="true" size={20} />}</IconButton>
              </form>
            </div>
          </> : <div className={styles.threadEmpty}><span className={styles.emptyIcon}><MessageCircle aria-hidden="true" size={38} /></span><h2>Tin nhắn của bạn</h2><Button leftIcon={<MessageSquarePlus aria-hidden="true" size={18} />} onClick={openCreate} variant="primary">Tin nhắn mới</Button></div>}
        </section>
      </div>
      <Drawer className={styles.createDrawer} onClose={() => { if (!creating) setShowCreate(false); }} open={showCreate} title="Tin nhắn mới">
        <form className={styles.createForm} onSubmit={create}>
          {canCreateGroup ? <div aria-label="Loại hội thoại" className={styles.createModes} role="group"><button aria-pressed={!group} disabled={creating} onClick={() => { setGroup(false); setGroupMembers([]); }} type="button"><UserRound aria-hidden="true" size={17} />Cá nhân</button><button aria-pressed={group} disabled={creating} onClick={() => { setGroup(true); setDirectAccountId(""); }} type="button"><Users aria-hidden="true" size={17} />Nhóm</button></div> : null}
          {group ? <Input disabled={creating} label="Tên nhóm" maxLength={120} minLength={2} name="title" placeholder="Nhập tên nhóm" required /> : <input name="accountId" type="hidden" value={directAccountId} />}
          <label className={styles.peopleSearch}><Search aria-hidden="true" size={18} /><input aria-label="Tìm tài khoản" disabled={creating} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Tìm tên, mã nhân viên" type="search" value={accountSearch} /></label>
          <fieldset className={styles.people}><legend>{group ? "Chọn thành viên" : "Chọn người nhận"}</legend>
            {accountsLoading ? <div className={styles.loading} role="status"><LoaderCircle aria-hidden="true" className={styles.spinner} size={22} /><span>Đang tải tài khoản</span></div> : visibleAccounts.map((item) => {
              const selected = group ? groupMembers.includes(item.id) : directAccountId === item.id;
              return <label className={styles.person} data-selected={selected || undefined} key={item.id}><input checked={selected} disabled={creating} name={group ? undefined : "recipient"} onChange={() => group ? toggleGroupMember(item.id) : setDirectAccountId(item.id)} type={group ? "checkbox" : "radio"} value={item.id} /><span aria-hidden="true" className={styles.avatar}>{initials(item.name)}</span><span className={styles.personDetails}><strong>{item.name}</strong>{item.employeeCode || item.department || item.roleLabel ? <small>{[item.employeeCode, item.department || item.roleLabel].filter(Boolean).join(" · ")}</small> : null}</span><span aria-hidden="true" className={styles.selection}>{selected ? <Check size={15} /> : null}</span></label>;
            })}
            {!accountsLoading && !visibleAccounts.length ? <div className={styles.peopleEmpty}>{accountSearch ? "Không tìm thấy tài khoản" : "Chưa có tài khoản"}</div> : null}
          </fieldset>
          {createError ? <p className={styles.error} role="alert">{createError}</p> : null}
          <footer className={styles.createFooter}><span>{group ? `${groupMembers.length} thành viên` : directAccountId ? "Đã chọn người nhận" : "Chưa chọn người nhận"}</span><Button busy={creating} disabled={accountsLoading || (group ? !groupMembers.length : !directAccountId)} leftIcon={<MessageCircle aria-hidden="true" size={18} />} type="submit" variant="primary">{group ? "Tạo nhóm" : "Nhắn tin"}</Button></footer>
        </form>
      </Drawer>
    </>
  );
}

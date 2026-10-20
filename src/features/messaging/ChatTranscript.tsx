"use client";

import { ArrowDownToLine, ArrowUpRight, Check, FileText, Image as ImageIcon, WalletCards } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type { ChatMessage } from "./types";
import styles from "./ChatTranscript.module.css";

const zone = "Asia/Ho_Chi_Minh";
const dayKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const dateLabel = (value: string) => {
  const key = dayKey(value), today = new Date();
  if (key === dayKey(today)) return "Hôm nay";
  if (key === dayKey(new Date(today.getTime() - 86_400_000))) return "Hôm qua";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
};
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(word => word[0] ?? "").join("").toLocaleUpperCase("vi");
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ChatTranscript({ conversationId, messages, selfId, bottomRef, compact = false, className = "", leading }: {
  conversationId: string;
  messages: ChatMessage[];
  selfId: string;
  bottomRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  className?: string;
  leading?: ReactNode;
}) {
  return <div aria-label="Nội dung trò chuyện" className={`${styles.transcript} ${className}`} data-compact={compact || undefined}>
    {leading}
    {messages.map((message, index) => {
      const previous = messages[index - 1];
      const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
      const grouped = !newDay && previous.senderAccountId === message.senderAccountId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300_000;
      const own = message.senderAccountId === selfId;
      return <div className={styles.entry} key={message.id}>
        {newDay ? <div className={styles.day}><span>{dateLabel(message.createdAt)}</span></div> : null}
        <div className={styles.row} data-grouped={grouped || undefined} data-own={own || undefined}>
          {!own ? <span aria-hidden="true" className={styles.avatar} data-hidden={grouped || undefined}>{initials(message.senderName)}</span> : null}
          <article aria-label={`${message.senderName}, ${clock(message.createdAt)}`} className={styles.bubble}>
            {!own && !grouped ? <strong className={styles.sender}>{message.senderName}</strong> : null}
            {message.body ? <p className={styles.text}>{message.body}</p> : null}
            {message.metadata?.payslipId ? <a className={styles.payslip} href={`/accounting/payslips/${message.metadata.payslipId}`}><span className={styles.fileIcon}><WalletCards aria-hidden="true" size={22} /></span><span><strong>Phiếu lương {message.metadata.payslipPeriod ?? ""}</strong><small>Xem phiếu · Tải PDF</small></span><ArrowUpRight aria-hidden="true" size={18} /></a> : null}
            {message.attachments.map(attachment => <a className={styles.file} href={`/api/v1/chat/conversations/${conversationId}/attachments/${attachment.id}`} key={attachment.id} rel="noreferrer" target="_blank"><span className={styles.fileIcon}>{attachment.mimeType.startsWith("image/") ? <ImageIcon aria-hidden="true" size={21} /> : <FileText aria-hidden="true" size={21} />}</span><span><strong>{attachment.fileName}</strong><small>{size(attachment.sizeBytes)}</small></span><ArrowDownToLine aria-hidden="true" size={17} /></a>)}
            <footer className={styles.meta}>{message.editedAt ? <span>Đã sửa</span> : null}<time dateTime={message.createdAt}>{clock(message.createdAt)}</time>{own ? <Check aria-label="Đã gửi" size={13} /> : null}</footer>
          </article>
        </div>
      </div>;
    })}
    <div aria-hidden="true" className={styles.bottom} ref={bottomRef} />
  </div>;
}

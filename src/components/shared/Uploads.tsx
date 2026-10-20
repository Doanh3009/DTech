"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { FileText, FileUp, ImagePlus, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { Input } from "@/components/shared/FormControls";

export function FileUpload(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <div className="upload-field">
      <FileUp aria-hidden="true" size={18} />
      <Input type="file" {...props} />
    </div>
  );
}

export function ImageUpload(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "accept"> & { label: string }) {
  return (
    <div className="upload-field">
      <ImagePlus aria-hidden="true" size={18} />
      <Input accept="image/*" type="file" {...props} />
    </div>
  );
}

/** Shared file-field name used by feature forms. */
export const UploadField = FileUpload;

export interface AttachmentItem {
  id: string;
  name: string;
  href?: string;
  sizeLabel?: string;
}

export interface UploadPreviewProps {
  name: string;
  meta?: ReactNode;
  preview?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function UploadPreview({ name, meta, preview, action, className }: UploadPreviewProps) {
  return (
    <div className={cn("upload-preview", className)}>
      <span aria-hidden="true" className="upload-preview__media">{preview ?? <FileText size={20} />}</span>
      <span className="upload-preview__copy"><strong>{name}</strong>{meta ? <small>{meta}</small> : null}</span>
      {action ? <span className="upload-preview__action">{action}</span> : null}
    </div>
  );
}

export function AttachmentList({ items }: { items: AttachmentItem[] }) {
  if (items.length === 0) {
    return <p className="muted-text">Chưa có tệp đính kèm.</p>;
  }

  return (
    <ul className="attachment-list">
      {items.map((item) => (
        <li key={item.id}>
          <Paperclip aria-hidden="true" size={16} />
          {item.href ? <a href={item.href}>{item.name}</a> : <span>{item.name}</span>}
          {item.sizeLabel ? <small>{item.sizeLabel}</small> : null}
        </li>
      ))}
    </ul>
  );
}

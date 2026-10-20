"use client";

import { FileText, Image as ImageIcon, Paperclip, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { cn } from "@/lib/utils/cn";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";

export interface ImageUploaderProps {
  file?: File;
  onFileChange: (file?: File) => void;
  accept?: string;
  capture?: "user" | "environment";
  maxBytes?: number;
  disabled?: boolean;
  uploading?: boolean;
  progress?: number;
  error?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
  label?: string;
}

const readableSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ImageUploader({
  file,
  onFileChange,
  accept = "image/jpeg,image/png,image/webp",
  capture,
  maxBytes = 15 * 1024 * 1024,
  disabled = false,
  uploading = false,
  progress,
  error,
  onRetry,
  compact = false,
  className,
  label = "Đính kèm"
}: ImageUploaderProps) {
  useLoadingActivity(uploading);
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState("");
  const previewUrl = useMemo(() => file?.type.startsWith("image/") ? URL.createObjectURL(file) : undefined, [file]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function choose(next?: File) {
    if (next && next.size > maxBytes) {
      setValidationError(`Tệp vượt quá ${readableSize(maxBytes)}.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setValidationError("");
    onFileChange(next);
  }

  const currentError = validationError || error;
  const hasMeasuredProgress = typeof progress === "number";
  const percent = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <div className={cn("image-uploader", compact && "image-uploader--compact", currentError && "has-error", className)}>
      <input
        accept={accept}
        aria-label={label}
        capture={capture}
        disabled={disabled || uploading}
        id={id}
        onChange={(event) => choose(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      {!file ? (
        <label className="image-uploader__trigger" htmlFor={id}>
          {compact ? <Paperclip size={18} /> : <UploadCloud size={22} />}
          <span>{label}</span>
        </label>
      ) : (
        <div className="image-uploader__selection">
          <span className="image-uploader__preview">
            {/* Blob previews are local and cannot use Next Image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previewUrl ? <img alt="" src={previewUrl} /> : file.type === "application/pdf" ? <FileText size={20} /> : <ImageIcon size={20} />}
          </span>
          <span className="image-uploader__meta"><strong>{file.name}</strong><small>{readableSize(file.size)}</small></span>
          {!uploading ? <IconButton label="Bỏ tệp" onClick={() => { choose(undefined); if (inputRef.current) inputRef.current.value = ""; }}><Trash2 size={16} /></IconButton> : null}
        </div>
      )}
      {uploading ? <div aria-label="Đang tải tệp" aria-valuemax={100} aria-valuemin={0} aria-valuenow={hasMeasuredProgress ? percent : undefined} aria-valuetext={hasMeasuredProgress ? undefined : "Đang tải"} className="image-uploader__progress" role="progressbar"><span className={hasMeasuredProgress ? undefined : "is-indeterminate"} style={hasMeasuredProgress ? { width: `${percent}%` } : undefined} /></div> : null}
      {currentError ? <div className="image-uploader__error"><span role="alert">{currentError}</span>{error && onRetry ? <Button leftIcon={<RotateCcw size={14} />} onClick={onRetry} size="sm" variant="ghost">Thử lại</Button> : null}</div> : null}
    </div>
  );
}

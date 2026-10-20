"use client";

import { useId, useRef, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { downloadFile, type DownloadFileFormat } from "@/lib/files/downloadFile";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import styles from "./FileDownloadLink.module.css";

export interface FileDownloadLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  format: DownloadFileFormat;
  fileName?: string;
}

export function FileDownloadLink({ href, format, fileName, children, onClick, "aria-describedby": describedBy, ...props }: FileDownloadLinkProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const errorId = useId();
  useLoadingActivity(busy);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); event.stopPropagation();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await downloadFile(href, { format, fileName }); }
    catch (caught) { setError(caught instanceof Error && caught.name === "TimeoutError" ? "Xuất tệp quá lâu. Vui lòng thử lại." : caught instanceof Error ? caught.message : "Không thể tải tệp. Vui lòng thử lại."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <><a {...props} aria-busy={busy || undefined} aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined} aria-disabled={busy || props["aria-disabled"] || undefined} href={href} onClick={(event) => void handleClick(event)}>{children}</a>{error ? <span className={styles.error} id={errorId} role="alert">{error}</span> : null}</>;
}

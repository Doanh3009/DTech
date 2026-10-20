"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button, IconButton } from "@/components/shared/Button";
import { cn } from "@/lib/utils/cn";
import { acquireBodyScrollLock } from "@/lib/ui/bodyScrollLock";
import { useOverlayPresence } from "@/lib/ui/useOverlayPresence";

interface OverlayProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  keepMounted?: boolean;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  'summary',
  '[contenteditable="true"]'
].join(",");

const openOverlays: HTMLElement[] = [];
const subscribeToPortal = () => () => {};
const clientPortalSnapshot = () => true;
const serverPortalSnapshot = () => false;

function usePortalReady() {
  return useSyncExternalStore(subscribeToPortal, clientPortalSnapshot, serverPortalSnapshot);
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    if (element.tabIndex < 0 || element.matches(":disabled")) return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (ancestor.hidden || ancestor.inert || style.display === "none" || style.visibility === "hidden") return false;
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open && !ancestor.querySelector("summary")?.contains(element)) return false;
      if (ancestor === container) break;
    }
    return true;
  });
}

function useOverlay(open: boolean, onClose: () => void): RefObject<HTMLElement | null> {
  const overlayRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!open || !overlay) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const releaseScrollLock = acquireBodyScrollLock();
    const viewport = window.visualViewport;
    const overlayHost = overlay.parentElement;
    const updateViewport = () => {
      overlayHost?.style.setProperty("--overlay-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      overlayHost?.style.setProperty("--overlay-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    openOverlays.push(overlay);
    overlay.focus({ preventScroll: true });
    const isTopmost = () => openOverlays.at(-1) === overlay;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !isTopmost()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeRef.current();
    };
    const handleFocus = (event: FocusEvent) => {
      if (isTopmost() && event.target instanceof Node && !overlay.contains(event.target)) {
        overlay.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      const wasTopmost = isTopmost();
      const index = openOverlays.indexOf(overlay);
      if (index >= 0) openOverlays.splice(index, 1);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      releaseScrollLock();
      if (wasTopmost && previousActiveElement?.isConnected) previousActiveElement.focus({ preventScroll: true });
    };
  }, [open]);

  return overlayRef;
}

function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = focusableElements(event.currentTarget);
  if (focusable.length === 0) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({ open, title, children, onClose, className }: OverlayProps) {
  const portalReady = usePortalReady();
  const { present, state, finishExit } = useOverlayPresence(open, portalReady);
  const dialogRef = useOverlay(present && portalReady, () => { if (open) onClose(); });
  const titleId = useId();

  if (!present || !portalReady) {
    return null;
  }

  return createPortal(
    <div className="overlay" data-state={state} onClickCapture={(event) => { if (!open) { event.preventDefault(); event.stopPropagation(); } }} onKeyDownCapture={(event) => { if (!open) { event.preventDefault(); event.stopPropagation(); } }} onPointerDown={(event) => { if (open && event.target === event.currentTarget) onClose(); }} role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className={cn("modal", className)} onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) finishExit(); }} onKeyDown={keepFocusInside} ref={dialogRef} role="dialog" tabIndex={-1}>
        <header className="overlay__header">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>,
    document.body
  );
}

/** Dialog is the semantic public name; Modal remains for backwards compatibility. */
export const Dialog = Modal;

export function Drawer({ open, title, children, onClose, className, keepMounted }: OverlayProps) {
  const portalReady = usePortalReady();
  const { present, state, finishExit } = useOverlayPresence(open, portalReady);
  const drawerRef = useOverlay(present && portalReady, () => { if (open) onClose(); });
  const titleId = useId();

  if (!portalReady || (!present && !keepMounted)) {
    return null;
  }

  return createPortal(
    <div className="overlay overlay--drawer" data-state={state} hidden={!present} onClickCapture={(event) => { if (!open) { event.preventDefault(); event.stopPropagation(); } }} onKeyDownCapture={(event) => { if (!open) { event.preventDefault(); event.stopPropagation(); } }} onPointerDown={(event) => { if (open && event.target === event.currentTarget) onClose(); }} role="presentation">
      <aside aria-labelledby={titleId} aria-modal="true" className={cn("drawer", className)} onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) finishExit(); }} onKeyDown={keepFocusInside} ref={drawerRef} role="dialog" tabIndex={-1}>
        <header className="overlay__header">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        </header>
        {children}
      </aside>
    </div>,
    document.body
  );
}

export interface ConfirmDialogProps extends OverlayProps {
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Xác nhận",
  danger,
  onClose,
  onConfirm,
  className
}: ConfirmDialogProps) {
  return (
    <Modal className={cn("modal--confirm", className)} open={open} title={title} onClose={onClose}>
      <div className="confirm-dialog">
        <div>{children}</div>
        <footer>
          <Button onClick={onClose} variant="secondary">
            Hủy
          </Button>
          <Button onClick={onConfirm} variant={danger ? "danger" : "primary"}>
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

export interface LightboxProps extends OverlayProps {
  mediaClassName?: string;
}

export function Lightbox({ open, title, children, onClose, mediaClassName, className }: LightboxProps) {
  const portalReady = usePortalReady();
  const { present, state, finishExit } = useOverlayPresence(open, portalReady);
  const lightboxRef = useOverlay(present && portalReady, () => { if (open) onClose(); });
  const titleId = useId();

  if (!present || !portalReady) {
    return null;
  }

  return createPortal(
    <div className="overlay overlay--lightbox" data-state={state} onClickCapture={(event) => { if (!open) { event.preventDefault(); event.stopPropagation(); } }} onKeyDownCapture={(event) => { if (!open) { event.preventDefault(); event.stopPropagation(); } }} onPointerDown={(event) => { if (open && event.target === event.currentTarget) onClose(); }} role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className={cn("lightbox", className)} onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) finishExit(); }} onKeyDown={keepFocusInside} ref={lightboxRef} role="dialog" tabIndex={-1}>
        <header className="overlay__header">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        </header>
        <div className={cn("lightbox__media", mediaClassName)}>{children}</div>
      </section>
    </div>,
    document.body
  );
}

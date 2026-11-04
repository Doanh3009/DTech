"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface FloatingPanelProps {
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  id?: string;
  onClose: () => void;
  role?: "listbox" | "menu" | "presentation";
  label?: string;
  matchWidth?: boolean;
  preferredWidth?: number;
}
const openPanels: HTMLDivElement[] = [];

/** Portals remain inside their owning dialog for its focus lock. The native
 * popover top layer prevents clipping by tables and scrolling form sections. */
export function FloatingPanel({ anchor, children, className = "", id, onClose, role = "presentation", label, matchWidth = true, preferredWidth }: FloatingPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const [position, setPosition] = useState<CSSProperties>();
  const [side, setSide] = useState("bottom");
  useLayoutEffect(() => { close.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const trigger = anchor.current;
    const element = panel.current;
    if (!trigger || !element) return;
    const viewport = window.visualViewport;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const topOffset = viewport?.offsetTop ?? 0;
      const leftOffset = viewport?.offsetLeft ?? 0;
      const gutter = 12;
      const panelWidth = Math.max(0, Math.min(preferredWidth ?? (matchWidth ? Math.max(rect.width, 224) : 240), width - gutter * 2));
      const below = height + topOffset - rect.bottom - gutter;
      const above = rect.top - topOffset - gutter;
      const up = below < 200 && above > below;
      const maxHeight = Math.max(0, Math.min(360, height - gutter * 2, (up ? above : below) - 8));
      const naturalHeight = Math.min(element.scrollHeight || 360, maxHeight);
      const next: CSSProperties = {
        left: Math.max(leftOffset + gutter, Math.min(rect.left, leftOffset + width - panelWidth - gutter)),
        top: up ? Math.max(topOffset + gutter, rect.top - naturalHeight - 8) : rect.bottom + 8,
        width: panelWidth,
        maxHeight
      };
      setSide(up ? "top" : "bottom");
      setPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof CSSProperties] === next[key as keyof CSSProperties]) ? previous : next);
    };
    openPanels.push(element);
    if (typeof element.showPopover === "function") element.showPopover();
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined;
    observer?.observe(trigger);
    observer?.observe(element);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !trigger.contains(event.target)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || openPanels.at(-1) !== element) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close.current();
      trigger.focus({ preventScroll: true });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      const index = openPanels.indexOf(element);
      if (index >= 0) openPanels.splice(index, 1);
      if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
    };
  }, [anchor, matchWidth, preferredWidth]);

  const host = anchor.current?.closest('.floating-panel, [role="dialog"]') ?? (typeof document !== "undefined" ? document.body : null);
  if (!host) return null;
  return createPortal(<div aria-label={label} className={`floating-panel ${className}`} data-side={side} id={id} popover="manual" ref={panel} role={role} style={position}>{children}</div>, host);
}

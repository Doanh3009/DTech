"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "error" | "info";

export function Badge({
  children,
  className,
  tone = "neutral"
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return <span className={cn("badge", `badge--${tone}`, className)}>{children}</span>;
}

export function Tooltip({
  children,
  content,
  className,
  placement = "bottom",
  portal = false
}: {
  children: ReactNode;
  content: ReactNode;
  className?: string;
  placement?: "bottom" | "right";
  portal?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const element = isValidElement<{ "aria-describedby"?: string }>(children) ? children : undefined;
  const trigger = element
    ? cloneElement(element as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": [element.props["aria-describedby"], id].filter(Boolean).join(" ")
      })
    : <span aria-describedby={id} tabIndex={0}>{children}</span>;

  const updatePosition = useCallback(() => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition(placement === "right"
      ? { left: bounds.right + 8, top: bounds.top + bounds.height / 2 }
      : { left: bounds.left + bounds.width / 2, top: bounds.bottom + 8 });
  }, [placement]);

  useEffect(() => {
    if (!portal || !open) return;
    updatePosition();
    const reposition = () => updatePosition();
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [open, portal, updatePosition]);

  const tooltip = <span className={cn("tooltip__content", portal && "tooltip__content--portal", portal && `tooltip__content--${placement}`)} id={id} role="tooltip" style={portal ? position : undefined}>{content}</span>;

  return (
    <span
      className={cn("tooltip", `tooltip--${placement}`, className)}
      onBlur={() => setOpen(false)}
      onFocus={() => { updatePosition(); setOpen(true); }}
      onMouseEnter={() => { updatePosition(); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      ref={rootRef}
    >
      {trigger}
      {portal ? (open && typeof document !== "undefined" ? createPortal(tooltip, document.body) : null) : tooltip}
    </span>
  );
}

export function Popover({
  children,
  className,
  label,
  trigger
}: {
  children: ReactNode;
  className?: string;
  label: string;
  trigger: ReactNode;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  return (
    <span className={cn("popover", className)} ref={rootRef}>
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className="popover__trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {trigger}
      </button>
      {open ? <span aria-label={label} className="popover__content" id={id} role="dialog">{children}</span> : null}
    </span>
  );
}

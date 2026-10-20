"use client";

import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  busy?: boolean;
}

export function Button({
  className,
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  busy = false,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  useLoadingActivity(busy);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const widestContent = useRef(0);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const style = getComputedStyle(button);
    const content = Array.from(button.children).reduce((width, child) => width + child.getBoundingClientRect().width, 0);
    if (!content) return;
    const gap = Number.parseFloat(style.columnGap) || 0;
    const inset = [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
      .reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);
    const width = Math.ceil(content + gap * Math.max(0, button.children.length - 1) + inset);
    if (width > widestContent.current) {
      widestContent.current = width;
      button.style.minWidth = `min(100%, ${width}px)`;
    }
  }, [children, leftIcon, rightIcon]);

  return (
    <button
      ref={buttonRef}
      className={cn("button", `button--${variant}`, `button--${size}`, className)}
      type={type}
      {...props}
      aria-busy={busy || props["aria-busy"] || undefined}
      disabled={props.disabled || busy}
    >
      {leftIcon ? <span className="button__icon">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="button__icon">{rightIcon}</span> : null}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  variant?: ButtonVariant;
}

export function IconButton({
  className,
  label,
  children,
  variant = "ghost",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn("icon-button", `icon-button--${variant}`, className)}
      title={label}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

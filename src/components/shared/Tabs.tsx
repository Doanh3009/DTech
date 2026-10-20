"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface TabItem {
  label: string;
  mobileLabel?: string;
  icon?: ReactNode;
  href?: string;
  scroll?: boolean;
  onSelect?: () => void;
  active?: boolean;
  className?: string;
}

export interface TabsProps {
  items: TabItem[];
  label: string;
  tone?: "mint" | "cyan" | "lavender" | "amber";
  className?: string;
}

export function ContextTabs({ items, label, tone, className }: TabsProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const candidates = items.map((item, index) => ({ item, index })).filter(({ item }) => item.active);
  const activeIndex = candidates.sort((left, right) => {
    const matchLength = (href?: string) => {
      const path = href?.split(/[?#]/)[0];
      return path && (pathname === path || pathname.startsWith(`${path}/`)) ? path.length : 0;
    };
    return matchLength(right.item.href) - matchLength(left.item.href);
  })[0]?.index;
  const activeKey = activeIndex === undefined ? undefined : items[activeIndex].href ?? items[activeIndex].label;
  useEffect(() => {
    const container = scroller.current;
    if (!container || typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 767px)").matches) return;
    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (active) container.scrollTo?.({ left: Math.max(0, container.scrollLeft + active.getBoundingClientRect().left - container.getBoundingClientRect().left - (container.clientWidth - active.offsetWidth) / 2), behavior: "auto" });
  }, [activeKey]);
  return (
    <nav aria-label={label} className={cn("tabs", "context-tabs", tone && `tabs--${tone}`, className)} data-ui="context-tabs">
      <div className="context-tabs__scroller" ref={scroller}>
        {items.map((item, index) => {
          const content = <>
            {item.icon ? <span aria-hidden="true" className="tabs__icon">{item.icon}</span> : null}
            <span className={cn("tabs__label", item.mobileLabel && "tabs__label--desktop")}>{item.label}</span>
            {item.mobileLabel ? <span className="tabs__label tabs__label--mobile">{item.mobileLabel}</span> : null}
          </>;
          const sharedProps = {
            "aria-current": index === activeIndex ? "page" as const : undefined,
            className: cn("tabs__item", item.className, index === activeIndex && "is-active"),
            "data-active": index === activeIndex || undefined
          };

          return item.onSelect ? (
            <button {...sharedProps} key={item.href ?? item.label} onClick={item.onSelect} type="button">{content}</button>
          ) : (
            <Link {...sharedProps} href={item.href ?? "#"} key={item.href ?? item.label} scroll={item.scroll}>{content}</Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Backwards-compatible name while feature pages move to ContextTabs. */
export function Tabs(props: TabsProps) {
  return <ContextTabs {...props} />;
}

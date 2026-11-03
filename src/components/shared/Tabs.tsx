"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

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

export function ViewTabs<T extends string>({id,label,items,value,onValueChange,className}:{id:string;label:string;items:{value:T;label:string}[];value:T;onValueChange:(value:T)=>void;className?:string}){
 const root=useRef<HTMLDivElement>(null);
 function keyboard(event:KeyboardEvent<HTMLButtonElement>,index:number){
  let next:number;if(event.key==="ArrowRight")next=(index+1)%items.length;else if(event.key==="ArrowLeft")next=(index-1+items.length)%items.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=items.length-1;else return;
  event.preventDefault();if(items[next].value!==value)onValueChange(items[next].value);root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
 }
 return <div className={cn("tabs","context-tabs",className)} role="tablist" aria-label={label} ref={root}><div className="context-tabs__scroller">{items.map((item,index)=><button key={item.value} type="button" role="tab" id={`${id}-${item.value}`} aria-controls={`${id}-panel`} aria-selected={item.value===value} tabIndex={item.value===value?0:-1} className={cn("tabs__item",item.value===value&&"is-active")} onClick={()=>{if(item.value!==value)onValueChange(item.value);}} onKeyDown={event=>keyboard(event,index)}>{item.label}</button>)}</div></div>;
}

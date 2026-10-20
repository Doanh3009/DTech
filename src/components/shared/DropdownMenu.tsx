"use client";

import { Children, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import { Drawer } from "@/components/shared/Overlays";
import { useIsPhone } from "@/lib/ui/useIsPhone";

export interface DropdownMenuProps {
  label?: string;
  trigger?: ReactNode;
  mobileTriggerLabel?: string;
  disabled?: boolean;
  menuWidth?: number;
  children: ReactNode;
}

function enabledActions(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button')).filter((action) => {
    if (action.matches(':disabled, [aria-disabled="true"]')) return false;
    for (let element: HTMLElement | null = action; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (element.hidden || element.inert || style.display === "none" || style.visibility === "hidden") return false;
      if (element instanceof HTMLDetailsElement && !element.open && !element.querySelector("summary")?.contains(action)) return false;
      if (element === container) break;
    }
    return true;
  });
}

export function DropdownMenu({ label = "Mở menu", trigger, mobileTriggerLabel, disabled = false, menuWidth, children }: DropdownMenuProps) {
  const anchor = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const mobile = useIsPhone();
  const genericMoreTrigger = mobile && isValidElement<{ children?: ReactNode }>(trigger)
    && Children.toArray(trigger.props.children).every((child) => typeof child === "string")
    && Children.toArray(trigger.props.children).join("").trim() === "Thêm";
  const keyboardFocus = useRef<"first" | "last" | undefined>(undefined);
  useLayoutEffect(() => {
    if (!open) return;
    const panel = document.getElementById(id);
    const actions = enabledActions(panel);
    if (!mobile) panel?.querySelectorAll<HTMLElement>('a[href], button').forEach((action) => action.setAttribute("role", "menuitem"));
    let fieldObserver: MutationObserver | undefined;
    if (mobile && anchor.current?.form) {
      const form = anchor.current.form;
      if (!form.id) form.id = `${id}-form`;
      const associateFields = () => panel?.querySelectorAll<HTMLElement>("button, input, select, textarea").forEach((control) => {
        if (!control.hasAttribute("form") && !control.closest("form")) control.setAttribute("form", form.id);
      });
      associateFields();
      if (panel) {
        fieldObserver = new MutationObserver(associateFields);
        fieldObserver.observe(panel, { childList: true, subtree: true });
      }
    }
    if (keyboardFocus.current) {
      actions[keyboardFocus.current === "last" ? actions.length - 1 : 0]?.focus();
      keyboardFocus.current = undefined;
    }
    return () => fieldObserver?.disconnect();
  }, [id, mobile, open]);
  const content = <div onClick={(event) => {
        if (!(event.target instanceof Element)) return;
        const action = event.target.closest("a, button");
        if (!action || action.matches(":disabled, [aria-disabled='true'], [aria-haspopup], [role='combobox']")) return;
        if (mobile && action instanceof HTMLButtonElement && action.type === "submit") return;
        setOpen(false);
        if (action.tagName === "BUTTON") anchor.current?.focus({ preventScroll: true });
      }} onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Tab") {
          if (!mobile) {
            anchor.current?.focus({ preventScroll: true });
            setOpen(false);
          }
          return;
        }
        if (event.target instanceof Element && event.target.matches("input, select, textarea, [role='combobox']")) return;
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const actions = enabledActions(event.currentTarget);
        if (!actions.length) return;
        const index = actions.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? actions.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + actions.length) % actions.length;
        actions[next]?.focus();
      }}>{children}</div>;
  return <span className="dropdown" data-ui="action-menu">
    <button disabled={disabled} aria-controls={open ? id : undefined} aria-expanded={open} aria-haspopup={mobile ? "dialog" : "menu"} aria-label={label} className="dropdown__trigger" onClick={() => { setHasOpened(true); setOpen((current) => !current); }} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      if (open) {
        const actions = enabledActions(document.getElementById(id));
        actions[event.key === "ArrowUp" ? actions.length - 1 : 0]?.focus();
        return;
      }
      keyboardFocus.current = event.key === "ArrowUp" ? "last" : "first";
      setHasOpened(true);
      setOpen(true);
    }} ref={anchor} type="button">{mobile && mobileTriggerLabel ? <><MoreHorizontal aria-hidden="true" size={19} /><span>{mobileTriggerLabel}</span></> : genericMoreTrigger ? <><MoreHorizontal aria-hidden="true" size={20} /><span>Công cụ</span></> : trigger ?? <MoreHorizontal aria-hidden="true" size={20} />}</button>
    {mobile ? hasOpened ? <Drawer className="mobile-dropdown-sheet" keepMounted onClose={() => setOpen(false)} open={open} title={label}>
      <div aria-label={label} className="mobile-dropdown-sheet__items" id={id} role="group">{content}</div>
    </Drawer> : null : open ? <FloatingPanel anchor={anchor} className="dropdown__content" id={id} label={label} matchWidth={false} preferredWidth={menuWidth} onClose={() => setOpen(false)} role="menu">{content}</FloatingPanel> : null}
  </span>;
}

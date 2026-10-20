"use client";

import { Children, Fragment, cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { Button, IconButton, type ButtonProps } from "@/components/shared/Button";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { Drawer } from "@/components/shared/Overlays";
import { cn } from "@/lib/utils/cn";
import { useIsPhone } from "@/lib/ui/useIsPhone";

export interface ActionBarProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function ActionBar({ children, className, label = "Thao tác", ref }: ActionBarProps & { ref?: RefObject<HTMLDivElement | null> }) {
  return (
    <div aria-label={label} className={cn("action-bar", className)} ref={ref} role="toolbar">
      {children}
    </div>
  );
}

type ActionNodeProps = { children?: ReactNode; className?: string; variant?: string; priority?: string; onClick?: unknown; href?: unknown; form?: string };

function actionNodes(children: ReactNode, parentKey = ""): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<ActionNodeProps>(child)) return [child];
    if (child.type === Fragment || ((child.type === "div" || child.type === "span") && !child.props.onClick && child.props.children && Children.toArray(child.props.children).every(isValidElement))) {
      return actionNodes(child.props.children, `${parentKey}${child.key}/`);
    }
    return [parentKey ? cloneElement(child, { key: `${parentKey}${child.key}` }) : child];
  });
}

function isAction(node: ReactNode): boolean {
  if (!isValidElement<ActionNodeProps>(node)) return false;
  // Opaque components, including permission gates, stay in the original layout.
  // Their presence in React children does not tell us whether they render an action.
  return node.type === "button" || node.type === "a" || node.type === Button || node.type === IconButton || node.type === ActionButton || node.type === Link;
}

function isPrimaryAction(node: ReactNode): boolean {
  if (!isValidElement<ActionNodeProps>(node)) return false;
  return node.props.variant === "primary" || node.props.priority === "primary" || Boolean(node.props.className?.includes("button--primary")) || Children.toArray(node.props.children).some(isPrimaryAction);
}

function associateForm(node: ReactNode, formId?: string): ReactNode {
  if (!formId || !isValidElement<ActionNodeProps>(node)) return node;
  const formControl = node.type === Button || node.type === ActionButton || (typeof node.type === "string" && ["button", "input", "select", "textarea"].includes(node.type));
  return cloneElement(node, {
    ...(formControl && !node.props.form ? { form: formId } : {}),
    ...(node.props.children ? { children: Children.map(node.props.children, (child) => associateForm(child, formId)) } : {})
  });
}

function ResponsiveActionBar({ children, className, label = "Thao tác", tools = false }: ActionBarProps & { tools?: boolean }) {
  const mobile = useIsPhone();
  const root = useRef<HTMLDivElement>(null);
  const formKey = useId();
  const [formId, setFormId] = useState<string>();
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    if (!form.id) form.id = `${formKey}-actions`;
    setFormId(form.id);
  }, [formKey]);
  const nodes = actionNodes(children);
  const actions = nodes.filter(isAction);
  const primary = actions.find(isPrimaryAction) ?? (tools ? undefined : actions[0]);
  const overflow = actions.filter((action) => action !== primary);

  return <ActionBar className={cn(className, mobile && "action-bar--mobile", mobile && tools && "action-bar--tools")} label={label} ref={root}>
    {mobile && overflow.length > 0 ? <>
      {nodes.filter((node) => !isAction(node))}
      {primary ? <div className="mobile-action-primary">{primary}</div> : null}
      <Button aria-expanded={open} aria-haspopup="dialog" aria-label={tools ? "Công cụ" : "Thao tác khác"} className="mobile-action-overflow" leftIcon={<MoreHorizontal aria-hidden="true" size={20} />} onClick={() => setOpen(true)} variant="secondary">{tools ? "Công cụ" : "Khác"}</Button>
      <Drawer className="mobile-action-sheet" onClose={() => setOpen(false)} open={open} title={label}>
        <div className="mobile-action-sheet__items" onClick={(event) => {
          if (!(event.target instanceof Element)) return;
          const action = event.target.closest("a, button");
          if (!action || action.matches(':disabled, [aria-disabled="true"], [aria-haspopup], [role="combobox"]')) return;
          // The browser must retain the submitter until its default form action runs.
          if (action instanceof HTMLButtonElement && action.type === "submit") return;
          setOpen(false);
        }}>{overflow.map((node) => associateForm(node, formId))}</div>
      </Drawer>
    </> : children}
  </ActionBar>;
}

export function PageActionBar({ children, className, label = "Thao tác trang" }: ActionBarProps) {
  return <ResponsiveActionBar className={cn("page-action-bar", className)} label={label}>{children}</ResponsiveActionBar>;
}

export function PageToolbar({ children, className, label = "Công cụ trang" }: ActionBarProps) {
  return <ResponsiveActionBar className={cn("page-toolbar", className)} label={label}>{children}</ResponsiveActionBar>;
}

export function FunctionToolbar({ children, className, label = "Công cụ chức năng" }: ActionBarProps) {
  return <ResponsiveActionBar className={cn("function-toolbar", className)} label={label}>{children}</ResponsiveActionBar>;
}

export function TableActionBar({ children, className, label = "Công cụ danh sách" }: ActionBarProps) {
  return <ResponsiveActionBar className={cn("table-action-bar", className)} label={label} tools>{children}</ResponsiveActionBar>;
}

export function TableToolbar({ children, className, label = "Table toolbar" }: ActionBarProps) {
  return <div aria-label={label} className={cn("table-toolbar", className)} role="toolbar">{children}</div>;
}

export function RowActions({ children, className, label = "Row actions" }: ActionBarProps) {
  return <ActionBar className={cn("row-actions", className)} label={label}>{children}</ActionBar>;
}

export interface ActionButtonProps extends ButtonProps {
  priority?: "primary" | "secondary";
}

export function ActionButton({ className, priority = "secondary", variant, ...props }: ActionButtonProps) {
  return (
    <Button
      className={cn("action-button", `action-button--${priority}`, className)}
      variant={variant ?? (priority === "primary" ? "primary" : "secondary")}
      {...props}
    />
  );
}

interface CompactActionMenuProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export function CompactActionMenu({ children, label = "Thao tác khác", className }: CompactActionMenuProps) {
  return (
    <div className={cn("compact-action-menu", className)}>
      <DropdownMenu
        label={label}
        trigger={
          <span aria-hidden="true" className="compact-action-menu__trigger">
            <MoreHorizontal aria-hidden="true" size={18} />
          </span>
        }
      >
        {children}
      </DropdownMenu>
    </div>
  );
}

"use client";

import { Children, Fragment, cloneElement, isValidElement, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { TableActionBar } from "@/components/shared/ActionBars";
import { Button, IconButton } from "@/components/shared/Button";
import { SearchInput } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { cn } from "@/lib/utils/cn";
import { useIsPhone } from "@/lib/ui/useIsPhone";

export interface FilterBarProps {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  label?: string;
  onApply?: () => void;
  onReset?: () => void;
}

export interface FilterSheetProps {
  children: ReactNode;
  formId?: string;
  open: boolean;
  onClose: () => void;
  onApply?: () => void;
  onReset?: () => void;
  title?: string;
}

function filterControls(children: ReactNode, parentKey = ""): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [child];
    if (child.type === Fragment) return filterControls(child.props.children, `${parentKey}${child.key}/`);
    return [parentKey ? cloneElement(child, { key: `${parentKey}${child.key}` }) : child];
  });
}

function countActiveFilters(children: ReactNode): number {
  return Children.toArray(children).reduce<number>((count, child) => {
    if (!isValidElement<{ value?: unknown; defaultValue?: unknown; checked?: unknown; children?: ReactNode }>(child)) return count;
    const value = child.props.value ?? child.props.defaultValue;
    if (child.props.checked === true || (value !== undefined && value !== null && String(value).length > 0)) return count + 1;
    return count + (child.props.children ? countActiveFilters(child.props.children) : 0);
  }, 0);
}

export function FilterSheet({ children, formId, open, onClose, onApply, onReset, title = "Bộ lọc" }: FilterSheetProps) {
  const attachFields = useCallback((fields: HTMLDivElement | null) => {
    if (!fields || !formId) return;
    // Portaled filters can contain wrappers or compound controls. Associate
    // their native inputs with the original form, including hidden select values.
    const associateFields = () => {
      fields.querySelectorAll<HTMLElement>("input, select, textarea, button").forEach((control) => {
        if (!control.hasAttribute("form") && !control.closest("form")) control.setAttribute("form", formId);
      });
    };
    associateFields();
    const observer = new MutationObserver(associateFields);
    observer.observe(fields, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [formId]);
  return (
    <Drawer className="filter-sheet" keepMounted onClose={onClose} open={open} title={title}>
      <div className="mobile-filter-sheet" ref={attachFields}>{children}</div>
      <footer className="mobile-filter-sheet__actions">
        {onReset ? <Button onClick={onReset} type="button" variant="secondary">Đặt lại</Button> : null}
        <Button onClick={() => { onApply?.(); onClose(); }} type="button" variant="primary">Áp dụng</Button>
      </footer>
    </Drawer>
  );
}

export function FilterBar({ children, actions, className, label = "Bộ lọc dữ liệu", onApply, onReset }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const mobile = useIsPhone();
  const rootRef = useRef<HTMLElement>(null);
  const generatedFormId = useId();
  const [formId, setFormId] = useState<string>();
  useLayoutEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    if (!form.id) form.id = `${generatedFormId}-filters`;
    setFormId(form.id);
  }, [generatedFormId]);
  const controls = filterControls(children);
  const searchIndex = controls.findIndex((child) => isValidElement(child) && child.type === SearchInput);
  const search = searchIndex >= 0 ? controls[searchIndex] : null;
  const filters = controls.filter((_, index) => index !== searchIndex);
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  return (
    <section aria-label={label} className={cn("filter-bar", "filter-bar--workspace", className)} data-ui="filter-bar" ref={rootRef}>
      {!mobile ? <div className="filter-bar__desktop">
        <div className="filter-bar__controls">{children}</div>
        {actions ? <TableActionBar className="filter-bar__actions">{actions}</TableActionBar> : null}
      </div> : <div className="mobile-filter-bar" data-has-search={Boolean(search)}>
        {search ? <div className="mobile-filter-bar__primary">{search}</div> : null}
        {filters.length || actions ? <div className="mobile-filter-bar__tools">
          {filters.length ? (
            <Button
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={activeCount ? `Bộ lọc (${activeCount})` : "Bộ lọc"}
              className={cn("mobile-filter-trigger", activeCount > 0 && "is-active")}
              leftIcon={<SlidersHorizontal aria-hidden="true" size={18} />}
              onClick={() => setOpen(true)}
              type="button"
              variant="secondary"
            >
              Bộ lọc{activeCount > 0 ? <span aria-hidden="true" className="mobile-filter-trigger__count">{activeCount}</span> : null}
            </Button>
          ) : null}
          {actions ? <TableActionBar className="mobile-filter-bar__actions">{actions}</TableActionBar> : null}
        </div> : null}
      </div>}
      {mobile && filters.length > 0 ? (
        <FilterSheet formId={formId} onApply={onApply ?? (formId ? () => rootRef.current?.closest("form")?.requestSubmit() : undefined)} onClose={() => setOpen(false)} onReset={onReset ?? (formId ? () => rootRef.current?.closest("form")?.reset() : undefined)} open={open}>{filters}</FilterSheet>
      ) : null}
    </section>
  );
}

export interface FilterChipProps {
  label: string;
  value?: string;
  onRemove?: () => void;
}

export function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <span className="filter-chip">
      <span>
        {label}
        {value ? `: ${value}` : null}
      </span>
      {onRemove ? (
        <IconButton label={`Bỏ lọc ${label}`} onClick={onRemove}>
          <X aria-hidden="true" size={14} />
        </IconButton>
      ) : null}
    </span>
  );
}

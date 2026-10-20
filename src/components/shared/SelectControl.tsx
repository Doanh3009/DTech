"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SelectHTMLAttributes } from "react";

import { FloatingPanel } from "@/components/shared/FloatingPanel";
import type { SelectOption } from "@/components/shared/FormControls";
import { cn } from "@/lib/utils/cn";

interface SelectControlProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectControl({ id, options, placeholder, className, disabled, required, value, defaultValue, onChange, onInvalid, "aria-label": accessibleLabel, ...props }: SelectControlProps) {
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [localValue, setLocalValue] = useState(String(defaultValue ?? (placeholder ? "" : options[0]?.value ?? "")));
  const selected = String(value ?? localValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const choices = placeholder ? [{ label: placeholder, value: "" }, ...options.filter((option) => option.value !== "")] : options;
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi");
  const visible = choices.filter((option) => normalize(option.label).includes(normalize(query)));
  const label = choices.find((option) => option.value === selected)?.label ?? placeholder ?? choices[0]?.label ?? "Chọn";
  const listId = `${id}-options`;

  useEffect(() => {
    const form = native.current?.form;
    const reset = () => { setLocalValue(String(defaultValue ?? (placeholder ? "" : options[0]?.value ?? ""))); setInvalid(false); setOpen(false); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, options, placeholder]);

  function choose(next: string) {
    const element = native.current;
    if (!element || disabled) return;
    // Dispatch a real select change: existing handlers retain target.value,
    // FormData, required validation, and their current controlled contract.
    element.value = next;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    setInvalid(false);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function expand() {
    setQuery("");
    setActive(Math.max(0, choices.findIndex((option) => option.value === selected)));
    setOpen(true);
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { expand(); return; }
      setActive((current) => visible.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length : 0);
    } else if (event.key === "Home" || event.key === "End") {
      if (!open || event.target instanceof HTMLInputElement) return;
      event.preventDefault(); setActive(event.key === "Home" ? 0 : Math.max(0, visible.length - 1));
    } else if (event.key === "Enter" || (event.key === " " && !(event.target instanceof HTMLInputElement))) {
      event.preventDefault();
      if (!open) expand();
      else if (visible[active]) choose(visible[active].value);
    } else if (open && event.target === trigger.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const match = choices.findIndex((option) => normalize(option.label).startsWith(normalize(event.key)));
      if (match >= 0) setActive(match);
    }
  }

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId, open]);

  return <span className="select-control" data-open={open || undefined}>
    <select {...props} aria-hidden="true" className="select-control__native" defaultValue={defaultValue} disabled={disabled} hidden id={`${id}-native`} onChange={(event) => { setLocalValue(event.currentTarget.value); onChange?.(event); }} onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); onInvalid?.(event); }} ref={native} required={required} tabIndex={-1} value={value}>
      {choices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <button aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined} aria-controls={open ? listId : undefined} aria-describedby={props["aria-describedby"]} aria-expanded={open} aria-haspopup="listbox" aria-invalid={invalid || props["aria-invalid"] || undefined} aria-label={accessibleLabel} aria-labelledby={accessibleLabel ? undefined : `${id}-label`} aria-required={required || undefined} className={cn("select", "select-control__trigger", className)} disabled={disabled} id={id} onClick={() => open ? setOpen(false) : expand()} onKeyDown={keyboard} ref={trigger} role="combobox" type="button">
      <span>{label}</span><ChevronDown aria-hidden="true" size={16} />
    </button>
    {invalid ? <span className="field__error" role="alert">Vui lòng chọn một giá trị.</span> : null}
    {open && !disabled ? <FloatingPanel anchor={trigger} className="select-control__panel" onClose={() => setOpen(false)}>
      {options.length > 7 ? <div className="select-control__search"><Search aria-hidden="true" size={16} /><input aria-controls={listId} aria-label="Tìm lựa chọn" autoFocus onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={keyboard} placeholder="Tìm kiếm…" type="search" value={query} /></div> : null}
      <div aria-labelledby={`${id}-label`} className="select-control__options" id={listId} role="listbox">
        {visible.length ? visible.map((option, index) => <div aria-selected={option.value === selected} className="select-control__option" data-active={index === active || undefined} id={`${listId}-${index}`} key={option.value} onClick={() => choose(option.value)} onMouseDown={(event) => event.preventDefault()} onPointerMove={() => setActive(index)} role="option"><span>{option.label}</span>{option.value === selected ? <Check aria-hidden="true" size={16} /> : null}</div>) : <p className="select-control__empty" role="status">Không có kết quả</p>}
      </div>
    </FloatingPanel> : null}
  </span>;
}

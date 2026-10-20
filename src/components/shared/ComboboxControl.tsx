"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import type { SelectOption } from "@/components/shared/FormControls";

export function ComboboxControl({ options, onChange, onFocus, onBlur, onKeyDown, disabled, readOnly, value, defaultValue, ...props }: InputHTMLAttributes<HTMLInputElement> & { options: SelectOption[] }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [text, setText] = useState(String(defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = String(value ?? text);
  const normalized = (label: string) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  const choices = options.filter((option) => normalized(option.label).includes(normalized(selected)));
  function choose(label: string) {
    const element = input.current;
    if (!element) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, label);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    setText(label);
    setOpen(false);
    element.focus({ preventScroll: true });
  }
  return <>
    <input {...props} aria-activedescendant={open && choices[active] ? `${id}-${active}` : undefined} aria-autocomplete="list" aria-controls={open ? id : undefined} aria-expanded={open} autoComplete="off" defaultValue={defaultValue} disabled={disabled} onBlur={(event) => { setOpen(false); onBlur?.(event); }} onChange={(event) => { setText(event.target.value); setActive(0); setOpen(true); onChange?.(event); }} onFocus={(event) => { if (!readOnly) setOpen(true); onFocus?.(event); }} onKeyDown={(event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || readOnly) return;
      if (event.key === "Tab") setOpen(false);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive((current) => choices.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length : 0);
      }
      if (event.key === "Enter" && open && choices[active]) { event.preventDefault(); choose(choices[active].label); }
    }} readOnly={readOnly} ref={input} role="combobox" value={value} />
    {open && !disabled && !readOnly ? <FloatingPanel anchor={input} className="select-control__panel" id={id} label="Gợi ý" onClose={() => setOpen(false)} role="listbox">
      {choices.length ? choices.map((option, index) => <div aria-selected={option.label === selected} className="select-control__option" data-active={active === index || undefined} id={`${id}-${index}`} key={option.value} onClick={() => choose(option.label)} onMouseDown={(event) => event.preventDefault()} onPointerMove={() => setActive(index)} role="option">{option.label}</div>) : <p className="select-control__empty" role="status">Không có kết quả</p>}
    </FloatingPanel> : null}
  </>;
}

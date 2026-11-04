"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import type { SelectOption } from "@/components/shared/FormControls";
import { normalizeOptionText, revealOption, SelectOptionContent } from "./SelectOptionContent";

export function ComboboxControl({ options, onChange, onFocus, onBlur, onKeyDown, disabled, readOnly, value, defaultValue, ...props }: InputHTMLAttributes<HTMLInputElement> & { options: SelectOption[] }) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const [text, setText] = useState(String(defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = String(value ?? text);
  const choices = options.filter((option) => normalizeOptionText(option.label).includes(normalizeOptionText(selected)));
  const loading = props["aria-busy"] === true || props["aria-busy"] === "true";
  const activeIndex = choices[active] && !choices[active].disabled ? active : choices.findIndex(option => !option.disabled);
  useEffect(() => {if(open)revealOption(list.current,document.getElementById(`${id}-${activeIndex}`));},[open,id,activeIndex,options,selected]);
  useEffect(()=>{const form=input.current?.form;const reset=()=>{setText(String(defaultValue??""));setOpen(false);setActive(0);};form?.addEventListener("reset",reset);return()=>form?.removeEventListener("reset",reset);},[defaultValue]);
  function choose(label: string) {
    const element = input.current;
    if (!element || element.matches(":disabled") || readOnly) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, label);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    setText(label);
    element.focus({ preventScroll: true });
    setOpen(false);
  }
  return <span className="combobox-control" data-open={open && !disabled && !readOnly || undefined} data-disabled={disabled || undefined}>
    <input {...props} aria-activedescendant={open && !loading && choices[activeIndex] ? `${id}-${activeIndex}` : undefined} aria-autocomplete="list" aria-controls={open ? id : undefined} aria-expanded={open} autoComplete="off" defaultValue={defaultValue} disabled={disabled} onBlur={(event) => { setOpen(false); onBlur?.(event); }} onChange={(event) => { setText(event.target.value); setActive(0); setOpen(true); onChange?.(event); }} onFocus={(event) => { if (!readOnly) setOpen(true); onFocus?.(event); }} onKeyDown={(event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || readOnly) return;
      if (event.key === "Tab") setOpen(false);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive(() => {const enabled=choices.map((option,index)=>({option,index})).filter(({option})=>!option.disabled).map(({index})=>index);return enabled.length?enabled[(enabled.indexOf(activeIndex)+(event.key==="ArrowDown"?1:-1)+enabled.length)%enabled.length]:-1;});
      }
      if (event.key === "Enter" && open) { event.preventDefault(); if(!loading&&choices[activeIndex])choose(choices[activeIndex].label); }
    }} readOnly={readOnly} ref={input} role="combobox" value={value} />
    <span className="combobox-control__tools">{loading?<LoaderCircle className="combobox-control__spinner" size={17} aria-hidden="true"/>:selected&&!disabled&&!readOnly?<button type="button" tabIndex={-1} aria-label="Xóa lựa chọn" onMouseDown={event=>event.preventDefault()} onClick={()=>{choose("");setOpen(true);}}><X size={15} aria-hidden="true"/></button>:null}{!readOnly?<button type="button" tabIndex={-1} aria-label="Mở gợi ý" aria-controls={open?id:undefined} aria-expanded={open} disabled={disabled} onMouseDown={event=>event.preventDefault()} onClick={()=>{input.current?.focus({preventScroll:true});setOpen(!open);}}><ChevronDown size={17} aria-hidden="true"/></button>:null}</span>
    {open && !disabled && !readOnly ? <FloatingPanel anchor={input} className="select-control__panel" id={id} label="Gợi ý" onClose={() => setOpen(false)} role="listbox">
      <div className="select-control__options" ref={list}>{loading?<p className="select-control__empty" role="status"><LoaderCircle className="combobox-control__spinner" size={22} aria-hidden="true"/><span>Đang tải danh mục</span></p>:choices.length ? choices.map((option, index) => <div aria-label={option.label} aria-disabled={option.disabled||undefined} aria-selected={option.label === selected} className="select-control__option" data-active={!option.disabled&&activeIndex === index || undefined} id={`${id}-${index}`} key={option.value} onClick={() => {if(!option.disabled)choose(option.label);}} onMouseDown={(event) => event.preventDefault()} onPointerMove={() => {if(!option.disabled)setActive(index);}} role="option"><SelectOptionContent option={option}/><span className="select-control__check" aria-hidden="true">{option.label===selected?<Check size={16}/>:null}</span></div>) : <p className="select-control__empty" role="status"><Search size={22} aria-hidden="true"/><span>Không có kết quả</span></p>}</div>
    </FloatingPanel> : null}
  </span>;
}

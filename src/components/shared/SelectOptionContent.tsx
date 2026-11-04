import type { SelectOption } from "./FormControls";

export function SelectOptionContent({ option }: { option: SelectOption }) {
  return option.code ? <span className="select-control__option-copy"><span className="select-control__option-name">{option.name ?? option.label}</span><span className="select-control__option-code">{option.code}</span></span> : <span className="select-control__option-copy">{option.label}</span>;
}

export function normalizeOptionText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi");
}

export function revealOption(container: HTMLElement | null, option: HTMLElement | null) {
  if (!container || !option) return;
  const list = container.getBoundingClientRect(), row = option.getBoundingClientRect();
  if (row.top < list.top) container.scrollTop -= list.top - row.top;
  else if (row.bottom > list.bottom) container.scrollTop += row.bottom - list.bottom;
}

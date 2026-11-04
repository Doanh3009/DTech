import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Select } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";

const options = [{ label: "Nhân sự", value: "hr" }, { label: "Kỹ thuật", value: "engineering" }];

describe("enterprise Select", () => {
  it("keeps a required placeholder in FormData without presenting it as a valid choice",()=>{const{container}=render(<form><Select label="Loại hình" name="companyType" required options={[{value:"",label:"Chọn loại hình",disabled:true},{value:"company",label:"Doanh nghiệp"}]} defaultValue=""/></form>);fireEvent.click(screen.getByRole("combobox"));expect(screen.getAllByRole("option")).toHaveLength(1);expect(container.querySelector("select")!.validity.valueMissing).toBe(true);fireEvent.click(screen.getByRole("option",{name:"Doanh nghiệp"}));expect(new FormData(container.querySelector("form")!).get("companyType")).toBe("company");});
  it("skips disabled options when choosing with the keyboard",()=>{const change=vi.fn();render(<Select label="Phòng ban" defaultValue="hr" options={[options[0],{...options[1],disabled:true},{value:"production",label:"Sản xuất"}]} onChange={change}/>);const trigger=screen.getByRole("combobox");fireEvent.click(trigger);expect(screen.getByRole("option",{name:"Kỹ thuật"})).toHaveAttribute("aria-disabled","true");fireEvent.keyDown(trigger,{key:"ArrowDown"});fireEvent.keyDown(trigger,{key:"Enter"});expect(trigger).toHaveTextContent("Sản xuất");expect(change).toHaveBeenCalledOnce();});
  it("does not display the first option as selected for an empty controlled value",()=>{render(<Select label="Phòng ban" value="" required options={options}/>);expect(screen.getByRole("combobox")).toHaveTextContent("Chọn một giá trị");});
  it("closes and restores focus without changing the current value",()=>{const change=vi.fn();render(<Select label="Phần hành" value="hr" options={options} onChange={change}/>);const trigger=screen.getByRole("combobox");fireEvent.click(trigger);fireEvent.click(screen.getByRole("option",{name:"Nhân sự"}));expect(change).not.toHaveBeenCalled();expect(screen.queryByRole("listbox")).toBeNull();expect(trigger).toHaveFocus();});
  it("updates FormData and passes the original select event contract", () => {
    const change = vi.fn();
    const { container } = render(<form><Select label="Phòng ban" name="departmentId" onChange={change} options={options} placeholder="Tất cả" /></form>);
    fireEvent.click(screen.getByRole("combobox", { name: "Phòng ban" }));
    fireEvent.click(screen.getByRole("option", { name: "Kỹ thuật" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Kỹ thuật");
    expect(new FormData(container.querySelector("form")!).get("departmentId")).toBe("engineering");
    expect(change).toHaveBeenCalledOnce();
    expect(change.mock.calls[0][0].target).toBeInstanceOf(HTMLSelectElement);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports controlled values, arrows, Enter and form reset", () => {
    function Controlled() {
      const [value, setValue] = useState("hr");
      return <Select label="Phòng ban" onChange={(event) => setValue(event.target.value)} options={options} value={value} />;
    }
    const { unmount } = render(<Controlled />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveTextContent("Kỹ thuật");
    unmount();
    const { container } = render(<form><Select defaultValue="hr" label="Phòng ban" name="departmentId" options={options} /></form>);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Kỹ thuật" }));
    fireEvent.reset(container.querySelector("form")!);
    expect(screen.getByRole("combobox")).toHaveTextContent("Nhân sự");
  });

  it("searches Vietnamese labels and exposes an empty result", () => {
    render(<Select label="Phòng ban" options={[...options, ...Array.from({ length: 8 }, (_, i) => ({ label: `Phòng ${i}`, value: String(i) }))]} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ky thuat" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Kỹ thuật");
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    expect(screen.getByRole("status")).toHaveTextContent("Không có kết quả");
  });

  it("preserves required validation and focuses the custom trigger", () => {
    const { container } = render(<form><Select label="Phòng ban" name="departmentId" options={options} placeholder="Chọn" required /></form>);
    expect(container.querySelector("select")!.validity.valueMissing).toBe(true);
    fireEvent.invalid(container.querySelector("select")!);
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng chọn");
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Nhân sự" }));
    expect(container.querySelector("select")!.validity.valid).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps search focus inside a modal and dismisses only the dropdown first", () => {
    const close = vi.fn();
    render(<Modal onClose={close} open title="Nhân viên"><Select label="Phòng ban" options={Array.from({ length: 10 }, (_, i) => ({ label: `Phòng ${i}`, value: String(i) }))} /></Modal>);
    fireEvent.click(screen.getByRole("combobox"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("searchbox")).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("does not open disabled fields and closes after outside interaction", () => {
    const { rerender } = render(<Select disabled label="Phòng ban" options={options} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    rerender(<Select label="Phòng ban" options={options} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

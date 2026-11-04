import {fireEvent,render,screen} from "@testing-library/react";
import {useState} from "react";
import {describe,expect,it,vi} from "vitest";
import {Combobox} from "./FormControls";
const options=[{value:"1",code:"NCC-01",name:"Đông Nam",label:"NCC-01 · Đông Nam"},{value:"2",code:"NCC-02",name:"An Phát",label:"NCC-02 · An Phát"}];
describe("reference combobox",()=>{
 it("searches Vietnamese names and preserves its native input event",()=>{const change=vi.fn();function Field(){const[value,setValue]=useState("");return <Combobox label="Nhà cung cấp" options={options} value={value} onChange={event=>{setValue(event.target.value);change(event.target.value);}}/>;}render(<Field/>);const field=screen.getByRole("combobox");fireEvent.change(field,{target:{value:"DONG"}});expect(screen.getAllByRole("option")).toHaveLength(1);expect(screen.getByText("NCC-01")).toBeVisible();fireEvent.keyDown(field,{key:"Enter"});expect(field).toHaveValue("NCC-01 · Đông Nam");expect(change).toHaveBeenLastCalledWith("NCC-01 · Đông Nam");expect(screen.queryByRole("listbox")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Xóa lựa chọn"}));expect(field).toHaveValue("");expect(change).toHaveBeenLastCalledWith("");});
 it("announces actual loading instead of an empty result",()=>{const{rerender}=render(<Combobox label="Nhà cung cấp" options={[]} aria-busy={true}/>);fireEvent.focus(screen.getByRole("combobox"));expect(screen.getByRole("status")).toHaveTextContent("Đang tải danh mục");rerender(<Combobox label="Nhà cung cấp" options={options} aria-busy={false}/>);expect(screen.getAllByRole("option")).toHaveLength(2);expect(screen.queryByRole("status")).toBeNull();});
 it("keeps read-only references from opening or exposing clear actions",()=>{render(<Combobox label="Nhà cung cấp" options={options} value={options[0].label} readOnly/>);fireEvent.focus(screen.getByRole("combobox"));expect(screen.queryByRole("listbox")).toBeNull();expect(screen.queryByRole("button")).toBeNull();});
});

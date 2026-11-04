import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DropdownMenu } from "@/components/shared/DropdownMenu";
import {Select} from "./FormControls";

describe("DropdownMenu", () => {
  it("keeps nested selections inside their menu and closes the top panel first",()=>{render(<DropdownMenu label="Bộ lọc"><Select label="Phòng ban" options={[{label:"Kế toán",value:"accounts"},{label:"Kỹ thuật",value:"engineering"}]}/><button>Áp dụng</button></DropdownMenu>);const trigger=screen.getByRole("button",{name:"Bộ lọc"});fireEvent.click(trigger);const select=screen.getByRole("combobox",{name:"Phòng ban"});fireEvent.click(select);fireEvent.keyDown(document,{key:"Escape"});expect(screen.queryByRole("listbox")).toBeNull();expect(screen.getByRole("menu")).toBeInTheDocument();fireEvent.click(select);const choice=screen.getByRole("option",{name:"Kỹ thuật"});fireEvent.pointerDown(choice);fireEvent.click(choice);expect(select).toHaveTextContent("Kỹ thuật");expect(screen.getByRole("menu")).toBeInTheDocument();fireEvent.keyDown(document,{key:"Escape"});expect(screen.queryByRole("menu")).toBeNull();expect(trigger).toHaveFocus();});
  it("closes after clicking outside or pressing Escape", () => {
    render(<DropdownMenu label="Tác vụ"><a href="/test">Chi tiết</a></DropdownMenu>);
    const summary = screen.getByRole("button", { name: "Tác vụ" });

    fireEvent.click(summary);
    expect(screen.getByRole("menu", { name: "Tác vụ" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(summary);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(summary).toHaveFocus();
  });
});

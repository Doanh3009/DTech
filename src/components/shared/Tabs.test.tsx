import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {useState} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextTabs,ViewTabs } from "./Tabs";

vi.mock("next/navigation", () => ({ usePathname: () => "/shipments/one/containers" }));
afterEach(cleanup);

describe("context tab selection", () => {
  it("supports arrow, Home and End activation with one tab stop",()=>{
    function Example(){const[value,setValue]=useState("one");return <ViewTabs id="books" label="Books" items={[{value:"one",label:"One"},{value:"two",label:"Two"},{value:"three",label:"Three"}]} value={value} onValueChange={setValue}/>;}
    render(<Example/>);const one=screen.getByRole("tab",{name:"One"}),two=screen.getByRole("tab",{name:"Two"}),three=screen.getByRole("tab",{name:"Three"});fireEvent.keyDown(one,{key:"ArrowRight"});expect(two).toHaveFocus();expect(two).toHaveAttribute("aria-selected","true");expect(one).toHaveAttribute("tabindex","-1");fireEvent.keyDown(two,{key:"End"});expect(three).toHaveFocus();fireEvent.keyDown(three,{key:"ArrowRight"});expect(one).toHaveFocus();fireEvent.keyDown(one,{key:"ArrowLeft"});expect(three).toHaveFocus();fireEvent.keyDown(three,{key:"Home"});expect(one).toHaveFocus();expect(one).toHaveAttribute("aria-controls","books-panel");
  });
  it("does not restart loading when the active view is clicked",()=>{const select=vi.fn();render(<ViewTabs id="current" label="Current" items={[{value:"one",label:"One"}]} value="one" onValueChange={select}/>);fireEvent.click(screen.getByRole("tab"));fireEvent.keyDown(screen.getByRole("tab"),{key:"Home"});expect(select).not.toHaveBeenCalled();});
  it("marks only the most specific active route", () => {
    render(<ContextTabs label="Lô hàng" items={[
      { label: "Lô hàng", href: "/shipments", active: true },
      { label: "Tổng quan", href: "/shipments/one", active: true },
      { label: "Container", href: "/shipments/one/containers", active: true }
    ]} />);
    expect(screen.getByRole("link", { name: "Container" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation").querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Tổng quan" })).not.toHaveClass("is-active");
  });
});

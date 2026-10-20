import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { Drawer, Lightbox, Modal } from "@/components/shared/Overlays";

describe("overlay interaction", () => {
  it("defers open and persistent portals during server rendering", () => {
    for (const Component of [Modal, Drawer, Lightbox]) {
      expect(renderToString(<Component onClose={() => undefined} open title="Deep link">Content</Component>)).toBe("");
    }
    expect(renderToString(<Drawer keepMounted onClose={() => undefined} open={false} title="Filters">Content</Drawer>)).toBe("");
  });

  it("preserves field focus when the form updates an inline close callback", () => {
    const { rerender } = render(<Modal onClose={() => undefined} open title="Form"><input aria-label="Name" /></Modal>);
    const field = screen.getByRole("textbox", { name: "Name" });
    field.focus();
    fireEvent.change(field, { target: { value: "Updated" } });
    rerender(<Modal onClose={() => undefined} open title="Form"><input aria-label="Name" /></Modal>);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Updated");
  });

  it("wraps Tab from the dialog and excludes hidden and disabled controls", () => {
    render(<Modal onClose={() => undefined} open title="Form"><button hidden>Hidden</button><button disabled>Disabled</button><button type="button">Last</button></Modal>);
    const dialog = screen.getByRole("dialog", { name: "Form" });
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("contains background focus and restores the opener and scroll after closing", () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open</button><Modal onClose={() => setOpen(false)} open={open} title="Form"><input aria-label="Name" /></Modal></>;
    }
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    trigger.focus();
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("closes only the topmost dialog and retains the parent scroll lock", () => {
    const closeParent = vi.fn();
    function Example() {
      const [childOpen, setChildOpen] = useState(false);
      return <Modal onClose={closeParent} open title="Parent"><button onClick={() => setChildOpen(true)}>Child</button><Modal onClose={() => setChildOpen(false)} open={childOpen} title="Child">Content</Modal></Modal>;
    }
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Child" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Child" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Child" })).toBeNull();
    expect(closeParent).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(closeParent).toHaveBeenCalledOnce();
  });

  it("dismisses an open dropdown before its containing dialog", () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} open title="Form"><DropdownMenu label="Actions"><button type="button">Action</button></DropdownMenu></Modal>);
    const trigger = screen.getByLabelText("Actions");
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Action" }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("keeps the dialog open when a dropdown mounts after it", () => {
    const onClose = vi.fn();
    function Example() {
      const [showMenu, setShowMenu] = useState(false);
      return <Modal onClose={onClose} open title="Form"><button onClick={() => setShowMenu(true)}>Show</button>{showMenu ? <DropdownMenu label="Actions"><button type="button">Action</button></DropdownMenu> : null}</Modal>;
    }
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    const trigger = screen.getByLabelText("Actions");
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Action" }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drawer, Modal } from "@/components/shared/Overlays";

describe("overlay motion lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("restores focus and body scrolling only after the closing panel finishes", () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open</button><Modal onClose={() => setOpen(false)} open={open} title="Form"><input aria-label="Name" /></Modal></>;
    }
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(dialog.parentElement).toHaveAttribute("data-state", "closing");
    expect(document.body.style.overflow).toBe("hidden");
    expect(trigger).not.toHaveFocus();
    fireEvent.animationEnd(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("finishes a retained drawer even when the browser omits animationend", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Drawer keepMounted onClose={() => undefined} open title="Filters">Content</Drawer>);
    const host = screen.getByRole("dialog").parentElement!;
    rerender(<Drawer keepMounted onClose={() => undefined} open={false} title="Filters">Content</Drawer>);
    expect(host).not.toHaveAttribute("hidden");
    act(() => { vi.advanceTimersByTime(250); });
    expect(host).toHaveAttribute("hidden");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("keeps a reopened dialog present when the interrupted exit would finish", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Modal onClose={() => undefined} open title="Form">Content</Modal>);
    rerender(<Modal onClose={() => undefined} open={false} title="Form">Content</Modal>);
    rerender(<Modal onClose={() => undefined} open title="Form">Content</Modal>);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("dialog").parentElement).toHaveAttribute("data-state", "open");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes immediately when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { rerender } = render(<Modal onClose={() => undefined} open title="Form">Content</Modal>);
    rerender(<Modal onClose={() => undefined} open={false} title="Form">Content</Modal>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

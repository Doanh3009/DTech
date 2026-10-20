import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DropdownMenu } from "@/components/shared/DropdownMenu";

describe("DropdownMenu", () => {
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

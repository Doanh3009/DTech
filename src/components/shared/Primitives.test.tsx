import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, Popover, Tooltip } from "@/components/shared/Primitives";

describe("shared presentation primitives", () => {
  it("connects tooltip content to its trigger", () => {
    render(<Tooltip content="Chi tiết"><button type="button">Mở</button></Tooltip>);
    const tooltip = screen.getByRole("tooltip");
    expect(screen.getByRole("button", { name: "Mở" })).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("supports a compact right-side navigation tooltip", () => {
    render(<Tooltip content="Nhân viên" placement="right"><button type="button">Nhân viên</button></Tooltip>);
    expect(screen.getByRole("tooltip", { name: "Nhân viên" }).parentElement).toHaveClass("tooltip--right");
  });

  it("opens and dismisses a popover with Escape", () => {
    render(<Popover label="Tùy chọn" trigger={<span>Mở</span>}>Nội dung</Popover>);
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    expect(screen.getByRole("dialog", { name: "Tùy chọn" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Tùy chọn" })).not.toBeInTheDocument();
  });

  it("uses the shared badge tone classes", () => {
    render(<Badge tone="info">Mới</Badge>);
    expect(screen.getByText("Mới")).toHaveClass("badge--info");
  });
});

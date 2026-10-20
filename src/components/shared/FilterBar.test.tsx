import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterSheet } from "@/components/shared/FilterBar";

describe("FilterSheet", () => {
  it("keeps mobile apply and reset actions inside the bottom sheet", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const onReset = vi.fn();

    render(<FilterSheet onApply={onApply} onClose={onClose} onReset={onReset} open><label>Trạng thái<input /></label></FilterSheet>);

    expect(screen.getByRole("dialog", { name: "Bộ lọc" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(onReset).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

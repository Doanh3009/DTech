import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "@/components/shared/FilterBar";
import { Select } from "@/components/shared/FormControls";

vi.mock("@/lib/ui/useIsPhone", () => ({ useIsPhone: () => true }));

describe("mobile form filters", () => {
  it("retains dropdown values after closing and submits portalled controls through the owning form", () => {
    const submitted = vi.fn();
    const { container } = render(<form onSubmit={(event) => { event.preventDefault(); submitted(new FormData(event.currentTarget).get("status")); }}><FilterBar><Select label="Trạng thái" name="status" options={[{ label: "Đang làm", value: "active" }, { label: "Tạm nghỉ", value: "leave" }]} placeholder="Tất cả" /></FilterBar></form>);
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    fireEvent.click(screen.getByRole("option", { name: "Tạm nghỉ" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(new FormData(container.querySelector("form")!).get("status")).toBe("leave");
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Tạm nghỉ");
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(submitted).toHaveBeenCalledWith("leave");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

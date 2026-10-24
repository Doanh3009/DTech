import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { calculateImpact, ImpactExplorer } from "./ImpactExplorer";
import { IndustryCases } from "./IndustryCases";

describe("impact scenario calculation", () => {
  it("compares inputs without treating an increase or zero baseline as a saving", () => {
    expect(calculateImpact(80, 32)).toEqual({ difference: 48, percent: 60 });
    expect(calculateImpact(40, 80)).toEqual({ difference: -40, percent: -100 });
    expect(calculateImpact(0, 20)).toEqual({ difference: -20, percent: null });
  });
  it("shows fixed illustrative values in the chart and accessible table", () => {
    render(<ImpactExplorer />);
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 48 giờ / tháng");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nhập lại chứng từ" }));
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 90 lần / tháng");
    expect(screen.getByRole("img")).toHaveAccessibleName(/trước 120, sau 30/);
    fireEvent.click(screen.getByText("Xem bảng số liệu"));
    expect(within(screen.getByRole("table")).getByText("30")).toBeInTheDocument();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
  it("switches fixed scenarios and pauses animation", () => {
    render(<ImpactExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Nhập lại chứng từ" }));
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 90 lần / tháng");
    fireEvent.click(screen.getByRole("button", { name: "Tổng hợp báo cáo" }));
    expect(screen.getByRole("img")).toHaveAccessibleName(/trước 80, sau 32/);
    fireEvent.click(screen.getByRole("button", { name: "Đối chiếu kho" }));
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 28 giờ / tháng");
    fireEvent.click(screen.getByRole("button", { name: "Dừng chuyển động biểu đồ" }));
    expect(screen.getByRole("button", { name: "Bật chuyển động biểu đồ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Số liệu giả định để minh họa cách vận hành/)).toBeInTheDocument();
  });
  it("switches industry scenarios and preserves the illustrative status", () => {
    render(<IndustryCases />);
    fireEvent.click(screen.getByRole("button", { name: "Điện tử & linh kiện" }));
    expect(screen.getByRole("heading", { name: "Mỗi lô thành phẩm có nguồn gốc." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Điện tử & linh kiện" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Mẫu giao diện · Điện tử & linh kiện")).toBeInTheDocument();
  });
});

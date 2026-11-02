import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateImpact, ImpactExplorer } from "./ImpactExplorer";
import { IndustryCases } from "./IndustryCases";

describe("impact scenario calculation", () => {
  const originalScroll=HTMLElement.prototype.scrollIntoView;
  beforeEach(()=>{HTMLElement.prototype.scrollIntoView=vi.fn();});
  afterEach(()=>{HTMLElement.prototype.scrollIntoView=originalScroll;});
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
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 210 lần / tháng");
    fireEvent.click(screen.getByText("Cơ sở tính toán"));
    expect(within(screen.getByRole("table")).getByText("240 → 30 lần")).toBeInTheDocument();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
  it("switches fixed scenarios and keeps illustrative results distinct from customer measurements", () => {
    render(<ImpactExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Nhập lại chứng từ" }));
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 210 lần / tháng");
    fireEvent.click(screen.getByRole("button", { name: "Tổng hợp báo cáo" }));
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 48 giờ / tháng");
    fireEvent.click(screen.getByRole("button", { name: "Đối chiếu kho" }));
    expect(screen.getByRole("status", { name: "Kết quả so sánh" })).toHaveTextContent("Giảm 28 giờ / tháng");
    expect(screen.getByText(/Mô phỏng để minh họa cách tổ chức công việc, chưa phải kết quả đo tại khách hàng/)).toBeInTheDocument();
  });
  it("switches industry scenarios and preserves the illustrative status", () => {
    render(<IndustryCases />);
    fireEvent.click(screen.getByRole("button", { name: "Điện tử & linh kiện" }));
    expect(screen.getByRole("heading", { name: "Mỗi lô thành phẩm có nguồn gốc." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Điện tử & linh kiện" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Xem mẫu giao diện" }));
    expect(screen.getByRole("dialog", { name: "Mẫu giao diện · Điện tử & linh kiện" })).toBeInTheDocument();
  });
});

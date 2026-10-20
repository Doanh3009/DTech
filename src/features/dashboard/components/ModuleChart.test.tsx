import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModuleChart } from "./ModuleChart";

afterEach(cleanup);

describe("dashboard chart context and drilldown", () => {
  it("shows real period context and an honest empty state", () => {
    render(<ModuleChart chart={{ key: "payroll", title: "Thực nhận đã chốt", context: "05/2026 – 10/2026", series: [], emptyLabel: "Chưa có kỳ lương đã chốt trong 6 tháng này" }} />);
    expect(screen.getByText("05/2026 – 10/2026")).toBeInTheDocument();
    expect(screen.getByText("Chưa có kỳ lương đã chốt trong 6 tháng này")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải số liệu Thực nhận đã chốt" })).toBeDisabled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("connects receipt slices and the accessible data table to matching filters", () => {
    render(<ModuleChart chart={{ key: "receipt", title: "Tiếp nhận phiếu lương", context: "09/2026", kind: "donut", unit: "phiếu", series: [{ label: "Chưa xem", value: 2, href: "/accounting/payslips?month=2026-09&receipt=unseen" }, { label: "Đã xác nhận", value: 3 }] }} />);
    expect(screen.getAllByRole("link", { name: "Chưa xem", hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Chưa xem", hidden: true }).every(link => link.getAttribute("href") === "/accounting/payslips?month=2026-09&receipt=unseen")).toBe(true);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
  it("keeps a zero amount as actual data with a drilldown", () => {
    render(<ModuleChart chart={{ key: "zero", title: "Thực nhận đã chốt", kind: "bar", series: [{ label: "09/2026", value: 0, href: "/accounting/payroll/one" }] }} />);
    expect(screen.queryByText("Chưa có dữ liệu")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "09/2026", hidden: true }).every(link => link.getAttribute("href") === "/accounting/payroll/one")).toBe(true);
  });
});

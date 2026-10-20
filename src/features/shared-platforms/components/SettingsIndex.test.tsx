import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsIndex } from "./SettingsIndex";
const items = [
  { key: "gps", group_key: "attendance", label: "Địa điểm chấm công", route: "/settings/attendance/locations" },
  { key: "departments", group_key: "organization", label: "Phòng ban", route: "/settings/organization/departments" }
];
describe("settings search from server catalog", () => {
  it("renders labels and routes without business descriptions", () => {
    render(<SettingsIndex items={items} />);
    expect(screen.getByRole("link", { name: "Phòng ban" })).toHaveAttribute("href", items[1].route);
    expect(screen.getByRole("link", { name: "Địa điểm chấm công" })).toBeInTheDocument();
  });
  it("filters locally using Vietnamese text without accents", () => {
    render(<SettingsIndex items={items} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dia diem" } });
    expect(screen.getByRole("link", { name: "Địa điểm chấm công" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Phòng ban" })).not.toBeInTheDocument();
  });
  it("shows an empty result and restores the catalog when search is cleared", () => {
    render(<SettingsIndex items={items} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    expect(screen.getByText("Không tìm thấy cài đặt")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

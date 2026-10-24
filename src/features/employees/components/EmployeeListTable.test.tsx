import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmployeeListTable } from "@/features/employees/components/EmployeeListTable";
import type { EmployeeSummary } from "@/features/employees/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const employee: EmployeeSummary = {
  id: "employee/id with spaces",
  rowVersion: 3,
  employeeCode: "NV001",
  fullName: "Nguyễn Thị Thúy Hằng",
  displayName: "Thúy Hằng",
  departmentName: "Nhân sự",
  positionName: "Chuyên viên",
  employmentTypeName: "Chính thức",
  workerCategory: "office",
  phone: "0900000000",
  companyEmail: "hang@example.com",
  joinDate: "2026-01-02",
  employmentStatus: "active",
  employmentStatusLabel: "Đang làm việc",
  employmentStatusTone: "success",
  profileStatus: "complete",
  profileCompleteness: 100,
  hasAccount: true
};

describe("EmployeeListTable", () => {
  it("opens the employee profile from the name", () => {
    render(<EmployeeListTable employees={[employee]} permissions={[]} />);

    const links = screen.getAllByRole("link", { name: employee.fullName });
    expect(links).toHaveLength(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/employees/employee%2Fid%20with%20spaces/profile");
    }
    expect(screen.queryByRole("columnheader", { name: "Ngày vào làm" })).not.toBeInTheDocument();
    expect(screen.queryByText("NV001")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Họ tên" })).toHaveAttribute("data-priority", "primary");
    expect(screen.getByRole("cell", { name: new RegExp(employee.fullName) })).toHaveAttribute("data-priority", "primary");
  });

  it("shows the saved employee avatar in the roster", () => {
    const employeeWithPhoto = { ...employee, id: "90000000-0000-4000-8000-000000000002", avatarAssetId: "file-id" };
    const { container } = render(<EmployeeListTable employees={[employeeWithPhoto]} permissions={[]} />);

    expect(container.querySelector(".employee-name-with-avatar img")).toHaveAttribute(
      "src",
      `/api/v1/employees/${employeeWithPhoto.id}/avatar?v=0`
    );
  });

  it("keeps the archive dialog open after choosing it from the row menu", () => {
    render(<EmployeeListTable employees={[employee]} permissions={["employee.archive"]} />);
    fireEvent.click(screen.getByRole("button", { name: `Thao tác ${employee.fullName}` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Lưu trữ" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Lưu trữ hồ sơ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Lý do" })).toBeInTheDocument();
  });
});

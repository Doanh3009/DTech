import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmployeeListFilters } from "@/features/employees/components/EmployeeListFilters";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("EmployeeListFilters", () => {
  beforeEach(() => push.mockClear());

  it("applies selected filters and resets pagination", () => {
    render(<EmployeeListFilters
      defaults={{ page: 3, pageSize: 20 }}
      departments={[]}
      employmentTypes={[]}
      positions={[]}
      statuses={[{ label: "Tạm nghỉ", value: "on_leave" }]}
    />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), { target: { value: "An" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Trạng thái" }));
    fireEvent.click(screen.getByRole("option", { name: "Tạm nghỉ" }));
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));

    expect(push).toHaveBeenCalledWith("/employees?q=An&status=on_leave&page=1&pageSize=20");
  });

  it("clears all filters", () => {
    render(<EmployeeListFilters defaults={{ pageSize: 10 }} departments={[]} employmentTypes={[]} positions={[]} statuses={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    expect(push).toHaveBeenCalledWith("/employees");
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

interface Row {
  code: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: "code", header: "Mã", accessor: "code" },
  { id: "name", header: "Tên", accessor: "name" }
];

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("DataTable", () => {
  it("uses records in a narrow desktop container and restores the table when it fits", async () => {
    let width = 180;
    const originalBounds = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("data-table-shell") ? { ...originalBounds.call(this), width } : originalBounds.call(this);
    });
    const { container } = render(<DataTable columns={columns} data={[{ code: "NV001", name: "Nguyễn Văn A" }]} />);
    await waitFor(() => expect(container.querySelector('.data-table-shell[data-adaptive="true"]')).toBeInTheDocument());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(container.querySelector(".mobile-record__title")).toHaveTextContent("Nguyễn Văn A");
    width = 1200;
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });

  it("keeps table headers visible with an empty state", () => {
    render(<DataTable ariaLabel="Danh sách nhân viên" columns={columns} data={[]} emptyTitle="Chưa có nhân viên" />);

    expect(screen.getByRole("table", { name: "Danh sách nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Mã" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tên" })).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có nhân viên")).toHaveLength(1);
  });

  it("reserves readable space for the action column before switching to records", async () => {
    let width = 312;
    const originalBounds = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("data-table-shell") ? { ...originalBounds.call(this), width } : originalBounds.call(this);
    });
    const { container } = render(<DataTable actions={() => <button type="button">Modifier</button>} columns={columns} data={[{ code: "NV001", name: "Nguyễn Văn A" }]} />);

    await waitFor(() => expect(container.querySelector('.data-table-shell[data-adaptive="true"]')).toBeInTheDocument());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    width = 400;
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Thao tác" })).toHaveAttribute("data-column", "actions");
    expect(container.querySelector('tbody td[data-column="actions"]')).toContainElement(screen.getByRole("button", { name: "Modifier" }));
  });

  it("renders desktop table content for records", () => {
    render(<DataTable ariaLabel="Danh sách nhân viên" columns={columns} data={[{ code: "NV001", name: "Nguyễn Văn A" }]} />);

    expect(screen.getByRole("table", { name: "Danh sách nhân viên" })).toBeInTheDocument();
    expect(screen.getAllByText("NV001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nguyễn Văn A").length).toBeGreaterThan(0);
  });

  it("builds a phone record with a clear identity and an open action", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 767px)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(
      <DataTable
        columns={columns}
        data={[{ code: "NV001", name: "Nguyễn Văn A" }]}
        getRowId={(row) => row.code}
        rowHrefPrefix="/employees/"
        rowHrefSuffix="/profile"
      />
    );

    expect(container.querySelector(".mobile-record__eyebrow")).toHaveTextContent("MãNV001");
    expect(container.querySelector(".mobile-record__title")).toHaveTextContent("Nguyễn Văn A");
    expect(container.querySelector(".mobile-record__open")).toHaveAttribute("href", "/employees/NV001/profile");
    expect(container.querySelector("table")).toBeNull();
  });

  it.each([false, true])("uses the short record URL while retaining its stable selection identity (phone: %s)", (phone) => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && query === "(max-width: 767px)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const onSelectRow = vi.fn();
    const stableId = "41000000-0000-4000-8000-000000000003";
    const { container } = render(<DataTable
      columns={columns}
      data={[{ code: "NV003", name: "Nguyễn Văn A" }]}
      getRowId={() => stableId}
      getRowHref={(row) => `/employees/${row.code}/salary`}
      rowHrefPrefix="/employees/"
      rowHrefSuffix="/profile"
      onSelectRow={onSelectRow}
      selectedRowIds={new Set([stableId])}
    />);

    expect(container.querySelector(phone ? ".mobile-record__open" : ".data-table__row-link")).toHaveAttribute("href", "/employees/NV003/salary");
    const checkbox = screen.getByRole("checkbox", { name: "Chọn dòng 1" });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(onSelectRow).toHaveBeenCalledWith(stableId, false);
  });

  it("marks a selected business row for visual treatment", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[{ code: "NV001", name: "Nguyễn Văn A" }]}
        getRowId={(row) => row.code}
        onSelectRow={() => undefined}
        selectedRowIds={new Set(["NV001"])}
      />
    );

    expect(container.querySelector("tbody tr")).toHaveClass("is-selected");
  });

  it("selects on one click and exposes double-click and Enter navigation", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[{ code: "NV001", name: "Nguyễn Văn A" }]}
        getRowId={(row) => row.code}
        rowHrefPrefix="/employees/"
        rowHrefSuffix="/profile"
      />
    );

    const row = container.querySelector<HTMLTableRowElement>("tbody tr");
    expect(row).toHaveAttribute("tabindex", "0");
    expect(container.querySelector<HTMLAnchorElement>(".data-table__row-link")).toHaveAttribute("href", "/employees/NV001/profile");

    fireEvent.click(row!);
    expect(row).toHaveClass("is-selected");
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("sorts sortable columns and announces the direction", () => {
    const sortableColumns: DataTableColumn<Row>[] = [
      { id: "code", header: "Mã", accessor: "code", sortable: true },
      columns[1]
    ];
    render(<DataTable columns={sortableColumns} data={[{ code: "NV010", name: "B" }, { code: "NV002", name: "A" }]} />);

    const sortButton = screen.getByRole("button", { name: /Mã/ });
    fireEvent.click(sortButton);
    expect(screen.getByRole("columnheader", { name: /Mã/ })).toHaveAttribute("aria-sort", "ascending");
    expect(within(screen.getAllByRole("row")[1]).getByText("NV002")).toBeInTheDocument();

    fireEvent.click(sortButton);
    expect(screen.getByRole("columnheader", { name: /Mã/ })).toHaveAttribute("aria-sort", "descending");
    expect(within(screen.getAllByRole("row")[1]).getByText("NV010")).toBeInTheDocument();
  });

  it("opens a focused row with Enter without hijacking controls inside it", () => {
    const { container } = render(<DataTable actions={() => <button type="button">Modifier</button>} columns={columns} data={[{ code: "NV001", name: "A" }]} getRowId={(row) => row.code} rowHrefPrefix="/employees/" />);
    const row = container.querySelector<HTMLTableRowElement>("tbody tr")!;
    const link = container.querySelector<HTMLAnchorElement>(".data-table__row-link")!;
    const open = vi.spyOn(link, "click").mockImplementation(() => undefined);

    fireEvent.keyDown(screen.getByRole("button", { name: "Modifier" }), { key: "Enter" });
    fireEvent.keyDown(link, { key: "Enter" });
    expect(open).not.toHaveBeenCalled();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(open).toHaveBeenCalledOnce();
  });
});

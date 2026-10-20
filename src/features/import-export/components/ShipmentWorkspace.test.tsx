import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Shipment } from "../types/importExportTypes";

const mocks = vi.hoisted(() => ({ section: "containers", shipment: {} as Shipment, api: vi.fn(), reload: vi.fn() }));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => mocks.section, usePathname: () => `/import-export/shipments/one/${mocks.section}`, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/providers/CurrentUserProvider", () => ({ useCurrentUser: () => ({ permissions: ["shipment.view", "shipment.edit", "customs.manage", "shipment.update_schedule"] }) }));
vi.mock("@/lib/ui/useIsPhone", () => ({ useIsPhone: () => false }));
vi.mock("@/lib/ui/useLoadingActivity", () => ({ useLoadingActivity: vi.fn() }));
vi.mock("./importExportClient", () => ({ requestImportExport: mocks.api, useImportExportData: () => ({ data: mocks.shipment, loading: false, error: "", reload: mocks.reload }) }));

import { ShipmentDetailView } from "./ShipmentWorkspace";

beforeEach(() => {
  mocks.section = "containers";
  mocks.api.mockReset().mockResolvedValue({});
  mocks.reload.mockReset().mockImplementation(async () => mocks.shipment);
  mocks.shipment = { id: "one", shipmentNumber: "SHP-TEST", supplierId: "supplier", supplierName: "Nhà cung cấp", transportMode: "sea", shipmentType: "import", status: "booked", rowVersion: 1, lines: [], containers: [], documents: [], scheduleHistory: [], customs: { status: "not_started", rowVersion: 1 } };
});
afterEach(cleanup);

describe("shipment workspace navigation and concurrent editing", () => {
  it("preserves an unsaved container across section changes and exposes only the active section", () => {
    const view = render(<ShipmentDetailView id="one" />);
    fireEvent.change(screen.getByLabelText(/Số container/), { target: { value: "MSCU1234567" } });
    mocks.section = "lines";
    view.rerender(<ShipmentDetailView id="one" />);
    expect(screen.queryByRole("textbox", { name: /Số container/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hàng hóa" })).toHaveAttribute("aria-current", "page");
    mocks.section = "containers";
    view.rerender(<ShipmentDetailView id="one" />);
    expect(screen.getByLabelText(/Số container/)).toHaveValue("MSCU1234567");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("keeps a customs draft after another user writes and requires an explicit reload before saving", async () => {
    mocks.section = "customs";
    const view = render(<ShipmentDetailView id="one" />);
    fireEvent.change(screen.getByLabelText("Số tờ khai"), { target: { value: "LOCAL-DRAFT" } });
    mocks.shipment = { ...mocks.shipment, customs: { ...mocks.shipment.customs, rowVersion: 2, declarationNumber: "REMOTE-VALUE" } };
    view.rerender(<ShipmentDetailView id="one" />);
    expect(screen.getByLabelText("Số tờ khai")).toHaveValue("LOCAL-DRAFT");
    expect(screen.getByRole("alert")).toHaveTextContent("Dữ liệu đã được cập nhật bởi người khác.");
    expect(screen.getByRole("button", { name: "Lưu thông quan" })).toBeDisabled();
    expect(mocks.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tải bản mới" }));
    expect(screen.getByLabelText("Số tờ khai")).toHaveValue("REMOTE-VALUE");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông quan" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
    const payload = JSON.parse(mocks.api.mock.calls[0][1].body);
    expect(payload).toMatchObject({ rowVersion: 2, declarationNumber: "REMOTE-VALUE" });
  });

  it("retains the same request identity when a schedule write is retried after a lost response", async () => {
    mocks.section = "history";
    mocks.api.mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce({});
    render(<ShipmentDetailView id="one" />);
    fireEvent.change(screen.getByLabelText(/ETA mới/), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật lịch trình" }));
    await screen.findByText("Mất kết nối");
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật lịch trình" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mocks.api.mock.calls[0][1].body).clientRequestId).toBe(JSON.parse(mocks.api.mock.calls[1][1].body).clientRequestId);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/features/attendance/client/attendanceAddressClient", () => ({ lookupAttendanceAddress: lookup }));
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";

beforeEach(() => { vi.clearAllMocks(); lookup.mockResolvedValue({ status: "resolved", address: "86 Lê Thánh Tôn, Sài Gòn, Thành phố Hồ Chí Minh", attribution: "© OpenStreetMap", attributionUrl: "https://www.openstreetmap.org/copyright" }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("attendance address display", () => {
  it("shows a readable address, map link, data source and actual GPS accuracy", async () => {
    render(<AttendanceLocationAddress accuracyMeters={12.4} latitude={10.7769} longitude={106.7009} referenceName="Văn phòng" />);
    expect(await screen.findByText("86 Lê Thánh Tôn, Sài Gòn, Thành phố Hồ Chí Minh")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vị trí chấm công.*86 Lê Thánh Tôn.*GPS ±12 m/ })).toHaveAttribute("href", "https://www.google.com/maps?q=10.7769,106.7009");
    expect(screen.getByText("Gần vị trí GPS · GPS ±12 m")).toBeInTheDocument();
    expect(screen.queryByText("Văn phòng", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "© OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(screen.queryByText("10.77690, 106.70090")).not.toBeInTheDocument();
  });

  it("does not present a nearby reference name as an exact address when the provider is unavailable", async () => {
    lookup.mockResolvedValue({ status: "unavailable" });
    render(<AttendanceLocationAddress latitude={0} longitude={0} referenceName="Văn phòng tham chiếu" />);
    expect(await screen.findByText("Xem vị trí trên bản đồ")).toBeInTheDocument();
    expect(screen.queryByText("Văn phòng tham chiếu", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vị trí chấm công/ })).toHaveAttribute("href", "https://www.google.com/maps?q=0,0");
  });

  it("uses verified worksite addresses without sending GPS externally", () => {
    render(<AttendanceLocationAddress accuracyMeters={20} knownAddress="Công trường, Đường số 2" latitude={10.77} longitude={106.7} referenceName="Gói A" />);
    expect(screen.getByText("Công trường, Đường số 2")).toBeInTheDocument();
    expect(screen.getByText("Theo công trường · GPS ±20 m")).toBeInTheDocument();
    expect(screen.getByText("Gói A")).toBeInTheDocument();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("does not geocode missing or invalid coordinates", () => {
    render(<AttendanceLocationAddress latitude={NaN} longitude={106.7} />);
    expect(screen.getByText("Chưa có GPS")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("waits for a visible element before resolving an admin evidence address", async () => {
    let notify: IntersectionObserverCallback | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: IntersectionObserverCallback) { notify = callback; } observe = vi.fn(); disconnect = vi.fn(); });
    render(<AttendanceLocationAddress latitude={10.7769} longitude={106.7009} />);
    expect(lookup).not.toHaveBeenCalled();
    notify!([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
    expect(await screen.findByText("86 Lê Thánh Tôn, Sài Gòn, Thành phố Hồ Chí Minh")).toBeInTheDocument();
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

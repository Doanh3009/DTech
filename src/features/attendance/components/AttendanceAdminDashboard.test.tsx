import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceAdminDashboard } from "./AttendanceAdminDashboard";
import type { AttendanceAdminToday, AttendanceAdminTodayRow, AttendanceEvent } from "@/features/attendance/types/attendanceTypes";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
// Address lookup has its own API/client tests; do not let it consume this workstation's staged attendance fetches.
vi.mock("@/features/attendance/client/attendanceAddressClient", () => ({ lookupAttendanceAddress: vi.fn().mockResolvedValue({ status: "unavailable" }) }));

const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const event = (employeeId: string, suffix: string, eventType: "check_in" | "check_out", clock: string, day = date): AttendanceEvent => {
  const id = employeeId + "-" + suffix;
  const stamp = day + "T" + clock + ":00+07:00";
  return { id, clientEventId: id, employeeId, eventType, attendanceDate: day, effectiveAt: stamp, capturedAtClient: stamp, receivedAtServer: stamp, photoId: "photo-" + id, photoStatus: "uploaded", syncStatus: "synced", geofenceStatus: "valid", attendanceStatus: "recorded", latitude: 10.7769, longitude: 106.7009, accuracyMeters: 12, anomalyFlags: [] };
};
const employee = (employeeId: string, employeeName: string, employeeCode: string, overrides: Partial<AttendanceAdminTodayRow> = {}, day = date): AttendanceAdminTodayRow => ({
  employeeId, employeeName, employeeCode, departmentId: "department-1", departmentName: "Nhân sự", shiftName: "Ca hành chính", checkIn: day + "T08:00:00+07:00", checkOut: day + "T17:00:00+07:00", lateMinutes: 0, earlyLeaveMinutes: 0, totalMinutes: 540, status: "present", events: [event(employeeId, "in", "check_in", "08:00", day), event(employeeId, "out", "check_out", "17:00", day)], ...overrides
});
const row = employee("employee-1", "Nguyễn Văn An", "NV01");
const secondRow = employee("employee-2", "Trần Văn Bình", "NV02");
const data: AttendanceAdminToday = { date, totalEmployees: 1, present: 1, late: 0, leave: 0, notChecked: 0, missingCheck: 0, canViewPhotos: true, rows: [row] };
const response = (value: AttendanceAdminToday) => ({ ok: true, json: async () => ({ data: value }) });
const inspector = () => screen.getByRole("region", { name: "Kiểm tra ảnh nhân viên" });
const markReviewed = () => screen.getByRole("button", { name: /^Đã xem và tiếp/ });
const loadFocusedPhotos = () => within(inspector()).getAllByRole("img").forEach((image) => fireEvent.load(image));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HR daily attendance photo workstation", () => {
  it("shows the large in/out pair beside lazy queue thumbnails and navigates enlarged photos directly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(data)));
    render(<AttendanceAdminDashboard />);
    const openPhoto = await screen.findByRole("button", { name: "Xem ảnh chấm vào của Nguyễn Văn An lúc 08:00" });
    const focusedPhotos = within(inspector()).getAllByRole("img");
    expect(focusedPhotos).toHaveLength(2);
    expect(focusedPhotos[0]).toHaveAttribute("src", "/api/v1/attendance/photos/photo-employee-1-in");
    expect(focusedPhotos[1]).toHaveAttribute("src", "/api/v1/attendance/photos/photo-employee-1-out");
    focusedPhotos.forEach((image) => expect(image).toHaveAttribute("loading", "eager"));
    const queuePhoto = within(screen.getByRole("complementary", { name: "Hàng đợi kiểm tra ảnh" })).getByRole("img");
    expect(queuePhoto).toHaveAttribute("src", "/api/v1/attendance/photos/photo-employee-1-in?size=thumbnail");
    expect(queuePhoto).toHaveAttribute("loading", "lazy");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: row.employeeName })).not.toBeInTheDocument();
    expect(within(inspector()).getAllByRole("link", { name: /Vị trí chấm công/ })[0]).toHaveAttribute("href", "https://www.google.com/maps?q=10.7769,106.7009");
    openPhoto.focus();
    fireEvent.click(openPhoto);
    let viewer = await screen.findByRole("dialog", { name: "Nguyễn Văn An · Chấm vào" });
    expect(within(viewer).getByRole("img")).toHaveAttribute("src", "/api/v1/attendance/photos/photo-employee-1-in");
    expect(within(viewer).getByRole("button", { name: "Ảnh trước" })).toBeDisabled();
    fireEvent.click(within(viewer).getByRole("button", { name: "Ảnh sau" }));
    viewer = screen.getByRole("dialog", { name: "Nguyễn Văn An · Chấm ra" });
    expect(within(viewer).getByRole("img")).toHaveAttribute("src", "/api/v1/attendance/photos/photo-employee-1-out");
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Nguyễn Văn An · Chấm vào" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openPhoto).toHaveFocus();
  });

  it("clears old employee evidence immediately while the newly selected day loads", async () => {
    let resolveNext!: (value: ReturnType<typeof response>) => void;
    const nextRead = new Promise<ReturnType<typeof response>>((resolve) => { resolveNext = resolve; });
    const fetch = vi.fn().mockResolvedValueOnce(response(data)).mockReturnValueOnce(nextRead);
    vi.stubGlobal("fetch", fetch);
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    fireEvent.change(screen.getByLabelText("Ngày"), { target: { value: "2026-09-30" } });
    expect(screen.queryByText(row.employeeName)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/v1/attendance/admin/today?date=2026-09-30", expect.objectContaining({ signal: expect.any(AbortSignal) })));
    resolveNext(response({ ...data, date: "2026-09-30", rows: [employee("employee-2", secondRow.employeeName, "NV02", {}, "2026-09-30")] }));
    expect(await screen.findByRole("heading", { name: secondRow.employeeName })).toBeInTheDocument();
  });

  it("finds an employee by code and exposes pending evidence without requesting a broken image", async () => {
    const pending = employee("employee-2", secondRow.employeeName, "NV02", { checkOut: undefined, events: [{ ...event("employee-2", "pending", "check_in", "08:10"), photoId: undefined, photoStatus: "pending_upload" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...data, rows: [row, pending] })));
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    fireEvent.change(screen.getByLabelText("Nhân viên"), { target: { value: "NV02" } });
    expect(screen.queryByText(row.employeeName)).not.toBeInTheDocument();
    expect(within(inspector()).getByRole("heading", { name: secondRow.employeeName })).toBeInTheDocument();
    expect(screen.getByText("Chờ đồng bộ ảnh")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(markReviewed()).toBeDisabled();
  });

  it("keeps photo requests and both inspection decisions disabled without photo permission", async () => {
    const preloadImage = vi.fn(function () { return document.createElement("img"); });
    vi.stubGlobal("Image", preloadImage);
    const fetch = vi.fn().mockResolvedValue(response({ ...data, canViewPhotos: false }));
    vi.stubGlobal("fetch", fetch);
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByText("Không có quyền xem ảnh")).toHaveLength(2);
    expect(markReviewed()).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Đánh dấu F/ })).toBeDisabled();
    expect(preloadImage).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([url]) => typeof url === "string" && url.startsWith("/api/v1/attendance/admin/today"))).toBe(true);
  });

  it("recovers a failed data read through the visible retry action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Dữ liệu tạm thời gián đoạn" } }) }).mockResolvedValueOnce(response(data)));
    render(<AttendanceAdminDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu tạm thời gián đoạn");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { name: row.employeeName })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("limits the employee queue to 40 items and loads the remainder on request", async () => {
    const rows = Array.from({ length: 41 }, (_, index) => employee("employee-" + index, "Nhân viên " + String(index).padStart(2, "0"), "NV" + index, { events: [], status: "not_checked", checkIn: undefined, checkOut: undefined, totalMinutes: 0 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...data, totalEmployees: rows.length, rows })));
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: "Ảnh theo nhân viên" });
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s+41$/ }));
    const queue = screen.getByRole("complementary", { name: "Hàng đợi kiểm tra ảnh" });
    expect(within(queue).getAllByRole("button", { name: /^Kiểm tra Nhân viên/ })).toHaveLength(40);
    expect(screen.queryByRole("button", { name: "Kiểm tra Nhân viên 40" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm 1 người" }));
    expect(within(queue).getAllByRole("button", { name: /^Kiểm tra Nhân viên/ })).toHaveLength(41);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra Nhân viên 40" }));
    expect(within(inspector()).getByRole("heading", { name: "Nhân viên 40" })).toBeInTheDocument();
  });

  it("requires the focused images to load, then marks and advances with one reversible action", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ...data, totalEmployees: 2, rows: [row, secondRow] }));
    vi.stubGlobal("fetch", fetch);
    render(<AttendanceAdminDashboard ownerAccountId="reviewer-1" />);
    await screen.findByRole("heading", { name: row.employeeName });
    expect(markReviewed()).toBeDisabled();
    const photos = within(inspector()).getAllByRole("img");
    fireEvent.load(photos[0]);
    expect(markReviewed()).toBeDisabled();
    fireEvent.load(photos[1]);
    await waitFor(() => expect(markReviewed()).toBeEnabled());
    fireEvent.click(markReviewed());
    expect(within(inspector()).getByRole("heading", { name: secondRow.employeeName })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tiến độ xem ảnh" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.queryByRole("button", { name: "Kiểm tra " + row.employeeName })).not.toBeInTheDocument();
    expect(markReviewed()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(within(inspector()).getByRole("heading", { name: row.employeeName })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tiến độ xem ảnh" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps failed images unreviewed until the failed image retry succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(data)));
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    const [checkIn, checkOut] = within(inspector()).getAllByRole("img");
    fireEvent.load(checkIn);
    fireEvent.error(checkOut);
    expect(screen.getByText("Ảnh không khả dụng")).toBeInTheDocument();
    expect(markReviewed()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại ảnh" }));
    const retryPhoto = within(inspector()).getByRole("img", { name: "Nguyễn Văn An · Chấm ra 17:00" });
    expect(retryPhoto).toHaveAttribute("src", "/api/v1/attendance/photos/photo-employee-1-out?retry=1");
    fireEvent.load(retryPhoto);
    await waitFor(() => expect(markReviewed()).toBeEnabled());
  });

  it("requires duplicate attendance evidence to be inspected before completing the employee", async () => {
    const duplicateRow = { ...row, events: [event(row.employeeId, "in-earlier", "check_in", "07:55"), ...(row.events ?? [])] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...data, rows: [duplicateRow] })));
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    loadFocusedPhotos();
    expect(markReviewed()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Chấm vào lượt 2 lúc 08:00" }));
    fireEvent.load(within(inspector()).getByRole("img", { name: "Nguyễn Văn An · Chấm vào 08:00" }));
    await waitFor(() => expect(markReviewed()).toBeEnabled());
  });

  it("reopens inspection after a new photo changes already reviewed evidence", async () => {
    const changedRow = { ...row, events: (row.events ?? []).map((item) => item.eventType === "check_out" ? { ...item, photoId: "photo-updated-out" } : item) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({ ...data, rows: [changedRow] })));
    render(<AttendanceAdminDashboard ownerAccountId="reviewer-1" />);
    await screen.findByRole("heading", { name: row.employeeName });
    loadFocusedPhotos();
    await waitFor(() => expect(markReviewed()).toBeEnabled());
    fireEvent.click(markReviewed());
    expect(screen.getByRole("heading", { name: "Đã xem hết ảnh trong ngày" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Làm mới ảnh chấm công" }));
    expect(await screen.findByRole("heading", { name: row.employeeName })).toBeInTheDocument();
    expect(within(inspector()).getByRole("img", { name: "Nguyễn Văn An · Chấm ra 17:00" })).toHaveAttribute("src", "/api/v1/attendance/photos/photo-updated-out");
    expect(markReviewed()).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Tiến độ xem ảnh" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("uses navigation and review shortcuts while preserving normal input keyboard behavior", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...data, rows: [row, secondRow] })));
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    // The heading commits before the asynchronous review initialization and document shortcut effect finish.
    await waitFor(() => expect(within(inspector()).getByRole("button", { name: /^Đánh dấu/ })).toBeEnabled());
    await act(async () => {});
    const search = screen.getByLabelText("Nhân viên");
    search.focus();
    fireEvent.keyDown(search, { key: "ArrowRight" });
    fireEvent.keyDown(search, { key: "f" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(within(inspector()).getByRole("heading", { name: row.employeeName })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tiến độ xem ảnh" })).toHaveAttribute("aria-valuenow", "0");
    inspector().focus();
    await act(async () => { fireEvent.keyDown(inspector(), { key: "ArrowRight" }); });
    expect(await within(inspector()).findByRole("heading", { name: secondRow.employeeName })).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(inspector(), { key: "ArrowLeft" }); });
    expect(await within(inspector()).findByRole("heading", { name: row.employeeName })).toBeInTheDocument();
    loadFocusedPhotos();
    await waitFor(() => expect(markReviewed()).toBeEnabled());
    await act(async () => { fireEvent.keyDown(inspector(), { key: "Enter" }); });
    expect(await within(inspector()).findByRole("heading", { name: secondRow.employeeName })).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(inspector(), { key: "f" }); });
    await screen.findByRole("heading", { name: "Đã xem hết ảnh trong ngày" });
    fireEvent.click(screen.getByRole("button", { name: /^Đánh dấu \d+$/ }));
    expect(within(inspector()).getByRole("heading", { name: secondRow.employeeName })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra " + secondRow.employeeName + " · Đánh dấu" })).toBeInTheDocument();
  });

  it("keeps progress in memory without an account and starts fresh after remount", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(data)));
    const first = render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    loadFocusedPhotos();
    await waitFor(() => expect(markReviewed()).toBeEnabled());
    fireEvent.click(markReviewed());
    expect(screen.getByRole("progressbar", { name: "Tiến độ xem ảnh" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("Trong phiên này")).toBeInTheDocument();
    first.unmount();
    render(<AttendanceAdminDashboard />);
    await screen.findByRole("heading", { name: row.employeeName });
    expect(screen.getByRole("progressbar", { name: "Tiến độ xem ảnh" })).toHaveAttribute("aria-valuenow", "0");
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("aborts an unfinished read when the workstation unmounts", async () => {
    const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);
    const view = render(<AttendanceAdminDashboard />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const options = fetch.mock.calls[0][1] as RequestInit;
    expect(options.signal?.aborted).toBe(false);
    view.unmount();
    expect(options.signal?.aborted).toBe(true);
  });
});

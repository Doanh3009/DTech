import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeRecord } from "@/features/employees/types";
import { EmployeeEditForm } from "./EmployeeEditForm";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const employee: EmployeeRecord = {
  id: "11111111-1111-4111-8111-111111111111", employeeCode: "NV001", fullName: "Nguyễn Văn An", displayName: "An",
  personalPhone: "0901234567", normalizedPhone: "0901234567", personalEmail: "an@example.com", currentAddress: "Địa chỉ cũ",
  departmentId: "22222222-2222-4222-8222-222222222222", positionId: "33333333-3333-4333-8333-333333333333", employmentTypeId: "44444444-4444-4444-8444-444444444444",
  joinDate: "2026-01-01", employmentStatus: "active", profileStatus: "complete", profileCompleteness: 100, country: "Việt Nam", rowVersion: 3,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
};
function renderForm(options: { canOffboard?: boolean; employee?: EmployeeRecord } = {}) {
  const result = render(<EmployeeEditForm canOffboard={options.canOffboard ?? true} employee={options.employee ?? employee} departments={[{ id: employee.departmentId, code: "hr", name: "Nhân sự", active: true, sortOrder: 1 }]} positions={[{ id: employee.positionId, code: "staff", name: "Nhân viên", active: true, sortOrder: 1 }]} employmentTypes={[{ id: employee.employmentTypeId, code: "office", name: "Văn phòng", workerCategory: "office", active: true, sortOrder: 1 }]} managers={[]} />);
  return { ...result, form: result.container.querySelector("form")! };
}
const success = { ok: true, status: 200, json: async () => ({ ok: true, data: { employeeId: employee.id, rowVersion: 4 } }) };
const submitted = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(fetchMock.mock.calls[0][1].body as string);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("employee profile edit command", () => {
  it("does not send an empty patch", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần có ít nhất một thông tin thay đổi");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends explicit clears and only changed fields with the original version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(success); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Email cá nhân"), { target: { value: "" } });
    fireEvent.submit(form);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/employees/${employee.id}/profile`));
    expect(submitted(fetchMock)).toEqual({ rowVersion: 3, displayName: null, personalEmail: null });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("blocks duplicate submissions while a write is pending", async () => {
    let resolve: (value: typeof success) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; })); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: "Nguyễn Văn Bình" } });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(/Họ và tên/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    resolve(success);
    await waitFor(() => expect(router.push).toHaveBeenCalledOnce());
  });

  it.each([
    () => Promise.reject(new Error("network")),
    () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error("invalid JSON"); } }),
    () => Promise.resolve({ ok: false, status: 503, json: async () => ({ ok: false, error: { message: "Unavailable" } }) })
  ])("keeps the draft and requires reload after an ambiguous result", async (reply) => {
    const fetchMock = vi.fn().mockImplementation(reply); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: "Nguyễn Văn Bình" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác định được kết quả lưu");
    expect(screen.getByLabelText(/Họ và tên/)).toHaveValue("Nguyễn Văn Bình");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải lại hồ sơ" })).toBeEnabled();
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("requires reload on a version conflict without rebasing the draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ ok: false, error: { message: "Hồ sơ đã thay đổi." } }) }); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText("Địa chỉ hiện tại"), { target: { value: "Địa chỉ mới" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Hồ sơ đã thay đổi.");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(submitted(fetchMock).rowVersion).toBe(3);
    expect(screen.getByLabelText("Địa chỉ hiện tại")).toHaveValue("Địa chỉ mới");
  });

  it("allows correction after a rejected validation request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, error: { message: "Mã nhân viên chưa hợp lệ." } }) }); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: "Nguyễn Văn Bình" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Mã nhân viên chưa hợp lệ.");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
    expect(screen.getByLabelText(/Họ và tên/)).toBeEnabled();
  });

  it("omits the termination choice without offboard permission", () => {
    const { form } = renderForm({ canOffboard: false });
    expect(form.querySelector('select[name="employmentStatus"] option[value="terminated"]')).toBeNull();
    expect(screen.queryByLabelText("Ngày nghỉ việc")).not.toBeInTheDocument();
  });

  it("requires a date and reason before sending termination", async () => {
    const fetchMock = vi.fn().mockResolvedValue(success); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm();
    fireEvent.change(form.querySelector('select[name="employmentStatus"]')!, { target: { value: "terminated" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần nhập ngày nghỉ việc.");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Ngày nghỉ việc/), { target: { value: "2026-10-22" } });
    fireEvent.change(screen.getByLabelText(/Lý do nghỉ việc/), { target: { value: "Theo nguyện vọng" } });
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(submitted(fetchMock)).toEqual({ rowVersion: 3, employmentStatus: "terminated", terminationDate: "2026-10-22", terminationReason: "Theo nguyện vọng" });
  });

  it("edits a terminated employee's general fields without sending lifecycle changes or permitting rehire", async () => {
    const fetchMock = vi.fn().mockResolvedValue(success); vi.stubGlobal("fetch", fetchMock);
    const { form } = renderForm({ canOffboard: false, employee: { ...employee, employmentStatus: "terminated", terminationDate: "2026-10-22", terminationReason: "Theo nguyện vọng" } });
    expect(form.querySelectorAll('select[name="employmentStatus"] option')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Địa chỉ hiện tại"), { target: { value: "Địa chỉ mới" } });
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(submitted(fetchMock)).toEqual({ rowVersion: 3, currentAddress: "Địa chỉ mới" });
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveEmployeeButton } from "./ArchiveEmployeeButton";
import { EmployeeSensitiveEdit } from "./EmployeeSensitiveEdit";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const employeeId = "11111111-1111-4111-8111-111111111111";
const profile = { allowed: true as const, employeeId, bankName: "Ngân hàng cũ", bankAccountNumber: "123456789", nationalIdNumber: "123456789012", updatedAt: "2026-01-01T00:00:00Z" };
const success = { ok: true, status: 200, json: async () => ({ ok: true, data: { employeeId, rowVersion: 5 } }) };
const submitted = (mock: ReturnType<typeof vi.fn>) => JSON.parse(mock.mock.calls[0][1].body as string);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

function sensitiveForm() {
  render(<EmployeeSensitiveEdit employeeId={employeeId} rowVersion={4} profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  const dialog = screen.getByRole("dialog", { name: "Thông tin nhạy cảm" });
  return { form: dialog.querySelector("form")!, dialog, reason: screen.getByLabelText(/Lý do thay đổi/) };
}

describe("sensitive correction form", () => {
  it("does not write unchanged values", async () => {
    const mock = vi.fn(); vi.stubGlobal("fetch", mock);
    const { form, reason } = sensitiveForm();
    fireEvent.change(reason, { target: { value: "Đối chiếu hồ sơ" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần có ít nhất một thông tin thay đổi");
    expect(mock).not.toHaveBeenCalled();
  });

  it("sends explicit clearing and changed values with the original row version", async () => {
    const mock = vi.fn().mockResolvedValue(success); vi.stubGlobal("fetch", mock);
    const { form, reason } = sensitiveForm();
    fireEvent.change(screen.getByLabelText("Ngân hàng"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Chi nhánh"), { target: { value: "Chi nhánh mới" } });
    fireEvent.change(reason, { target: { value: "Đối chiếu hồ sơ" } });
    fireEvent.submit(form);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(submitted(mock)).toEqual({ rowVersion: 4, reason: "Đối chiếu hồ sơ", bankName: null, bankBranch: "Chi nhánh mới" });
    expect(mock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe.each(["sensitive", "archive"] as const)("%s command form", (variant) => {
  function openForm() {
    if (variant === "sensitive") {
      const result = sensitiveForm();
      fireEvent.change(screen.getByLabelText("Ngân hàng"), { target: { value: "Ngân hàng mới" } });
      fireEvent.change(result.reason, { target: { value: "Điều chỉnh hồ sơ" } });
      return { ...result, submitLabel: "Lưu" };
    }
    render(<ArchiveEmployeeButton employeeId={employeeId} rowVersion={4} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu trữ" }));
    const dialog = screen.getByRole("dialog", { name: "Lưu trữ hồ sơ" });
    const reason = within(dialog).getByRole("textbox", { name: "Lý do" });
    fireEvent.change(reason, { target: { value: "Điều chỉnh hồ sơ" } });
    return { form: dialog.querySelector("form")!, dialog, reason, submitLabel: "Lưu trữ" };
  }

  it("blocks duplicate submits and closing while pending", async () => {
    let resolve: (value: typeof success) => void = () => {};
    const mock = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; })); vi.stubGlobal("fetch", mock);
    const { form, reason, dialog } = openForm();
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mock).toHaveBeenCalledOnce();
    expect(reason).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    resolve(success);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(submitted(mock)).toMatchObject({ rowVersion: 4, reason: "Điều chỉnh hồ sơ" });
  });

  it.each([
    { reply: () => Promise.reject(new Error("Network failure")), expected: "Chưa xác định được kết quả lưu" },
    { reply: () => Promise.reject(new DOMException("Timed out", "TimeoutError")), expected: "Chưa xác định được kết quả lưu" },
    { reply: () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error("Invalid JSON"); } }), expected: "Chưa xác định được kết quả lưu" },
    { reply: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, data: { employeeId, rowVersion: 4 } }) }), expected: "Chưa xác định được kết quả lưu" },
    { reply: () => Promise.resolve({ ok: false, status: 503, json: async () => ({ ok: false }) }), expected: "Chưa xác định được kết quả lưu" },
    { reply: () => Promise.resolve({ ok: false, status: 409, json: async () => ({ ok: false, error: { message: "Hồ sơ đã thay đổi" } }) }), expected: "Hồ sơ đã thay đổi" }
  ])("preserves the draft and requires reload for an uncertain/conflicted result", async ({ reply, expected }) => {
    const mock = vi.fn().mockImplementation(reply); vi.stubGlobal("fetch", mock);
    const { form, reason, dialog, submitLabel } = openForm();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(reason).toHaveValue("Điều chỉnh hồ sơ");
    expect(reason).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: submitLabel })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Tải lại hồ sơ" })).toBeEnabled();
    fireEvent.submit(form);
    expect(mock).toHaveBeenCalledOnce();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("allows correction after a definitive validation rejection", async () => {
    const mock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, error: { message: "Dữ liệu chưa hợp lệ" } }) }); vi.stubGlobal("fetch", mock);
    const { form, reason, dialog, submitLabel } = openForm();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu chưa hợp lệ");
    expect(reason).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: submitLabel })).toBeEnabled();
    expect(within(dialog).queryByRole("button", { name: "Tải lại hồ sơ" })).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountRecoveryPanel } from "./AccountRecoveryPanel";
import { accountOperationsChanged } from "@/features/employees/components/useAccountProvisionCommand";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const operation = {
  requestId: "11111111-1111-4111-8111-111111111111", accountId: "22222222-2222-4222-8222-222222222222",
  employeeId: "33333333-3333-4333-8333-333333333333", kind: "provision" as const,
  state: "prepared" as const, username: "nv001", credentialMode: "generated" as "generated" | "provided", createdAt: "2026-10-22T00:00:00Z"
};
type TestOperation = Omit<typeof operation, "kind" | "state"> & { kind: "provision" | "delete"; state: "prepared" | "cleanup_required" };
const list = (operations: TestOperation[] = [operation]) => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { operations } }) });
const receipt = (op: TestOperation = operation, state = "completed", temporaryPassword?: string) => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { requestId: op.requestId, accountId: op.accountId, employeeId: op.employeeId, kind: op.kind, state, temporaryPassword } }) });
function mockRequests(op: TestOperation = operation, action = () => Promise.resolve(receipt(op))) {
  const mock = vi.fn().mockImplementation((_url, options) => options?.method === "POST" ? action() : Promise.resolve(list([op])));
  vi.stubGlobal("fetch", mock);
  return mock;
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("AccountRecoveryPanel", () => {
  it("shows only the current employee's requests in the HR account tab", async () => {
    const other = { ...operation, requestId: "44444444-4444-4444-8444-444444444444", employeeId: "55555555-5555-4555-8555-555555555555", username: "nv002" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(list([operation, other])));
    render(<AccountRecoveryPanel canCreate canDelete employeeId={operation.employeeId} hideWhenEmpty />);
    expect(await screen.findByText("nv001")).toBeInTheDocument();
    expect(screen.queryByText("nv002")).not.toBeInTheDocument();
  });

  it("hides an empty inline queue without expanding access to the users worklist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(list([])));
    render(<AccountRecoveryPanel canCreate canDelete={false} employeeId={operation.employeeId} hideWhenEmpty />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Yêu cầu tài khoản" })).not.toBeInTheDocument();
  });

  it("loads pending requests with business labels and no descriptions", async () => {
    mockRequests(); render(<AccountRecoveryPanel canCreate canDelete />);
    expect(await screen.findByText("nv001")).toBeInTheDocument();
    expect(screen.getByText("Chờ hoàn tất")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Hủy yêu cầu" })).toBeEnabled();
    expect(screen.getByText(operation.requestId)).toBeInTheDocument();
  });

  it("reports list failure without claiming an empty queue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<AccountRecoveryPanel canCreate canDelete />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải yêu cầu tài khoản");
    expect(screen.queryByText("Không có yêu cầu đang chờ")).not.toBeInTheDocument();
  });

  it("does not display operations outside the supplied permissions", async () => {
    mockRequests(); render(<AccountRecoveryPanel canCreate={false} canDelete />);
    expect(await screen.findByText("Không có yêu cầu đang chờ")).toBeInTheDocument();
    expect(screen.queryByText("nv001")).not.toBeInTheDocument();
  });

  it("resumes an automatically generated provision and clears its credential on close", async () => {
    const mock = mockRequests(operation, () => Promise.resolve(receipt(operation, "completed", "Dt!RecoveredPassword9")));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Mật khẩu ban đầu/)).not.toBeInTheDocument();
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await screen.findByText("Dt!RecoveredPassword9")).toBeInTheDocument();
    const post = mock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(post[0]).toBe(`/api/v1/account-operations/${operation.requestId}`);
    expect(JSON.parse(post[1].body)).toEqual({ action: "resume" });
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tất" }));
    await waitFor(() => expect(screen.queryByText("Dt!RecoveredPassword9")).not.toBeInTheDocument());
  });

  it("requires the original provided password and preserves the exact uncertain retry", async () => {
    const op = { ...operation, credentialMode: "provided" as const };
    let attempts = 0;
    const mock = mockRequests(op, () => ++attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(receipt(op)));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục" }));
    const dialog = screen.getByRole("dialog"); const form = dialog.querySelector("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần nhập mật khẩu ban đầu");
    expect(mock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Mật khẩu ban đầu/), { target: { value: "Original!Password9" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể xác nhận kết quả");
    expect(within(dialog).getByLabelText(/Mật khẩu ban đầu/)).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    const posts = mock.mock.calls.filter((call) => call[1]?.method === "POST");
    expect(posts).toHaveLength(2); expect(posts[1][1].body).toBe(posts[0][1].body);
    expect(JSON.parse(posts[0][1].body)).toEqual({ action: "resume", password: "Original!Password9" });
  });

  it("cancels a prepared provision without requesting its password", async () => {
    const op = { ...operation, credentialMode: "provided" as const };
    const mock = mockRequests(op, () => Promise.resolve(receipt(op, "cancelled")));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Mật khẩu ban đầu/)).not.toBeInTheDocument();
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(JSON.parse(mock.mock.calls.find((call) => call[1]?.method === "POST")![1].body)).toEqual({ action: "cancel" });
  });

  it("offers cleanup completion and excludes a second cancellation action", async () => {
    const op = { ...operation, state: "cleanup_required" as const };
    mockRequests(op, () => Promise.resolve(receipt(op, "cancelled")));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Hoàn tất thu hồi" }));
    expect(screen.queryByRole("button", { name: "Hủy yêu cầu" })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("only offers completion for a prepared deletion", async () => {
    const op = { ...operation, kind: "delete" as const };
    mockRequests(op);
    render(<AccountRecoveryPanel canCreate canDelete />);
    expect(await screen.findByRole("button", { name: "Tiếp tục" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hủy yêu cầu" })).not.toBeInTheDocument();
  });

  it("completes a deletion cleanup with a completed receipt", async () => {
    const op = { ...operation, kind: "delete" as const, state: "cleanup_required" as const };
    const mock = mockRequests(op, () => Promise.resolve(receipt(op, "completed")));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Hoàn tất thu hồi" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(JSON.parse(mock.mock.calls.find((call) => call[1]?.method === "POST")![1].body)).toEqual({ action: "resume" });
  });

  it("blocks duplicate recovery submissions", async () => {
    let resolve: (value: ReturnType<typeof receipt>) => void = () => {};
    const mock = mockRequests(operation, () => new Promise((done) => { resolve = done; }));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục" }));
    const dialog = screen.getByRole("dialog"); const form = dialog.querySelector("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(1);
    expect(within(form).getByRole("button", { name: "Đóng" })).toBeDisabled();
    resolve(receipt()); await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("refreshes the queue when another account action settles", async () => {
    const mock = mockRequests(); render(<AccountRecoveryPanel canCreate canDelete />);
    await screen.findByText("nv001");
    window.dispatchEvent(new Event(accountOperationsChanged));
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
  });

  it("does not mark a rejected clipboard copy as successful", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, userAgent: "jsdom" });
    mockRequests(operation, () => Promise.resolve(receipt(operation, "completed", "Dt!RecoveredPassword9")));
    render(<AccountRecoveryPanel canCreate canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục" }));
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "Sao chép" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể sao chép");
    expect(screen.queryByText("Đã sao chép")).not.toBeInTheDocument();
  });
});

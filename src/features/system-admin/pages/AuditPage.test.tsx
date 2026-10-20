import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/system-admin/components/AdminPage", () => ({ AdminPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
import { AuditPage } from "./AuditPage";

const entry = (id: string) => ({ id, actorName: "Người kiểm thử", action: "system.updated", actionLabel: id, module: "system", entityType: "record", entityId: id, happenedAt: "2026-10-20T03:00:00Z", source: "web", severity: "normal" });
const response = (id: string) => ({ ok: true, json: async () => ({ data: { entries: [entry(id)] } }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("audit log loading recovery", () => {
  it("ends loading after a network failure and retries without a document reload", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(response("RECOVERED"));
    vi.stubGlobal("fetch", fetch);
    render(<AuditPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối. Vui lòng thử lại.");
    expect(screen.queryByRole("status", { name: "Đang tải dữ liệu" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("RECOVERED", { selector: "strong" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retains existing rows during filtering and ignores a stale response", async () => {
    let finishOld: (value: ReturnType<typeof response>) => void = () => undefined;
    const fetch = vi.fn().mockResolvedValueOnce(response("INITIAL")).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce(response("LATEST"));
    vi.stubGlobal("fetch", fetch);
    render(<AuditPage />);
    await screen.findByText("INITIAL", { selector: "strong" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "old" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByText("INITIAL", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Đang tải dữ liệu" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "latest" } });
    await screen.findByText("LATEST", { selector: "strong" });
    await act(async () => { finishOld(response("STALE")); });
    expect(screen.getByText("LATEST", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("STALE")).not.toBeInTheDocument();
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
  });
});

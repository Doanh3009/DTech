import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessWorkspace } from "./businessSchemas";
import { BusinessMisaWorkspace } from "./BusinessMisaWorkspace";

const workspace: BusinessWorkspace = { tenantId: "tenant", slug: "acme", name: "Acme", systemName: "ERP", industry: "construction", features: ["inventory", "assets", "accounting"], status: "active", trialEndsAt: "2026-12-01", accountId: "account", displayName: "Owner", username: "owner", role: "owner", mustChangePassword: false };
const snapshot = () => new Response(JSON.stringify({ ok: true, data: { rows: [], total: 0, totals: {}, asOf: "2026-11-02" } }), { headers: { "content-type": "application/json" } });

describe("MISA report download", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValueOnce(snapshot());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("keeps report content visible and permits retry after an export error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { message: "Dữ liệu xuất vượt quá 5.000 dòng." } }), { status: 400, headers: { "content-type": "application/json" } }));
    render(<BusinessMisaWorkspace workspace={workspace} initialView="assets" />);
    const button = await screen.findByRole("button", { name: "Tải CSV" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("5.000");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tài sản & phân bổ");
    expect(button).toBeEnabled();
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/business/acme/misa/export?view=assets&");
  });

  it("prevents repeated downloads while the request is pending and aborts on unmount", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => undefined));
    const rendered = render(<BusinessMisaWorkspace workspace={workspace} initialView="assets" />);
    const button = await screen.findByRole("button", { name: "Tải CSV" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const signal = fetchMock.mock.calls[1][1]?.signal;
    rendered.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("rejects a successful response that is not a CSV file", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Login</html>", { headers: { "content-type": "text/html" } }));
    render(<BusinessMisaWorkspace workspace={workspace} initialView="assets" />);
    const button = await screen.findByRole("button", { name: "Tải CSV" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tệp xuất chưa hợp lệ");
    expect(button).toBeEnabled();
  });

  it("downloads a CSV file without navigating away and releases its object URL", async () => {
    const originalURL = URL;
    const create = vi.fn(() => "blob:report-download");
    const revoke = vi.fn();
    class DownloadURL extends originalURL { static createObjectURL = create; static revokeObjectURL = revoke; }
    vi.stubGlobal("URL", DownloadURL);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(new Response("code\r\nBC01", { headers: { "content-type": "text/csv; charset=utf-8" } }));
    render(<BusinessMisaWorkspace workspace={workspace} initialView="assets" />);
    const button = await screen.findByRole("button", { name: "Tải CSV" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText("Đã tải CSV.")).toHaveAttribute("role", "status");
    expect(click).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(button).toBeEnabled();
    await waitFor(() => expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:report-download"), { timeout: 1500 });
  });
});

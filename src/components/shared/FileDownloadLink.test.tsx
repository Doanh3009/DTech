import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/files/downloadFile", () => ({ downloadFile: vi.fn() }));
import { downloadFile } from "@/lib/files/downloadFile";
import { FileDownloadLink } from "./FileDownloadLink";

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
describe("file download action", () => {
  it("keeps a progressive href and reports a failed download beside the action", async () => {
    vi.mocked(downloadFile).mockRejectedValueOnce(new Error("Không có quyền tải tệp."));
    render(<FileDownloadLink format="pdf" href="/api/pdf">Tải PDF</FileDownloadLink>);
    const link = screen.getByRole("link", { name: "Tải PDF" });
    expect(link).toHaveAttribute("href", "/api/pdf");
    fireEvent.click(link);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không có quyền tải tệp.");
    expect(link).not.toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAccessibleDescription("Không có quyền tải tệp.");
  });
  it("prevents duplicate download requests and menu dismissal while busy", async () => {
    let finish!: () => void;
    vi.mocked(downloadFile).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const parentClick = vi.fn();
    render(<div onClick={parentClick}><FileDownloadLink format="xlsx" href="/api/xlsx">Xuất Excel</FileDownloadLink></div>);
    const link = screen.getByRole("link", { name: "Xuất Excel" });
    fireEvent.click(link); fireEvent.click(link);
    expect(downloadFile).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
    expect(link).toHaveAttribute("aria-busy", "true");
    await act(async () => finish());
    await waitFor(() => expect(link).not.toHaveAttribute("aria-busy"));
  });
});

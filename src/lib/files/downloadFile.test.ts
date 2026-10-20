import { describe, expect, it } from "vitest";
import { readDownloadResponse } from "./downloadFile";

const response = (body: BodyInit, mime: string, disposition?: string) => new Response(body, { headers: { "content-type": mime, ...(disposition ? { "content-disposition": disposition } : {}) } });

describe("file download validation", () => {
  it("accepts a PDF signature and its server filename", async () => {
    const file = await readDownloadResponse(response("%PDF-1.7\n%%EOF", "application/pdf", 'attachment; filename="phieu-luong.pdf"'), "pdf");
    expect(file.fileName).toBe("phieu-luong.pdf");
    expect(file.blob.type).toBe("application/pdf");
  });
  it("accepts an XLSX ZIP signature and a UTF-8 filename", async () => {
    const file = await readDownloadResponse(response(new Uint8Array([0x50, 0x4b, 3, 4, 0]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "attachment; filename*=UTF-8''Bang%20luong.xlsx"), "xlsx");
    expect(file.fileName).toBe("Bang luong.xlsx");
  });
  it("shows the API error instead of saving its JSON as a spreadsheet", async () => {
    await expect(readDownloadResponse(new Response(JSON.stringify({ error: { message: "Không có quyền xuất báo cáo." } }), { status: 403, headers: { "content-type": "application/json" } }), "xlsx")).rejects.toThrow("Không có quyền xuất báo cáo.");
  });
  it.each(["pdf", "xlsx"] as const)("rejects a successful HTML login or JSON response for %s", async format => {
    await expect(readDownloadResponse(response("<html>Login</html>", "text/html"), format)).rejects.toThrow("hợp lệ");
    await expect(readDownloadResponse(response("{}", "application/json"), format)).rejects.toThrow("hợp lệ");
  });
  it.each(["pdf", "xlsx"] as const)("rejects wrong bytes despite a correct %s MIME", async format => {
    await expect(readDownloadResponse(response("{\"error\":true}", format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), format)).rejects.toThrow("Nội dung tệp xuất không hợp lệ");
  });
  it("sanitizes a server filename and retains the expected extension", async () => {
    const file = await readDownloadResponse(response("%PDF-1.7", "application/pdf", 'attachment; filename="../../report"'), "pdf");
    expect(file.fileName).not.toMatch(/[/\\]/);
    expect(file.fileName).toMatch(/\.pdf$/);
  });
});

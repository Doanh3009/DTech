export type DownloadFileFormat = "pdf" | "xlsx";

const mimeTypes: Record<DownloadFileFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function downloadName(disposition: string | null, fallback: string, format: DownloadFileFormat): string {
  const encoded = disposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  let name = plain?.[1] ?? plain?.[2] ?? fallback;
  if (encoded) {
    try { name = decodeURIComponent(encoded.trim().replace(/^"|"$/g, "")); } catch { /* Use the plain filename when its encoded variant is malformed. */ }
  }
  name = name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-").replace(/^\.+|[. ]+$/g, "").trim();
  if (!name) name = `tai-lieu.${format}`;
  return name.toLocaleLowerCase("en").endsWith(`.${format}`) ? name : `${name}.${format}`;
}

export async function readDownloadResponse(response: Response, format: DownloadFileFormat, fallbackName = `tai-lieu.${format}`): Promise<{ blob: Blob; fileName: string }> {
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!response.ok) {
    let message = "Không thể xuất tệp. Vui lòng thử lại.";
    if (mime === "application/json") {
      try {
        const body = await response.json() as { error?: { message?: string } };
        if (typeof body.error?.message === "string" && body.error.message.trim()) message = body.error.message;
      } catch { /* Keep the readable fallback when an upstream error response is incomplete. */ }
    }
    throw new Error(message);
  }
  if (mime !== mimeTypes[format]) throw new Error(`Máy chủ chưa trả về tệp ${format === "pdf" ? "PDF" : "Excel"} hợp lệ. Vui lòng thử lại.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const valid = format === "pdf"
    ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
    : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!valid) throw new Error("Nội dung tệp xuất không hợp lệ. Vui lòng thử lại.");
  return { blob: new Blob([bytes], { type: mimeTypes[format] }), fileName: downloadName(response.headers.get("content-disposition"), fallbackName, format) };
}

export async function downloadFile(href: string, options: { format: DownloadFileFormat; fileName?: string; signal?: AbortSignal }): Promise<void> {
  const response = await fetch(href, { cache: "no-store", credentials: "same-origin", signal: options.signal ?? AbortSignal.timeout(60_000) });
  const { blob, fileName } = await readDownloadResponse(response, options.format, options.fileName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.hidden = true;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Give the browser time to consume the object URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

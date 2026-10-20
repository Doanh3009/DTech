export async function warehouseRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(45_000);
  const response = await fetch(url, { cache: "no-store", ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  const body = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "Không thể xử lý dữ liệu kho.");
  return body.data;
}
export const warehouseWrite = <T>(url: string, method: string, data: unknown) => warehouseRequest<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

import "server-only";
import { AppError } from "@/lib/api/errors";

type PageQuery<T> = { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }> };
export async function readWarehouseRows<T>(query: () => PageQuery<T>, message: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error || !data) throw new AppError("SERVER_ERROR", message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
  throw new AppError("SERVER_ERROR", message);
}

import { coordinateLabel } from "@/features/attendance/services/attendanceAddressRules";
import type { AttendanceAddressCoordinates, AttendanceAddressResult } from "@/features/attendance/types/attendanceAddressTypes";

const memory = new Map<string, { expiresAt: number; result: AttendanceAddressResult }>();
const pending = new Map<string, Promise<AttendanceAddressResult>>();
let queue: Promise<unknown> = Promise.resolve();
let disabledUntil = 0;

export function lookupAttendanceAddress(coordinates: AttendanceAddressCoordinates): Promise<AttendanceAddressResult> {
  const key = coordinateLabel(coordinates);
  const cached = memory.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
  if (disabledUntil > Date.now()) return Promise.resolve({ status: "not_configured" });
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = queue.catch(() => undefined).then(async () => {
    let result: AttendanceAddressResult = { status: "unavailable" };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch("/api/v1/attendance/address", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: coordinates.latitude, longitude: coordinates.longitude }),
          cache: "no-store", signal: AbortSignal.timeout(8500)
        });
        const body = await response.json() as { data?: AttendanceAddressResult };
        if (!response.ok || !body.data) break;
        result = body.data;
        if (result.status !== "busy" || attempt === 2) break;
        await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(12_000, Math.max(1100, result.retryAfterMs ?? 1100))));
      } catch { break; }
    }
    if (result.status === "not_configured") disabledUntil = Date.now() + 60_000;
    if (memory.size >= 500) memory.delete(memory.keys().next().value!);
    memory.set(key, { result, expiresAt: Date.now() + (result.status === "resolved" ? 300_000 : 30_000) });
    return result;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  queue = promise;
  return promise;
}

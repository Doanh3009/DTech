import type { AttendanceCoordinates } from "@/features/attendance/types/attendanceTypes";

type LocationFailure = "denied" | "timeout" | "unavailable" | "unsupported" | "insecure";
const messages: Record<LocationFailure, string> = {
  denied: "Chưa có quyền vị trí. Bật quyền vị trí cho trang này trong trình duyệt.",
  timeout: "Chưa lấy được GPS. Kiểm tra dịch vụ vị trí của thiết bị và thử lại.",
  unavailable: "Thiết bị chưa xác định được vị trí. Bật dịch vụ vị trí và thử lại.",
  unsupported: "Trình duyệt này không hỗ trợ GPS.",
  insecure: "GPS cần kết nối HTTPS."
};

export class AttendanceLocationError extends Error {
  constructor(public readonly code: LocationFailure) {
    super(messages[code]);
    this.name = "AttendanceLocationError";
  }
}

interface LocationCaptureOptions {
  signal?: AbortSignal;
  targetAccuracyMeters?: number;
  onPosition?: (position: AttendanceCoordinates) => void;
}

// Start device GPS independently of Wi-Fi / navigator.onLine. A coarse fix can be
// displayed while GNSS refines it. Never substitute office or worksite coordinates.
export async function captureAttendanceLocation(geolocation: Geolocation | undefined, secureContext: boolean, options: LocationCaptureOptions = {}): Promise<AttendanceCoordinates> {
  if (!secureContext) throw new AttendanceLocationError("insecure");
  if (!geolocation) throw new AttendanceLocationError("unsupported");
  if (options.signal?.aborted) throw new DOMException("Location capture cancelled", "AbortError");

  return new Promise((resolve, reject) => {
    let best: AttendanceCoordinates | undefined;
    let finished = false;
    let watchId: number | undefined;
    const target = Math.max(1, options.targetAccuracyMeters ?? 30);
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      if (watchId !== undefined) geolocation.clearWatch(watchId);
      options.signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else if (best) resolve(best);
      else reject(new AttendanceLocationError("timeout"));
    };
    const abort = () => finish(new DOMException("Location capture cancelled", "AbortError"));
    const deadline = setTimeout(() => finish(), 35_000);
    const receive = (position: GeolocationPosition) => {
      if (finished) return;
      const { latitude, longitude, accuracy } = position.coords;
      const age = Date.now() - position.timestamp;
      if (![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || age > 15_000 || age < -5_000) return;
      if (best && accuracy >= best.accuracy) return;
      best = { latitude, longitude, accuracy, capturedAt: new Date(position.timestamp).toISOString() };
      options.onPosition?.(best);
      if (accuracy <= target) finish();
    };
    const failed = (error: GeolocationPositionError) => {
      // A network-positioning error must not cancel a still-starting GPS fix.
      if (error.code === 1) finish(new AttendanceLocationError("denied"));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    try {
      if (typeof geolocation.watchPosition === "function") {
        watchId = geolocation.watchPosition(receive, failed, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 });
        if (finished) { geolocation.clearWatch(watchId); return; }
      } else {
        geolocation.getCurrentPosition(receive, failed, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 });
      }
      if (!finished) geolocation.getCurrentPosition(receive, failed, { enableHighAccuracy: false, maximumAge: 5_000, timeout: 10_000 });
    } catch (error) {
      finish(error instanceof DOMException && error.name === "NotAllowedError" ? new AttendanceLocationError("denied") : new AttendanceLocationError("unavailable"));
    }
  });
}

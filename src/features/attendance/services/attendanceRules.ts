import type {
  AttendanceCoordinates,
  AttendanceEvent,
  AttendanceLocation,
  AttendancePolicy,
  AttendanceType,
  PendingAttendanceItem
} from "@/features/attendance/types/attendanceTypes";

const EARTH_RADIUS_METERS = 6_371_000;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceInMeters(
  first: Pick<AttendanceCoordinates, "latitude" | "longitude">,
  second: Pick<AttendanceLocation, "latitude" | "longitude">
): number {
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const latitudeA = radians(first.latitude);
  const latitudeB = radians(second.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export interface LocationMatch {
  location?: AttendanceLocation;
  distanceMeters?: number;
  status: "valid" | "outside" | "accuracy_low" | "unavailable" | "not_required";
}

export function matchAttendanceLocation(
  coordinates: AttendanceCoordinates | undefined,
  locations: readonly AttendanceLocation[],
  policy: AttendancePolicy
): LocationMatch {
  if (!coordinates) return { status: policy.gpsRequired ? "unavailable" : "not_required" };

  const nearest = locations
    .filter((location) => location.active)
    .map((location) => ({ location, distanceMeters: distanceInMeters(coordinates, location) }))
    .sort((first, second) => first.distanceMeters - second.distanceMeters)[0];

  // Locations identify the nearest reference point. Attendance has no radius restriction.
  // A low accuracy reading remains evidence for HR review and never blocks attendance.
  return {
    ...nearest,
    status: coordinates.accuracy > policy.allowedAccuracyThresholdMeters ? "accuracy_low" : "valid"
  };
}

export function getNextAttendanceAction(events: readonly Pick<AttendanceEvent, "eventType">[]): AttendanceType | "completed" {
  const hasCheckIn = events.some((event) => event.eventType === "check_in");
  const hasCheckOut = events.some((event) => event.eventType === "check_out");
  if (!hasCheckIn) return "check_in";
  if (!hasCheckOut) return "check_out";
  return "completed";
}

export function retryDelayMilliseconds(retryCount: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(Math.max(retryCount, 0), 6));
}

export function getAttendanceLateMinutes(effectiveAt: string, policy: Pick<AttendancePolicy, "timezone" | "shiftStart" | "lateThresholdMinutes">): number {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: policy.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(effectiveAt));
  const parts = Object.fromEntries(time.map((part) => [part.type, part.value]));
  const [hour, minute] = policy.shiftStart.split(":").map(Number);
  const elapsedSeconds = (Number(parts.hour) * 60 + Number(parts.minute) - hour * 60 - minute) * 60 + Number(parts.second);
  return elapsedSeconds > policy.lateThresholdMinutes * 60 ? Math.ceil(elapsedSeconds / 60) : 0;
}

export function itemsOwnedBy(
  items: readonly PendingAttendanceItem[],
  accountId: string
): PendingAttendanceItem[] {
  return items.filter((item) => item.ownerAccountId === accountId);
}

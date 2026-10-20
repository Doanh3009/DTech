export interface AttendanceAddressResult {
  status: "resolved" | "not_configured" | "unavailable" | "not_found" | "busy" | "rate_limited";
  address?: string;
  matchedLatitude?: number;
  matchedLongitude?: number;
  attribution?: string;
  attributionUrl?: string;
  retryAfterMs?: number;
}

export interface AttendanceAddressCoordinates {
  latitude: number;
  longitude: number;
}

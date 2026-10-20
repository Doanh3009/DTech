import type { AttendanceAddressCoordinates, AttendanceAddressResult } from "@/features/attendance/types/attendanceAddressTypes";

export function validAddressCoordinates(input: { latitude?: number; longitude?: number }): input is AttendanceAddressCoordinates {
  return typeof input.latitude === "number" && Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90
    && typeof input.longitude === "number" && Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180;
}

export function coordinateLabel(input: AttendanceAddressCoordinates): string {
  return `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
}

const text = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 250) : "";
const unique = (values: string[]) => [...new Map(values.filter(Boolean).map((value) => [value.toLocaleLowerCase("vi"), value])).values()];

export function parsePhotonAddress(body: unknown): AttendanceAddressResult {
  if (!body || typeof body !== "object" || !("features" in body) || !Array.isArray(body.features)) return { status: "unavailable" };
  const feature = body.features[0];
  if (!feature) return { status: "not_found" };
  const properties = feature.properties as Record<string, unknown> | undefined;
  const position = feature.geometry?.coordinates;
  if (!properties || !Array.isArray(position) || !validAddressCoordinates({ latitude: position[1], longitude: position[0] })) return { status: "unavailable" };
  const street = [text(properties.housenumber), text(properties.street)].filter(Boolean).join(" ");
  const address = unique([text(properties.name), street, text(properties.district), text(properties.city), text(properties.county), text(properties.state), text(properties.country)]).join(", ").slice(0, 800);
  if (!address) return { status: "not_found" };
  return { status: "resolved", address, matchedLatitude: position[1], matchedLongitude: position[0] };
}

export function parseNominatimAddress(body: unknown): AttendanceAddressResult {
  if (!body || typeof body !== "object") return { status: "unavailable" };
  const row = body as Record<string, unknown>;
  if (row.error) return { status: "not_found" };
  const address = typeof row.display_name === "string" ? row.display_name.trim().replace(/\s+/g, " ").slice(0, 800) : "";
  const latitude = row.lat === null || row.lat === undefined ? NaN : Number(row.lat);
  const longitude = row.lon === null || row.lon === undefined ? NaN : Number(row.lon);
  if (!address || !validAddressCoordinates({ latitude, longitude })) return { status: "not_found" };
  return { status: "resolved", address, matchedLatitude: latitude, matchedLongitude: longitude };
}

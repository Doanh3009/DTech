import "server-only";

import { createHash } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser, type Permission } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolvePlatformIdentity } from "@/features/shared-platforms/services/platformIdentity";
import { coordinateLabel, parseNominatimAddress, parsePhotonAddress, validAddressCoordinates } from "./attendanceAddressRules";
import { distanceInMeters } from "./attendanceRules";
import type { AttendanceAddressCoordinates, AttendanceAddressResult } from "@/features/attendance/types/attendanceAddressTypes";

const permissions: Permission[] = ["attendance.self", "attendance.self.view", "attendance.self.create", "attendance.self_history", "attendance.view", "attendance.view_team", "attendance.view_all", "attendance.raw.view", "attendance.log.view", "attendance.config.view", "attendance.config.manage", "worker_attendance.create", "worker_attendance.view", "worker_attendance.self_scope", "worker_attendance.view_project", "worker_attendance.view_all"];
const attribution = { attribution: "© OpenStreetMap", attributionUrl: "https://www.openstreetmap.org/copyright" };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function attendanceAddressProvider(): { provider: "photon" | "nominatim"; endpoint: URL } | undefined {
  const configured = process.env.GEOCODING_PROVIDER ?? "photon";
  if (configured === "disabled") return undefined;
  if (configured !== "photon" && configured !== "nominatim") return undefined;
  const rawUrl = process.env.GEOCODING_REVERSE_URL || (configured === "photon" ? "https://photon.komoot.io/reverse" : "");
  try {
    const endpoint = new URL(rawUrl);
    // Only an operator-defined endpoint can be called; clients never supply a URL.
    // Never send staff GPS to the public Nominatim service.
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hostname === "nominatim.openstreetmap.org") return undefined;
    return { provider: configured, endpoint };
  } catch { return undefined; }
}

export async function resolveAttendanceAddress(user: AuthenticatedUser, coordinates: AttendanceAddressCoordinates): Promise<AttendanceAddressResult> {
  if (!permissions.some((permission) => can(user.permissions, permission))) throw new AppError("PERMISSION_DENIED");
  if (!validAddressCoordinates(coordinates)) throw new AppError("VALIDATION_ERROR");
  const config = attendanceAddressProvider();
  if (!config) return { status: "not_configured" };
  const client = getSupabaseServiceClient();
  if (!client) return { status: "unavailable" };
  const actor = await resolvePlatformIdentity(client, user);
  const providerKey = digest(`${config.provider}:${config.endpoint.href}`);
  const normalized = { latitude: Number(coordinates.latitude.toFixed(5)), longitude: Number(coordinates.longitude.toFixed(5)) };
  const cacheKey = digest(`${providerKey}:${coordinateLabel(normalized)}`);
  const { data: claim, error: claimError } = await client.rpc("claim_attendance_address_lookup", { p_provider_key: providerKey, p_cache_key: cacheKey, p_actor_id: actor.accountId });
  // Missing cache/rate infrastructure fails closed to external calls, but never blocks attendance.
  if (claimError || !claim) return { status: "unavailable" };
  if (claim.status !== "claimed") return { ...claim, ...(claim.status === "resolved" ? attribution : {}) } as AttendanceAddressResult;

  let result: AttendanceAddressResult = { status: "unavailable" };
  let retrySeconds = 0;
  try {
    const endpoint = new URL(config.endpoint);
    endpoint.searchParams.set("lat", normalized.latitude.toString());
    endpoint.searchParams.set("lon", normalized.longitude.toString());
    if (config.provider === "photon") {
      endpoint.searchParams.set("limit", "1");
      endpoint.searchParams.set("radius", "0.2");
      // Omit lang: Photon returns local OSM names if no translated name exists.
    } else {
      endpoint.searchParams.set("format", "jsonv2");
      endpoint.searchParams.set("zoom", "18");
      endpoint.searchParams.set("addressdetails", "1");
      endpoint.searchParams.set("accept-language", "vi");
    }
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "User-Agent": "ChauTuanInternal/1.0 (attendance address lookup)" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6500)
    });
    if (response.status === 429) {
      const header = response.headers.get("retry-after");
      const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 60;
      retrySeconds = Number.isFinite(seconds) ? Math.min(3600, Math.max(60, seconds)) : 60;
    } else if (response.ok) {
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize <= 100_000) {
        const content = await response.text();
        if (content.length <= 100_000) {
          result = config.provider === "photon" ? parsePhotonAddress(JSON.parse(content)) : parseNominatimAddress(JSON.parse(content));
          // A provider returning a town centroid kilometres away is not the address at this GPS point.
          if (result.status === "resolved" && distanceInMeters(normalized, { latitude: result.matchedLatitude!, longitude: result.matchedLongitude! }) > 250) result = { status: "not_found" };
        }
      }
    }
  } catch {
    // Do not log URLs, coordinates, addresses or provider bodies.
  }
  const { data: stored, error: storeError } = await client.rpc("finish_attendance_address_lookup", {
    p_provider_key: providerKey, p_cache_key: cacheKey, p_lease_id: claim.leaseId,
    p_status: result.status, p_address: result.address ?? null,
    p_matched_latitude: result.matchedLatitude ?? null, p_matched_longitude: result.matchedLongitude ?? null,
    p_retry_seconds: retrySeconds
  });
  if (storeError || !stored) return { status: "unavailable" };
  return { ...result, ...(result.status === "resolved" ? attribution : {}) };
}

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AppError, errorResponse } from "@/lib/api/errors";
import { ACCESS_COOKIE, resolveRequestUser } from "@/services/auth/sessionService";

function expiration(accessToken: string): string {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    if (typeof payload.exp === "number") return new Date(payload.exp * 1_000).toISOString();
  } catch {
    // The token was already verified by resolveRequestUser; a malformed expiry only shortens the client cache.
  }
  return new Date(Date.now() + 5 * 60_000).toISOString();
}

export async function GET() {
  try {
    const user = await resolveRequestUser();
    if (!user) throw new AppError("AUTHENTICATION_REQUIRED");
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) throw new AppError("SESSION_EXPIRED");
    return NextResponse.json({
      ok: true,
      data: { accessToken, expiresAt: expiration(accessToken) }
    }, {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        pragma: "no-cache",
        vary: "Cookie"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}

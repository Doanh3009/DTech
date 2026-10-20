import { NextResponse } from "next/server";
import { clearSessionCookies, revokeCurrentSession } from "@/services/auth/sessionService";
export async function POST() {
  await revokeCurrentSession();
  const response = NextResponse.json({ ok: true, data: null }, { headers: { "cache-control": "no-store" } });
  clearSessionCookies(response.cookies);
  return response;
}

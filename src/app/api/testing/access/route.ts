import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { TEST_GATE_COOKIE, createTesterToken, safeEqual, validTesterInvitation } from "@/lib/testing/policy.mjs";
import { requireTestEnvironment } from "@/features/testing/server";
import { assertLoginAllowed, recordLoginResult, requestNetworkContext } from "@/services/auth/sessionService";

export async function POST(request: Request) {
  try {
    requireTestEnvironment();
    const input = await parseJsonBody(request, z.union([
      z.object({ secret: z.string().min(1).max(512) }).strict(),
      z.object({ token: z.string().min(1).max(2000) }).strict()
    ]));
    const { ip } = await requestNetworkContext();
    await assertLoginAllowed("tester.gate", ip);
    const valid = "token" in input
      ? validTesterInvitation(input.token)
      : safeEqual(input.secret, process.env.TEST_TOOLS_GATE_SECRET || "");
    await recordLoginResult("tester.gate", ip, valid);
    if (!valid) throw new AppError("INVALID_CREDENTIALS");
    const response = NextResponse.json({ ok: true, data: null }, { headers: { "cache-control": "no-store" } });
    response.cookies.set(TEST_GATE_COOKIE, createTesterToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 3600 });
    return response;
  } catch (error) { return errorResponse(error); }
}

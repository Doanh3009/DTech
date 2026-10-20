import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { listTestAccounts, requireTestEnvironment } from "@/features/testing/server";
import { resolveLandingPage } from "@/features/dashboard/registry";
import { readSettingsGroup } from "@/services/system-settings/systemSettingsService";
import { requestNetworkContext, resolveRequestUser, revokeCurrentSession, signInWithPassword, writeSessionCookies } from "@/services/auth/sessionService";

export async function POST(request: Request) {
  try {
    requireTestEnvironment();
    const input = await parseJsonBody(request, z.object({ username: z.string().min(3).max(32) }).strict());
    const [accounts, previous] = await Promise.all([listTestAccounts(), resolveRequestUser()]);
    const account = accounts.find((item) => item.username === input.username);
    if (!account) throw new AppError("PERMISSION_DENIED");
    if (account.status !== "active") throw new AppError("ACCOUNT_DISABLED");
    if (previous) {
      // Switching a real user's session is forbidden, even with a tester gate.
      if (!accounts.some((item) => item.username === previous.username && item.status === "active")) throw new AppError("PERMISSION_DENIED");
    }
    const result = await signInWithPassword({ username: input.username, password: process.env.TEST_ACCOUNT_PASSWORD || "", ...await requestNetworkContext() });
    if (previous) await revokeCurrentSession();
    const dashboard = await readSettingsGroup("dashboard");
    const response = NextResponse.json({ ok: true, data: { redirectTo: resolveLandingPage(result.user, dashboard), mobileRedirectTo: "/personal" } }, { headers: { "cache-control": "no-store" } });
    writeSessionCookies(response.cookies, result.session, result.sessionId);
    return response;
  } catch (error) { return errorResponse(error instanceof Error ? error : new AppError("SERVER_ERROR")); }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { parseWithSchema } from "@/lib/api/validation";
import { usernamePattern } from "@/lib/auth/username";
import { ACCOUNT_PASSWORD_MESSAGE, ACCOUNT_PASSWORD_PATTERN } from "@/lib/auth/passwordPolicy";
import { requestNetworkContext, signInWithPassword, writeSessionCookies } from "@/services/auth/sessionService";

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(usernamePattern, "Tên tài khoản không hợp lệ."),
  password: z.string().regex(ACCOUNT_PASSWORD_PATTERN, ACCOUNT_PASSWORD_MESSAGE)
}).strict();
export async function POST(request: Request) {
  try {
    const input = parseWithSchema(schema, await request.json());
    const result = await requestNetworkContext().then((context) => signInWithPassword({ ...input, ...context }));
    const response = NextResponse.json({ ok: true, data: { redirectTo: "/applications", mobileRedirectTo: "/applications" } }, { headers: { "cache-control": "no-store" } });
    writeSessionCookies(response.cookies, result.session, result.sessionId);
    logger.info("auth.login_succeeded", { actorId: result.user.id });
    return response;
  } catch (error) { logger.warn("auth.login_failed"); return errorResponse(error); }
}

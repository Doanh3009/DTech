import { readFile } from "node:fs/promises";
import path from "node:path";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { testToolsAvailable } from "@/lib/testing/policy.mjs";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    requireAuthenticatedUser(await getRequestUser());
    let url: string | null = null;
    if (process.env.NODE_ENV !== "production" && testToolsAvailable()) {
      try {
        const link = JSON.parse(await readFile(path.join(process.cwd(), "test-results/mobile-https/link.json"), "utf8"));
        const age = Date.now() - Date.parse(link.createdAt);
        if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(link.url) && Number.isInteger(link.pid) && link.pid > 0 && age >= 0 && age < 8 * 60 * 60 * 1000) {
          process.kill(link.pid, 0);
          url = link.url;
        }
      } catch { /* No active local tunnel. */ }
    }
    return successResponse({ url }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

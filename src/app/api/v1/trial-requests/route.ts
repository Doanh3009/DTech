import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { listTrialRequests, readTrialBody, submitTrialRequest } from "@/features/marketing/trialRequestService";
import { trialRequestSchema } from "@/features/marketing/trialSchemas";
import { parseWithSchema } from "@/lib/api/validation";
import { controlCenterEnabled, requireControlCenter } from "@/features/crm/controlCenterAccess";
import { z } from "zod";

export async function POST(request:Request) {
  try {
    if(!controlCenterEnabled())throw new AppError("NOT_FOUND");
    const input=parseWithSchema(trialRequestSchema,await readTrialBody(request));
    // Addresses are a best-effort signal; database-wide and contact quotas also apply.
    const address=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    return successResponse(await submitTrialRequest(input,address),{status:202,headers:{"cache-control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}
const filters=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),q:z.string().trim().max(100).default(""),status:z.enum(["","new","contacted","qualified","closed"]).default("")}).strict();
export async function GET(request:Request) {
  try {
    await requireControlCenter("trial_request.view");
    const f=parseWithSchema(filters,Object.fromEntries(new URL(request.url).searchParams));
    return successResponse(await listTrialRequests(f.page,f.q,f.status),{headers:{"cache-control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}

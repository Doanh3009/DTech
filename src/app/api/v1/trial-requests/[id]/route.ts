import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { readTrialBody, reviewTrialRequest } from "@/features/marketing/trialRequestService";

export async function PATCH(request:Request,{params}:RouteContext<"/api/v1/trial-requests/[id]">) {
  try {
    const user=await requireControlCenter("trial_request.manage");
    return successResponse(await reviewTrialRequest((await params).id,await readTrialBody(request),user!.id),{headers:{"cache-control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}

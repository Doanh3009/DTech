import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { convertTrial } from "@/features/crm/crmService";
import { readTrialBody } from "@/features/marketing/trialRequestService";
import { requirePermission } from "@/services/authorization/requirePermission";
export async function POST(request:Request){try{const u=await requireControlCenter("crm.manage");requirePermission(u,"trial_request.view");requirePermission(u,"trial_request.manage");return successResponse(await convertTrial(await readTrialBody(request),u.id),{headers:{"cache-control":"no-store"}});}catch(e){return errorResponse(e);}}

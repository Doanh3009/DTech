import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { addCustomerActivity } from "@/features/crm/crmService";
import { readTrialBody } from "@/features/marketing/trialRequestService";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const u=await requireControlCenter("crm.manage");return successResponse(await addCustomerActivity((await params).id,await readTrialBody(request),u.id),{headers:{"cache-control":"no-store"}});}catch(e){return errorResponse(e);}}

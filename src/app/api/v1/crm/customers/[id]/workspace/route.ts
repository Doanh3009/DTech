import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { readTrialBody } from "@/features/marketing/trialRequestService";
import { businessProvisionSchema, businessWorkspaceStatus } from "@/features/business/businessSchemas";
import { businessRpc, operatorBusinessWorkspace, provisionBusiness } from "@/features/business/businessService";
import { businessHash, hashBusinessPassword, initialBusinessPassword } from "@/features/business/businessCredentials";
type Context={params:Promise<{id:string}>};
const ok=(d:unknown)=>successResponse(d,{headers:{"cache-control":"no-store"}});
export async function GET(_r:Request,{params}:Context){try{const u=await requireControlCenter();return ok(await operatorBusinessWorkspace(parseWithSchema(z.string().uuid(),(await params).id),u.id));}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:Context){try{const u=await requireControlCenter("crm.manage");return ok(await provisionBusiness((await params).id,parseWithSchema(businessProvisionSchema,await readTrialBody(request,6000)),u.id));}catch(e){return errorResponse(e);}}
export async function PATCH(request:Request,{params}:Context){try{
 const u=await requireControlCenter("crm.manage");const id=parseWithSchema(z.string().uuid(),(await params).id);const d=parseWithSchema(businessWorkspaceStatus,await readTrialBody(request,2000));
 return ok(await businessRpc("business_manage_workspace",{p_request_id:d.requestId,p_customer_id:id,p_expected_version:d.rowVersion,p_status:d.status,p_days:d.trialDays,p_actor_id:u.id}));
}catch(e){return errorResponse(e);}}
export async function PUT(request:Request,{params}:Context){try{
 const u=await requireControlCenter("crm.manage");const id=parseWithSchema(z.string().uuid(),(await params).id);const d=parseWithSchema(z.object({requestId:z.string().uuid(),rowVersion:z.number().int().positive()}).strict(),await readTrialBody(request,1000));
 const initialPassword=initialBusinessPassword(d.requestId);const hash=await hashBusinessPassword(initialPassword,businessHash("initial-salt",d.requestId).slice(0,32));
 const r=await businessRpc("business_reset_owner",{p_request_id:d.requestId,p_customer_id:id,p_expected_version:d.rowVersion,p_password_hash:hash,p_actor_id:u.id});return ok({...r as object,initialPassword});
}catch(e){return errorResponse(e);}}

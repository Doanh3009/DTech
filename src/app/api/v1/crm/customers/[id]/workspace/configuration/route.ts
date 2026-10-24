import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { readTrialBody } from "@/features/marketing/trialRequestService";
import { businessConfigurationSchema } from "@/features/business/businessSchemas";
import { businessRpc } from "@/features/business/businessService";

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const u=await requireControlCenter("crm.manage");const id=parseWithSchema(z.string().uuid(),(await params).id);
 const d=parseWithSchema(businessConfigurationSchema,await readTrialBody(request,4000));
 return successResponse(await businessRpc("business_configure_workspace",{p_request_id:d.requestId,p_customer_id:id,p_customer_version:d.customerVersion,p_expected_version:d.rowVersion,p_industry:d.industry,p_features:d.features,p_system_name:d.systemName,p_actor_id:u.id}),{headers:{"cache-control":"no-store"}});
}catch(e){return errorResponse(e);}}

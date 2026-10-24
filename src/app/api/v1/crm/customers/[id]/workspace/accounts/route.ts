import {z} from "zod";
import {errorResponse} from "@/lib/api/errors";
import {successResponse} from "@/lib/api/responses";
import {parseWithSchema} from "@/lib/api/validation";
import {requireControlCenter} from "@/features/crm/controlCenterAccess";
import {readTrialBody} from "@/features/marketing/trialRequestService";
import {businessListSchema,businessOperatorAccountSchema} from "@/features/business/businessSchemas";
import {businessRpc} from "@/features/business/businessService";
import {businessHash,hashBusinessPassword,initialBusinessPassword} from "@/features/business/businessCredentials";
type Context={params:Promise<{id:string}>};
const ok=(d:unknown)=>successResponse(d,{headers:{"cache-control":"no-store"}});
export async function GET(request:Request,{params}:Context){try{const u=await requireControlCenter();const id=parseWithSchema(z.string().uuid(),(await params).id);const q=parseWithSchema(businessListSchema,Object.fromEntries(new URL(request.url).searchParams));return ok(await businessRpc("business_operator_accounts",{p_customer_id:id,p_actor_id:u.id,p_page:q.page,p_query:q.q}));}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:Context){try{
 const u=await requireControlCenter("crm.manage");const id=parseWithSchema(z.string().uuid(),(await params).id);const d=parseWithSchema(businessOperatorAccountSchema,await readTrialBody(request,3000));
 const initialPassword=d.operation==="create"||d.operation==="reset"?initialBusinessPassword(d.requestId):null;
 const passwordHash=initialPassword?await hashBusinessPassword(initialPassword,businessHash("initial-salt",d.requestId).slice(0,32)):null;
 const receipt=await businessRpc<{accountId:string;username:string;displayName:string;rowVersion:number;customerVersion:number}>("business_operator_account_command",{p_request_id:d.requestId,p_customer_id:id,p_expected_version:d.rowVersion,p_operation:d.operation,p_account_id:d.accountId,p_data:d.operation==="create"?{username:d.username,displayName:d.displayName,role:d.role}:{},p_password_hash:passwordHash,p_actor_id:u.id});
 return ok({...receipt,...(initialPassword?{initialPassword}:{})});
}catch(e){return errorResponse(e);}}

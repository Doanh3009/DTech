import { errorResponse } from "@/lib/api/errors";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { readCustomer } from "@/features/crm/crmService";
import { customerDeploymentManifest } from "@/features/crm/crmDeployment";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{await requireControlCenter("crm.manage");const {customer}=await readCustomer((await params).id);const ref=process.env.NEXT_PUBLIC_SUPABASE_URL?new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]:undefined;const manifest=customerDeploymentManifest(customer,ref);return new Response(JSON.stringify(manifest,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="${manifest.deploymentId}.json"`,"cache-control":"no-store"}});}catch(e){return errorResponse(e);}}

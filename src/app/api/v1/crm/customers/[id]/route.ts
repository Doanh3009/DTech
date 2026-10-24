import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { readCustomer } from "@/features/crm/crmService";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{await requireControlCenter();return successResponse(await readCustomer((await params).id),{headers:{"cache-control":"no-store"}});}catch(e){return errorResponse(e);}}

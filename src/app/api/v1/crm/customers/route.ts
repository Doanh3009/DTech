import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { requireControlCenter } from "@/features/crm/controlCenterAccess";
import { listCustomers, saveCustomer } from "@/features/crm/crmService";
import { crmSaveSchema } from "@/features/crm/crmSchemas";
import { readTrialBody } from "@/features/marketing/trialRequestService";
const filters=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),q:z.string().trim().max(100).regex(/^[^\x00-\x1f]*$/).default(""),stage:z.enum(["","discovery","configuration","provisioning","trial","active","paused","closed"]).default("")}).strict();
export async function GET(request:Request){try{await requireControlCenter();const f=parseWithSchema(filters,Object.fromEntries(new URL(request.url).searchParams));return successResponse(await listCustomers(f.page,f.q,f.stage),{headers:{"cache-control":"no-store"}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{const u=await requireControlCenter("crm.manage");return successResponse(await saveCustomer(parseWithSchema(crmSaveSchema,await readTrialBody(request, 24000)),u.id),{headers:{"cache-control":"no-store"}});}catch(e){return errorResponse(e);}}

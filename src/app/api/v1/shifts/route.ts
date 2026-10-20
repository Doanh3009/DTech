import { shiftInputSchema } from "@/features/timesheets/schemas/timesheetSchemas";
import { listShifts,saveShift } from "@/features/timesheets/services/timesheetRepository";
import { errorResponse } from "@/lib/api/errors";import { successResponse } from "@/lib/api/responses";import { parseJsonBody } from "@/lib/api/validation";import { getRequestUser } from "@/services/auth/getRequestUser";import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(){try{return successResponse(await listShifts(requireAuthenticatedUser(await getRequestUser())));}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{return successResponse(await saveShift(requireAuthenticatedUser(await getRequestUser()),await parseJsonBody(request,shiftInputSchema)),{status:201});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request){try{return successResponse(await saveShift(requireAuthenticatedUser(await getRequestUser()),await parseJsonBody(request,shiftInputSchema)));}catch(error){return errorResponse(error);}}

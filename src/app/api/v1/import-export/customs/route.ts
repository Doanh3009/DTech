import { listCustomsShipments } from "@/features/import-export/services/importExportRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(){try{return successResponse(await listCustomsShipments(requireAuthenticatedUser(await getRequestUser())));}catch(error){return errorResponse(error);}}

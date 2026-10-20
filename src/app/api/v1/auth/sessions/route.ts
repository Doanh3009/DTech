import {errorResponse} from "@/lib/api/errors";import {successResponse} from "@/lib/api/responses";import {listCurrentSessions} from "@/services/auth/sessionService";
export async function GET(){try{return successResponse(await listCurrentSessions());}catch(error){return errorResponse(error);}}

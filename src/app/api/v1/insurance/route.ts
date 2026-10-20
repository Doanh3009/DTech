import { insuranceInputSchema } from "@/features/insurance/schema";
import { listInsurance, saveInsurance } from "@/features/insurance/service";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() { try { return successResponse(await listInsurance(requireAuthenticatedUser(await getRequestUser())), { headers: { "cache-control": "private, no-store" } }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const user = requireAuthenticatedUser(await getRequestUser()), form = await request.formData(), metadata = form.get("metadata"), file = form.get("file"); if (typeof metadata !== "string") throw new AppError("VALIDATION_ERROR"); return successResponse(await saveInsurance(user, parseWithSchema(insuranceInputSchema, JSON.parse(metadata)), file instanceof File && file.size ? file : undefined), { status: 201 }); } catch (error) { return errorResponse(error); } }

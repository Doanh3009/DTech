import { z } from "zod";
import { listInventoryDocumentAttachments, uploadInventoryDocumentAttachment } from "@/features/warehouse/services/warehouseRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema=z.object({id:z.string().uuid()});
export async function GET(_request:Request,context:RouteContext<"/api/v1/warehouse/documents/[id]/attachments">){try{const{id}=parseWithSchema(paramsSchema,await context.params);return successResponse(await listInventoryDocumentAttachments(requireAuthenticatedUser(await getRequestUser()),id));}catch(error){return errorResponse(error);}}
export async function POST(request:Request,context:RouteContext<"/api/v1/warehouse/documents/[id]/attachments">){try{const{id}=parseWithSchema(paramsSchema,await context.params),form=await request.formData(),file=form.get("file");if(!(file instanceof File))throw new AppError("VALIDATION_ERROR","Cần chọn tệp.");const caption=form.get("caption");return successResponse(await uploadInventoryDocumentAttachment(requireAuthenticatedUser(await getRequestUser()),id,file,typeof caption==="string"?caption:undefined),{status:201});}catch(error){return errorResponse(error);}}

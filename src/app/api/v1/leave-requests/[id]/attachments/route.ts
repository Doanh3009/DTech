import { uploadLeaveAttachment } from "@/features/leave/services/leaveRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());const form=await request.formData();const file=form.get("file");if(!(file instanceof File))throw new AppError("VALIDATION_ERROR","Chưa chọn tệp.");return successResponse(await uploadLeaveAttachment(user,(await params).id,file),{status:201});}catch(error){return errorResponse(error);}}

import { createContractTemplate, listContractTemplates } from "@/features/employees/services/contractTemplateService";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(){try{return successResponse(await listContractTemplates(requireAuthenticatedUser(await getRequestUser())));}catch(error){return errorResponse(error);}}

export async function POST(request:Request){
  try{
    const form=await request.formData(),candidate=form.get("file");
    if(!(candidate instanceof File)||!candidate.size)throw new AppError("VALIDATION_ERROR","Cần chọn file Word mẫu.");
    return successResponse(await createContractTemplate(requireAuthenticatedUser(await getRequestUser()),String(form.get("name")??""),candidate),{status:201});
  }catch(error){return errorResponse(error);}
}

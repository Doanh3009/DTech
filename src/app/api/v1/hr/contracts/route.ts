import { listAllEmployeeContracts } from "@/features/employees/services/organizationService";
import { createContract, listContractEmployeeOptions } from "@/features/employees/services/contractService";
import { listContractTemplates } from "@/features/employees/services/contractTemplateService";
import { employeeContractInputSchema } from "@/features/employees/schemas/employeeSchemas";
import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { parseWithSchema } from "@/lib/api/validation";
import { can } from "@/lib/auth/permissions";

const employeeIdSchema=z.string().uuid();
function fields(form:FormData){return{contractNumber:form.get("contractNumber"),contractType:form.get("contractType"),signedDate:form.get("signedDate")||undefined,effectiveDate:form.get("effectiveDate"),endDate:form.get("endDate")||undefined,status:form.get("status")||"draft",note:form.get("note")||undefined};}

export async function GET() {
  try {
    const user=requireAuthenticatedUser(await getRequestUser());
    const contracts=await listAllEmployeeContracts(user);
    const[employees,templates]=await Promise.all([can(user.permissions,"contract.edit")?listContractEmployeeOptions(user):Promise.resolve([]),listContractTemplates(user)]);
    return successResponse({contracts,employees,templates});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request:Request){
  try{
    const user=requireAuthenticatedUser(await getRequestUser()),form=await request.formData();
    const employeeId=parseWithSchema(employeeIdSchema,form.get("employeeId"));
    const input=parseWithSchema(employeeContractInputSchema,fields(form));
    const templateCandidate=String(form.get("templateId")??"").trim(),templateId=templateCandidate?parseWithSchema(z.string().uuid(),templateCandidate):undefined;
    const candidate=form.get("file"),file=candidate instanceof File&&candidate.size?candidate:undefined;
    return successResponse(await createContract(user,employeeId,input,file,templateId),{status:201});
  }catch(error){return errorResponse(error);}
}

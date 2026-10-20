import { generatePayrollExcel } from "@/features/accounting/payrollExcel";
import { getPayroll } from "@/features/accounting/service";
import { AppError, errorResponse } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(_request:Request,context:RouteContext<"/api/v1/accounting/payroll/[id]/export">){try{const user=requireAuthenticatedUser(await getRequestUser());if(!can(user.permissions,"payroll.export"))throw new AppError("PERMISSION_DENIED");const payroll=await getPayroll(user,(await context.params).id),bytes=await generatePayrollExcel(payroll),[year,month]=payroll.periodMonth.slice(0,7).split("-");return new Response(new Uint8Array(bytes),{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":`attachment; filename="Bang_luong_${month}_${year}.xlsx"`,"cache-control":"private, no-store"}});}catch(error){return errorResponse(error);}}

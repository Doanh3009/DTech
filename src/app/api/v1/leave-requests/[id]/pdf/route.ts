import { generateLeaveRequestPdf } from "@/features/leave/services/leavePdf";
import { getLeaveOrganizationSnapshot, getLeaveRequestForPdf } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { readSystemSettings } from "@/services/system-settings/systemSettingsService";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());const id=(await params).id;const [item,snapshot,settings]=await Promise.all([getLeaveRequestForPdf(user,id),getLeaveOrganizationSnapshot(user,id),readSystemSettings()]);if(snapshot)settings.organization={...settings.organization,...snapshot};const bytes=await generateLeaveRequestPdf(item,settings);const safeName=item.employeeName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_|_$/g,"");return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="Don_xin_nghi_${item.requestNumber}_${safeName}.pdf"`,"Cache-Control":"private, no-store"}});}catch(error){return errorResponse(error);}}

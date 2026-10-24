import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { businessHash, businessSessionCookie, hashBusinessPassword, initialBusinessPassword, newBusinessToken, verifyBusinessPassword } from "./businessCredentials";
import { businessLoginSchema, businessMemberCommand, businessPassword, businessProvisionSchema, businessSlug, type BusinessWorkspace } from "./businessSchemas";
import { businessIndustries, type EntityKind, recordSchema } from "./businessCatalog";

export function businessFailure(message=""):never {
 const operational:Record<string,string>={BUSINESS_STAFF_REQUIRED:"Liên kết tài khoản với hồ sơ nhân viên đang hoạt động.",BUSINESS_OWNER_TRANSFER_REQUIRED:"Bàn giao chủ doanh nghiệp trước khi ngừng hồ sơ này.",BUSINESS_CONTACT_REQUIRED:"Nhập điện thoại hoặc email của người liên hệ.",BUSINESS_LEAD_NOT_QUALIFIED:"Đánh giá lead đủ điều kiện và kiểm tra ngày dự kiến chốt trước khi chuyển đổi.",BUSINESS_CUSTOMER_EXISTS:"Thông tin liên hệ đã có trong danh mục. Chọn khách hàng hiện có để liên kết.",BUSINESS_CONTRACT_REQUIRED:"Cơ hội cần có hợp đồng đã ký trước khi ghi nhận thắng.",BUSINESS_QUOTE_EXPIRED:"Báo giá chưa được khách chấp nhận hoặc ngày phản hồi / ký nằm ngoài hiệu lực.",BUSINESS_CONTRACT_EXCEEDED:"Số lượng vượt khối lượng hợp đồng còn lại. Lập phụ lục trước khi đặt thêm.",BUSINESS_MATERIAL_COST_LOCKED:"Chứng từ sớm hơn ngày vật tư đã tính giá thành. Đảo kỳ giá thành liên quan trước khi sửa nguồn kho.",BUSINESS_SHIFT_OVERLAP:"Nhân viên đã có ca hoặc giờ công trùng thời gian này.",BUSINESS_SHIFT_REQUIRED:"Phân ca cho ngày nghỉ trước khi đối chiếu số giờ phép.",BUSINESS_ATTENDANCE_EXCEEDED:"Tổng công và nghỉ vượt giờ theo ca hoặc vượt thời gian trong ngày.",BUSINESS_ATTENDANCE_LOCKED:"Kỳ công đã khóa. Mở khóa kỳ theo quyền trước khi điều chỉnh.",BUSINESS_OVERTIME_APPROVAL_REQUIRED:"Giờ làm thêm cần được duyệt và xác nhận qua ca tương ứng.",BUSINESS_LEAVE_EXCEEDED:"Số giờ nghỉ vượt hạn mức phép còn lại.",BUSINESS_LEAVE_BALANCE_REQUIRED:"Chọn hạn mức phép có hiệu lực của đúng nhân viên.",BUSINESS_BUDGET_EXCEEDED:"Giá trị cam kết và chi phí nguồn vượt ngân sách được duyệt. Duyệt bổ sung hạn mức hoặc phiên bản ngân sách trước khi tiếp tục.",BUSINESS_BUDGET_VERSION_REQUIRED:"Lập phiên bản ngân sách mới để điều chỉnh hạn mức đã duyệt.",BUSINESS_PROJECT_CLOSED:"Công trình đang tạm dừng hoặc đã khóa.",BUSINESS_UNSETTLED_PROJECT:"Công trình còn đơn mua, tạm ứng hoặc nghiệm thu chưa đối chiếu đủ.",BUSINESS_PROCUREMENT_EXCEEDED:"Số lượng đặt mua vượt phần còn lại của đề nghị hoặc báo giá.",BUSINESS_STOCK_COUNT_FROZEN:"Kho đang kiểm kê. Hoàn tất hoặc hủy biên bản kiểm kê trước khi ghi nhận phiếu kho khác.",BUSINESS_ACCEPTANCE_EXCEEDED:"Khối lượng hoặc giá trị vượt phần hạng mục còn được nghiệm thu / lập hóa đơn.",BUSINESS_INVENTORY_ACCOUNT_CONFLICT:"Một mặt hàng đang dùng nhiều tài khoản thành phẩm. Đối chiếu cấu hình giá thành trước khi tính giá kho."};
 const operationalCode=message.match(/BUSINESS_[A-Z_]+/)?.[0];if(operationalCode&&operational[operationalCode])throw new AppError("CONFLICT",operational[operationalCode]);
 if(message.includes("BUSINESS_SCOPED_REPORT"))throw new AppError("PERMISSION_DENIED","Báo cáo tổng hợp cần quyền xem toàn bộ dữ liệu liên quan. Mở danh sách chứng từ trong phạm vi được giao.");
 const detail:Record<string,string>={BUSINESS_CALCULATION_STALE:"Nguồn dữ liệu đã thay đổi hoặc chưa tính. Tính và đối chiếu lại trước khi duyệt.",BUSINESS_ASSET_SOURCE_EXCEEDED:"Nguyên giá hoặc hao mòn vượt phần chứng từ hình thành chưa phân bổ.",BUSINESS_ASSET_NOT_REGISTERED:"Ghi tăng tài sản trước khi bàn giao hoặc bảo dưỡng.",BUSINESS_ASSET_DEPRECIATION_REQUIRED:"Tính khấu hao đến trước ngày điều chuyển hoặc đến ngày ghi giảm rồi tiếp tục.",BUSINESS_ASSET_ALREADY_ASSIGNED:"Tài sản đang có người giữ. Thu hồi trước khi bàn giao mới.",BUSINESS_BANK_MATCH_MISMATCH:"Tài khoản hoặc chiều tiền không khớp giữa sao kê và sổ ngân hàng.",BUSINESS_LOAN_LIMIT_EXCEEDED:"Tổng giải ngân vượt hạn mức khế ước.",BUSINESS_CREDIT_EXCEEDED:"Giá trị điều chỉnh vượt phần hóa đơn còn được điều chỉnh.",BUSINESS_COST_SOURCE_REQUIRED:"Đối chiếu chứng từ vận hành với đúng dòng chi phí đã ghi sổ.",BUSINESS_COST_SOURCE_EXCEEDED:"Chi phí nguồn đã được phân bổ hoặc không đủ giá trị còn lại.",BUSINESS_COSTING_REQUIRED:"Hoàn thành tính giá thành lệnh sản xuất trước khi tính giá xuất thành phẩm.",BUSINESS_NEGATIVE_VALUATION:"Sổ kho có số lượng hoặc giá trị không đủ theo ngày. Đối chiếu chứng từ nguồn trước khi tính giá.",BUSINESS_STOCK_VALUATION_LOCKED:"Kỳ kho đã tính giá. Đảo kỳ tính giá liên quan trước khi điều chỉnh nguồn.",BUSINESS_TAX_PROFILE_REQUIRED:"Chưa có hồ sơ hoặc chính sách thuế, bảo hiểm có hiệu lực cho kỳ này.",BUSINESS_TAX_BRACKETS_INVALID:"Bậc thuế phải liên tục từ 0, không chồng khoảng và có bậc cuối không giới hạn.",BUSINESS_PAYROLL_DEDUCTIONS_EXCEEDED:"Tổng khấu trừ, thuế và bảo hiểm vượt thu nhập. Đối chiếu hồ sơ và chính sách áp dụng."};
 const key=message.match(/BUSINESS_[A-Z_]+/)?.[0];if(key&&detail[key])throw new AppError("CONFLICT",detail[key]);
 if(message.includes("BUSINESS_PURCHASE_INVOICE_EXCEEDED"))throw new AppError("CONFLICT","Giá trị hóa đơn trước thuế vượt phần chưa lập hóa đơn của đơn mua. Đối chiếu hoặc điều chỉnh đơn mua trước khi ghi sổ.");
 if(message.includes("RATE_LIMITED"))throw new AppError("RATE_LIMITED");
 if(message.includes("SESSION_REQUIRED"))throw new AppError("AUTHENTICATION_REQUIRED");
 if(message.includes("TENANT_UNAVAILABLE"))throw new AppError("ACCOUNT_DISABLED","Không gian đã hết hạn hoặc tạm ngừng. Liên hệ DIMIXO để gia hạn.");
 if(message.includes("PASSWORD_CHANGE_REQUIRED"))throw new AppError("PERMISSION_DENIED","Đổi mật khẩu trước khi sử dụng ERP.");
 if(message.includes("FORBIDDEN"))throw new AppError("PERMISSION_DENIED");
 if(message.includes("NOT_FOUND"))throw new AppError("NOT_FOUND");
 if(message.includes("DUPLICATE"))throw new AppError("DUPLICATE","Mã, tên tài khoản hoặc địa chỉ ERP đã được sử dụng.");
 if(message.includes("BUSINESS_DELIVERY_EXCEEDED"))throw new AppError("CONFLICT","Số lượng giao vượt phần còn lại của đơn hàng.");
 if(message.includes("BUSINESS_RETURN_EXCEEDED"))throw new AppError("CONFLICT","Số lượng trả vượt số lượng đã giao.");
 if(message.includes("BUSINESS_INVALID_DATE"))throw new AppError("VALIDATION_ERROR","Ngày chứng từ không hợp lệ với ngày đơn hàng hoặc lô hàng.");
 if(message.includes("BUSINESS_SALES_ITEM_MISMATCH"))throw new AppError("CONFLICT","Hàng hóa không nằm trong đơn bán hàng.");
 if(message.includes("BUSINESS_"))throw new AppError("CONFLICT",businessMessages[message.match(/BUSINESS_[A-Z_]+/)?.[0]??""]??"Dữ liệu đã thay đổi hoặc chưa đủ điều kiện. Tải lại để đối chiếu.");
 throw new AppError("NETWORK_ERROR","Chưa xác nhận được kết quả. Tải lại trước khi tiếp tục.");
}
const businessMessages:Record<string,string>={BUSINESS_TIMECARDS_INCOMPLETE:"Ngày công tính lương vượt giờ công đã xác nhận. Đối chiếu bảng công trước khi ghi sổ.",BUSINESS_REVIEW_REQUIRED:"Chứng từ cần được người khác duyệt trước khi ghi sổ.",BUSINESS_JOURNAL_UNBALANCED:"Tổng Nợ phải bằng tổng Có và lớn hơn 0; cần ít nhất hai dòng định khoản.",BUSINESS_PERIOD_CLOSED:"Ngày hạch toán không thuộc kỳ kế toán đang mở.",BUSINESS_PERIOD_OVERLAP:"Khoảng ngày trùng với kỳ kế toán hiện có.",BUSINESS_UNPOSTED_DOCUMENTS:"Còn chứng từ nháp trong kỳ; xử lý trước khi khóa sổ.",BUSINESS_INSUFFICIENT_FUNDS:"Số dư tiền không đủ để chi tại ngày hạch toán.",BUSINESS_CONFIGURATION_HAS_DATA:"Gói ngành hoặc module đã có dữ liệu. Giữ cấu hình hiện tại để bảo toàn chứng từ.",BUSINESS_USE_WORKSPACE_CONFIGURATION:"Đổi gói ngành tại Cấu hình ERP rồi lưu đồng bộ.",BUSINESS_MOLD_REQUIRED:"Chọn khuôn sản xuất trước khi phát hành lệnh nhựa / bao bì.",BUSINESS_RECEIPT_EXCEEDED:"Lượng nhập vượt sản lượng đạt ở công đoạn cuối hoặc kế hoạch lệnh.",BUSINESS_MATERIAL_INCOMPLETE:"Cấp đủ nguyên liệu định mức trước khi nhập thành phẩm.",BUSINESS_MATERIAL_NOT_IN_BOM:"Nguyên liệu không có trong định mức đã phát hành.",BUSINESS_MATERIAL_EXCEEDED:"Lượng cấp vượt định mức gồm hao hụt cho phép.",BUSINESS_PRODUCTION_EXCEEDED:"Sản lượng đạt vượt kế hoạch lệnh.",BUSINESS_PREVIOUS_OPERATION_INCOMPLETE:"Sản lượng vượt đầu ra công đoạn trước tại ngày báo cáo.",BUSINESS_INSUFFICIENT_STOCK:"Số lượng xuất vượt tồn kho khả dụng.",BUSINESS_LOT_BLOCKED:"Lô đã hết hạn hoặc chưa đạt chất lượng.",BUSINESS_LOT_REQUIRED:"Vật tư yêu cầu quản lý theo lô / số sê-ri.",BUSINESS_CYCLE:"Liên kết tạo vòng lặp.",BUSINESS_PAYMENT_EXCEEDED:"Số tiền vượt công nợ còn lại.",BUSINESS_RECORD_LOCKED:"Chứng từ đã khóa theo trạng thái nghiệp vụ.",BUSINESS_INVALID_INPUT:"Kiểm tra dữ liệu bắt buộc và định dạng.",BUSINESS_INVALID_REFERENCE:"Dữ liệu liên kết không hợp lệ.",BUSINESS_EXPIRY_REQUIRED:"Lô thực phẩm cần có hạn sử dụng.",BUSINESS_BOM_EMPTY:"Định mức chưa có nguyên liệu.",BUSINESS_ORDER_EMPTY:"Đơn hàng chưa có chi tiết hoặc giá trị.",BUSINESS_PRODUCTION_INCOMPLETE:"Sản lượng đạt chưa đủ số lượng lệnh.",BUSINESS_DELIVERY_INCOMPLETE:"Chưa xuất đủ số lượng đơn hàng.",BUSINESS_OPERATION_REQUIRED:"Chọn công đoạn để tính chi phí giờ công / máy."};
export async function businessRpc<T=unknown>(name:string,args:Record<string,unknown>):Promise<T>{
 const c=getSupabaseServiceClient({timeoutMs:12000});if(!c)businessFailure();
 let r;try{r=await c.rpc(name,args).abortSignal(AbortSignal.timeout(12000));}catch{businessFailure();}
 if(r.error){if(r.error.code==="23505")businessFailure("BUSINESS_DUPLICATE");if(["23502","23503","23514","22P02","22003"].includes(r.error.code))businessFailure("BUSINESS_INVALID_INPUT");businessFailure(r.error.message);}return r.data as T;
}
export async function businessSessionArgs(slug:string){
 const p=businessSlug.safeParse(slug);if(!p.success)throw new AppError("NOT_FOUND");
 const token=(await cookies()).get(businessSessionCookie)?.value;
 if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AppError("AUTHENTICATION_REQUIRED");
 return {p_hash:businessHash("session",token),p_slug:p.data};
}
export const readBusinessWorkspace=cache(async(slug:string)=>businessRpc<BusinessWorkspace>("business_session_workspace",await businessSessionArgs(slug)));
export async function provisionBusiness(customerId:string,input:unknown,actorId:string){
 if(!z.string().uuid().safeParse(customerId).success)throw new AppError("VALIDATION_ERROR");
 const d=businessProvisionSchema.parse(input);const {requestId,customerVersion,...config}=d;
 if(d.features.some(f=>!(businessIndustries[d.industry].features as readonly string[]).includes(f)))throw new AppError("VALIDATION_ERROR");
 const initialPassword=initialBusinessPassword(requestId);
 const passwordHash=await hashBusinessPassword(initialPassword,businessHash("initial-salt",requestId).slice(0,32));
 const payloadHash=businessHash("provision",JSON.stringify({customerId,customerVersion,config,passwordHash}));
 const r=await businessRpc<{customerId:string;tenantId:string;slug:string;username:string;accountId:string;trialEndsAt:string;rowVersion:number}>("business_provision_customer",{p_request_id:requestId,p_customer_id:customerId,p_expected_version:customerVersion,p_config:config,p_password_hash:passwordHash,p_payload_hash:payloadHash,p_actor_id:actorId});
 if(r?.customerId!==customerId||r.slug!==d.slug||r.username!==d.username||r.rowVersion!==customerVersion+1)businessFailure();
 return {...r,initialPassword};
}
export interface OperatorBusinessWorkspace extends Omit<BusinessWorkspace,"role"> {rowVersion:number}
export function operatorBusinessWorkspace(customerId:string,actorId:string){if(!z.string().uuid().safeParse(customerId).success)throw new AppError("VALIDATION_ERROR");return businessRpc<OperatorBusinessWorkspace|null>("business_customer_workspace",{p_customer_id:customerId,p_actor_id:actorId});}
export async function loginBusiness(input:unknown,network:string){
 const d=businessLoginSchema.parse(input);
 const lookup=await businessRpc<{accountId:string;credentialVersion:number;passwordHash:string}|null>("business_login_lookup",{p_slug:d.slug,p_username:d.username,p_identifier_hash:businessHash("login-id",`${d.slug}:${d.username}`),p_network_hash:businessHash("login-network",network)});
 const valid=await verifyBusinessPassword(d.password,lookup?.passwordHash??`scrypt$65536$8$2$${"0".repeat(32)}$${"0".repeat(128)}`);
 if(!lookup||!valid)throw new AppError("INVALID_CREDENTIALS","Doanh nghiệp, tài khoản hoặc mật khẩu không đúng.");
 const token=newBusinessToken();const r=await businessRpc<{slug:string;mustChangePassword:boolean}>("business_open_session",{p_account_id:lookup.accountId,p_credential_version:lookup.credentialVersion,p_token_hash:businessHash("session",token)});
 (await cookies()).set(businessSessionCookie,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:12*3600});
 return {destination:`/erp/${r.slug}${r.mustChangePassword?"/password":""}`};
}
export async function logoutBusiness(){const jar=await cookies();const token=jar.get(businessSessionCookie)?.value;jar.delete(businessSessionCookie);if(token)await businessRpc("business_logout",{p_hash:businessHash("session",token)});return {loggedOut:true};}
export async function commandBusinessMember(slug:string,input:unknown){
 const d=businessMemberCommand.parse(input);const w=await readBusinessWorkspace(slug);if(w.role!=="owner"||w.mustChangePassword)throw new AppError("PERMISSION_DENIED");
 const credentials=d.operation==="create"||d.operation==="reset";
 const password=credentials?initialBusinessPassword(d.requestId):null;
 const passwordHash=password?await hashBusinessPassword(password,businessHash("member-salt",d.requestId).slice(0,32)):null;
 const {requestId,accountId,rowVersion,operation,...data}=d;
 const result=await businessRpc<Record<string,unknown>>("business_member_command",{...await businessSessionArgs(slug),p_request_id:requestId,p_id:accountId,p_expected_version:rowVersion,p_operation:operation,p_data:data,p_password_hash:passwordHash,p_payload_hash:businessHash("member",JSON.stringify(d))});
 return {...result,...(password?{initialPassword:password}:{})};
}
export async function changeBusinessPassword(slug:string,input:unknown){
 const d=z.object({currentPassword:z.string().min(1).max(128),password:businessPassword}).strict().parse(input);const args=await businessSessionArgs(slug);
 const snapshot=await businessRpc<{passwordHash:string;credentialVersion:number}>("business_password_snapshot",args);
 if(!await verifyBusinessPassword(d.currentPassword,snapshot.passwordHash))throw new AppError("INVALID_CREDENTIALS","Mật khẩu hiện tại không đúng.");
 if(d.currentPassword===d.password)throw new AppError("VALIDATION_ERROR","Chọn mật khẩu khác mật khẩu hiện tại.");
 return businessRpc("business_change_password",{...args,p_expected_version:snapshot.credentialVersion,p_password_hash:await hashBusinessPassword(d.password)});
}
export async function saveBusinessRecord(slug:string,kind:EntityKind,d:{requestId:string;recordId:string;rowVersion:number;data:Record<string,unknown>}){
 const data=recordSchema(kind).safeParse(d.data);if(!data.success)throw new AppError("VALIDATION_ERROR","Kiểm tra: "+data.error.issues.map(i=>i.path.join(".")).join(", "));
 return businessRpc("business_save_record",{...await businessSessionArgs(slug),p_kind:kind,p_id:d.recordId,p_expected_version:d.rowVersion,p_data:data.data,p_request_id:d.requestId,p_payload_hash:businessHash("record",JSON.stringify({...d,data:data.data,kind}))});
}

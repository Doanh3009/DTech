import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";
import { generateReportWorkbook } from "./excelGenerator";
import { reportSheetPermission } from "./reportFieldRegistry";
import { safeUploadName } from "@/lib/security/filePolicy";
import type { ReportExport, ReportTemplate } from "../types/timesheetTypes";

type Row=Record<string,unknown>;
function db(){const value=getSupabaseServiceClient();if(!value)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return value;}
function txt(row:Row,key:string){return typeof row[key]==="string"?String(row[key]):"";}
async function actorId(client:SupabaseClient,user:AuthenticatedUser){let query=client.from("app_accounts").select("id").limit(1);query=/^[0-9a-f-]{36}$/i.test(user.id)?query.eq("id",user.id):query.eq("primary_email",user.email);const {data,error}=await query.maybeSingle();if(error)throw new AppError("SERVER_ERROR","Không thể xác định tài khoản xuất báo cáo.");if(!data?.id)throw new AppError("PERMISSION_DENIED");return String(data.id);}
function template(row:Row):ReportTemplate{return{id:txt(row,"id"),code:txt(row,"code"),name:txt(row,"name"),reportType:txt(row,"report_type") as ReportTemplate["reportType"],definition:row.definition as ReportTemplate["definition"],version:Number(row.version),active:Boolean(row.active)};}
function reportExport(row:Row):ReportExport{return{id:txt(row,"id"),reportType:txt(row,"report_type") as ReportExport["reportType"],templateId:txt(row,"template_id"),templateVersion:Number(row.template_version),periodId:txt(row,"period_id")||undefined,periodVersion:row.period_version==null?undefined:Number(row.period_version),status:txt(row,"status") as ReportExport["status"],requestedAt:txt(row,"requested_at"),completedAt:txt(row,"completed_at")||undefined,fileId:txt(row,"file_id")||undefined,fileName:((row.metadata??{}) as Row).fileName as string|undefined,errorMessage:txt(row,"error_message")||undefined};}

export async function listReportTemplates(user:AuthenticatedUser){if(!["export_template.view","export_template.manage","timesheet.export","report.employee_basic","report.employee_sensitive","employee.export_basic","employee.export_sensitive"].some(permission=>user.permissions.includes(permission as AuthenticatedUser["permissions"][number])))throw new AppError("PERMISSION_DENIED");const {data,error}=await db().from("report_templates").select("*").order("report_type").order("name");if(error)throw new AppError("SERVER_ERROR","Không thể đọc mẫu xuất.");return(data??[]).map(row=>template(row as Row));}
export async function saveReportTemplate(user:AuthenticatedUser,input:Omit<ReportTemplate,"id"|"version"> & {id?:string}){if(!can(user.permissions,"export_template.manage"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=await actorId(client,user);let result;if(input.id){const {data:current}=await client.from("report_templates").select("version,definition").eq("id",input.id).maybeSingle();if(!current)throw new AppError("NOT_FOUND");const next=Number(current.version)+1;result=await client.from("report_templates").update({code:input.code,name:input.name,report_type:input.reportType,definition:input.definition,version:next,active:input.active}).eq("id",input.id).eq("version",current.version).select("*").single();if(!result.error)await client.from("report_template_versions").insert({template_id:input.id,version:next,snapshot:input.definition,created_by:actor});}else{result=await client.from("report_templates").insert({code:input.code,name:input.name,report_type:input.reportType,definition:input.definition,active:input.active,created_by:actor}).select("*").single();if(!result.error&&result.data)await client.from("report_template_versions").insert({template_id:result.data.id,version:1,snapshot:input.definition,created_by:actor});}if(result.error||!result.data)throw new AppError(result.error?.code==="23505"?"DUPLICATE":"CONFLICT","Không thể lưu mẫu xuất.");await recordAuditLog({actorId:actor,action:"report.template_saved",entityType:"report_template",entityId:String(result.data.id),after:{code:input.code,reportType:input.reportType}});return template(result.data as Row);}

function employeeSnapshot(row:Row){const snap=(row.employee_snapshot??{}) as Row;return{employeeCode:txt(snap,"code")||txt(snap,"employeeCode"),employeeName:txt(snap,"name")||txt(snap,"employeeName"),departmentName:txt(snap,"departmentName"),positionName:txt(snap,"positionName"),employmentTypeName:txt(snap,"employmentTypeName")};}
async function allRows(query: (start: number, end: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, message: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await query(start, start + 999);
    if (error) throw new AppError("SERVER_ERROR", message);
    rows.push(...(data ?? []) as Row[]);
    if (!data || data.length < 1000) return rows;
  }
}
async function currentTimesheetRows(client: SupabaseClient, periodId: unknown, sheets: Set<string>) {
  const [daily, summaries] = await Promise.all([
    sheets.has("daily") || sheets.has("matrix") ? allRows((start, end) => client.from("daily_timesheets").select("*").eq("period_id", periodId).order("work_date").order("employee_id").range(start, end), "Không thể đọc dữ liệu công theo ngày.") : Promise.resolve([]),
    allRows((start, end) => client.from("timesheet_period_summaries").select("*").eq("period_id", periodId).order("employee_id").range(start, end), "Không thể đọc tổng hợp kỳ công.")
  ]);
  return { daily, summaries };
}
async function timesheetData(client:SupabaseClient,period:Row,sheets:Set<string>){let daily:Row[]=[];let summaries:Row[]=[];if(period.status==="locked"&&Number(period.version)>0){const {data,error}=await client.from("timesheet_period_versions").select("snapshot").eq("period_id",period.id).eq("version",period.version).maybeSingle();if(error)throw new AppError("SERVER_ERROR","Không thể đọc phiên bản kỳ công đã khóa.");if(data){const snapshot=(data.snapshot??{}) as Row;daily=Array.isArray(snapshot.daily)?snapshot.daily as Row[]:[];summaries=Array.isArray(snapshot.summaries)?snapshot.summaries as Row[]:[];}else{({daily,summaries}=await currentTimesheetRows(client,period.id,sheets));}}else{({daily,summaries}=await currentTimesheetRows(client,period.id,sheets));}
  const dailyRows=daily.map(row=>({...employeeSnapshot(row),employeeId:row.employee_id,workDate:row.work_date,shiftName:(row.shift_snapshot as Row|undefined)?.name,effectiveCheckIn:row.effective_check_in,effectiveCheckOut:row.effective_check_out,workMinutes:Number(row.work_minutes),workFraction:Number(row.work_fraction),leaveFraction:Number(row.leave_fraction),lateMinutes:Number(row.late_minutes),earlyLeaveMinutes:Number(row.early_leave_minutes),status:row.status,sources:row.source_codes,hrNote:row.hr_note,exceptionCount:Number(row.exception_count)}));const summaryRows=summaries.map(row=>({...employeeSnapshot(row),employeeId:row.employee_id,scheduledWorkdays:Number(row.scheduled_workdays),actualWorkdays:Number(row.actual_workdays),workedMinutes:Number(row.worked_minutes),lateDays:Number(row.late_days),lateMinutes:Number(row.late_minutes),earlyLeaveDays:Number(row.early_leave_days),earlyLeaveMinutes:Number(row.early_leave_minutes),annualLeaveDays:Number(row.annual_leave_days),unpaidLeaveDays:Number(row.unpaid_leave_days),absentDays:Number(row.absent_days),exceptionCount:Number(row.exception_count)}));
  const employeeIds=[...new Set([...daily,...summaries].map(row=>String(row.employee_id)))];const base=(process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000").replace(/\/$/,"");
  const [eventRows,leaveRows,ledgerRows]=await Promise.all([
    sheets.has("events") ? allRows((start,end)=>client.from("attendance_events").select("employee_id,attendance_date,event_type,effective_at,geofence_status,photo_status,attendance_locations(name),attendance_photos(id),employees(employee_code,full_name)").gte("attendance_date",period.start_date).lte("attendance_date",period.end_date).in("employee_id",employeeIds.length?employeeIds:["00000000-0000-0000-0000-000000000000"]).order("effective_at").order("id").range(start,end),"Không thể đọc lịch sử chấm công.") : Promise.resolve([]),
    sheets.has("leave") ? allRows((start,end)=>client.from("leave_requests").select("request_number,employee_id,start_date,end_date,calculated_days,status,employee_snapshot,leave_types(name)").eq("status","approved").lte("start_date",period.end_date).gte("end_date",period.start_date).order("start_date").order("id").range(start,end),"Không thể đọc đơn nghỉ đã duyệt.") : Promise.resolve([]),
    sheets.has("balance") || sheets.has("ledger") ? allRows((start,end)=>client.from("leave_ledger").select("employee_id,leave_year,leave_type_id,transaction_type,amount,effective_date,reason,leave_types(name),employees(employee_code,full_name)").gte("effective_date",`${String(period.start_date).slice(0,4)}-01-01`).lte("effective_date",period.end_date).order("effective_date").order("id").range(start,end),"Không thể đọc sổ phép.") : Promise.resolve([])
  ]);
  const eventsResult={data:eventRows},leaveResult={data:leaveRows},ledgerResult={data:ledgerRows};
  const nested = (row: Row, key: string) => (Array.isArray(row[key]) ? row[key][0] : row[key]) as Row | undefined;
  const events = eventsResult.data.map((row) => {
    const employee = nested(row, "employees"), location = nested(row, "attendance_locations"), photo = nested(row, "attendance_photos");
    return { employeeCode: employee?.employee_code, employeeName: employee?.full_name, attendanceDate: row.attendance_date, eventType: row.event_type, effectiveAt: row.effective_at, locationName: location?.name, geofenceStatus: row.geofence_status, photoStatus: row.photo_status, photoUrl: photo?.id ? `${base}/attendance/photos/${photo.id}` : "" };
  });
  const leave = leaveResult.data.map((row) => ({ ...employeeSnapshot(row), requestNumber: row.request_number, leaveTypeName: nested(row,"leave_types")?.name, startDate: row.start_date, endDate: row.end_date, calculatedDays: Number(row.calculated_days), status: row.status }));
  const ledger = ledgerResult.data.map((row) => {
    const employee = nested(row, "employees");
    return { employeeId: row.employee_id, leaveTypeId: row.leave_type_id, year: Number(row.leave_year), employeeCode: employee?.employee_code, employeeName: employee?.full_name, leaveTypeName: nested(row,"leave_types")?.name, effectiveDate: row.effective_date, transactionType: row.transaction_type, amount: Number(row.amount), reason: row.reason };
  });
  const balances = new Map<string, Row>();
  for (const item of ledger) {
    const id = `${item.employeeId}:${item.leaveTypeId}:${item.year}`;
    const current = balances.get(id) ?? { employeeCode: item.employeeCode, employeeName: item.employeeName, leaveTypeName: item.leaveTypeName, year: item.year, granted: 0, used: 0, remaining: 0 };
    // Reversed requests reduce usage, rather than becoming new granted leave.
    if (["leave_usage", "leave_reversal"].includes(String(item.transactionType))) current.used = Number(current.used) - item.amount;
    else current.granted = Number(current.granted) + item.amount;
    current.remaining = Number(current.granted) - Number(current.used);
    balances.set(id, current);
  }
  return { summary: summaryRows, daily: dailyRows, events, leave, balance: [...balances.values()], ledger };
}

async function employeeData(client: SupabaseClient, employeeId?: string): Promise<Record<string, Row[]>> {
  const [employeeRows, departmentRows, positionRows, typeRows] = await Promise.all([
    allRows((start,end)=>{let query=client.from("employees").select("*").order("employee_code").order("id");if(employeeId)query=query.eq("id",employeeId);return query.range(start,end);},"Không thể đọc dữ liệu nhân sự."),
    allRows((start,end)=>client.from("departments").select("id,name").order("id").range(start,end),"Không thể đọc danh sách phòng ban."),
    allRows((start,end)=>client.from("positions").select("id,name").order("id").range(start,end),"Không thể đọc danh sách chức danh."),
    allRows((start,end)=>client.from("employment_types").select("id,name").order("id").range(start,end),"Không thể đọc danh sách nhóm làm việc.")
  ]);
  const names = (rows: Row[]) => new Map(rows.map((row) => [String(row.id), String(row.name)]));
  const departments = names(departmentRows), positions = names(positionRows), types = names(typeRows);
  const employees = employeeRows.map((row) => ({ employeeCode: row.employee_code, fullName: row.full_name, departmentName: departments.get(String(row.department_id)) ?? "", positionName: positions.get(String(row.position_id)) ?? "", employmentTypeName: types.get(String(row.employment_type_id)) ?? "", companyEmail: row.company_email, employmentStatus: row.employment_status, joinDate: row.join_date, personalPhone: row.personal_phone, personalEmail: row.personal_email, dateOfBirth: row.date_of_birth, currentAddress: row.current_address }));
  if (!employeeId) return { employees };
  const first = employeeRows[0];
  if (!first?.id) throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
  const historyRows = await allRows((start,end)=>client.from("employee_history_events").select("event_date,event_type,after_data,reason").eq("employee_id",employeeId).order("event_date").order("id").range(start,end),"Không thể đọc quá trình công tác.");
  const profileLabels: Record<string,string> = { employee_code: "Mã nhân viên", full_name: "Họ tên", company_email: "Email công ty", join_date: "Ngày vào làm", employment_status: "Trạng thái" };
  const history = historyRows.map((row) => {
    const after = (row.after_data ?? {}) as Row;
    const changed = Object.entries(after).filter(([,item]) => typeof item === "string" || typeof item === "number").map(([key,item]) => `${key}: ${item}`).join("; ");
    return { effectiveDate: row.event_date, category: row.event_type, value: row.reason || changed || "—" };
  });
  return { profile: Object.entries(profileLabels).map(([key,field]) => ({ field, value: first[key] ?? "" })), history };
}

export async function createReportExport(user: AuthenticatedUser, input: { templateId: string; periodId?: string; employeeId?: string }) {
  const client = db();
  const actor = await actorId(client, user);
  const { data: templateRow, error: templateError } = await client.from("report_templates").select("*").eq("id", input.templateId).eq("active", true).maybeSingle();
  if (templateError) throw new AppError("SERVER_ERROR", "Không thể đọc mẫu xuất.");
  if (!templateRow) throw new AppError("NOT_FOUND", "Không tìm thấy mẫu xuất.");
  const selected = template(templateRow as Row);
  if (selected.reportType === "timesheet" && !can(user.permissions, "timesheet.export")) throw new AppError("PERMISSION_DENIED");
  if (selected.reportType !== "timesheet" && !["report.employee_basic", "report.employee_sensitive", "employee.export_basic", "employee.export_sensitive"].some((permission) => user.permissions.includes(permission as AuthenticatedUser["permissions"][number]))) throw new AppError("PERMISSION_DENIED");
  let period: Row | undefined;
  if (selected.reportType === "timesheet") {
    if (!input.periodId) throw new AppError("VALIDATION_ERROR", "Cần chọn kỳ công.");
    const { data, error } = await client.from("timesheet_periods").select("*").eq("id", input.periodId).maybeSingle();
    if (error) throw new AppError("SERVER_ERROR", "Không thể đọc kỳ công.");
    if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy kỳ công.");
    period = data as Row;
  }
  const exportId = crypto.randomUUID();
  const { error: queueError } = await client.from("report_exports").insert({ id: exportId, report_type: selected.reportType, template_id: selected.id, template_version: selected.version, period_id: period?.id ?? null, period_version: period?.version ?? null, filters: { employeeId: input.employeeId }, requested_by: actor, status: "processing" });
  if (queueError) throw new AppError("SERVER_ERROR", "Không thể tạo yêu cầu xuất.");
  try {
    const sheets = new Set(selected.definition.sheets.filter((sheet) => sheet.enabled && (!reportSheetPermission[sheet.key] || can(user.permissions, reportSheetPermission[sheet.key]))).map((sheet) => sheet.key));
    const data = (period ? await timesheetData(client, period, sheets) : await employeeData(client, input.employeeId)) as Record<string, Row[]>;
    const buffer = await generateReportWorkbook({ template: selected, permissions: user.permissions, data, title: period ? `${selected.name} - ${period.name}` : selected.name, period: period ? { startDate: String(period.start_date), endDate: String(period.end_date) } : undefined });
    const fileName = safeUploadName(`${selected.code}_${period?.code ?? input.employeeId ?? "ALL"}_v${period?.version ?? selected.version}.xlsx`, "report.xlsx");
    const objectPath = `${new Date().getUTCFullYear()}/${actor}/${exportId}/${fileName}`;
    const { error: uploadError } = await client.storage.from("report-exports").upload(objectPath, buffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false });
    if (uploadError) throw new AppError("SERVER_ERROR", "Không thể lưu tệp Excel vào kho báo cáo.");
    const fileId = crypto.randomUUID();
    const { error: fileError } = await client.from("file_assets").insert({ id: fileId, bucket: "report-exports", object_path: objectPath, owner_entity_type: "report_export", owner_entity_id: exportId, mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byte_size: buffer.byteLength, visibility: "private", created_by: actor, metadata: { fileName, templateVersion: selected.version, periodVersion: period?.version ?? null } });
    if (fileError) throw new AppError("SERVER_ERROR", "Không thể ghi nhận tệp Excel.");
    const { data: completed, error } = await client.from("report_exports").update({ status: "completed", completed_at: new Date().toISOString(), file_id: fileId, metadata: { fileName } }).eq("id", exportId).select("*").single();
    if (error || !completed) throw new AppError("SERVER_ERROR", "Không thể hoàn tất yêu cầu xuất.");
    await recordAuditLog({ actorId: actor, action: "report.export_completed", entityType: "report_export", entityId: exportId, metadata: { reportType: selected.reportType, templateVersion: selected.version, periodVersion: period?.version } });
    return reportExport(completed as Row);
  } catch (error) {
    await client.from("report_exports").update({ status: "failed", error_message: error instanceof Error ? error.message : "Không thể xuất báo cáo." }).eq("id", exportId);
    if (error instanceof AppError) throw error;
    throw new AppError("SERVER_ERROR", "Không thể tạo tệp Excel.");
  }
}
export async function listReportExports(user:AuthenticatedUser){const client=db();const actor=await actorId(client,user);let query=client.from("report_exports").select("*").order("requested_at",{ascending:false}).limit(100);if(!can(user.permissions,"export_template.manage"))query=query.eq("requested_by",actor);const {data,error}=await query;if(error)throw new AppError("SERVER_ERROR","Không thể đọc lịch sử xuất.");return(data??[]).map(row=>reportExport(row as Row));}
export async function getReportExport(user:AuthenticatedUser,id:string){const client=db();const actor=await actorId(client,user);const {data,error}=await client.from("report_exports").select("*").eq("id",id).maybeSingle();if(error||!data)throw new AppError("NOT_FOUND","Không tìm thấy yêu cầu xuất.");if(String(data.requested_by)!==actor&&!can(user.permissions,"export_template.manage"))throw new AppError("PERMISSION_DENIED");return reportExport(data as Row);}
export async function getReportExportAsset(user:AuthenticatedUser,id:string){const client=db();const actor=await actorId(client,user);const {data,error}=await client.from("report_exports").select("requested_by,status,file_assets(bucket,object_path,metadata)").eq("id",id).maybeSingle();if(error||!data||data.status!=="completed")throw new AppError("NOT_FOUND","Tệp xuất chưa sẵn sàng.");if(String(data.requested_by)!==actor&&!can(user.permissions,"export_template.manage"))throw new AppError("PERMISSION_DENIED");const asset=data.file_assets as unknown as Row;if(!asset)throw new AppError("NOT_FOUND");return{bucket:txt(asset,"bucket"),path:txt(asset,"object_path"),fileName:txt((asset.metadata??{}) as Row,"fileName")||"report.xlsx"};}

import "server-only";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
type Row = Record<string, unknown>;

export interface ContractTemplateOption {
  id: string;
  name: string;
  fileAssetId?: string;
  createdAt: string;
}

function db() {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return client;
}

function nested(value: unknown): Row | undefined {
  if (Array.isArray(value)) return value[0] as Row | undefined;
  return value && typeof value === "object" ? value as Row : undefined;
}

function optional(value: unknown) {
  return typeof value === "string" && value ? value : "";
}

function date(value: unknown) {
  const raw = optional(value);
  if (!raw) return "";
  const [year, month, day] = raw.slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : raw;
}

export async function listContractTemplates(user: AuthenticatedUser): Promise<ContractTemplateOption[]> {
  if (!can(user.permissions, "contract.view")) throw new AppError("PERMISSION_DENIED");
  const { data, error } = await db().from("employee_contract_templates")
    .select("id,name,file_asset_id,created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách mẫu Word.");
  const mayViewFile = can(user.permissions, "contract.file.view");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    fileAssetId: mayViewFile ? String(row.file_asset_id) : undefined,
    createdAt: String(row.created_at)
  }));
}

export async function createContractTemplate(user: AuthenticatedUser, name: string, file: File) {
  if (!can(user.permissions, "contract.file.upload")) throw new AppError("PERMISSION_DENIED");
  const templateName = name.trim();
  if (templateName.length < 2 || templateName.length > 120) {
    throw new AppError("VALIDATION_ERROR", "Tên mẫu phải từ 2 đến 120 ký tự.");
  }
  const bytes = await validateUploadedFile(file, { allowedMimeTypes: [DOCX_MIME], maxBytes: 15 * 1024 * 1024 });
  const client = db();
  const templateId = crypto.randomUUID();
  const assetId = crypto.randomUUID();
  const path = `contract-templates/${templateId}/${assetId}-${safeUploadName(file.name, "contract-template.docx")}`;
  const { error: uploadError } = await client.storage.from("employee-private").upload(path, bytes, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) throw new AppError("SERVER_ERROR", "Không thể tải mẫu Word.");
  const { error: assetError } = await client.from("file_assets").insert({
    id: assetId,
    bucket: "employee-private",
    object_path: path,
    owner_entity_type: "employee_contract_template",
    owner_entity_id: templateId,
    mime_type: DOCX_MIME,
    byte_size: file.size,
    visibility: "private",
    created_by: user.id,
    metadata: { originalName: file.name }
  });
  if (assetError) {
    await client.storage.from("employee-private").remove([path]);
    throw new AppError("SERVER_ERROR", "Không thể lưu mẫu Word.");
  }
  const { error } = await client.from("employee_contract_templates").insert({
    id: templateId,
    name: templateName,
    file_asset_id: assetId,
    created_by: user.id
  });
  if (error) {
    await client.from("file_assets").delete().eq("id", assetId);
    await client.storage.from("employee-private").remove([path]);
    throw new AppError(error.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error.code === "23505" ? "Tên mẫu Word đã tồn tại." : "Không thể lưu mẫu Word.");
  }
  await recordAuditLog({ actorId: user.id, action: "employee.contract_template.created", entityType: "employee_contract_template", entityId: templateId, after: { name: templateName, fileAssetId: assetId } });
  return { id: templateId, name: templateName, fileAssetId: assetId, createdAt: new Date().toISOString() };
}

export async function generateContractDocument(user: AuthenticatedUser, contractId: string, templateId: string) {
  if (!can(user.permissions, "contract.edit") || !can(user.permissions, "contract.file.upload")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const [{ data: template }, { data: contract }] = await Promise.all([
    client.from("employee_contract_templates").select("id,name,file_asset_id").eq("id", templateId).eq("active", true).maybeSingle(),
    client.from("employee_contracts").select("*").eq("id", contractId).maybeSingle()
  ]);
  if (!template) throw new AppError("NOT_FOUND", "Không tìm thấy mẫu Word.");
  if (!contract) throw new AppError("NOT_FOUND", "Không tìm thấy hợp đồng.");
  const [{ data: templateAsset }, { data: employee }] = await Promise.all([
    client.from("file_assets").select("bucket,object_path").eq("id", template.file_asset_id).maybeSingle(),
    client.from("employees").select("*,departments!employees_department_id_fkey(name),positions(name),employment_types(name),employee_sensitive_profiles(*)").eq("id", contract.employee_id).maybeSingle()
  ]);
  if (!templateAsset || !employee) throw new AppError("NOT_FOUND", "Thiếu mẫu Word hoặc hồ sơ nhân viên.");
  const { data: blob, error: downloadError } = await client.storage.from(templateAsset.bucket).download(templateAsset.object_path);
  if (downloadError || !blob) throw new AppError("SERVER_ERROR", "Không thể đọc mẫu Word.");

  const department = nested(employee.departments);
  const position = nested(employee.positions);
  const employmentType = nested(employee.employment_types);
  const sensitive = can(user.permissions, "employee.view_sensitive") ? nested(employee.employee_sensitive_profiles) : undefined;
  let output: Buffer;
  try {
    const zip = new PizZip(Buffer.from(await blob.arrayBuffer()));
    const document = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
    document.render({
      employee_code: optional(employee.employee_code),
      employee_full_name: optional(employee.full_name),
      employee_display_name: optional(employee.display_name) || optional(employee.full_name),
      date_of_birth: date(employee.date_of_birth),
      personal_phone: optional(employee.personal_phone),
      personal_email: optional(employee.personal_email),
      company_email: optional(employee.company_email),
      current_address: optional(employee.current_address),
      permanent_address: optional(employee.permanent_address),
      province: optional(employee.province),
      department: optional(department?.name),
      position: optional(position?.name),
      employment_type: optional(employmentType?.name),
      official_date: date(employee.official_date),
      national_id_number: optional(sensitive?.national_id_number),
      national_id_issued_date: date(sensitive?.national_id_issued_date),
      national_id_issued_place: optional(sensitive?.national_id_issued_place),
      personal_tax_code: optional(sensitive?.personal_tax_code),
      contract_number: optional(contract.contract_number),
      contract_type: optional(contract.contract_type),
      signed_date: date(contract.signed_date),
      effective_date: date(contract.effective_date ?? contract.start_date),
      end_date: date(contract.end_date),
      contract_note: optional(contract.note)
    });
    output = document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch {
    throw new AppError("VALIDATION_ERROR", "Mẫu Word không hợp lệ hoặc có biến dữ liệu bị lỗi.");
  }

  const assetId = crypto.randomUUID();
  const outputName = `${safeUploadName(String(contract.contract_number), "hop-dong")}.docx`;
  const path = `${contract.employee_id}/contracts/${contractId}/${assetId}-${outputName}`;
  const { error: uploadError } = await client.storage.from("employee-private").upload(path, output, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) throw new AppError("SERVER_ERROR", "Không thể tạo file Word hợp đồng.");
  const { error: assetError } = await client.from("file_assets").insert({
    id: assetId,
    bucket: "employee-private",
    object_path: path,
    owner_entity_type: "employee_contract",
    owner_entity_id: contractId,
    mime_type: DOCX_MIME,
    byte_size: output.byteLength,
    visibility: "private",
    created_by: user.id,
    metadata: { originalName: outputName, generated: true, templateId }
  });
  if (assetError) {
    await client.storage.from("employee-private").remove([path]);
    throw new AppError("SERVER_ERROR", "Không thể lưu file Word hợp đồng.");
  }
  const { error: updateError } = await client.from("employee_contracts").update({ attachment_file_id: assetId, template_id: templateId }).eq("id", contractId);
  if (updateError) {
    await client.from("file_assets").delete().eq("id", assetId);
    await client.storage.from("employee-private").remove([path]);
    throw new AppError("SERVER_ERROR", "Không thể gắn file Word vào hợp đồng.");
  }
  await recordAuditLog({ actorId: user.id, action: "employee.contract_document.generated", entityType: "employee_contract", entityId: contractId, after: { templateId, fileAssetId: assetId } });
  return assetId;
}

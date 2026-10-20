import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError, errorResponse } from "@/lib/api/errors";
import { parseWithSchema } from "@/lib/api/validation";
import { can, type Permission } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

const paramsSchema = z.object({ assetId: z.string().uuid() });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "file.read");
    const { assetId } = parseWithSchema(paramsSchema, await params);
    const client = getSupabaseServiceClient();
    if (!client) {
      throw new AppError("NOT_FOUND", "Kho file private chưa được cấu hình.");
    }

    const { data: asset, error: assetError } = await client
      .from("file_assets")
      .select("id,bucket,object_path,owner_entity_type,owner_entity_id,visibility")
      .eq("id", assetId)
      .maybeSingle();
    if (assetError || !asset) {
      throw new AppError("NOT_FOUND", "Không tìm thấy file.");
    }

    const { data: document } = await client
      .from("employee_documents")
      .select("employee_id,sensitive")
      .eq("file_id", assetId)
      .is("deleted_at", null)
      .maybeSingle();
    const { data: sensitiveProfile } = await client
      .from("employee_sensitive_profiles")
      .select("employee_id")
      .or(`national_id_front_file_id.eq.${assetId},national_id_back_file_id.eq.${assetId}`)
      .maybeSingle();
    const { data: contract } = await client
      .from("employee_contracts")
      .select("employee_id")
      .eq("attachment_file_id", assetId)
      .maybeSingle();

    if (document && !can(user.permissions, "employee.view")) {
      throw new AppError("PERMISSION_DENIED");
    }
    if (sensitiveProfile && !can(user.permissions, "employee.identity_document.view")) {
      throw new AppError("PERMISSION_DENIED");
    }
    if (asset.owner_entity_type === "employee_contract") {
      if (!can(user.permissions, "contract.file.view")) throw new AppError("PERMISSION_DENIED");
      const { data: owner } = await client.from("employee_contracts").select("id").eq("id", asset.owner_entity_id).maybeSingle();
      if (!owner) throw new AppError("NOT_FOUND", "Hợp đồng chứa file không tồn tại.");
    }
    if (asset.owner_entity_type === "employee_contract_template") {
      if (!can(user.permissions, "contract.file.view")) throw new AppError("PERMISSION_DENIED");
      const { data: owner } = await client.from("employee_contract_templates").select("id").eq("id", asset.owner_entity_id).eq("active", true).maybeSingle();
      if (!owner) throw new AppError("NOT_FOUND", "Mẫu hợp đồng không tồn tại.");
    }
    if (contract && !can(user.permissions, "contract.file.view")) throw new AppError("PERMISSION_DENIED");
    if (asset.owner_entity_type === "insurance_event" && !can(user.permissions, "insurance.document.view")) {
      throw new AppError("PERMISSION_DENIED");
    }
    const sensitiveAccess = Boolean(document?.sensitive || sensitiveProfile);
    if (document?.sensitive && !can(user.permissions, "employee.view_sensitive")) {
      throw new AppError("PERMISSION_DENIED");
    }

    if (asset.owner_entity_type === "project_update") {
      const { data: update } = await client.from("project_updates").select("project_id").eq("id", asset.owner_entity_id).maybeSingle();
      if (!update) throw new AppError("NOT_FOUND", "Không tìm thấy cập nhật chứa tệp.");
      if (!can(user.permissions, "project_update.view_all") && !can(user.permissions, "project_monitoring.view_all")) {
        let accountQuery = client.from("app_accounts").select("employee_id").limit(1);
        accountQuery = /^[0-9a-f-]{36}$/i.test(user.id) ? accountQuery.eq("id", user.id) : accountQuery.eq("primary_email", user.email);
        const { data: account } = await accountQuery.maybeSingle();
        const { data: assignment } = account?.employee_id ? await client.from("project_assignments").select("id").eq("project_id", update.project_id).eq("employee_id", account.employee_id).eq("status", "active").limit(1).maybeSingle() : { data: null };
        if (!assignment) throw new AppError("PERMISSION_DENIED", "Bạn không thuộc phạm vi dự án này.");
      }
    }

    if (asset.owner_entity_type === "inventory_document") {
      const { data: inventoryDocument } = await client.from("inventory_documents").select("type,reverses_document_id,source_warehouse_id,target_warehouse_id").eq("id", asset.owner_entity_id).maybeSingle();
      if (!inventoryDocument) throw new AppError("NOT_FOUND", "Không tìm thấy chứng từ chứa tệp.");
      let permissionType = inventoryDocument.type;
      if (permissionType === "reversal" && inventoryDocument.reverses_document_id) {
        const { data: original } = await client.from("inventory_documents").select("type").eq("id", inventoryDocument.reverses_document_id).maybeSingle();
        permissionType = original?.type ?? "receipt";
      }
      const viewPermission = `warehouse.${permissionType}.view` as Permission;
      if (!can(user.permissions, viewPermission)) throw new AppError("PERMISSION_DENIED");
      if (!can(user.permissions, "warehouse.view_all")) {
        let accountQuery = client.from("app_accounts").select("id").limit(1);
        accountQuery = /^[0-9a-f-]{36}$/i.test(user.id) ? accountQuery.eq("id", user.id) : accountQuery.eq("primary_email", user.email);
        const { data: account } = await accountQuery.maybeSingle();
        const warehouseIds = [inventoryDocument.source_warehouse_id, inventoryDocument.target_warehouse_id].filter(Boolean);
        const { data: scope } = account?.id && warehouseIds.length ? await client.from("warehouse_user_scopes").select("warehouse_id").eq("account_id", account.id).eq("can_view", true).in("warehouse_id", warehouseIds) : { data: null };
        if (!scope?.length) throw new AppError("PERMISSION_DENIED", "Bạn không thuộc phạm vi kho của chứng từ này.");
      }
    }

    if (asset.owner_entity_type === "inventory_item" && !can(user.permissions, "warehouse.item.view")) {
      throw new AppError("PERMISSION_DENIED");
    }

    if (asset.owner_entity_type === "shipment_document") {
      if (!can(user.permissions, "shipment_document.view")) throw new AppError("PERMISSION_DENIED");
      const { data: shipment } = await client.from("shipments").select("id,assigned_account_id,created_by").eq("id", asset.owner_entity_id).maybeSingle();
      if (!shipment) throw new AppError("NOT_FOUND", "Không tìm thấy lô hàng chứa chứng từ.");
      if (!can(user.permissions, "import_export.view_all")) {
        let accountQuery = client.from("app_accounts").select("id").limit(1);
        accountQuery = /^[0-9a-f-]{36}$/i.test(user.id) ? accountQuery.eq("id", user.id) : accountQuery.eq("primary_email", user.email);
        const { data: account } = await accountQuery.maybeSingle();
        if (!account?.id || (shipment.assigned_account_id !== account.id && shipment.created_by !== account.id)) throw new AppError("PERMISSION_DENIED", "Bạn không thuộc phạm vi lô hàng này.");
      }
    }

    const { data: signed, error: signedError } = await client.storage
      .from(asset.bucket)
      .createSignedUrl(asset.object_path, 300);
    if (signedError || !signed?.signedUrl) {
      throw new AppError("SERVER_ERROR", "Không thể tạo quyền truy cập file.");
    }

    if (sensitiveAccess) {
      await recordAuditLog({
        actorId: user.id,
        action: "employee.sensitive_file_viewed",
        entityType: "file_asset",
        entityId: assetId,
        metadata: { ownerEntityType: asset.owner_entity_type, ownerEntityId: asset.owner_entity_id }
      });
    }

    return NextResponse.redirect(signed.signedUrl, 307);
  } catch (error) {
    logger.error("api.file.signed_url_failed");
    return errorResponse(error);
  }
}

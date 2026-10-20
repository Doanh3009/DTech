import { z } from "zod";

import { AppError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";

export const brandAssetTypeSchema = z.enum(["logo_main", "logo_compact", "logo_dark", "favicon"]);
export type BrandAssetType = z.infer<typeof brandAssetTypeSchema>;

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytesByType: Record<BrandAssetType, number> = {
  logo_main: 2 * 1024 * 1024,
  logo_compact: 1024 * 1024,
  logo_dark: 2 * 1024 * 1024,
  favicon: 512 * 1024
};

function fileExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "webp";
}

function hasExpectedSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (mimeType === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function uint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function imageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mimeType === "image/png" && bytes.length >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      if (offset + 4 >= bytes.length) break;
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const chunk = new TextDecoder().decode(bytes.slice(12, 16));
    if (chunk === "VP8X") return { width: uint24LittleEndian(bytes, 24) + 1, height: uint24LittleEndian(bytes, 27) + 1 };
    if (chunk === "VP8 " && bytes.length >= 30) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L" && bytes.length >= 25) {
      const width = 1 + ((bytes[21] | (bytes[22] << 8)) & 0x3fff);
      const height = 1 + (((bytes[22] >> 6) | (bytes[23] << 2) | (bytes[24] << 10)) & 0x3fff);
      return { width, height };
    }
  }
  return null;
}

function validateDimensions(bytes: Uint8Array, mimeType: string, assetType: BrandAssetType): void {
  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions || dimensions.width < 32 || dimensions.height < 32 || dimensions.width > 4096 || dimensions.height > 4096) {
    throw new AppError("VALIDATION_ERROR", "Kích thước ảnh không hợp lệ.");
  }
  const ratio = dimensions.width / dimensions.height;
  const square = assetType === "logo_compact" || assetType === "favicon";
  if (square && (ratio < 0.8 || ratio > 1.2)) {
    throw new AppError("VALIDATION_ERROR", "Ảnh cần có tỷ lệ 1:1.");
  }
  if (!square && (ratio < 0.65 || ratio > 6)) {
    throw new AppError("VALIDATION_ERROR", "Tỷ lệ logo cần nằm trong khoảng 0,65:1 đến 6:1.");
  }
}

export async function validateBrandAsset(file: File, assetType: BrandAssetType): Promise<Uint8Array> {
  if (!allowedMimeTypes.has(file.type)) {
    throw new AppError("VALIDATION_ERROR", "Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP.");
  }
  if (file.size <= 0 || file.size > maxBytesByType[assetType]) {
    throw new AppError("VALIDATION_ERROR", "Kích thước tệp không hợp lệ.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedSignature(bytes, file.type)) {
    throw new AppError("VALIDATION_ERROR", "Nội dung tệp không khớp định dạng ảnh.");
  }
  validateDimensions(bytes, file.type, assetType);
  return bytes;
}

export async function uploadBrandAsset(input: {
  file: File;
  assetType: BrandAssetType;
  actorId: string;
}): Promise<{ id: string; url: string; mimeType: string; byteSize: number }> {
  const bytes = await validateBrandAsset(input.file, input.assetType);
  const id = globalThis.crypto.randomUUID();
  const objectPath = `${input.assetType}/${id}.${fileExtension(input.file.type)}`;
  const client = getSupabaseServiceClient();
  let url: string;

  if (client) {
    const { error } = await client.storage.from("brand-assets").upload(objectPath, bytes, {
      contentType: input.file.type,
      upsert: false,
      cacheControl: "31536000"
    });
    if (error) throw new AppError("SERVER_ERROR", "Không thể tải tài sản thương hiệu lên.");
    url = client.storage.from("brand-assets").getPublicUrl(objectPath).data.publicUrl;
    await client.from("brand_assets").insert({
      id,
      asset_type: input.assetType,
      bucket: "brand-assets",
      object_path: objectPath,
      mime_type: input.file.type,
      byte_size: input.file.size,
      created_by: z.string().uuid().safeParse(input.actorId).success ? input.actorId : null
    });
  } else {
    url = `data:${input.file.type};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  await recordAuditLog({
    actorId: input.actorId,
    action: "branding.asset_upload",
    entityType: "brand_asset",
    entityId: id,
    after: { assetType: input.assetType, mimeType: input.file.type, byteSize: input.file.size }
  });

  return { id, url, mimeType: input.file.type, byteSize: input.file.size };
}

import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";
import { requirePermission } from "@/services/authorization/requirePermission";

export const fileAssetSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string().min(1),
  objectPath: z.string().min(1),
  ownerEntityType: z.string().min(1),
  ownerEntityId: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive(),
  visibility: z.enum(["private", "internal"]),
  createdAt: z.string().datetime()
});

export type FileAsset = z.infer<typeof fileAssetSchema>;

export interface SignedFileAccess {
  assetId: string;
  url: string;
  expiresAt: string;
}

export function buildInternalFileUrl(assetId: string): string {
  return `/api/v1/files/${assetId}/signed-url`;
}

export async function createSignedFileAccess(
  user: AuthenticatedUser | null,
  asset: FileAsset
): Promise<SignedFileAccess> {
  requirePermission(user, "file.read");

  if (asset.visibility !== "private" && asset.visibility !== "internal") {
    throw new AppError("PERMISSION_DENIED");
  }

  return {
    assetId: asset.id,
    url: buildInternalFileUrl(asset.id),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}

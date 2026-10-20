"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { ImageLightbox } from "@/components/shared/ImageLightbox";

interface ItemImagePreviewProps {
  assetId?: string;
  itemName: string;
  variant?: "thumbnail" | "detail";
}

export function ItemImagePreview({ assetId, itemName, variant = "thumbnail" }: ItemImagePreviewProps) {
  const [open, setOpen] = useState(false);
  const [failedAssetId, setFailedAssetId] = useState<string>();
  const src = assetId ? `/api/v1/files/${assetId}/signed-url` : undefined;

  if (!assetId || !src || failedAssetId === assetId) {
    return (
      <div aria-label={`Chưa có ảnh ${itemName}`} className={`item-image item-image--${variant} item-image--empty`}>
        <ImageIcon aria-hidden="true" size={variant === "detail" ? 36 : 18} />
      </div>
    );
  }

  return (
    <>
      <button
        aria-label={`Xem ảnh ${itemName}`}
        className={`item-image item-image--${variant}`}
        onClick={() => setOpen(true)}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={itemName} onError={() => setFailedAssetId(assetId)} src={src} />
      </button>
      <ImageLightbox
        images={[{ id: assetId, src, alt: itemName, title: itemName }]}
        initialImageId={assetId}
        onClose={() => setOpen(false)}
        open={open}
      />
    </>
  );
}

"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { IconButton } from "@/components/shared/Button";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { Lightbox } from "@/components/shared/Overlays";

export interface ImageAssetPreview {
  id: string;
  src: string;
  alt: string;
  title: string;
  metadata?: Record<string, string>;
}

export interface ImageLightboxProps {
  images: ImageAssetPreview[];
  initialImageId?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ images, initialImageId, open, onClose }: ImageLightboxProps) {
  const initialIndex = useMemo(() => {
    const index = images.findIndex((image) => image.id === initialImageId);
    return index >= 0 ? index : 0;
  }, [images, initialImageId]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => Math.max(0, current - 1));
        setImageState("loading");
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => Math.min(images.length - 1, current + 1));
        setImageState("loading");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose, open]);

  const image = images[activeIndex];

  return (
    <Lightbox open={open} title={image?.title ?? "Xem ảnh"} onClose={onClose}>
      {!image ? (
        <ErrorState description="Không tìm thấy ảnh cần xem." title="Không có ảnh" />
      ) : (
        <div className="image-lightbox">
          <div className="image-lightbox__stage">
            {imageState === "loading" ? <LoadingState description="Đang tải ảnh." title="Đang tải" /> : null}
            {imageState === "error" ? (
              <ErrorState description="Ảnh không thể hiển thị. Vui lòng thử lại." title="Không tải được ảnh" />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={image.alt}
              loading="lazy"
              onError={() => setImageState("error")}
              onLoad={() => setImageState("ready")}
              src={image.src}
            />
          </div>
          <aside className="image-lightbox__meta">
            <h3>{image.title}</h3>
            {image.metadata ? (
              <dl>
                {Object.entries(image.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted-text">Metadata ảnh sẽ được nối từ file metadata.</p>
            )}
          </aside>
          <div className="image-lightbox__controls">
            <IconButton
              disabled={activeIndex === 0}
              label="Ảnh trước"
              onClick={() => {
                setActiveIndex((current) => Math.max(0, current - 1));
                setImageState("loading");
              }}
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </IconButton>
            <span>
              {activeIndex + 1} / {images.length}
            </span>
            <IconButton
              disabled={activeIndex >= images.length - 1}
              label="Ảnh sau"
              onClick={() => {
                setActiveIndex((current) => Math.min(images.length - 1, current + 1));
                setImageState("loading");
              }}
            >
              <ChevronRight aria-hidden="true" size={18} />
            </IconButton>
          </div>
        </div>
      )}
      {images.length === 0 ? (
        <p className="image-lightbox__empty">
          <ImageIcon aria-hidden="true" size={16} />
          Chưa có ảnh trong gallery.
        </p>
      ) : null}
    </Lightbox>
  );
}

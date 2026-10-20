"use client";

export interface ProcessedAttendancePhoto {
  photo: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

function targetDimensions(width: number, height: number, longestEdge: number) {
  const ratio = Math.min(1, longestEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Không thể xử lý ảnh.")),
      "image/jpeg",
      quality
    );
  });
}

function drawVideo(video: HTMLVideoElement, longestEdge: number): HTMLCanvasElement {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("Camera chưa sẵn sàng.");
  const size = targetDimensions(sourceWidth, sourceHeight, longestEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Thiết bị không thể xử lý ảnh.");
  context.drawImage(video, 0, 0, size.width, size.height);
  return canvas;
}

export async function captureAttendancePhoto(video: HTMLVideoElement): Promise<ProcessedAttendancePhoto> {
  const fullCanvas = drawVideo(video, 1600);
  const thumbnailCanvas = drawVideo(video, 320);
  const [photo, thumbnail] = await Promise.all([
    canvasBlob(fullCanvas, 0.82),
    canvasBlob(thumbnailCanvas, 0.76)
  ]);
  return {
    photo,
    thumbnail,
    width: fullCanvas.width,
    height: fullCanvas.height,
    previewUrl: URL.createObjectURL(photo)
  };
}

export async function processAttendanceImage(file: File): Promise<ProcessedAttendancePhoto> {
  const image = new Image();
  const sourceUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Không thể đọc ảnh."));
      image.src = sourceUrl;
    });
    const draw = (longestEdge: number) => {
      const size = targetDimensions(image.naturalWidth, image.naturalHeight, longestEdge);
      const canvas = document.createElement("canvas");
      canvas.width = size.width; canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Thiết bị không thể xử lý ảnh.");
      context.drawImage(image, 0, 0, size.width, size.height);
      return canvas;
    };
    const fullCanvas = draw(1600);
    const thumbnailCanvas = draw(320);
    const [photo, thumbnail] = await Promise.all([canvasBlob(fullCanvas, 0.82), canvasBlob(thumbnailCanvas, 0.76)]);
    return { photo, thumbnail, width: fullCanvas.width, height: fullCanvas.height, previewUrl: URL.createObjectURL(photo) };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

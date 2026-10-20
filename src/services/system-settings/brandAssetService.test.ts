import { describe, expect, it } from "vitest";

import { validateBrandAsset } from "@/services/system-settings/brandAssetService";

describe("brand asset validation", () => {
  function fileOf(bytes: Uint8Array, name: string, type: string): File {
    return {
      name,
      type,
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer
    } as File;
  }

  it("accepts a PNG signature", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
    new DataView(bytes.buffer).setUint32(16, 300);
    new DataView(bytes.buffer).setUint32(20, 100);
    const file = fileOf(bytes, "logo.png", "image/png");
    await expect(validateBrandAsset(file, "logo_main")).resolves.toBeInstanceOf(Uint8Array);
  });

  it("rejects invalid logo dimensions", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
    new DataView(bytes.buffer).setUint32(16, 40);
    new DataView(bytes.buffer).setUint32(20, 100);
    await expect(validateBrandAsset(fileOf(bytes, "logo.png", "image/png"), "logo_main")).rejects.toThrow("Tỷ lệ");
  });

  it("rejects executable content disguised as an image", async () => {
    const file = fileOf(new TextEncoder().encode("<script>alert(1)</script>"), "logo.png", "image/png");
    await expect(validateBrandAsset(file, "logo_main")).rejects.toThrow("không khớp định dạng");
  });

  it("rejects SVG in V1", async () => {
    const file = fileOf(new TextEncoder().encode("<svg/>"), "logo.svg", "image/svg+xml");
    await expect(validateBrandAsset(file, "logo_main")).rejects.toThrow("PNG, JPG hoặc WEBP");
  });
});

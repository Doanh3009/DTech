import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ItemImagePreview } from "@/features/warehouse/components/ItemImagePreview";

describe("ItemImagePreview", () => {
  it("opens the large image preview without navigating to product detail", () => {
    render(<ItemImagePreview assetId="asset-1" itemName="Máy khoan" />);

    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh Máy khoan" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Máy khoan" })).toBeInTheDocument();
    for (const image of screen.getAllByRole("img", { name: "Máy khoan" })) {
      expect(image).toHaveAttribute("src", "/api/v1/files/asset-1/signed-url");
    }
  });

  it("shows a safe fallback when the signed image cannot load", () => {
    render(<ItemImagePreview assetId="asset-2" itemName="Mũ bảo hộ" />);

    fireEvent.error(screen.getByRole("img", { name: "Mũ bảo hộ" }));

    expect(screen.getByLabelText("Chưa có ảnh Mũ bảo hộ")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackLink } from "@/components/shared/BackLink";
import { goBackInApp } from "@/lib/navigation/backHistory";

vi.mock("@/lib/navigation/backHistory", () => ({ goBackInApp: vi.fn(() => false) }));

describe("BackLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(goBackInApp).mockReset();
  });

  it("uses the supplied safe parent route", () => {
    render(<BackLink href="/fixed-fallback" />);
    expect(screen.getByRole("link", { name: "Trở lại" })).toHaveAttribute("href", "/fixed-fallback");
  });

  it("returns to the actual previous history entry", () => {
    vi.mocked(goBackInApp).mockReturnValue(true);

    render(<BackLink href="/fixed-fallback" />);
    fireEvent.click(screen.getByRole("link", { name: "Trở lại" }));

    expect(goBackInApp).toHaveBeenCalledOnce();
  });

  it("renders the same history-aware control as an icon-only mobile action", () => {
    render(<BackLink className="mobile-back" href="/fixed-fallback" iconOnly label="Quay lại" />);
    const link = screen.getByRole("link", { name: "Quay lại" });

    expect(link).toHaveClass("mobile-back");
    expect(link).toHaveAttribute("href", "/fixed-fallback");
  });
});

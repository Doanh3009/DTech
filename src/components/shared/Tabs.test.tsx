import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextTabs } from "./Tabs";

vi.mock("next/navigation", () => ({ usePathname: () => "/shipments/one/containers" }));
afterEach(cleanup);

describe("context tab selection", () => {
  it("marks only the most specific active route", () => {
    render(<ContextTabs label="Lô hàng" items={[
      { label: "Lô hàng", href: "/shipments", active: true },
      { label: "Tổng quan", href: "/shipments/one", active: true },
      { label: "Container", href: "/shipments/one/containers", active: true }
    ]} />);
    expect(screen.getByRole("link", { name: "Container" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation").querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Tổng quan" })).not.toHaveClass("is-active");
  });
});

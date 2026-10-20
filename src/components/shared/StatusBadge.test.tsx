import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BusinessStatusBadge, resolveStatusPresentation, StatusBadge } from "@/components/shared/StatusBadge";

describe("central status system", () => {
  it("normalizes equivalent status keys", () => {
    expect(resolveStatusPresentation("pending-approval")).toEqual({
      label: "Chờ duyệt",
      tone: "warning"
    });
  });

  it("renders the shared label and tone", () => {
    render(<BusinessStatusBadge status="approved" />);
    expect(screen.getByText("Đã duyệt")).toHaveClass("status-badge--success");
  });

  it("allows a domain label without changing the semantic tone", () => {
    render(<StatusBadge status="active">Đang hiệu lực</StatusBadge>);
    expect(screen.getByText("Đang hiệu lực")).toHaveClass("status-badge--success");
  });
});

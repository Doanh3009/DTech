import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OperationalSection } from "@/components/shared/Workbench";

describe("OperationalSection", () => {
  it("separates panel heading, metadata and business content", () => {
    const { container } = render(
      <OperationalSection meta={<span>4 mục</span>} title="Cần xử lý">
        <p>Nội dung nghiệp vụ</p>
      </OperationalSection>
    );

    expect(screen.getByRole("heading", { name: "Cần xử lý" })).toBeInTheDocument();
    expect(screen.getByText("4 mục")).toBeInTheDocument();
    expect(container.querySelector(".operational-section__body")).toHaveTextContent("Nội dung nghiệp vụ");
  });
});

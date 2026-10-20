import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormErrorSummary } from "@/components/shared/FormLayout";

describe("FormErrorSummary", () => {
  it("links every validation message to its field", () => {
    render(
      <FormErrorSummary
        errors={[
          { fieldId: "counterparty", message: "Chọn đối tượng" },
          { fieldId: "amount", message: "Nhập giá trị" }
        ]}
      />
    );

    expect(screen.getByRole("alert")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("link", { name: "Chọn đối tượng" })).toHaveAttribute("href", "#counterparty");
    expect(screen.getByRole("link", { name: "Nhập giá trị" })).toHaveAttribute("href", "#amount");
  });

  it("does not render an empty summary", () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { nextLink } = vi.hoisted(() => ({ nextLink: vi.fn() }));
vi.mock("next/link", () => ({ default: nextLink }));

import { ApiDocumentation } from "./IntegrationConsole";

describe("OpenAPI document navigation", () => {
  it("opens the JSON endpoint through an anchor without router prefetch", () => {
    render(<ApiDocumentation />);
    expect(screen.getByRole("link", { name: "OpenAPI 3.1" })).toHaveAttribute("href", "/api/v1/integrations/openapi");
    expect(nextLink).not.toHaveBeenCalled();
  });
});

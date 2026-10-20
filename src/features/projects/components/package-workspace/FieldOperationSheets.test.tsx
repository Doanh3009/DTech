import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";
import { FieldOperationSheets } from "./FieldOperationSheets";

const node: ProjectProgressNode = {
  id: "task-1", projectId: "project-1", name: "Kiểm tra ray", nodeType: "task",
  status: "blocked", completionPercent: 70, sortOrder: 0, rowVersion: 1
};

describe("field progress update", () => {
  it("keeps blocked work blocked and separates completion percent from confirmation", () => {
    render(<FieldOperationSheets accountId="account-1" initialNodeId={node.id} mode="field-update" nodes={[node]} onClose={vi.fn()} onSaved={vi.fn()} projectId={node.projectId} />);
    const dialog = screen.getByRole("dialog", { name: "Cập nhật tiến độ" });
    expect(screen.getByRole("button", { name: "Đang vướng" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("slider", { name: "Mức hoàn thành" })).toHaveValue("70");
    fireEvent.change(screen.getByRole("slider", { name: "Mức hoàn thành" }), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: "Đang vướng" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    expect(screen.getByRole("slider", { name: "Mức hoàn thành" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Đang thi công" }));
    expect(screen.getByRole("slider", { name: "Mức hoàn thành" })).toHaveValue("95");
    expect(dialog).toBeInTheDocument();
  });
});

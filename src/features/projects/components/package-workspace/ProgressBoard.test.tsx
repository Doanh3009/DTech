import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";
import { ProgressBoard } from "./ProgressBoard";
import { progressBranches, progressOverview } from "./progressPresentation";

const node = (id: string, overrides: Partial<ProjectProgressNode> = {}): ProjectProgressNode => ({
  id, projectId: "p1", name: id, nodeType: "phase", status: "in_progress", completionPercent: 0, sortOrder: 0, rowVersion: 1, ...overrides,
});
const nodes = [
  node("Chuẩn bị", { completionPercent: 100, deadline: "2026-09-10" }),
  node("Thi công", { completionPercent: 50, sortOrder: 1 }),
  node("Lắp ray", { parentId: "Thi công", nodeType: "task", status: "blocked", completionPercent: 50 }),
  node("Nghiệm thu", { status: "completed", completionPercent: 100, deadline: "2026-09-10", sortOrder: 2 }),
  node("Đã hủy", { status: "cancelled", deadline: "2026-09-10", sortOrder: 3 }),
];
const today = "2026-09-30";
const actions = () => ({ onCreate: vi.fn(), onEdit: vi.fn(), onComplete: vi.fn(), onOperation: vi.fn() });

describe("progress presentation", () => {
  it("averages active roots without double-counting children or cancelled work", () => {
    expect(progressOverview(nodes, today)).toMatchObject({ percent: 83, activeRootCount: 3, overdue: 1, completed: 1, blocked: 1, confirmation: 1, attention: 2 });
    expect(progressOverview([], today).percent).toBeNull();
  });

  it("keeps the root as context when only its child needs attention", () => {
    const branches = progressBranches(nodes, "attention", today);
    expect(branches.map((branch) => branch.root.name)).toEqual(["Chuẩn bị", "Thi công"]);
    expect(branches[1].descendants.map((child) => child.name)).toEqual(["Lắp ray"]);
  });

  it("keeps orphaned work visible", () => {
    const orphan = node("Độc lập", { parentId: "missing" });
    expect(progressBranches([orphan], "all", today)[0].root).toBe(orphan);
  });

  it("separates 100 percent from confirmation and never calls completed work overdue", () => {
    render(<ProgressBoard {...actions()} canEdit canFieldUpdate nodes={nodes} today={today} />);
    expect(within(screen.getByRole("region", { name: "Chuẩn bị" })).getByText("Chưa xác nhận hoàn tất")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Nghiệm thu" })).queryByText(/Quá hạn/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cần xử lý/ }));
    expect(screen.getByRole("heading", { name: "Lắp ray" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nghiệm thu" })).not.toBeInTheDocument();
  });

  it("opens updates for the exact phase or task clicked", () => {
    const callbacks = actions();
    render(<ProgressBoard {...callbacks} canEdit canFieldUpdate nodes={nodes} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật Chuẩn bị" }));
    expect(callbacks.onOperation).toHaveBeenLastCalledWith("field-update", "Chuẩn bị");
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật Lắp ray" }));
    expect(callbacks.onOperation).toHaveBeenLastCalledWith("field-update", "Lắp ray");
  });

  it("retains readable names but hides mutation actions for read-only users", () => {
    render(<ProgressBoard {...actions()} canEdit={false} canFieldUpdate={false} nodes={nodes} today={today} />);
    expect(screen.getByRole("heading", { name: "Chuẩn bị" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cập nhật/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm công việc" })).not.toBeInTheDocument();
  });
});

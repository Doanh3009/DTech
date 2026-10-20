import { describe, expect, it } from "vitest";

import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";
import { selectProgressGroups, selectProgressSummary, selectVisibleProgressIds } from "./projectProgressSelectors";

const nodes: ProjectProgressNode[] = [
  { id: "phase-a", projectId: "p1", nodeType: "phase", name: "Chuẩn bị", status: "in_progress", completionPercent: 100, sortOrder: 0, rowVersion: 1 },
  { id: "phase-b", projectId: "p1", nodeType: "phase", name: "Thi công", status: "blocked", completionPercent: 100, sortOrder: 1, rowVersion: 1 },
  { id: "task-b1", projectId: "p1", parentId: "phase-b", nodeType: "task", name: "Siết kẹp ray", assigneeName: "Nguyễn Văn Hùng", status: "blocked", completionPercent: 100, sortOrder: 0, rowVersion: 1 },
  { id: "task-b2", projectId: "p1", parentId: "phase-b", nodeType: "task", name: "Siết kẹp ray nhánh hai", assigneeName: "Nguyễn Văn Hùng", status: "blocked", completionPercent: 100, sortOrder: 1, rowVersion: 1 }
];

describe("project progress selectors", () => {
  it("keeps volume independent from open operational statuses", () => {
    expect(selectProgressSummary(nodes)).toEqual({
      volumePercent: 100,
      total: 4,
      blocked: 3,
      inProgress: 1,
      completed: 0
    });
  });

  it("preserves the parent branch when a child matches search", () => {
    const visible = selectVisibleProgressIds(nodes, "Hùng", "all");
    expect([...visible]).toEqual(["task-b1", "task-b2", "phase-b"]);
    expect(selectProgressGroups(nodes, visible)).toMatchObject([
      { key: "blocked", visibleCount: 3, roots: [{ id: "phase-b" }] }
    ]);
  });
});

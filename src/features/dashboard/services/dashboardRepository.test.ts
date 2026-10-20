import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServiceClient, listProjects, listProjectIssues } = vi.hoisted(() => ({
  getSupabaseServiceClient: vi.fn(), listProjects: vi.fn(), listProjectIssues: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/features/projects/services/projectRepository", () => ({ listProjects }));
vi.mock("@/features/projects/services/projectUpdateRepository", () => ({ listProjectIssues }));

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { getDashboardProjectSummary, listDashboardActivity } from "./dashboardRepository";

const user: AuthenticatedUser = {
  id: "account-id", username: "tester", displayName: "Nhân viên", email: "tester@example.invalid", status: "active",
  permissions: ["project_monitoring.view", "project_issue.view", "audit.view"]
};

function mockDatabase(data: unknown[], error: unknown = null) {
  const query = {
    select: vi.fn(), in: vi.fn(), is: vi.fn(), order: vi.fn(), limit: vi.fn(), neq: vi.fn(),
    then: (resolve: (value: { data: unknown[]; error: unknown }) => unknown) => Promise.resolve({ data, error }).then(resolve)
  };
  for (const key of ["select", "in", "is", "order", "limit", "neq"] as const) query[key].mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  getSupabaseServiceClient.mockReturnValue({ from });
  return { from, query };
}

describe("dashboard read repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps scoped projects, root progress averages and existing open issue priority", async () => {
    listProjects.mockResolvedValue([
      { id: "assigned-project", name: "Công trường A", status: "active", health: "at_risk" },
      { id: "other-visible-project", name: "Công trường B", status: "paused", health: "delayed" },
      { id: "closed-project", name: "Đã đóng", status: "closed", health: "completed" }
    ]);
    listProjectIssues.mockResolvedValue([
      { id: "resolved", status: "resolved" },
      { id: "critical", status: "open", severity: "critical" },
      { id: "in-progress", status: "in_progress", severity: "high" }
    ]);
    const { from, query } = mockDatabase([
      { project_id: "assigned-project", completion_percent: 20 },
      { project_id: "assigned-project", completion_percent: 60 }
    ]);

    const summary = await getDashboardProjectSummary(user);
    expect(listProjects).toHaveBeenCalledWith(user);
    expect(listProjectIssues).toHaveBeenCalledWith(user);
    expect(summary).toMatchObject({ active: 1, atRisk: 1, delayed: 1, averageCompletion: 20 });
    expect(summary.projects.map((project) => project.completionPercent)).toEqual([40, 0]);
    expect(summary.attention.map((issue) => issue.id)).toEqual(["critical", "in-progress"]);
    expect(query.in).toHaveBeenCalledWith("project_id", ["assigned-project", "other-visible-project"]);
    expect(query.is).toHaveBeenCalledWith("parent_id", null);
    expect(from.mock.calls).toEqual([["project_progress_nodes"]]);
  });

  it("returns an empty summary without reading issues or progress outside the visible scope", async () => {
    listProjects.mockResolvedValue([]);
    const { from } = mockDatabase([]);
    expect(await getDashboardProjectSummary(user)).toMatchObject({ active: 0, projects: [], attention: [] });
    expect(listProjectIssues).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("checks monitoring and audit permissions before reading database data", async () => {
    const { from } = mockDatabase([]);
    const restricted = { ...user, permissions: [] };
    await expect(getDashboardProjectSummary(restricted)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(listDashboardActivity(restricted)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(from).not.toHaveBeenCalled();
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("excludes sensitive audit entries and preserves the eight visible activity links", async () => {
    const { query } = mockDatabase([{
      id: "audit-id", action: "leave.approved", entity_type: "leave_request", entity_id: "leave-id", entity_reference: "NP001",
      happened_at: "2026-10-05T06:00:00.000Z", severity: "critical", app_accounts: [{ display_name: "Người duyệt" }]
    }]);
    expect(await listDashboardActivity(user)).toEqual([{
      id: "audit-id", actorName: "Người duyệt", actionLabel: "Duyệt đơn nghỉ", entityType: "leave_request", entityId: "leave-id",
      entityReference: "NP001", happenedAt: "2026-10-05T06:00:00.000Z", severity: "critical"
    }]);
    expect(query.neq).toHaveBeenCalledWith("severity", "sensitive");
    expect(query.limit).toHaveBeenCalledWith(8);
    expect(query.select).toHaveBeenCalledWith(expect.not.stringContaining("before_data"));
  });

  it("allows sensitive audit activity only with the existing sensitive permission", async () => {
    const { query } = mockDatabase([]);
    await listDashboardActivity({ ...user, permissions: [...user.permissions, "audit.view_sensitive"] });
    expect(query.neq).not.toHaveBeenCalled();
  });
});

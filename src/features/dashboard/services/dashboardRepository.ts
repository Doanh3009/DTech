import "server-only";

import { listProjects } from "@/features/projects/services/projectRepository";
import { listProjectIssues } from "@/features/projects/services/projectUpdateRepository";
import { humanizeAuditAction } from "@/features/shared-platforms/rules";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function getDashboardProjectSummary(user: AuthenticatedUser) {
  if (!can(user.permissions, "project_monitoring.view") && !can(user.permissions, "project_monitoring.view_all")) {
    throw new AppError("PERMISSION_DENIED");
  }
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");

  // Keep the existing project and issue scope checks. The dashboard only needs
  // status, progress and open issues; updates and their attachments are unused.
  const projects = (await listProjects(user)).filter((project) => project.status !== "closed");
  if (!projects.length) return { active: 0, averageCompletion: 0, atRisk: 0, delayed: 0, projects: [], attention: [] };
  const [issues, { data: progressRows, error }] = await Promise.all([
    can(user.permissions, "project_issue.view") ? listProjectIssues(user) : Promise.resolve([]),
    client.from("project_progress_nodes").select("project_id,completion_percent")
      .in("project_id", projects.map((project) => project.id)).is("parent_id", null)
  ]);
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu theo dõi dự án.");

  const progressByProject = new Map<string, { total: number; count: number }>();
  for (const row of progressRows ?? []) {
    const projectId = String(row.project_id);
    const progress = progressByProject.get(projectId) ?? { total: 0, count: 0 };
    progress.total += Number(row.completion_percent);
    progress.count += 1;
    progressByProject.set(projectId, progress);
  }
  const enriched = projects.map((project) => {
    const progress = progressByProject.get(project.id);
    return {
      id: project.id, name: project.name, status: project.status, health: project.health,
      completionPercent: progress ? Math.round(progress.total / progress.count) : 0
    };
  });
  return {
    active: projects.filter((project) => project.status === "active").length,
    atRisk: projects.filter((project) => project.health === "at_risk").length,
    delayed: projects.filter((project) => project.health === "delayed").length,
    averageCompletion: Math.round(enriched.reduce((sum, project) => sum + project.completionPercent, 0) / enriched.length),
    projects: enriched,
    attention: issues.filter((issue) => ["open", "in_progress"].includes(issue.status)).slice(0, 12)
  };
}

export async function listDashboardActivity(user: AuthenticatedUser) {
  if (!can(user.permissions, "audit.view")) throw new AppError("PERMISSION_DENIED");
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");

  // Avoid counting the entire audit table or transferring before/after payloads
  // for the eight activity links shown on the dashboard.
  let query = client.from("audit_logs")
    .select("id,action,entity_type,entity_id,entity_reference,happened_at,severity,app_accounts!audit_logs_actor_account_id_fkey(display_name)")
    .order("happened_at", { ascending: false }).limit(8);
  if (!can(user.permissions, "audit.view_sensitive")) query = query.neq("severity", "sensitive");
  const { data, error } = await query;
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc audit log.");
  return (data ?? []).map((row) => {
    const actor = Array.isArray(row.app_accounts) ? row.app_accounts[0] : row.app_accounts;
    return {
      id: String(row.id), actorName: typeof actor?.display_name === "string" ? actor.display_name : "Hệ thống",
      actionLabel: humanizeAuditAction(String(row.action)), entityType: String(row.entity_type), entityId: String(row.entity_id),
      entityReference: row.entity_reference ?? null, happenedAt: String(row.happened_at), severity: row.severity ?? "normal"
    };
  });
}

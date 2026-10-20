import type { ProjectIssue, ProjectIssueSeverity, ProjectIssueStatus } from "@/features/projects/types/projectTypes";

export function createProjectUpdateTitle(title: string | undefined, content: string, maxLength = 90) {
  const normalized = title?.trim() || content.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength - 1).trimEnd() + "…" : normalized;
}

export function isProjectStale(lastUpdateAt: string | undefined, staleAfterDays: number, now = new Date()) {
  if (!lastUpdateAt) return true;
  return now.getTime() - new Date(lastUpdateAt).getTime() > staleAfterDays * 86_400_000;
}

export function isOpenIssue(status: ProjectIssueStatus) {
  return status === "open" || status === "in_progress";
}

export function sortIssuesByPriority(issues: ProjectIssue[]) {
  const severityRank: Record<ProjectIssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...issues].sort((first, second) => severityRank[first.severity] - severityRank[second.severity] || first.createdAt.localeCompare(second.createdAt));
}

export function sortIssuesForAttention(issues: ProjectIssue[]) {
  return sortIssuesByPriority(issues.filter((issue) => isOpenIssue(issue.status)));
}

export function getProjectCloseWarning(issues: ProjectIssue[]) {
  const count = issues.filter((issue) => isOpenIssue(issue.status) && (issue.severity === "high" || issue.severity === "critical")).length;
  return count ? `Dự án còn ${count} vấn đề mức cao hoặc nghiêm trọng chưa xử lý.` : undefined;
}

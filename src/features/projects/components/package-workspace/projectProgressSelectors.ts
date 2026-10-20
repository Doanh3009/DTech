import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";

export type ProgressGroupKey = ProjectProgressNode["status"];

export interface ProgressGroup {
  key: ProgressGroupKey;
  roots: ProjectProgressNode[];
  visibleCount: number;
}

export const progressGroupOrder: readonly ProgressGroupKey[] = [
  "blocked",
  "in_progress",
  "not_started",
  "completed",
  "cancelled"
];

export function selectProgressSummary(nodes: readonly ProjectProgressNode[]) {
  const roots = nodes.filter((node) => !node.parentId);
  const volumePercent = roots.length
    ? Math.round(roots.reduce((total, node) => total + node.completionPercent, 0) / roots.length)
    : 0;

  return {
    volumePercent,
    total: nodes.length,
    blocked: nodes.filter((node) => node.status === "blocked").length,
    inProgress: nodes.filter((node) => node.status === "in_progress").length,
    completed: nodes.filter((node) => node.status === "completed").length
  };
}

export function selectVisibleProgressIds(
  nodes: readonly ProjectProgressNode[],
  query: string,
  status: ProgressGroupKey | "all"
): ReadonlySet<string> {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const visible = new Set<string>();
  const children = new Map<string, ProjectProgressNode[]>();
  const roots = nodes.filter((node) => !node.parentId);

  for (const node of nodes) {
    if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }

  function visit(node: ProjectProgressNode): boolean {
    const childMatches = (children.get(node.id) ?? []).map(visit).some(Boolean);
    const queryMatches = !normalizedQuery
      || `${node.name} ${node.assigneeName ?? ""}`.toLocaleLowerCase("vi-VN").includes(normalizedQuery);
    const statusMatches = status === "all" || node.status === status;
    const matches = (queryMatches && statusMatches) || childMatches;
    if (matches) visible.add(node.id);
    return matches;
  }

  roots.forEach(visit);
  return visible;
}

export function selectProgressGroups(
  nodes: readonly ProjectProgressNode[],
  visibleIds: ReadonlySet<string>
): ProgressGroup[] {
  const byParent = new Map<string, ProjectProgressNode[]>();
  for (const node of nodes) {
    if (node.parentId) byParent.set(node.parentId, [...(byParent.get(node.parentId) ?? []), node]);
  }

  function countVisible(node: ProjectProgressNode): number {
    if (!visibleIds.has(node.id)) return 0;
    return 1 + (byParent.get(node.id) ?? []).reduce((total, child) => total + countVisible(child), 0);
  }

  const roots = nodes.filter((node) => !node.parentId && visibleIds.has(node.id));
  return progressGroupOrder.flatMap((key) => {
    const groupRoots = roots.filter((node) => node.status === key);
    if (!groupRoots.length) return [];
    return [{
      key,
      roots: groupRoots,
      visibleCount: groupRoots.reduce((total, root) => total + countVisible(root), 0)
    }];
  });
}

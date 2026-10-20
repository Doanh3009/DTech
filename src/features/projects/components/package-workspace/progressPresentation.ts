import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";

export type ProgressFilter = "all" | "attention" | "in_progress" | "completed";

export function isOpenProgress(node: ProjectProgressNode) {
  return node.status !== "completed" && node.status !== "cancelled";
}

export function isOverdueProgress(node: ProjectProgressNode, today: string) {
  return isOpenProgress(node) && Boolean(node.deadline && node.deadline < today);
}

export function needsProgressConfirmation(node: ProjectProgressNode) {
  return isOpenProgress(node) && node.completionPercent >= 100;
}

export function matchesProgressFilter(node: ProjectProgressNode, filter: ProgressFilter, today: string) {
  if (filter === "attention") return node.status === "blocked" || isOverdueProgress(node, today) || needsProgressConfirmation(node);
  if (filter === "all") return true;
  return node.status === filter;
}

export function progressOverview(nodes: readonly ProjectProgressNode[], today: string) {
  const ids = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter((node) => !node.parentId || !ids.has(node.parentId)).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeRoots = roots.filter((node) => node.status !== "cancelled");
  return {
    roots,
    activeRootCount: activeRoots.length,
    // Root values already represent their branches; adding children double-counts work.
    percent: activeRoots.length ? Math.round(activeRoots.reduce((sum, node) => sum + node.completionPercent, 0) / activeRoots.length) : null,
    completed: nodes.filter((node) => node.status === "completed").length,
    overdue: nodes.filter((node) => isOverdueProgress(node, today)).length,
    blocked: nodes.filter((node) => node.status === "blocked").length,
    confirmation: nodes.filter(needsProgressConfirmation).length,
    attention: nodes.filter((node) => matchesProgressFilter(node, "attention", today)).length,
  };
}

export function progressBranches(nodes: readonly ProjectProgressNode[], filter: ProgressFilter, today: string) {
  const children = new Map<string, ProjectProgressNode[]>();
  for (const node of nodes) {
    if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  const ordered = (items: readonly ProjectProgressNode[]) => [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  return ordered(progressOverview(nodes, today).roots).flatMap((root) => {
    const descendants: ProjectProgressNode[] = [];
    const visited = new Set([root.id]);
    function visit(parent: ProjectProgressNode) {
      for (const node of ordered(children.get(parent.id) ?? [])) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        descendants.push(node);
        visit(node);
      }
    }
    visit(root);
    const visible = descendants.filter((node) => matchesProgressFilter(node, filter, today));
    return matchesProgressFilter(root, filter, today) || visible.length
      ? [{ root, descendants: visible, totalChildren: descendants.length }]
      : [];
  });
}

import type { AttentionPriority, DashboardItem } from "@/features/dashboard/types";

const priorityWeight: Record<AttentionPriority, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1
};

export function sortAttention(items: DashboardItem[]): DashboardItem[] {
  return [...items].sort((left, right) => {
    const priority = priorityWeight[right.priority ?? "INFO"] - priorityWeight[left.priority ?? "INFO"];
    if (priority) return priority;
    const leftOverdue = /quá hạn/i.test(left.dueOrAge ?? "") ? 1 : 0;
    const rightOverdue = /quá hạn/i.test(right.dueOrAge ?? "") ? 1 : 0;
    if (leftOverdue !== rightOverdue) return rightOverdue - leftOverdue;
    return left.title.localeCompare(right.title, "vi");
  });
}

export function deduplicateAttention(items: DashboardItem[]): DashboardItem[] {
  const grouped = new Map<string, DashboardItem[]>();
  for (const item of items) grouped.set(item.href, [...(grouped.get(item.href) ?? []), item]);
  return [...grouped.values()].map((group) => {
    if (group.length === 1) return group[0];
    const sorted = sortAttention(group);
    return {
      ...sorted[0],
      title: `${sorted[0].title} · ${group.length} vấn đề cần chú ý`,
      context: group.map((item) => item.context).filter(Boolean).join(" · ")
    };
  });
}

export function normalizeAttention(items: DashboardItem[], limit = 16): DashboardItem[] {
  return sortAttention(deduplicateAttention(items)).slice(0, limit);
}

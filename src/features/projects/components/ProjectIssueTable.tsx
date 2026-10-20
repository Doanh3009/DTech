"use client";

import Link from "next/link";
import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DataSurface } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { IssueActions } from "@/features/projects/components/IssueActions";
import { severityLabels } from "@/features/projects/components/ProjectUpdateCard";
import type { ProjectIssue } from "@/features/projects/types/projectTypes";

export function ProjectIssueTable({ issues }: { issues: ProjectIssue[] }) {
  const columns = useMemo<DataTableColumn<ProjectIssue>[]>(() => [
    { id: "project", header: "Dự án", cell: (issue) => <><Link href={`/projects/${issue.projectId}/progress`}>{issue.projectName}</Link><br /><small>{issue.worksiteName}</small></> },
    { id: "issue", header: "Vấn đề", cell: (issue) => <Link href={`/projects/${issue.projectId}/updates/${issue.sourceUpdateId}`}>{issue.title}</Link> },
    { id: "severity", header: "Mức độ", cell: (issue) => <StatusBadge tone={issue.severity === "critical" ? "error" : issue.severity === "low" ? "info" : "warning"}>{severityLabels[issue.severity]}</StatusBadge> },
    { id: "status", header: "Trạng thái", cell: (issue) => issue.status === "resolved" ? "Đã xử lý" : issue.status === "in_progress" ? "Đang xử lý" : issue.status === "closed" ? "Đã đóng" : "Chưa xử lý" },
    { id: "owner", header: "Phụ trách", cell: (issue) => issue.ownerName ?? "—", hiddenOnMobile: true },
    { id: "updated", header: "Cập nhật", cell: (issue) => new Date(issue.updatedAt).toLocaleDateString("vi-VN"), hiddenOnMobile: true }
  ], []);

  return (
    <DataSurface>
      <DataTable actions={(issue) => <IssueActions issue={issue} />} columns={columns} data={issues} emptyDescription="" emptyTitle="Không có vấn đề" getRowId={(issue) => issue.id} />
    </DataSurface>
  );
}

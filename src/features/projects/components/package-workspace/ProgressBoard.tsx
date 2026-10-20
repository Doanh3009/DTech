"use client";

import { CalendarDays, ChartNoAxesCombined, CheckCheck, ChevronDown, CircleAlert, Clock3, FilePlus2, Layers3, Pencil, Plus, ShieldAlert, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/shared/Button";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";
import { isOpenProgress, isOverdueProgress, needsProgressConfirmation, progressBranches, progressOverview, type ProgressFilter } from "./progressPresentation";
import styles from "./ProgressBoard.module.css";

const typeLabels = { phase: "Giai đoạn", work_item: "Hạng mục", task: "Đầu việc", milestone: "Mốc kiểm soát", acceptance: "Nghiệm thu" };
const statusLabels = { not_started: "Chưa bắt đầu", in_progress: "Đang thực hiện", blocked: "Đang vướng", completed: "Hoàn thành", cancelled: "Đã hủy" };

function deadlineText(node: ProjectProgressNode, today: string) {
  if (!node.deadline) return "Chưa đặt hạn";
  const days = Math.round((Date.parse(`${node.deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (isOpenProgress(node) && days < 0) return `Quá hạn ${-days} ngày`;
  if (isOpenProgress(node) && days === 0) return "Đến hạn hôm nay";
  return `Hạn ${node.deadline.split("-").reverse().join("/")}`;
}

function Meter({ value, name, tone }: { value: number; name: string; tone?: string }) {
  return <progress aria-label={name} className={styles.meter} data-tone={tone} max={100} value={Math.max(0, Math.min(100, value))} />;
}

export function ProgressBoard({ nodes, today, canEdit, canFieldUpdate, mutating, error, onCreate, onEdit, onComplete, onOperation }: {
  nodes: ProjectProgressNode[];
  today: string;
  canEdit: boolean;
  canFieldUpdate: boolean;
  mutating?: string;
  error?: string;
  onCreate: (parentId?: string) => void;
  onEdit: (node: ProjectProgressNode) => void;
  onComplete: (node: ProjectProgressNode) => void;
  onOperation: (mode: "field-update" | "report-issue", nodeId: string) => void;
}) {
  const [filter, setFilter] = useState<ProgressFilter>("all");
  const overview = useMemo(() => progressOverview(nodes, today), [nodes, today]);
  const branches = useMemo(() => progressBranches(nodes, filter, today), [nodes, filter, today]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const filters: Array<{ key: ProgressFilter; label: string; count: number }> = [
    { key: "all", label: "Tất cả", count: nodes.length },
    { key: "attention", label: "Cần xử lý", count: overview.attention },
    { key: "in_progress", label: "Đang làm", count: nodes.filter((node) => node.status === "in_progress").length },
    { key: "completed", label: "Hoàn thành", count: overview.completed },
  ];

  function row(node: ProjectProgressNode, root = false, number?: number, groupId?: string) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const overdue = isOverdueProgress(node, today);
    const confirmation = needsProgressConfirmation(node);
    const tone = node.status === "completed" ? "success" : node.status === "blocked" ? "error" : "info";
    return <article className={styles.row} data-root={root || undefined} data-status={node.status} key={node.id}>
      <div className={styles.identity}>
        {root ? <span aria-hidden="true" className={styles.number}>{String(number).padStart(2, "0")}</span> : <span aria-hidden="true" className={styles.childMark}><Layers3 size={17} /></span>}
        <div className={styles.name}>
          <span className={styles.type}>{typeLabels[node.nodeType]}</span>
          {root ? <h3>{node.name}</h3> : <h4>{node.name}</h4>}
          {!root && parent && parent.id !== groupId ? <span className={styles.parentName}>{parent.name}</span> : null}
          <div className={styles.meta}>
            <span><UserRound aria-hidden="true" size={14} />{node.assigneeName || "Chưa phân công"}</span>
            <time className={overdue ? styles.overdue : undefined} dateTime={node.deadline}><CalendarDays aria-hidden="true" size={14} />{deadlineText(node, today)}</time>
          </div>
        </div>
      </div>
      <div className={styles.progress}>
        <div className={styles.progressLabel}><span>Tiến độ</span><strong>{node.completionPercent}<small>%</small></strong></div>
        <Meter name={`Tiến độ ${node.name}`} tone={node.status === "completed" ? "success" : node.status === "blocked" ? "danger" : undefined} value={node.completionPercent} />
        <div className={styles.status}><StatusBadge tone={node.status === "cancelled" || node.status === "not_started" ? "neutral" : tone}>{statusLabels[node.status]}</StatusBadge>{confirmation ? <span className={styles.confirmation}>Chưa xác nhận hoàn tất</span> : null}</div>
      </div>
      <div className={styles.actions}>
        {canFieldUpdate && node.status !== "cancelled" ? <Button aria-label={`Cập nhật ${node.name}`} leftIcon={<FilePlus2 aria-hidden="true" size={16} />} onClick={() => onOperation("field-update", node.id)} size="sm" variant="soft">Cập nhật</Button> : null}
        {canEdit || (canFieldUpdate && isOpenProgress(node)) ? <DropdownMenu label={`Thao tác cho ${node.name}`}>
          {canFieldUpdate && isOpenProgress(node) ? <button onClick={() => onOperation("report-issue", node.id)} type="button"><ShieldAlert aria-hidden="true" size={16} />Báo vướng</button> : null}
          {canEdit && isOpenProgress(node) ? <button disabled={Boolean(mutating)} onClick={() => onComplete(node)} type="button"><CheckCheck aria-hidden="true" size={16} />Xác nhận hoàn thành</button> : null}
          {canEdit ? <><button onClick={() => onEdit(node)} type="button"><Pencil aria-hidden="true" size={16} />Chỉnh sửa</button><button onClick={() => onCreate(node.id)} type="button"><Plus aria-hidden="true" size={16} />Thêm công việc con</button></> : null}
        </DropdownMenu> : null}
      </div>
    </article>;
  }

  return <section aria-label="Tiến độ công việc" className={styles.board}>
    {error ? <div className={styles.error} role="alert"><CircleAlert aria-hidden="true" size={18} />{error}</div> : null}
    {nodes.length > 0 ? <div className={styles.overview}>
      <div className={styles.total}>
        <div className={styles.totalHeading}><span><ChartNoAxesCombined aria-hidden="true" size={19} />Tiến độ hiện tại</span><time dateTime={today}>{today.split("-").reverse().join("/")}</time></div>
        <div className={styles.totalValue}><strong>{overview.percent ?? "—"}{overview.percent !== null ? <small>%</small> : null}</strong><span>Bình quân {overview.activeRootCount} hạng mục</span></div>
        {overview.percent !== null ? <Meter name="Tiến độ bình quân các hạng mục" value={overview.percent} /> : null}
        <div className={styles.scope}>Toàn gói<span aria-hidden="true">·</span>{overview.roots.length} hạng mục<span aria-hidden="true">·</span>{nodes.length - overview.roots.length} công việc con</div>
      </div>
      <dl className={styles.metrics}>
        <div data-tone="success"><dt><CheckCheck aria-hidden="true" size={19} />Hoàn thành</dt><dd>{overview.completed}<small>/ {nodes.length} mục</small></dd></div>
        <div data-tone={overview.overdue ? "danger" : undefined}><dt><Clock3 aria-hidden="true" size={19} />Quá hạn</dt><dd>{overview.overdue}<small>mục</small></dd></div>
        <div data-tone={overview.blocked ? "warning" : undefined}><dt><ShieldAlert aria-hidden="true" size={19} />Đang vướng</dt><dd>{overview.blocked}<small>mục</small></dd></div>
      </dl>
    </div> : null}
    <div className={styles.toolbar}>
      <div aria-label="Lọc tiến độ" className={styles.filters} role="group">{filters.map((item) => <button aria-pressed={filter === item.key} key={item.key} onClick={() => setFilter(item.key)} type="button">{item.label}<span>{item.count}</span></button>)}</div>
      {canEdit ? <Button leftIcon={<Plus aria-hidden="true" size={17} />} onClick={() => onCreate()} size="sm" variant="primary">Thêm công việc</Button> : null}
    </div>
    <div className={styles.branches}>{branches.map(({ root, descendants, totalChildren }) => <section aria-label={root.name} className={styles.branch} key={root.id}>
      {row(root, true, overview.roots.findIndex((node) => node.id === root.id) + 1)}
      {descendants.length ? <details className={styles.children} key={`${root.id}-${filter}`} open={root.status !== "completed" || filter !== "all"}>
        <summary><span><ChevronDown aria-hidden="true" size={16} />Công việc bên trong <strong>{descendants.length}{descendants.length !== totalChildren ? ` / ${totalChildren}` : ""}</strong></span><span className={styles.childCount}>{descendants.filter((node) => node.status === "completed").length} hoàn thành</span></summary>
        <div>{descendants.map((node) => row(node, false, undefined, root.id))}</div>
      </details> : null}
    </section>)}</div>
    {!branches.length ? <EmptyState action={nodes.length ? <Button onClick={() => setFilter("all")}>Xem tất cả</Button> : canEdit ? <Button onClick={() => onCreate()} variant="primary">Thêm công việc</Button> : undefined} title={error && !nodes.length ? "Chưa tải được tiến độ" : nodes.length ? "Không có công việc trong nhóm này" : "Chưa có công việc"} /> : null}
  </section>;
}

"use client";

import { ArrowUpRight, Bell, CalendarClock, ChartNoAxesCombined, CheckCircle2, ChevronDown, ClipboardCheck, Package, RefreshCw, Truck, UsersRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/shared/Button";
import { ModuleLauncher } from "@/components/shared/ModuleLauncher";
import { DashboardPageTemplate } from "@/components/shared/PageLayouts";
import { LoadingState } from "@/components/shared/States";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import type { DashboardChart, DashboardProfileKey, DashboardReadModel, DashboardWidgetKey } from "@/features/dashboard/types";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { useMobileViewport } from "@/lib/ui/useMobileViewport";

import { ModuleChart } from "./ModuleChart";
import styles from "./DashboardView.module.css";

const attentionCategories: Record<string, string> = {
  approval: "Phê duyệt", attendance: "Chấm công", attendance_follow_up: "Chấm công",
  worker_attendance: "Điểm danh", timesheet: "Bảng công", project_issue: "Công trường",
  warehouse_item: "Kho", shipment: "Lô hàng", notification: "Thông báo",
  hr_task: "Nhân sự", payroll: "Bảng lương"
};

const dashboardPresentation: Record<DashboardProfileKey, {
  pageTitle: string;
  overviewTitle: string;
  attentionTitle: string;
  chartTitle: string;
  focusWidget: DashboardWidgetKey;
  chartOrder: readonly string[];
}> = {
  management: { pageTitle: "Điều hành", overviewTitle: "Vận hành hôm nay", attentionTitle: "Cần chú ý", chartTitle: "Sức khỏe vận hành", focusWidget: "attendance_overview", chartOrder: ["attendance-today", "hr-by-department", "project-progress", "project-health"] },
  hr: { pageTitle: "Nhân sự", overviewTitle: "Quy mô đội ngũ", attentionTitle: "Việc nhân sự", chartTitle: "Cơ cấu nhân sự", focusWidget: "hr_summary", chartOrder: ["hr-by-department", "hr-employment", "attendance-today", "timesheet-exceptions"] },
  warehouse: { pageTitle: "Kho", overviewTitle: "Kho hôm nay", attentionTitle: "Ưu tiên trong kho", chartTitle: "Tồn kho và chứng từ", focusWidget: "warehouse_low_stock", chartOrder: ["warehouse-stock-alerts", "warehouse-pending"] },
  accounting: { pageTitle: "Kế toán", overviewTitle: "Lương và kỳ chốt", attentionTitle: "Kỳ lương cần xử lý", chartTitle: "Lương và phiếu lương", focusWidget: "accounting_summary", chartOrder: ["payroll-fund", "payslip-status", "salary-profiles"] },
  import_export: { pageTitle: "Xuất nhập khẩu", overviewTitle: "Luồng lô hàng", attentionTitle: "Lô hàng cần xử lý", chartTitle: "Tiến độ lô hàng", focusWidget: "shipment_attention", chartOrder: ["shipment-status", "shipment-flags"] },
  supervisor: { pageTitle: "Công trường", overviewTitle: "Công trường hôm nay", attentionTitle: "Phiên cần theo dõi", chartTitle: "Điểm danh công trường", focusWidget: "supervisor_today", chartOrder: ["supervisor-sessions", "project-progress", "project-health"] },
  employee: { pageTitle: "Cá nhân", overviewTitle: "Ca làm hôm nay", attentionTitle: "Việc của tôi", chartTitle: "Chấm công cá nhân", focusWidget: "employee_today", chartOrder: ["personal-attendance", "payslip-status"] }
};

function DashboardProfileIcon({ profile }: { profile: DashboardProfileKey }) {
  switch (profile) {
    case "management": return <ChartNoAxesCombined aria-hidden="true" size={19} strokeWidth={1.8} />;
    case "hr": return <UsersRound aria-hidden="true" size={19} strokeWidth={1.8} />;
    case "warehouse": return <Package aria-hidden="true" size={19} strokeWidth={1.8} />;
    case "accounting": return <WalletCards aria-hidden="true" size={19} strokeWidth={1.8} />;
    case "import_export": return <Truck aria-hidden="true" size={19} strokeWidth={1.8} />;
    case "supervisor": return <ClipboardCheck aria-hidden="true" size={19} strokeWidth={1.8} />;
    case "employee": return <CalendarClock aria-hidden="true" size={19} strokeWidth={1.8} />;
  }
}

function metricIcon(label: string) {
  if (/chưa đọc|thông báo/i.test(label)) return Bell;
  if (/lương|thu nhập|khấu trừ|thực nhận/i.test(label)) return WalletCards;
  if (/nhân sự|nhân viên|thử việc|đang làm/i.test(label)) return UsersRound;
  if (/ca làm|ngày công|kỳ|chấm/i.test(label)) return CalendarClock;
  return ClipboardCheck;
}

export function DashboardView({ initialModel }: { initialModel?: DashboardReadModel }) {
  const user = useCurrentUser();
  const [model, setModel] = useState(initialModel);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [moreWork, setMoreWork] = useState(false);
  const mobile = useMobileViewport();

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/dashboard", { cache: "no-store", signal });
    const body = await response.json() as { data?: DashboardReadModel; error?: { message: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải Dashboard.");
    setModel(body.data);
    setError("");
  }, []);
  useDomainReconciliation("dashboard", load);
  useEffect(() => {
    if (initialModel) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải Dashboard.");
    }), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [initialModel, load]);

  async function refresh() {
    setRefreshing(true);
    try { await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật Dashboard."); }
    finally { setRefreshing(false); }
  }

  if (!model && !error) return <LoadingState description="" title="Đang tải Dashboard" />;
  const widgets = model?.widgets ?? [];
  const profile = model?.profile ?? "employee";
  const presentation = dashboardPresentation[profile];
  const focusWidgetIndex = widgets.findIndex((widget) => widget.key === presentation.focusWidget);
  const orderedWidgets = focusWidgetIndex > 0 ? [widgets[focusWidgetIndex], ...widgets.slice(0, focusWidgetIndex), ...widgets.slice(focusWidgetIndex + 1)] : widgets;
  const focusWidget = orderedWidgets.find((widget) => widget.key === presentation.focusWidget);
  const metrics = orderedWidgets.flatMap((widget) => widget.status === "ready" ? widget.data?.metrics ?? [] : []).slice(0, 5);
  const availableCharts = orderedWidgets.flatMap((widget) => widget.data?.charts ?? []).filter((chart) => chart.emptyLabel || chart.series.some((entry) => Number.isFinite(entry.value)));
  const meaningfulCharts = profile !== "accounting" && availableCharts.some((chart) => chart.series.some((entry) => Number.isFinite(entry.value) && entry.value !== 0))
    ? availableCharts.filter((chart) => chart.series.some((entry) => Number.isFinite(entry.value) && entry.value !== 0))
    : availableCharts;
  const overviewChart = presentation.chartOrder.map((key) => meaningfulCharts.find((chart) => chart.key === key)).find((chart) => chart !== undefined)
    ?? meaningfulCharts.find((chart) => chart.kind === "line")
    ?? meaningfulCharts.find((chart) => chart.kind !== "donut" && !(chart.unit === "%" && chart.series.length === 1))
    ?? meaningfulCharts[0];
  const secondaryChart = presentation.chartOrder.map((key) => meaningfulCharts.find((chart) => chart.key === key && chart.key !== overviewChart?.key)).find((chart) => chart !== undefined)
    ?? meaningfulCharts.find((chart) => chart.key !== overviewChart?.key && chart.unit === "%" && chart.series.length === 1)
    ?? meaningfulCharts.find((chart) => chart.key !== overviewChart?.key && chart.kind === "donut")
    ?? meaningfulCharts.find((chart) => chart.key !== overviewChart?.key);
  const attention = model?.attention ?? [];
  const seen = new Set<string>();
  const allWorkItems = [...attention, ...orderedWidgets.filter((widget) => widget.key !== "recent_activity" && widget.key !== "recent_notifications").flatMap((widget) => widget.data?.items ?? [])].filter((item) => {
    const key = `${item.type}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const workItems = allWorkItems.slice(0, 6);
  const visibleWorkItems = mobile && !moreWork ? workItems.slice(0, 3) : workItems;
  const workCategories = new Map<string, number>();
  allWorkItems.forEach((item) => {
    const label = attentionCategories[item.type] ?? "Khác";
    workCategories.set(label, (workCategories.get(label) ?? 0) + 1);
  });
  const workChart: DashboardChart = { key: "dashboard-work-by-category", title: "Công việc theo nhóm", kind: "bar", unit: "việc", series: [...workCategories].map(([label, value]) => ({ label, value })) };
  const charts = overviewChart?.unit === "%" && overviewChart.series.length === 1 && !secondaryChart && workCategories.size
    ? [workChart, overviewChart]
    : [overviewChart, secondaryChart].filter((chart) => chart !== undefined);
  const failed = widgets.some((widget) => widget.status === "error");
  const failedLabels = widgets.filter((widget) => widget.status === "error").map((widget) => widget.label);
  const focusState = focusWidget?.data?.state ?? {};
  const primaryAction = typeof focusState.primaryAction === "string" ? focusState.primaryAction : undefined;
  const primaryHref = typeof focusState.primaryHref === "string" ? focusState.primaryHref : undefined;

  return <>
    <div className={styles.launcher} data-dashboard-applications><ModuleLauncher /></div>
    <PageHeader action={<div className={styles.headingActions}>{model?.generatedAt ? <time dateTime={model.generatedAt}>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(model.generatedAt))}</time> : null}<Button aria-label="Cập nhật dashboard" busy={refreshing} leftIcon={<RefreshCw aria-hidden="true" size={18} />} onClick={() => void refresh()} size="sm"><span className={styles.refreshLabel}>Cập nhật</span></Button></div>} meta={model?.generatedAt ? <time className={styles.mobileUpdatedAt} dateTime={model.generatedAt}>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(model.generatedAt))}</time> : undefined} title={`Chào, ${user.displayName.trim() || user.username}`} />
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <section aria-label={presentation.pageTitle} className={styles.analytics} data-dashboard-profile={profile}>
      {metrics.length ? <section aria-labelledby="dashboard-role-overview" className={styles.roleOverview} data-dashboard-profile={profile}>
        <header className={styles.roleOverviewHeader}>
          <span aria-hidden="true" className={styles.roleOverviewIcon}><DashboardProfileIcon profile={profile} /></span>
          <h2 id="dashboard-role-overview">{presentation.overviewTitle}</h2>
          {(profile === "employee" || profile === "supervisor") && primaryAction && primaryHref ? <Link className={styles.rolePrimaryAction} href={primaryHref} prefetch={false}>{primaryAction}<ArrowUpRight aria-hidden="true" size={16} /></Link> : null}
        </header>
        <div className={styles.metrics} data-dashboard-metrics data-dashboard-profile={profile}>{metrics.map((metric, index) => {
        const Icon = metricIcon(metric.label);
        const content = <><span aria-hidden="true" className={styles.metricIcon}><Icon className={styles.metricGlyph} size={23} strokeWidth={1.7} /></span><span className={styles.metricContent}><strong>{typeof metric.value === "number" ? new Intl.NumberFormat("vi-VN").format(metric.value) : metric.value}</strong><span>{metric.label}</span></span></>;
        return metric.href ? <Link className={styles.metric} data-accent={index % 5} data-dashboard-metric data-metric-label={metric.label} data-metric-value={metric.value} data-tone={metric.tone ?? "neutral"} data-value-kind={typeof metric.value} href={metric.href} key={`${metric.label}-${index}`} prefetch={false}>{content}</Link> : <div className={styles.metric} data-accent={index % 5} data-dashboard-metric data-metric-label={metric.label} data-metric-value={metric.value} data-tone={metric.tone ?? "neutral"} data-value-kind={typeof metric.value} key={`${metric.label}-${index}`}>{content}</div>;
        })}</div>
      </section> : null}
      <div className={styles.workspace}>
      <details aria-labelledby="dashboard-attention-title" className={styles.attention} data-dashboard-panel data-dashboard-profile={profile} open>
        <summary className={styles.dashboardDisclosure}><ClipboardCheck aria-hidden="true" size={19} /><span>{presentation.attentionTitle}</span><small>{seen.size}</small><ChevronDown aria-hidden="true" size={18} /></summary>
        <header className={styles.chartHeader}><h2 id="dashboard-attention-title">{presentation.attentionTitle}</h2><span>{seen.size} việc</span></header>
        {workItems.length ? <div className={styles.attentionList}>{visibleWorkItems.map((item) => <Link className={styles.attentionItem} data-priority={item.priority ?? "LOW"} href={item.href} key={`${item.type}-${item.id}`} prefetch={false}>
          <span aria-hidden="true" className={styles.workIcon}><ClipboardCheck size={18} /></span>
          <span className={styles.workIdentity}>
          <span className={styles.attentionCategory}>{attentionCategories[item.type] ?? "Cần xử lý"}</span>
          <strong>{item.type === "shipment" && item.context && item.context !== "—" ? item.context : item.title}</strong>
          {item.type === "shipment" && item.context && item.context !== "—"
            ? <span className={styles.attentionContext}>Mã lô: {item.title}</span>
            : item.context && item.context !== "—" ? <span className={styles.attentionContext}>{item.context}</span> : null}
          </span>
          <span className={styles.workMeta}>
            {item.dueOrAge ? <small className={styles.workDate}>{item.dueOrAge}</small> : null}
            {item.priority === "HIGH" || item.priority === "CRITICAL" ? <span className={styles.priority}>{item.priority === "CRITICAL" ? "Khẩn cấp" : "Ưu tiên cao"}</span> : null}
          </span>
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>)}</div> : <div className={styles.empty}><CheckCircle2 aria-hidden="true" size={28} /><span>Không có việc cần xử lý</span></div>}
        {mobile && workItems.length > 3 ? <Button aria-expanded={moreWork} className={styles.workMore} onClick={() => setMoreWork((current) => !current)} variant="ghost">{moreWork ? "Thu gọn" : `Xem thêm (${workItems.length - 3})`}</Button> : null}
        {profile === "accounting" && allWorkItems.filter(item => item.type === "payroll").length > 6 ? <Link className={styles.workAll} href="/accounting/payroll?status=pending" prefetch={false}>Xem tất cả kỳ cần xử lý<ArrowUpRight aria-hidden="true" size={16} /></Link> : null}
      </details>
      </div>
      {charts.length ? <details className={styles.chartDisclosure} data-dashboard-profile={profile} open={!mobile}><summary><ChartNoAxesCombined aria-hidden="true" size={19} /><span>{presentation.chartTitle}</span><small>{charts.length}</small><ChevronDown aria-hidden="true" size={18} /></summary><div className={styles.chartGrid}>{charts.map((chart) => <ModuleChart chart={chart} key={chart.key} />)}</div></details> : null}
      {failed ? <div className={styles.error} role="alert"><span>Chưa tải được: {failedLabels.join(", ")}.</span><Button disabled={refreshing} onClick={() => void refresh()} size="sm">Thử lại</Button></div> : null}
    </section>
  </>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return <DashboardPageTemplate className={styles.page}>
    {children}
  </DashboardPageTemplate>;
}

export function DashboardAnalyticsFallback() {
  return <LoadingState title="Đang tải Dashboard" />;
}

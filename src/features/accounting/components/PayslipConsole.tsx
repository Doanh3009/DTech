"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, EyeOff, History, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { FileDownloadLink } from "@/components/shared/FileDownloadLink";
import { SearchInput, Select, Textarea } from "@/components/shared/FormControls";
import { Drawer, Modal } from "@/components/shared/Overlays";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBusinessDateTime } from "@/lib/time/timezone";
import { defaultPayslipPeriod, formatPayslipPeriod, groupPayslips, matchesPayslipTracking, parsePayslipTracking, payslipListQuery, payslipPeriodKey, type PayslipGroup, type PayslipTracking } from "../payslipPresentation";
import type { Payslip } from "../types";
import styles from "./PayslipConsole.module.css";

const money = (value: unknown) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value ?? 0));
const pageSize = 20;

function TrackingStatus({ item }: { item: Payslip }) {
  if (item.status !== "published") return <StatusBadge status={item.status} />;
  if (item.confirmedAt) return <StatusBadge tone="success">Đã xác nhận</StatusBadge>;
  return <StatusBadge tone={item.viewedAt ? "warning" : "info"}>{item.viewedAt ? "Chờ xác nhận" : "Chưa xem"}</StatusBadge>;
}

export function PayslipConsole({ canRevoke, selfOnly = false, personalRoute = false, initialMonth, initialReceipt }: { canRevoke: boolean; selfOnly?: boolean; personalRoute?: boolean; initialMonth?: string; initialReceipt?: string }) {
  const selfScope = selfOnly;
  const [items, setItems] = useState<Payslip[]>([]);
  const [loadedScope, setLoadedScope] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [revoking, setRevoking] = useState<Payslip>();
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [search, setSearch] = useState("");
  const [tracking, setTracking] = useState<PayslipTracking>(parsePayslipTracking(initialReceipt));
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(initialMonth === "all" ? "" : initialMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(initialMonth) ? initialMonth : undefined);
  const [historyKey, setHistoryKey] = useState<string>();
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const mutationRef = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++requestId.current;
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
    const response = await fetch(`/api/v1/accounting/payslips${selfScope ? "?scope=self" : ""}`, { cache: "no-store", signal: requestSignal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải phiếu lương.");
    if (requestSignal.aborted || request !== requestId.current) return;
    setItems(body.data);
    setLoadedScope(selfScope);
    setError("");
  }, [selfScope]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => { if (active) void load(controller.signal).catch(reason => { if (active) setError(reason.name === "TimeoutError" ? "Tải phiếu lương quá lâu. Vui lòng mở lại." : reason.message); }); });
    return () => { active = false; controller.abort(); };
  }, [load]);

  async function revoke(item: Payslip) {
    const reason = revokeReason.trim();
    if (reason.length < 3 || mutationRef.current) return;
    mutationRef.current = true;
    setBusyId(item.id);
    setRevokeError("");
    try {
      const response = await fetch(`/api/v1/accounting/payslips/${item.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }), signal: AbortSignal.timeout(15_000)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể thu hồi phiếu lương.");
      // Preserve the successful mutation even if the following list refresh fails.
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "revoked", revokeReason: reason, revokedAt: body.data?.revokedAt } : entry));
      setRevoking(undefined);
      setRevokeReason("");
      await load().catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể tải phiếu lương."));
    } catch (reason) {
      setRevokeError(reason instanceof Error && reason.name === "TimeoutError" ? "Chưa nhận được phản hồi. Vui lòng tải lại danh sách để kiểm tra." : reason instanceof Error ? reason.message : "Không thể thu hồi phiếu lương.");
    } finally {
      mutationRef.current = false;
      setBusyId(undefined);
    }
  }

  const scopedItems = loadedScope === selfScope ? items : [];
  const groups = groupPayslips(scopedItems);
  const period = selectedPeriod ?? defaultPayslipPeriod(scopedItems);
  const periods = [...new Set([...scopedItems.map(payslipPeriodKey).filter(Boolean), ...(period ? [period] : [])])].sort().reverse();
  const periodGroups = groups.filter((group) => !period || payslipPeriodKey(group.current) === period);
  const issued = periodGroups.filter((group) => group.current.status === "published");
  const unseen = issued.filter((group) => matchesPayslipTracking(group.current, "unseen")).length;
  const pending = issued.filter((group) => matchesPayslipTracking(group.current, "pending")).length;
  const confirmed = issued.filter((group) => matchesPayslipTracking(group.current, "confirmed")).length;
  const filtered = periodGroups.filter(({ current }) => matchesPayslipTracking(current, tracking)
    && `${current.employeeName} ${current.employeeCode} ${current.periodMonth} ${formatPayslipPeriod(current.periodMonth)}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const history = groups.find((group) => group.key === historyKey);
  const detailHref = (item: Payslip) => `${personalRoute ? "/personal/payslips" : "/accounting/payslips"}/${item.id}${payslipListQuery(period || "all", tracking, selfScope && !personalRoute)}`;
  const chooseTracking = (value: PayslipTracking) => { setTracking(value); setPage(1); };
  const columns: DataTableColumn<PayslipGroup>[] = [
    ...(!selfScope ? [{ id: "employee", header: "Nhân viên", priority: "primary" as const, cell: ({ current }: PayslipGroup) => <Link href={detailHref(current)} className={styles.employee}><strong>{current.employeeName}</strong><small>{current.employeeCode}</small></Link> }] : []),
    { id: "period", header: "Kỳ lương", priority: selfScope ? "primary" : undefined, width: "compact", cell: ({ current }) => <span className={styles.period}><Link className="text-link" href={detailHref(current)}>{formatPayslipPeriod(current.periodMonth)}</Link><small>Phiên bản {current.version}</small></span> },
    { id: "net", header: "Thực nhận", cell: ({ current }) => <strong className={styles.amount}>{money(current.snapshot.netSalary)}</strong>, align: "right" },
    { id: "status", header: "Theo dõi", cell: ({ current }) => <TrackingStatus item={current} /> },
    { id: "published", header: "Phát hành", cell: ({ current }) => current.publishedAt ? formatBusinessDateTime(current.publishedAt) : "—", hiddenOnMobile: true },
    ...(!selfScope && groups.some((group) => group.versions.length > 1) ? [{ id: "history", header: "Phiên bản", width: "compact" as const, hiddenOnMobile: true, cell: (group: PayslipGroup) => group.versions.length > 1 ? <button className={styles.historyButton} onClick={() => setHistoryKey(group.key)} type="button"><History aria-hidden="true" size={15} />{group.versions.length} bản</button> : "—" }] : [])
  ];

  return <ListPageLayout className={styles.layout}>
    {loadedScope === selfScope && scopedItems.length ? <section className={styles.summary} aria-label={`Tổng hợp phiếu lương ${period ? formatPayslipPeriod(period) : "tất cả kỳ"}`}>
      <div className={styles.total}><Wallet aria-hidden="true" size={19} /><span>{selfScope ? "Thực nhận" : "Tổng thực nhận"}</span><strong>{money(issued.reduce((sum, group) => sum + Number(group.current.snapshot.netSalary ?? 0), 0))}</strong><small>{period ? formatPayslipPeriod(period) : "Tất cả kỳ"} · {issued.length} phiếu phát hành</small></div>
      <button aria-pressed={tracking === "unseen"} className={styles.summaryItem} onClick={() => chooseTracking("unseen")} type="button"><EyeOff aria-hidden="true" size={19} /><span>Chưa xem</span><strong>{unseen}</strong></button>
      <button aria-pressed={tracking === "pending"} className={styles.summaryItem} onClick={() => chooseTracking("pending")} type="button"><Clock3 aria-hidden="true" size={19} /><span>Chờ xác nhận</span><strong>{pending}</strong></button>
      <button aria-pressed={tracking === "confirmed"} className={styles.summaryItem} onClick={() => chooseTracking("confirmed")} type="button"><CheckCircle2 aria-hidden="true" size={19} /><span>Đã xác nhận</span><strong>{confirmed}</strong></button>
    </section> : null}
    <DataSurface className={styles.surface}>
      <div className={styles.toolbar} data-ui="filter-controls">
        <SearchInput aria-label="Tìm phiếu lương" placeholder={selfScope ? "Tìm kỳ lương" : "Tìm nhân viên"} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select label="Kỳ lương" labelHidden value={period} onChange={(event) => { setSelectedPeriod(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả kỳ lương" }, ...periods.map((value) => ({ value, label: `Tháng ${formatPayslipPeriod(value)}` }))]} />
        <Select label="Theo dõi phiếu lương" labelHidden value={tracking} onChange={(event) => chooseTracking(event.target.value as PayslipTracking)} options={[{ value: "all", label: "Tất cả phiếu hiện hành" }, { value: "unseen", label: "Chưa xem" }, { value: "pending", label: "Chờ xác nhận" }, { value: "confirmed", label: "Đã xác nhận" }, ...(!selfScope ? [{ value: "revoked", label: "Đã thu hồi" }, { value: "draft", label: "Nháp" }] : [])]} />
      </div>
      <div className={styles.resultBar}><span>{filtered.length} phiếu{period ? ` · ${formatPayslipPeriod(period)}` : ""}</span>{tracking !== "all" || search ? <button className="text-link" onClick={() => { setSearch(""); chooseTracking("all"); }} type="button">Xóa bộ lọc</button> : null}</div>
      {error && loadedScope === selfScope ? <p className={`form-error ${styles.refreshError}`} role="alert">{error}</p> : null}
      <DataTable
        actions={({ current: item, key, versions }) => <DropdownMenu label={`Thao tác phiếu lương ${item.employeeName}`}><Link href={detailHref(item)}>Xem phiếu lương</Link><FileDownloadLink format="pdf" href={`/api/v1/accounting/payslips/${item.id}/download`}>Tải PDF</FileDownloadLink>{versions.length > 1 ? <button onClick={() => setHistoryKey(key)} type="button">Lịch sử phiên bản</button> : null}{canRevoke && !selfScope && item.status === "published" ? <button disabled={busyId === item.id} onClick={() => { setRevoking(item); setRevokeReason(""); setRevokeError(""); }} type="button">Thu hồi</button> : null}</DropdownMenu>}
        ariaLabel="Phiếu lương hiện hành"
        columns={columns}
        data={paged}
        emptyDescription=""
        emptyTitle={scopedItems.length ? "Không có phiếu lương phù hợp" : "Chưa có phiếu lương"}
        error={loadedScope === selfScope ? undefined : error}
        getRowId={(group) => group.current.id}
        getRowHref={(group) => detailHref(group.current)}
        loading={!error && loadedScope !== selfScope}
      />
      {pageCount > 1 ? <div className={styles.pagination}><Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} /></div> : null}
    </DataSurface>
    <Drawer open={Boolean(history)} onClose={() => setHistoryKey(undefined)} title="Lịch sử phiếu lương" className={styles.historyDrawer}>
      {history ? <div className={styles.historyContent}>
        <header className={styles.historyHeading}><strong>{history.current.employeeName}</strong><span>{history.current.employeeCode} · {formatPayslipPeriod(history.current.periodMonth)}</span></header>
        <ol className={styles.versions}>{history.versions.map((item) => <li key={item.id}>
          <div className={styles.versionHeader}><strong>Phiên bản {item.version}</strong><StatusBadge status={item.status} /></div>
          <strong className={styles.versionAmount}>{money(item.snapshot.netSalary)}</strong>
          <dl><div><dt>Phát hành</dt><dd>{item.publishedAt ? formatBusinessDateTime(item.publishedAt) : "—"}</dd></div><div><dt>Đã xem</dt><dd>{item.viewedAt ? formatBusinessDateTime(item.viewedAt) : "—"}</dd></div><div><dt>Xác nhận</dt><dd>{item.confirmedAt ? formatBusinessDateTime(item.confirmedAt) : "—"}</dd></div>{item.revokedAt ? <div><dt>Thu hồi</dt><dd>{formatBusinessDateTime(item.revokedAt)}</dd></div> : null}{item.revokeReason ? <div><dt>Lý do</dt><dd>{item.revokeReason}</dd></div> : null}</dl>
          <Link className="button button--secondary button--md" href={detailHref(item)}>Xem phiên bản {item.version}</Link>
        </li>)}</ol>
      </div> : null}
    </Drawer>
    <Modal open={Boolean(revoking)} onClose={() => { if (!busyId) setRevoking(undefined); }} title="Thu hồi phiếu lương">
      {revoking ? <form className={styles.revokeForm} onSubmit={(event) => { event.preventDefault(); void revoke(revoking); }}>
        <div className={styles.revokeSummary}><div><strong>{revoking.employeeName}</strong><span>Kỳ {formatPayslipPeriod(revoking.periodMonth)} · v{revoking.version}</span></div><strong>{money(revoking.snapshot.netSalary)}</strong></div>
        <Textarea label="Lý do thu hồi" required minLength={3} maxLength={500} value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} rows={3} />
        {revokeError ? <p className="form-error" role="alert">{revokeError}</p> : null}
        <div className="form-actions"><Button disabled={Boolean(busyId)} onClick={() => setRevoking(undefined)} type="button">Hủy</Button><Button busy={Boolean(busyId)} disabled={revokeReason.trim().length < 3 || Boolean(busyId)} type="submit" variant="danger">Thu hồi phiếu lương</Button></div>
      </form> : null}
    </Modal>
  </ListPageLayout>;
}

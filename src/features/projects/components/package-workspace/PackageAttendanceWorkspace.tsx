"use client";

import { FileDownloadLink } from "@/components/shared/FileDownloadLink";

import { Bell, CalendarDays, Camera, Clock3, Download, MoreHorizontal, Plus, Search, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Avatar } from "@/components/shared/Avatar";
import { Button } from "@/components/shared/Button";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { Checkbox, Input, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { EmptyState, ErrorState, PermissionDeniedState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { workerCategoryLabels } from "@/features/employees/services/employeeService";
import type { EmployeeSummary, WorkerCategory } from "@/features/employees/types";
import type { AssignmentRole, ProjectAssignment, ProjectDetail } from "@/features/projects/types/projectTypes";
import { readWorkerResponse } from "@/features/worker-attendance/client/workerAttendanceSync";
import type { WorkerAttendanceEntry, WorkerAttendanceSession, WorkerEntryStatus } from "@/features/worker-attendance/types/workerAttendanceTypes";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { formatBusinessDate } from "@/lib/time/timezone";

import attendanceStyles from "./PackageAttendanceWorkspace.module.css";
import styles from "./PackageWorkspace.module.css";

const roleLabels: Record<AssignmentRole, string> = {
  project_manager: "Quản lý dự án", engineer: "Kỹ sư", supervisor_main: "Giám sát chính",
  supervisor_replacement: "Giám sát thay thế", worker: "Công nhân", support: "Hỗ trợ"
};

const attendanceStatus: Record<WorkerEntryStatus | "not_recorded", { label: string; tone: "error" | "info" | "neutral" | "success" | "warning" }> = {
  not_recorded: { label: "Chưa chấm", tone: "error" }, unconfirmed: { label: "Chưa xử lý", tone: "warning" },
  present: { label: "Có mặt", tone: "success" }, absent: { label: "Vắng", tone: "error" },
  leave: { label: "Nghỉ", tone: "neutral" }, late: { label: "Đi muộn", tone: "warning" },
  transferred: { label: "Điều chuyển", tone: "info" }
};

type AttendanceRow = { assignment: ProjectAssignment; entry?: WorkerAttendanceEntry; session?: WorkerAttendanceSession; status: WorkerEntryStatus | "not_recorded" };

function timeOnly(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function weekdayDate(value: string) {
  const date = new Date(`${value}T12:00:00+07:00`);
  const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
  return `${weekday.charAt(0).toLocaleUpperCase("vi-VN")}${weekday.slice(1)}, ${formatBusinessDate(value)}`;
}

function weekRange(value: string) {
  const date = new Date(`${value}T12:00:00+07:00`);
  const day = date.getDay() || 7;
  const monday = new Date(date); monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const key = (item: Date) => item.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  return { from: key(monday), to: key(sunday) };
}

function matchesAssignment(session: WorkerAttendanceSession, assignment: ProjectAssignment) {
  return session.shiftCode === assignment.shiftCode && (!assignment.worksiteId || session.worksiteId === assignment.worksiteId);
}

export function PackageAttendanceWorkspace({ project, today, todayRoster, attendanceSessions, initialLoadError, selectedWorksiteId, canManageTeam, canOpenAttendance, canViewAttendance, canAdjustAttendance, canExportAttendance }: {
  project: ProjectDetail; today: string; todayRoster: ProjectAssignment[]; attendanceSessions: WorkerAttendanceSession[];
  initialLoadError?: string;
  selectedWorksiteId?: string;
  canManageTeam: boolean; canOpenAttendance: boolean; canViewAttendance: boolean; canAdjustAttendance: boolean; canExportAttendance: boolean;
}) {
  const [members, setMembers] = useState(project.assignments);
  const [roster, setRoster] = useState(todayRoster);
  const [sessions, setSessions] = useState(attendanceSessions.filter((session) => session.date === today));
  const [history, setHistory] = useState(attendanceSessions);
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [shift, setShift] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reminding, setReminding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialLoadError ?? "");
  const pendingDate = useRef<string | undefined>(undefined);
  const dateRequest = useRef(0);

  const loadDate = useCallback(async (date: string) => {
    if (pendingDate.current === date) return;
    const requestId = ++dateRequest.current;
    pendingDate.current = date;
    setLoading(true); setLoadError("");
    try {
      const range = weekRange(date);
      const [nextRoster, weekSessions] = await Promise.all([
        readWorkerResponse<ProjectAssignment[]>(await fetch(`/api/v1/projects/${project.id}/roster?date=${date}${selectedWorksiteId ? `&worksiteId=${selectedWorksiteId}` : ""}`, { cache: "no-store" })),
        readWorkerResponse<WorkerAttendanceSession[]>(await fetch(`/api/v1/worker-attendance/sessions?projectId=${project.id}&from=${range.from}&to=${range.to}`, { cache: "no-store" }))
      ]);
      const scopedSessions = weekSessions.filter((session) => !selectedWorksiteId || session.worksiteId === selectedWorksiteId);
      if (requestId !== dateRequest.current) return;
      setRoster(nextRoster); setSessions(scopedSessions.filter((session) => session.date === date));
      setHistory((current) => [...scopedSessions, ...current.filter((item) => item.date < range.from || item.date > range.to)]);
    } catch (reason) {
      if (requestId === dateRequest.current) setLoadError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu chấm công.");
    } finally { if (requestId === dateRequest.current) { pendingDate.current = undefined; setLoading(false); } }
  }, [project.id, selectedWorksiteId]);

  useDomainReconciliation("worker-attendance", () => loadDate(selectedDate));

  function selectDate(date: string) {
    setSelectedDate(date);
    void loadDate(date);
  }

  const rows = useMemo<AttendanceRow[]>(() => roster.map((assignment) => {
    const session = sessions.find((item) => matchesAssignment(item, assignment) && item.entries.some((entry) => entry.workerId === assignment.employeeId));
    const entry = session?.entries.find((item) => item.workerId === assignment.employeeId);
    return { assignment, entry, session, status: entry?.status ?? "not_recorded" };
  }), [roster, sessions]);
  const roleOptions = useMemo(() => [...new Set(roster.map((item) => item.assignmentRole))], [roster]);
  const shiftOptions = useMemo(() => [...new Map(roster.map((item) => [item.shiftCode, item.shiftName])).entries()], [roster]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return rows.filter(({ assignment, status }) => (!normalized || `${assignment.employeeName} ${assignment.employeeCode} ${roleLabels[assignment.assignmentRole]} ${assignment.worksiteName ?? ""}`.toLocaleLowerCase("vi-VN").includes(normalized)) && (!role || assignment.assignmentRole === role) && (!shift || assignment.shiftCode === shift) && (!statusFilter || status === statusFilter));
  }, [query, role, rows, shift, statusFilter]);
  const counts = useMemo(() => filteredRows.reduce((result, row) => {
    result.total += 1;
    if (row.status === "present" || row.status === "late") result.completed += 1;
    else if (row.status === "not_recorded") result.notRecorded += 1;
    else if (row.status === "unconfirmed") result.pending += 1;
    else result.other += 1;
    return result;
  }, { total: 0, completed: 0, pending: 0, notRecorded: 0, other: 0 }), [filteredRows]);
  const completion = counts.total ? Math.round(counts.completed / counts.total * 100) : 0;
  const activeFilterCount = [role, shift, statusFilter].filter(Boolean).length;
  const week = weekRange(selectedDate);
  const weekEntries = history.filter((session) => session.date >= week.from && session.date <= week.to).flatMap((session) => session.entries);

  async function remindSupervisor() {
    setReminding(true); setMessage("");
    try {
      const response = await fetch("/api/v1/worker-attendance/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, date: selectedDate }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể gửi nhắc nhở.");
      setMessage("Đã gửi nhắc chấm công.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể gửi nhắc nhở."); }
    finally { setReminding(false); }
  }

  if (!canViewAttendance) return <PermissionDeniedState title="Không có quyền xem chấm công" />;
  const startButton = selectedDate === today && canOpenAttendance ? <Link aria-label="Điểm danh công nhân" className="button button--primary button--md" href={`/worker-attendance/today?projectId=${project.id}${selectedWorksiteId ? `&worksiteId=${selectedWorksiteId}` : ""}`}><Camera aria-hidden="true" size={17} /><span className={attendanceStyles.fullActionLabel}>Điểm danh công nhân</span><span aria-hidden="true" className={attendanceStyles.compactActionLabel}>Điểm danh</span></Link> : null;

  return <section className={attendanceStyles.workspace}>
    <header className={attendanceStyles.workspaceHeader}><div><h2>Chấm công tại công trường</h2><p><CalendarDays aria-hidden="true" size={16} />{weekdayDate(selectedDate)}</p></div><div className={attendanceStyles.dateActions}><Button disabled={selectedDate === today} onClick={() => selectDate(today)} variant={selectedDate === today ? "primary" : "secondary"}>Hôm nay</Button><Input aria-label="Chọn ngày chấm công" label="Ngày chấm công" labelHidden max={today} onChange={(event) => selectDate(event.target.value)} type="date" value={selectedDate} /></div></header>
    {message ? <p className={attendanceStyles.statusMessage} role="status">{message}</p> : null}
    {loadError ? <ErrorState action={<Button onClick={() => void loadDate(selectedDate)}>Tải lại</Button>} description={loadError} /> : null}
    <div className={attendanceStyles.layout}>
      <div className={attendanceStyles.mainColumn}>
        <div className={attendanceStyles.toolbar}>
          <label className={attendanceStyles.searchControl}><Search aria-hidden="true" size={18} /><span className="sr-only">Tìm nhân sự</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nhân sự" type="search" value={query} /></label>
          <div className={attendanceStyles.desktopFilters}><Select label="Chức danh" labelHidden onChange={(event) => setRole(event.target.value)} options={roleOptions.map((value) => ({ value, label: roleLabels[value] }))} placeholder="Chức danh" value={role} /><Select label="Ca làm" labelHidden onChange={(event) => setShift(event.target.value)} options={shiftOptions.map(([value, label]) => ({ value, label }))} placeholder="Ca làm" value={shift} /><Select label="Trạng thái" labelHidden onChange={(event) => setStatusFilter(event.target.value)} options={Object.entries(attendanceStatus).map(([value, item]) => ({ value, label: item.label }))} placeholder="Trạng thái" value={statusFilter} /></div>
          <details className={attendanceStyles.mobileFilters}>
            <summary aria-label={activeFilterCount ? `Bộ lọc, đang áp dụng ${activeFilterCount}` : "Bộ lọc"}><SlidersHorizontal aria-hidden="true" size={19} />{activeFilterCount ? <span>{activeFilterCount}</span> : null}</summary>
            <div className={attendanceStyles.filterPopover}>
              <header><strong>Bộ lọc</strong>{activeFilterCount ? <button onClick={() => { setRole(""); setShift(""); setStatusFilter(""); }} type="button">Xóa lọc</button> : null}</header>
              <FilterChoices label="Chức danh" onChange={setRole} options={roleOptions.map((value) => ({ value, label: roleLabels[value] }))} value={role} />
              <FilterChoices label="Ca làm" onChange={setShift} options={shiftOptions.map(([value, label]) => ({ value, label }))} value={shift} />
              <FilterChoices label="Trạng thái" onChange={setStatusFilter} options={Object.entries(attendanceStatus).map(([value, item]) => ({ value, label: item.label }))} value={statusFilter} />
            </div>
          </details>
          <div className={attendanceStyles.toolbarActions}>{canExportAttendance ? <FileDownloadLink format="xlsx" className="button button--secondary button--md" href={`/api/v1/worker-attendance/export?projectId=${project.id}&month=${selectedDate.slice(0, 7)}`}><Download aria-hidden="true" size={17} />Xuất Excel</FileDownloadLink> : null}{startButton}</div>
        </div>
        <div className={attendanceStyles.listHeader}><strong>Danh sách nhân sự</strong><span aria-label={`${filteredRows.length} trên ${rows.length}`}>{filteredRows.length}/{rows.length}</span>{canManageTeam ? <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => setAssignOpen(true)} size="sm">Phân công</Button> : null}</div>
        <div aria-busy={loading} className={attendanceStyles.tableWrap}><table className={attendanceStyles.table}><thead><tr><th>Nhân sự</th><th>Chức danh</th><th>Ca / Công trường</th><th>Bắt đầu phiên</th><th>Hoàn tất</th><th>Trạng thái</th><th>Ảnh phiên</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{loading ? Array.from({ length: 5 }).map((_, index) => <tr className={attendanceStyles.skeletonRow} key={index}><td colSpan={8}><span /></td></tr>) : filteredRows.map((row) => <AttendanceTableRow canAdjustAttendance={canAdjustAttendance} canOpenAttendance={canOpenAttendance && selectedDate === today} key={row.assignment.id} row={row} />)}</tbody></table>{!loading && !filteredRows.length ? <EmptyState title={rows.length ? "Không tìm thấy nhân sự" : "Chưa có nhân sự trong ngày này"} /> : null}</div>
        <div aria-busy={loading} className={attendanceStyles.mobileList}>{loading ? Array.from({ length: 4 }).map((_, index) => <span className={attendanceStyles.mobileSkeleton} key={index} />) : filteredRows.map((row) => <AttendanceCard canAdjustAttendance={canAdjustAttendance} canOpenAttendance={canOpenAttendance && selectedDate === today} key={row.assignment.id} row={row} />)}{!loading && !filteredRows.length ? <EmptyState title={rows.length ? "Không tìm thấy nhân sự" : "Chưa có nhân sự trong ngày này"} /> : null}</div>
      </div>
      <aside className={attendanceStyles.summaryColumn}>
        <section className={attendanceStyles.summaryCard}><h3>Tình hình chấm công</h3><div className={attendanceStyles.donutBlock}><div aria-label={`${counts.completed} trên ${counts.total} nhân sự đã chấm`} className={attendanceStyles.donut} style={{ "--attendance-angle": `${counts.total ? counts.completed / counts.total * 360 : 0}deg` } as React.CSSProperties}><strong>{counts.completed}<small>/{counts.total}</small></strong><span>{completion}%</span></div><dl className={attendanceStyles.legend}><div data-tone="success"><dt>Đã chấm</dt><dd>{counts.completed}</dd></div><div data-tone="warning"><dt>Chưa xử lý</dt><dd>{counts.pending}</dd></div><div data-tone="danger"><dt>Chưa chấm</dt><dd>{counts.notRecorded}</dd></div><div data-tone="neutral"><dt>Khác</dt><dd>{counts.other}</dd></div></dl></div></section>
        {(counts.pending + counts.notRecorded) > 0 && canAdjustAttendance ? <section className={`${attendanceStyles.summaryCard} ${attendanceStyles.reminderCard}`}><div><Bell aria-hidden="true" size={20} /><span><strong>Điểm danh nhanh</strong><small>{counts.pending + counts.notRecorded} người cần xử lý</small></span></div><Button disabled={reminding} onClick={() => void remindSupervisor()} variant="primary" busy={reminding}>{"Nhắc chấm công"}</Button></section> : null}
        <section className={`${attendanceStyles.summaryCard} ${attendanceStyles.desktopSummary}`}><h3>Thống kê tuần này</h3><dl className={attendanceStyles.weekStats}><div><dt>Nhân sự</dt><dd>{new Set(weekEntries.map((entry) => entry.workerId)).size}</dd></div><div><dt>Đã chấm</dt><dd>{weekEntries.filter((entry) => entry.status === "present" || entry.status === "late").length}</dd></div><div><dt>Chưa xử lý</dt><dd>{weekEntries.filter((entry) => entry.status === "unconfirmed").length}</dd></div><div><dt>Vắng / nghỉ</dt><dd>{weekEntries.filter((entry) => entry.status === "absent" || entry.status === "leave").length}</dd></div></dl></section>
      </aside>
    </div>
    <AssignMembersDrawer canManageTeam={canManageTeam} onAssigned={(created, nextMessage) => { setMembers((current) => [...created, ...current]); setRoster((current) => [...created, ...current]); setMessage(nextMessage); }} onClose={() => setAssignOpen(false)} open={assignOpen} project={{ ...project, assignments: members }} today={today} />
  </section>;
}

function AttendanceTableRow({ row, canAdjustAttendance, canOpenAttendance }: { row: AttendanceRow; canAdjustAttendance: boolean; canOpenAttendance: boolean }) {
  const { assignment, session, status } = row; const presentation = attendanceStatus[status];
  return <tr><td><div className={attendanceStyles.person}><Avatar name={assignment.employeeName} /><strong>{assignment.employeeName}</strong></div></td><td>{roleLabels[assignment.assignmentRole]}</td><td><span className={attendanceStyles.stack}><strong>{assignment.shiftName}</strong><small>{assignment.worksiteName ?? "Toàn dự án"}</small></span></td><td>{session ? timeOnly(session.startedAt) : "—"}</td><td>{session ? timeOnly(session.submittedAt ?? session.dayClosedAt) : "—"}</td><td><StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge></td><td>{session?.photos[0] ? <AttendancePhoto alt={`Ảnh phiên ${session.shiftName}`} height={36} photoId={session.photos[0].id} width={50} /> : "—"}</td><td><RowActions assignment={assignment} canAdjustAttendance={canAdjustAttendance} canOpenAttendance={canOpenAttendance} session={session} /></td></tr>;
}

function AttendanceCard({ row, canAdjustAttendance, canOpenAttendance }: { row: AttendanceRow; canAdjustAttendance: boolean; canOpenAttendance: boolean }) {
  const { assignment, session, status } = row; const presentation = attendanceStatus[status];
  return <article className={attendanceStyles.attendanceCard}><header><Avatar name={assignment.employeeName} /><span><strong>{assignment.employeeName}</strong><span className={attendanceStyles.personMeta}><small>{roleLabels[assignment.assignmentRole]}</small><StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge></span></span><RowActions assignment={assignment} canAdjustAttendance={canAdjustAttendance} canOpenAttendance={canOpenAttendance} session={session} /></header><div className={attendanceStyles.cardFacts}><span><strong>{assignment.shiftName}</strong><em>{assignment.worksiteName ?? "Toàn dự án"}</em></span>{session ? <span className={attendanceStyles.sessionTime}><Clock3 aria-hidden="true" size={15} /><strong>{timeOnly(session.startedAt)} – {timeOnly(session.submittedAt ?? session.dayClosedAt)}</strong></span> : null}{session?.photos[0] ? <AttendancePhoto alt={`Ảnh phiên ${session.shiftName}`} height={32} photoId={session.photos[0].id} width={46} /> : null}</div></article>;
}

function FilterChoices({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <fieldset className={attendanceStyles.filterChoices}><legend>{label}</legend><div><button aria-pressed={!value} onClick={() => onChange("")} type="button">Tất cả</button>{options.map((option) => <button aria-pressed={value === option.value} key={option.value} onClick={() => onChange(option.value)} type="button">{option.label}</button>)}</div></fieldset>;
}

function AttendancePhoto({ photoId, alt, width, height }: { photoId: string; alt: string; width: number; height: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={attendanceStyles.noPhoto}>Ảnh lỗi</span>;
  return <Image alt={alt} className={attendanceStyles.sessionPhoto} height={height} onError={() => setFailed(true)} src={`/api/v1/worker-attendance/photos/${photoId}?size=thumbnail`} unoptimized width={width} />;
}

function RowActions({ assignment, session, canAdjustAttendance, canOpenAttendance }: { assignment: ProjectAssignment; session?: WorkerAttendanceSession; canAdjustAttendance: boolean; canOpenAttendance: boolean }) {
  const canContinue = canOpenAttendance && session && !session.submittedAt && session.status !== "locked";
  return <DropdownMenu label={`Thao tác ${assignment.employeeName}`} trigger={<span className={attendanceStyles.rowMenu}><MoreHorizontal aria-hidden="true" size={18} /></span>}>{canContinue ? <Link href={`/worker-attendance/sessions/${session.id}/roster`}>Tiếp tục điểm danh</Link> : !session && canOpenAttendance ? <Link href={`/worker-attendance/today?projectId=${assignment.projectId}${assignment.worksiteId ? `&worksiteId=${assignment.worksiteId}` : ""}`}>Điểm danh công nhân</Link> : null}{session ? <Link href={`/worker-attendance/sessions/${session.id}`}>{canAdjustAttendance ? "Xem / điều chỉnh điểm danh" : "Xem điểm danh"}</Link> : null}<Link href={`/employees/${assignment.employeeId}/profile`}>Xem hồ sơ</Link></DropdownMenu>;
}

function AssignMembersDrawer({ project, today, open, onClose, onAssigned, canManageTeam }: { project: ProjectDetail; today: string; open: boolean; onClose: () => void; onAssigned: (created: ProjectAssignment[], message: string) => void; canManageTeam: boolean }) {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]); const [loading, setLoading] = useState(false); const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [query, setQuery] = useState(""); const [category, setCategory] = useState<WorkerCategory | "all">("all");
  const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState("");
  useEffect(() => { if (!open || employees.length || !canManageTeam) return; const controller = new AbortController(); async function loadEmployees() { setLoading(true); setLoadError(""); try { const response = await fetch("/api/v1/employees?status=active&pageSize=100", { signal: controller.signal }); const body = await response.json() as { data?: { employees?: { items?: EmployeeSummary[] } }; error?: { message?: string } }; if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải danh sách nhân sự."); setEmployees(body.data?.employees?.items ?? []); } catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setLoadError(reason instanceof Error ? reason.message : "Không thể tải danh sách nhân sự."); } finally { if (!controller.signal.aborted) setLoading(false); } } void loadEmployees(); return () => controller.abort(); }, [canManageTeam, employees.length, open]);
  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("vi-VN"); return employees.filter((employee) => (category === "all" || employee.workerCategory === category) && (!normalized || `${employee.employeeCode} ${employee.displayName} ${employee.departmentName}`.toLocaleLowerCase("vi-VN").includes(normalized))); }, [category, employees, query]);
  function toggle(id: string, checked: boolean) { setSelected((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; }); }
  function close() { if (submitting) return; setSelected(new Set()); setSubmitError(""); onClose(); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected.size) return; const form = new FormData(event.currentTarget); const payload = { worksiteId: form.get("worksiteId") || undefined, assignmentRole: form.get("assignmentRole"), startDate: form.get("startDate"), endDate: form.get("endDate") || undefined, shiftCode: form.get("shiftCode"), shiftName: form.get("shiftName"), shiftStart: form.get("shiftStart"), shiftEnd: form.get("shiftEnd") }; setSubmitting(true); setSubmitError(""); const results = await Promise.allSettled([...selected].map(async (employeeId) => { const response = await fetch(`/api/v1/projects/${project.id}/assignments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, employeeId }) }); const body = await response.json() as { data?: ProjectAssignment; error?: { message?: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể phân công nhân sự."); return body.data; })); setSubmitting(false); const created = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []); const failed = results.filter((result) => result.status === "rejected"); if (created.length) onAssigned(created, `Đã phân công ${created.length} nhân sự.`); if (failed.length) setSubmitError(failed[0]?.reason instanceof Error ? failed[0].reason.message : "Một số nhân sự chưa được phân công."); else close(); }
  return <Drawer onClose={close} open={open} title="Phân công nhân sự"><form className={styles.assignDrawer} onSubmit={submit}><Input label="Tìm nhân sự" onChange={(event) => setQuery(event.target.value)} placeholder="Tên hoặc phòng ban" value={query} /><Select label="Loại nhân sự" onChange={(event) => setCategory(event.target.value as WorkerCategory | "all")} options={[{ value: "all", label: "Tất cả loại" }, ...Object.entries(workerCategoryLabels).map(([value, label]) => ({ value, label }))]} value={category} />{loadError ? <ErrorState action={<Button onClick={() => { setEmployees([]); setLoadError(""); }}>Tải lại</Button>} description={loadError} /> : <div aria-busy={loading} className={styles.employeePicker}>{loading ? Array.from({ length: 5 }).map((_, index) => <span className={styles.employeeSkeleton} key={index} />) : visible.map((employee) => <label key={employee.id}><Checkbox checked={selected.has(employee.id)} label="" onChange={(event) => toggle(employee.id, event.target.checked)} /><Avatar name={employee.displayName} /><span><strong>{employee.displayName}</strong><small>{employee.departmentName}</small></span></label>)}</div>}<div className={styles.assignGrid}><Select label="Vai trò dự án" name="assignmentRole" options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} required /><Select label="Công trường" name="worksiteId" options={project.worksites.filter((site) => site.status === "active").map((site) => ({ value: site.id, label: site.name }))} placeholder="Toàn dự án" /><Input defaultValue={today} label="Từ ngày" name="startDate" required type="date" /><Input label="Đến ngày" name="endDate" type="date" /><Input defaultValue="DAY" label="Mã ca" name="shiftCode" required /><Input defaultValue="Ca ngày" label="Tên ca" name="shiftName" required /><Input defaultValue="07:00" label="Bắt đầu" name="shiftStart" required type="time" /><Input defaultValue="17:00" label="Kết thúc" name="shiftEnd" required type="time" /></div>{submitError ? <p className={styles.inlineError} role="alert">{submitError}</p> : null}<footer className={styles.drawerFooter}><span>{selected.size} người đã chọn</span><div><Button disabled={submitting} onClick={close}>Hủy</Button><Button disabled={!selected.size || submitting} type="submit" variant="primary" busy={submitting}>{"Phân công"}</Button></div></footer></form></Drawer>;
}

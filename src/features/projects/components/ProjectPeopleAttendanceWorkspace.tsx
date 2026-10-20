"use client";

import { FileDownloadLink } from "@/components/shared/FileDownloadLink";

import { Bell, CalendarDays, ClipboardCheck, Download, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Avatar } from "@/components/shared/Avatar";
import { Button } from "@/components/shared/Button";
import { Card, StatCard } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Checkbox, Input, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Toast, ToastViewport } from "@/components/shared/Toast";
import { workerCategoryLabels } from "@/features/employees/services/employeeService";
import type { EmployeeSummary, WorkerCategory } from "@/features/employees/types";
import type { AssignmentRole, ProjectAssignment, ProjectDetail } from "@/features/projects/types/projectTypes";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";

const roleLabels: Record<AssignmentRole, string> = {
  project_manager: "Quản lý dự án",
  engineer: "Kỹ sư",
  supervisor_main: "Giám sát chính",
  supervisor_replacement: "Giám sát thay thế",
  worker: "Công nhân",
  support: "Hỗ trợ"
};

const assignmentStatus = {
  active: { label: "Đang tham gia", tone: "success" as const },
  inactive: { label: "Tạm nghỉ", tone: "warning" as const },
  cancelled: { label: "Đã rời dự án", tone: "neutral" as const }
};

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function timeLabel(value?: string) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function safeJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

interface ProjectPeopleAttendanceWorkspaceProps {
  project: ProjectDetail;
  today: string;
  todayRoster: ProjectAssignment[];
  attendanceSessions: WorkerAttendanceSession[];
  canManageTeam: boolean;
  canOpenAttendance: boolean;
  canViewAttendance: boolean;
  canAdjustAttendance: boolean;
  canExportAttendance: boolean;
}

export function ProjectPeopleAttendanceWorkspace({ project, today, todayRoster, attendanceSessions, canManageTeam, canOpenAttendance, canViewAttendance, canAdjustAttendance, canExportAttendance }: ProjectPeopleAttendanceWorkspaceProps) {
  const [members, setMembers] = useState(project.assignments);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const [showMobileMembers, setShowMobileMembers] = useState(false);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeMembers = members.filter((member) => member.status === "active");
  const filteredMembers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi-VN");
    return members.filter((member) => {
      const matchesQuery = !term || [member.employeeName, member.employeeCode, member.worksiteName, roleLabels[member.assignmentRole]].some((value) => value?.toLocaleLowerCase("vi-VN").includes(term));
      return matchesQuery && (roleFilter === "all" || member.assignmentRole === roleFilter) && (statusFilter === "all" || member.status === statusFilter);
    });
  }, [members, query, roleFilter, statusFilter]);

  const todaySessions = attendanceSessions.filter((session) => session.date === today);
  const activeSession = todaySessions.find((session) => session.sessionType === "morning") ?? todaySessions[0];
  const todayEntries = todaySessions.flatMap((session) => session.entries);
  const presentToday = todayEntries.filter((entry) => entry.status === "present" || entry.status === "late").length;
  const leaveToday = todayEntries.filter((entry) => entry.status === "leave").length || todayRoster.filter((member) => Boolean(member.approvedLeave)).length;
  const workersToday = todayRoster.filter((member) => member.assignmentRole === "worker");
  const unconfirmedToday = canViewAttendance ? Math.max(0, workersToday.length - presentToday - leaveToday - todayEntries.filter((entry) => entry.status === "absent" || entry.status === "transferred").length) : 0;
  const monthWorkdays = attendanceSessions.filter((session) => session.entries.length > 0).flatMap((session) => session.entries).filter((entry) => entry.status === "present" || entry.status === "late").length;
  const supervisor = todayRoster.find((member) => member.assignmentRole === "supervisor_main" || member.assignmentRole === "supervisor_replacement") ?? todayRoster.find((member) => member.assignmentRole === "project_manager");
  const latestPhoto = activeSession?.photos.at(-1);
  const expectedCount = workersToday.length;
  const confirmedCount = presentToday + leaveToday + todayEntries.filter((entry) => entry.status === "absent" || entry.status === "transferred").length;
  const completion = expectedCount ? Math.min(100, Math.round((confirmedCount / expectedCount) * 100)) : 0;
  const attendanceHref = `/worker-attendance/today?projectId=${project.id}`;
  const month = today.slice(0, 7);

  async function remindSupervisor() {
    setReminding(true);
    try {
      const response = await fetch("/api/v1/worker-attendance/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, date: today })
      });
      const body = await safeJson<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể gửi nhắc nhở.");
      setToast("Đã nhắc kỹ sư phụ trách chấm công.");
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Không thể gửi nhắc nhở.");
    } finally {
      setReminding(false);
    }
  }

  const columns: DataTableColumn<ProjectAssignment>[] = [
    {
      id: "employee",
      header: "Nhân sự",
      cell: (member) => <div className="project-people__employee"><Avatar name={member.employeeName} /><span><strong>{member.employeeName}</strong><small>{member.worksiteName ?? "Toàn dự án"}</small></span></div>,
      sortable: true
    },
    { id: "role", header: "Vai trò dự án", cell: (member) => roleLabels[member.assignmentRole], sortable: true },
    { id: "group", header: "Nhóm", cell: (member) => member.assignmentRole === "worker" ? "Công nhân" : member.assignmentRole.startsWith("supervisor") ? "Giám sát" : "Nhân sự dự án", hiddenOnMobile: true },
    { id: "shift", header: "Ca", cell: (member) => <span>{member.shiftName}<small className="project-people__subline">{member.shiftStart} – {member.shiftEnd}</small></span>, hiddenOnMobile: true },
    { id: "start", header: "Ngày tham gia", accessor: "startDate", sortable: true, hiddenOnMobile: true },
    { id: "status", header: "Trạng thái", cell: (member) => <StatusBadge tone={assignmentStatus[member.status].tone}>{assignmentStatus[member.status].label}</StatusBadge> }
  ];

  return <div className="project-people-attendance">
    <section aria-label="Chỉ số nhân sự và chấm công" className="project-people-attendance__metrics">
      <StatCard label="Nhân sự dự án" value={String(activeMembers.length)} />
      <StatCard label="Có mặt hôm nay" value={canViewAttendance ? String(presentToday) : "—"} />
      <StatCard label="Nghỉ" value={canViewAttendance ? String(leaveToday) : "—"} />
      <StatCard label="Chưa điểm danh" value={canViewAttendance ? String(unconfirmedToday) : "—"} />
      <StatCard label="Ngày công tháng" value={canViewAttendance ? String(monthWorkdays) : "—"} />
    </section>

    <div className="project-people-attendance__workspace">
      <Card className={`project-people-attendance__members${showMobileMembers ? " is-mobile-open" : ""}`}>
        <header className="project-people-attendance__section-header">
          <div><h2>Nhân sự dự án</h2><StatusBadge>{activeMembers.length} người</StatusBadge></div>
          {canManageTeam ? <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => setDrawerOpen(true)} variant="primary">Phân công nhân sự</Button> : null}
        </header>
        <div className="project-people-attendance__filters">
          <label className="project-people-attendance__search"><Search aria-hidden="true" size={17} /><span className="sr-only">Tìm nhân sự dự án</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã, công trường" value={query} /></label>
          <Select label="Vai trò" labelHidden onChange={(event) => setRoleFilter(event.target.value)} options={[{ value: "all", label: "Tất cả vai trò" }, ...Object.entries(roleLabels).map(([value, label]) => ({ value, label }))]} value={roleFilter} />
          <Select label="Trạng thái" labelHidden onChange={(event) => setStatusFilter(event.target.value)} options={[{ value: "all", label: "Tất cả trạng thái" }, ...Object.entries(assignmentStatus).map(([value, item]) => ({ value, label: item.label }))]} value={statusFilter} />
        </div>
        {members.length ? <DataTable ariaLabel="Nhân sự dự án" columns={columns} data={filteredMembers} emptyDescription="Không có nhân sự phù hợp." emptyTitle="Không tìm thấy nhân sự" getRowId={(member) => member.id} actions={(member) => <Link aria-label={`Xem hồ sơ ${member.employeeName}`} className="icon-button icon-button--ghost" href={`/employees/${member.employeeId}/profile`} title={`Xem hồ sơ ${member.employeeName}`}><MoreHorizontal aria-hidden="true" size={18} /></Link>} /> : <EmptyState action={canManageTeam ? <Button onClick={() => setDrawerOpen(true)} variant="primary">Phân công nhân sự</Button> : undefined} title="Chưa có nhân sự trong dự án" />}
      </Card>

      <Card className="project-people-attendance__attendance">
        <header className="project-people-attendance__section-header"><div><h2>Điểm danh hôm nay</h2><span>{dayLabel(today)}</span></div><ClipboardCheck aria-hidden="true" size={20} /></header>
        {!canViewAttendance ? <EmptyState title="Không có quyền xem điểm danh" /> : !workersToday.length ? <EmptyState action={canManageTeam ? <Button onClick={() => setDrawerOpen(true)} variant="secondary">Phân công nhân sự</Button> : undefined} title="Hôm nay chưa có ca làm" /> : <>
          <dl className="project-people-attendance__attendance-context">
            <div><dt>Ca</dt><dd>{activeSession?.shiftName ?? workersToday[0]?.shiftName ?? "Chưa thiết lập"}</dd></div>
            <div><dt>Thời gian</dt><dd>{workersToday[0]?.shiftStart} – {workersToday[0]?.shiftEnd}</dd></div>
            {supervisor ? <div><dt>Giám sát</dt><dd>{supervisor.employeeName}</dd></div> : null}
          </dl>
          {activeSession ? <><div className="project-people-attendance__attendance-count"><strong>{confirmedCount} / {expectedCount}</strong><span>đã ghi nhận</span></div><div aria-label={`${completion}% đã ghi nhận`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={completion} className="project-people-attendance__progress" role="progressbar"><i style={{ width: `${completion}%` }} /></div><div className="project-people-attendance__breakdown"><span>Có mặt <strong>{presentToday}</strong></span><span>Nghỉ <strong>{leaveToday}</strong></span><span>Chưa điểm danh <strong>{unconfirmedToday}</strong></span></div><div className="project-people-attendance__evidence"><StatusBadge tone={latestPhoto ? "success" : "warning"}>{latestPhoto ? "Đã có ảnh điểm danh" : "Thiếu ảnh điểm danh"}</StatusBadge></div><p className="project-people-attendance__updated">Cập nhật {timeLabel(activeSession.submittedAt ?? activeSession.startedAt)}</p>{latestPhoto ? <Link aria-label="Xem ảnh điểm danh gần nhất" className="project-people-attendance__photo" href={`/api/v1/worker-attendance/photos/${latestPhoto.id}`} target="_blank"><Image alt="Ảnh điểm danh gần nhất" height={180} sizes="(max-width: 980px) 100vw, 360px" src={`/api/v1/worker-attendance/photos/${latestPhoto.id}`} width={320} /></Link> : null}</> : <div className="project-people-attendance__missing"><StatusBadge tone="warning">Chưa gửi điểm danh</StatusBadge><strong>{expectedCount} công nhân đang chờ</strong>{canAdjustAttendance && supervisor ? <Button disabled={reminding} leftIcon={<Bell aria-hidden="true" size={16} />} onClick={() => void remindSupervisor()} variant="secondary" busy={reminding}>{"Nhắc kỹ sư"}</Button> : null}</div>}
        </>}
        <footer className="project-people-attendance__attendance-actions">{canOpenAttendance ? <Link className="button button--primary button--md" href={attendanceHref}><span>Điểm danh công nhân</span></Link> : canAdjustAttendance && activeSession ? <Link className="button button--primary button--md" href={`/worker-attendance/sessions/${activeSession.id}`}><span>Điều chỉnh điểm danh</span></Link> : null}<Link className="button button--secondary button--md" href={`/worker-attendance?projectId=${project.id}`}><span>Lịch sử</span></Link>{canExportAttendance ? <FileDownloadLink format="xlsx" className="button button--secondary button--md" href={`/api/v1/worker-attendance/export?projectId=${project.id}&month=${month}`}><Download aria-hidden="true" size={16} /><span>Xuất Excel</span></FileDownloadLink> : null}<Button className="project-people-attendance__members-toggle" leftIcon={<Users aria-hidden="true" size={16} />} onClick={() => setShowMobileMembers((current) => !current)} variant="ghost">{showMobileMembers ? "Ẩn nhân sự" : `Nhân sự (${activeMembers.length})`}</Button></footer>
      </Card>
    </div>

    <Card className="project-people-attendance__activity">
      <header className="project-people-attendance__section-header"><div><h2>Nhật ký nhân sự & chấm công</h2></div><CalendarDays aria-hidden="true" size={20} /></header>
      <ActivityList attendanceSessions={attendanceSessions} members={members} today={today} />
    </Card>

    <AssignMembersDrawer canManageTeam={canManageTeam} onAssigned={(created, message) => { setMembers((current) => [...created, ...current]); setToast(message); }} onClose={() => setDrawerOpen(false)} open={drawerOpen} project={project} today={today} />
    {toast ? <ToastViewport><Toast title={toast} tone="success" /></ToastViewport> : null}
  </div>;
}

function ActivityList({ attendanceSessions, members, today }: { attendanceSessions: WorkerAttendanceSession[]; members: ProjectAssignment[]; today: string }) {
  const activity = [
    ...attendanceSessions.filter((session) => session.date >= `${today.slice(0, 7)}-01`).flatMap((session) => session.submittedAt ? [{ at: session.submittedAt, text: `${session.supervisorName} hoàn tất điểm danh ${session.shiftName}.` }] : []),
    ...members.filter((member) => member.startDate >= `${today.slice(0, 7)}-01`).map((member) => ({ at: `${member.startDate}T00:00:00`, text: `${member.employeeName} được phân công vào dự án.` }))
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 8);
  return activity.length ? <ol className="project-people-attendance__timeline">{activity.map((item, index) => <li key={`${item.at}-${index}`}><time>{timeLabel(item.at)}</time><span>{item.text}</span></li>)}</ol> : <EmptyState title="Chưa có hoạt động gần đây" />;
}

function AssignMembersDrawer({ project, today, open, onClose, onAssigned, canManageTeam }: { project: ProjectDetail; today: string; open: boolean; onClose: () => void; onAssigned: (created: ProjectAssignment[], message: string) => void; canManageTeam: boolean }) {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WorkerCategory | "all">("all");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    if (!open || employees.length || !canManageTeam) return;
    const controller = new AbortController();
    async function loadEmployees() {
      setLoading(true); setLoadError(undefined);
      try {
        const response = await fetch("/api/v1/employees?status=active&pageSize=100", { signal: controller.signal });
        const body = await safeJson<{ data?: { employees?: { items?: EmployeeSummary[] } }; error?: { message?: string } }>(response);
        if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải danh sách nhân sự.");
        setEmployees(body.data?.employees?.items ?? []);
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setLoadError(reason instanceof Error ? reason.message : "Không thể tải danh sách nhân sự.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadEmployees();
    return () => controller.abort();
  }, [canManageTeam, employees.length, open]);

  const visibleEmployees = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return employees.filter((employee) => (category === "all" || employee.workerCategory === category) && (!normalized || [employee.employeeCode, employee.displayName, employee.departmentName, employee.positionName].some((value) => value.toLocaleLowerCase("vi-VN").includes(normalized))));
  }, [category, employees, query]);

  function toggle(id: string, checked: boolean) { setSelected((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; }); }
  function close() { if (!submitting) { setSelected(new Set()); setSubmitError(undefined); onClose(); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.size) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true); setSubmitError(undefined);
    const payload = { worksiteId: form.get("worksiteId") || undefined, assignmentRole: form.get("assignmentRole"), startDate: form.get("startDate"), endDate: form.get("endDate") || undefined, shiftCode: form.get("shiftCode"), shiftName: form.get("shiftName"), shiftStart: form.get("shiftStart"), shiftEnd: form.get("shiftEnd") };
    const results = await Promise.allSettled([...selected].map(async (employeeId) => {
      const response = await fetch(`/api/v1/projects/${project.id}/assignments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, employeeId }) });
      const body = await safeJson<{ data?: ProjectAssignment; error?: { message?: string } }>(response);
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể phân công nhân sự.");
      return body.data;
    }));
    setSubmitting(false);
    const created = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failed = results.filter((result) => result.status === "rejected");
    if (created.length) { onAssigned(created, `Đã phân công ${created.length} nhân sự.`); setSelected(new Set()); }
    if (failed.length) setSubmitError(failed[0]?.reason instanceof Error ? failed[0].reason.message : "Một số nhân sự chưa được phân công.");
    if (!failed.length) close();
  }

  return <Drawer onClose={close} open={open} title="Phân công nhân sự vào dự án"><form className="drawer-form project-assign-drawer" onSubmit={submit}><div className="project-assign-drawer__filters"><Input label="Tìm nhân sự" onChange={(event) => setQuery(event.target.value)} placeholder="Tên, mã, phòng ban" value={query} /><Select label="Loại nhân sự" onChange={(event) => setCategory(event.target.value as WorkerCategory | "all")} options={[{ value: "all", label: "Tất cả loại" }, ...Object.entries(workerCategoryLabels).map(([value, label]) => ({ value, label }))]} value={category} /></div>{loading ? <LoadingState /> : loadError ? <ErrorState action={<Button onClick={() => { setEmployees([]); setLoadError(undefined); }} variant="secondary">Tải lại</Button>} description={loadError} /> : <div className="project-assign-drawer__list">{visibleEmployees.map((employee) => <label className="project-assign-drawer__employee" key={employee.id}><Checkbox checked={selected.has(employee.id)} label="" onChange={(event) => toggle(employee.id, event.target.checked)} /><Avatar name={employee.displayName} /><span><strong>{employee.displayName}</strong><small>{employee.departmentName}</small></span><StatusBadge tone="neutral">{workerCategoryLabels[employee.workerCategory]}</StatusBadge></label>)}{!visibleEmployees.length ? <EmptyState title="Không tìm thấy nhân sự" /> : null}</div>}<div className="form-grid"><Select label="Vai trò dự án" name="assignmentRole" options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} required /><Select label="Công trường" name="worksiteId" options={project.worksites.filter((site) => site.status === "active").map((site) => ({ value: site.id, label: site.name }))} placeholder="Toàn dự án" /><Input defaultValue={today} label="Từ ngày" name="startDate" required type="date" /><Input label="Đến ngày" name="endDate" type="date" /><Input defaultValue="DAY" label="Mã ca" name="shiftCode" required /><Input defaultValue="Ca ngày" label="Tên ca" name="shiftName" required /><Input defaultValue="07:00" label="Bắt đầu" name="shiftStart" required type="time" /><Input defaultValue="17:00" label="Kết thúc" name="shiftEnd" required type="time" /></div>{submitError ? <p className="form-error" role="alert">{submitError}</p> : null}<footer className="project-assign-drawer__footer"><span>{selected.size} nhân sự đã chọn</span><div><Button disabled={submitting} onClick={close} variant="secondary">Hủy</Button><Button disabled={!selected.size || submitting} type="submit" variant="primary" busy={submitting}>{`Phân công ${selected.size} người`}</Button></div></footer></form></Drawer>;
}

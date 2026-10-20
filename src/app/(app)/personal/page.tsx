"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarOff, CalendarRange, ChevronRight, UserRound, WalletCards } from "lucide-react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { ModuleLauncher } from "@/components/shared/ModuleLauncher";
import { visibleApplications } from "@/config/moduleRegistry";
import { PersonalToday } from "@/features/attendance/components/PersonalToday";
import { WorkerAttendanceToday } from "@/features/worker-attendance/components/WorkerAttendanceHome";
import { canUseWorkerAttendance } from "@/config/mobileNavigationResolver";
import { canOpenPersonalAttendance } from "@/lib/auth/applicationAccess";
import { can } from "@/lib/auth/permissions";
import { useMobileViewport } from "@/lib/ui/useMobileViewport";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { getBusinessDateKey } from "@/lib/time/timezone";

export default function PersonalPage() {
  const user = useCurrentUser();
  const { settings } = useSystemSettings();
  const canViewAttendance = settings.modules.attendance && canOpenPersonalAttendance(user.permissions);
  const canReviewWorkers = canUseWorkerAttendance(user);
  const hasOtherApplications = visibleApplications(user, settings.modules).some((application) => application.id !== "overview" && application.id !== "attendance");
  const mobile = useMobileViewport();
  const today = new Date();
  const initials = user.displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("");
  const profileAllowed = can(user.permissions, "profile.view");
  const canViewPayslips = can(user.permissions, "payslip.self.view");
  const canUseLeave = can(user.permissions, "leave.self.view") || can(user.permissions, "leave.self.create");
  const identity = <><span className="personal-home__avatar" aria-hidden="true">{initials || <UserRound size={22} />}</span><span className="personal-home__identity"><span>Xin chào,</span><strong>{user.displayName}</strong></span>{profileAllowed ? <ChevronRight aria-hidden="true" size={18} /> : null}</>;

  return (
    <div className="personal-home page-stack">
      <PageHeader title="Cá nhân" />
      <header className="personal-home__mobile-only personal-home__welcome">
        {profileAllowed ? <Link aria-label={`Hồ sơ của ${user.displayName}`} className="personal-home__person" href="/profile">{identity}</Link> : <div className="personal-home__person">{identity}</div>}
        <time dateTime={getBusinessDateKey(today)} suppressHydrationWarning>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit" }).format(today)}</time>
      </header>
      {hasOtherApplications ? <div className="personal-home__desktop-launcher"><ModuleLauncher excludePersonal /></div> : null}
      {canViewAttendance ? (
        <PersonalToday />
      ) : can(user.permissions, "profile.view") ? (
        <Link className="personal-home__profile" href="/profile"><UserRound aria-hidden="true" size={19} />Hồ sơ của tôi<ArrowUpRight aria-hidden="true" size={17} /></Link>
      ) : null}
      {canViewAttendance || canViewPayslips || canUseLeave ? <section aria-labelledby="personal-services-title" className="personal-home__services">
      <h2 className="personal-home__section-title" id="personal-services-title">Tiện ích cá nhân</h2>
      <nav aria-label="Thông tin của tôi" className="personal-home__links">
        {canViewAttendance ? <Link href="/attendance/history"><CalendarRange aria-hidden="true" size={20} /><span><span className="personal-home__label-desktop">Lịch công của tôi</span><span className="personal-home__label-mobile">Lịch công</span></span><ChevronRight aria-hidden="true" size={18} /></Link> : null}
        {canViewPayslips ? <Link href="/personal/payslips"><WalletCards aria-hidden="true" size={20} /><span><span className="personal-home__label-desktop">Phiếu lương của tôi</span><span className="personal-home__label-mobile">Phiếu lương</span></span><ChevronRight aria-hidden="true" size={18} /></Link> : null}
        {canUseLeave ? <Link href="/leave"><CalendarOff aria-hidden="true" size={20} /><span><span className="personal-home__label-desktop">Nghỉ phép của tôi</span><span className="personal-home__label-mobile">Nghỉ phép</span></span><ChevronRight aria-hidden="true" size={18} /></Link> : null}
      </nav>
      </section> : null}
      {mobile && canReviewWorkers ? <section className="personal-home__mobile-only personal-supervisor-work" aria-label="Điểm danh công nhân"><h2>Điểm danh công nhân</h2><WorkerAttendanceToday /></section> : null}
      <div className="personal-home__mobile-only personal-home__logout"><LogoutButton /></div>
    </div>
  );
}

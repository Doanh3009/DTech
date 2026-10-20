"use client";

import {
  AlertTriangle,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Filter,
  HardHat,
  Home,
  Inbox,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldX,
  Truck,
  UserPlus,
  Users,
  Warehouse,
  X
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { Checkbox, Input, SearchInput, Select } from "@/components/shared/FormControls";
import { Skeleton } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";

import styles from "./GoldenVisualPrototype.module.css";

type ScreenId = "tasks" | "warehouse" | "employee" | "dashboard";
type PreviewState = "filled" | "empty" | "loading" | "error" | "denied" | "open" | "success";

const screens: ReadonlyArray<{ id: ScreenId; label: string; icon: typeof Home }> = [
  { id: "tasks", label: "Gói · Thi công", icon: HardHat },
  { id: "warehouse", label: "Kho · Chứng từ", icon: Warehouse },
  { id: "employee", label: "Nhân sự · Tạo mới", icon: UserPlus },
  { id: "dashboard", label: "Dashboard cá nhân", icon: LayoutDashboard }
];

const previewStates: ReadonlyArray<{ id: PreviewState; label: string }> = [
  { id: "filled", label: "Có dữ liệu" },
  { id: "empty", label: "Trống" },
  { id: "loading", label: "Đang tải" },
  { id: "error", label: "Lỗi" },
  { id: "denied", label: "Không có quyền" },
  { id: "open", label: "Mở panel" },
  { id: "success", label: "Lưu thành công" }
];

const navItems = [
  { label: "Tổng quan", icon: Home },
  { label: "Gói công trình", icon: BriefcaseBusiness },
  { label: "Kho", icon: Boxes },
  { label: "Nhân sự", icon: Users }
] as const;

const taskRows = [
  { name: "Lắp đặt tủ điện tầng 3", owner: "Nguyễn Văn Nam", due: "Hôm nay · 16:30", progress: "72%", tone: "info" as const },
  { name: "Nghiệm thu cáp động lực", owner: "Trần Minh Khôi", due: "25/09 · 09:00", progress: "58%", tone: "warning" as const },
  { name: "Xử lý vướng mặt bằng khu B", owner: "Lê Quốc Huy", due: "Quá hạn 2 ngày", progress: "35%", tone: "error" as const }
];

const documentRows = [
  { code: "PN-260924-018", type: "Nhập kho", partner: "Công ty Minh Phát", date: "24/09/2026", total: "128.400.000 ₫", status: "Chờ ghi sổ", tone: "warning" as const },
  { code: "PX-260924-011", type: "Xuất kho", partner: "Gói CT-2408", date: "24/09/2026", total: "42.760.000 ₫", status: "Đã ghi sổ", tone: "success" as const },
  { code: "CK-260923-006", type: "Chuyển kho", partner: "Kho công trường Q7", date: "23/09/2026", total: "18.920.000 ₫", status: "Nháp", tone: "neutral" as const },
  { code: "KK-260923-003", type: "Kiểm kê", partner: "Kho trung tâm", date: "23/09/2026", total: "—", status: "Cần kiểm tra", tone: "error" as const }
];

function ScreenState({ screen, state, onRetry }: { screen: ScreenId; state: PreviewState; onRetry: () => void }) {
  if (state === "loading") {
    return (
      <div aria-label="Đang tải dữ liệu" className={styles.loadingState} data-state-marker="loading" role="status">
        <span className="sr-only">Đang tải dữ liệu</span>
        <Skeleton className={styles.skeletonTitle} />
        {Array.from({ length: screen === "employee" ? 4 : 6 }, (_, index) => <Skeleton className={styles.skeletonRow} key={index} />)}
      </div>
    );
  }

  const stateContent = state === "empty"
    ? { icon: Inbox, title: "Chưa có dữ liệu", action: "Tạo bản ghi đầu tiên" }
    : state === "denied"
      ? { icon: ShieldX, title: "Không có quyền truy cập", action: "Quay lại" }
      : { icon: AlertTriangle, title: "Không thể tải dữ liệu", action: "Thử lại" };
  const StateIcon = stateContent.icon;

  return (
    <div className={styles.centerState} data-state-marker={state} role={state === "error" || state === "denied" ? "alert" : undefined}>
      <span className={styles.stateIcon}><StateIcon aria-hidden="true" size={22} /></span>
      <h2>{stateContent.title}</h2>
      <Button onClick={onRetry} variant={state === "error" ? "primary" : "secondary"}>
        {stateContent.action}
      </Button>
    </div>
  );
}

function AppSidebar({ collapsed, onToggle, screen }: { collapsed: boolean; onToggle: () => void; screen: ScreenId }) {
  return (
    <aside className={styles.sidebar} data-collapsed={collapsed || undefined}>
      <div className={styles.brand}><span>CT</span>{collapsed ? null : <strong>ERP Nội bộ</strong>}</div>
      <nav aria-label="Điều hướng chính">
        {navItems.map(({ label, icon: Icon }, index) => {
          const active = (screen === "dashboard" && index === 0) || (screen === "tasks" && index === 1) || (screen === "warehouse" && index === 2) || (screen === "employee" && index === 3);
          return <button aria-current={active ? "page" : undefined} key={label} title={collapsed ? label : undefined} type="button"><Icon aria-hidden="true" size={19} />{collapsed ? null : <span>{label}</span>}</button>;
        })}
      </nav>
      <button aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-pressed={collapsed} className={styles.collapseButton} onClick={onToggle} type="button">
        {collapsed ? <PanelLeftOpen aria-hidden="true" size={19} /> : <PanelLeftClose aria-hidden="true" size={19} />}
        {collapsed ? null : <span>Thu gọn</span>}
      </button>
    </aside>
  );
}

function AppTopbar() {
  return (
    <header className={styles.topbar}>
      <button aria-label="Mở menu" className={styles.mobileMenu} type="button"><Menu aria-hidden="true" size={21} /></button>
      <div className={styles.mobileBrand}><span>CT</span><strong>ERP</strong></div>
      <label className={styles.globalSearch}><Search aria-hidden="true" size={17} /><input aria-label="Tìm kiếm toàn hệ thống" placeholder="Tìm nhanh" /></label>
      <div className={styles.topbarActions}>
        <IconButton label="Thông báo"><Bell aria-hidden="true" size={19} /></IconButton>
        <button className={styles.userButton} type="button"><span>AN</span><strong>Admin</strong><ChevronDown aria-hidden="true" size={16} /></button>
      </div>
    </header>
  );
}

function ContextHeader({ eyebrow, title, meta, action }: { eyebrow: string; title: string; meta: ReactNode; action: ReactNode }) {
  return (
    <header className={styles.contextHeader}>
      <div><span>{eyebrow}</span><h1>{title}</h1><div className={styles.contextMeta}>{meta}</div></div>
      <div className={styles.contextAction}>{action}</div>
    </header>
  );
}

function FunctionToolbar({ onOpen, children }: { onOpen: () => void; children?: ReactNode }) {
  return (
    <div className={styles.functionToolbar}>
      <div>{children}</div>
      <Button leftIcon={<Filter aria-hidden="true" size={16} />} onClick={onOpen} size="sm">Bộ lọc</Button>
    </div>
  );
}

function TaskWorkspace({ state, setState }: { state: PreviewState; setState: (state: PreviewState) => void }) {
  const contentState = state === "filled" || state === "open" || state === "success";
  return (
    <div className={styles.screenBody}>
      <ContextHeader
        action={<Button leftIcon={<Plus aria-hidden="true" size={17} />} onClick={() => setState("success")} variant="primary">Cập nhật hiện trường</Button>}
        eyebrow="Gói công trình · Thi công"
        meta={<><span>CT-2408</span><span>Quận 7, TP.HCM</span><StatusBadge tone="info">Đang thi công</StatusBadge></>}
        title="Nhà máy xử lý nước KCN Tân Thuận"
      />
      <nav aria-label="Không gian làm việc gói" className={styles.contextTabs}>
        <button aria-current="page" type="button">Thi công</button><button type="button">Chấm công</button><button type="button">Hồ sơ</button><button type="button">Tài liệu</button>
      </nav>
      <FunctionToolbar onOpen={() => setState("open")}><strong>12 công việc</strong><span>3 cần chú ý</span></FunctionToolbar>
      {contentState ? (
        <div className={styles.taskLayout}>
          <section className={styles.primarySurface}>
            <header className={styles.surfaceHeader}><div><span>Hôm nay</span><h2>Công việc thi công</h2></div><button aria-label="Tùy chọn danh sách" type="button"><MoreHorizontal aria-hidden="true" size={19} /></button></header>
            <div className={styles.taskList}>
              {taskRows.map((task, index) => <article className={styles.taskRow} data-golden-task-row key={task.name}><button aria-label={`Mở ${task.name}`} className={styles.checkButton} data-golden-task-check type="button"><Check aria-hidden="true" size={16} /></button><div data-golden-task-copy><strong>{task.name}</strong><span>{task.owner}</span></div><div className={styles.taskDue}><Clock3 aria-hidden="true" size={15} /><span>{task.due}</span></div><div className={styles.progressCell}><span><i className={index === 0 ? styles.progress72 : index === 1 ? styles.progress58 : styles.progress35} /></span><StatusBadge tone={task.tone}>{task.progress}</StatusBadge></div><ChevronRight aria-hidden="true" size={18} /></article>)}
            </div>
          </section>
          <aside className={styles.contextRail}>
            <section><header><span>Tiến độ gói</span><strong>64%</strong></header><div className={styles.largeProgress}><i /></div><dl><div><dt>Hoàn thành</dt><dd>18</dd></div><div><dt>Đang làm</dt><dd>9</dd></div><div><dt>Vướng mắc</dt><dd>3</dd></div></dl></section>
            <section><header><span>Vướng mắc mới</span><StatusBadge tone="error">3</StatusBadge></header><button type="button"><strong>Chờ bàn giao mặt bằng khu B</strong><span>Quá hạn 2 ngày</span></button><button type="button"><strong>Thiếu biên bản nghiệm thu cáp</strong><span>Cập nhật 10:24</span></button></section>
          </aside>
        </div>
      ) : <ScreenState onRetry={() => setState("filled")} screen="tasks" state={state} />}
      <div className={styles.mobileSticky}><Button onClick={() => setState("success")} variant="primary">Cập nhật hiện trường</Button></div>
    </div>
  );
}

function WarehouseWorklist({ state, setState }: { state: PreviewState; setState: (state: PreviewState) => void }) {
  const contentState = state === "filled" || state === "open" || state === "success";
  return (
    <div className={styles.screenBody}>
      <ContextHeader action={<Button leftIcon={<Plus aria-hidden="true" size={17} />} onClick={() => setState("success")} variant="primary">Tạo phiếu nhập</Button>} eyebrow="Kho · Chứng từ" meta={<><span>Kho trung tâm</span><span>Cập nhật 14:32</span></>} title="Danh sách chứng từ" />
      <FunctionToolbar onOpen={() => setState("open")}><SearchInput label="Tìm chứng từ" placeholder="Mã phiếu, đối tác" /></FunctionToolbar>
      {contentState ? <div className={styles.worklistLayout}>
        <section className={styles.primarySurface}>
          <div className={styles.documentHead}><span>Mã / Loại</span><span>Đối tượng</span><span>Ngày chứng từ</span><span>Giá trị</span><span>Trạng thái</span></div>
          <div className={styles.documentList}>{documentRows.map((row, index) => <button aria-pressed={index === 0} className={styles.documentRow} data-golden-document-row key={row.code} type="button"><span><strong>{row.code}</strong><small>{row.type}</small></span><span>{row.partner}</span><span>{row.date}</span><span className={styles.numeric}>{row.total}</span><StatusBadge tone={row.tone}>{row.status}</StatusBadge><ChevronRight aria-hidden="true" size={17} /></button>)}</div>
        </section>
        <aside className={styles.detailPanel}>
          <header><div><span>Phiếu nhập kho</span><h2>PN-260924-018</h2></div><StatusBadge tone="warning">Chờ ghi sổ</StatusBadge></header>
          <dl><div><dt>Nhà cung cấp</dt><dd>Công ty Minh Phát</dd></div><div><dt>Kho nhận</dt><dd>Kho trung tâm</dd></div><div><dt>Ngày chứng từ</dt><dd>24/09/2026</dd></div><div><dt>Tổng giá trị</dt><dd>128.400.000 ₫</dd></div></dl>
          <section><h3>Hàng hóa</h3><div><span>Cáp CV 4.0</span><strong>1.200 m</strong></div><div><span>Ống thép D60</span><strong>80 cây</strong></div></section>
          <footer><Button variant="secondary">Mở chi tiết</Button><Button onClick={() => setState("success")} variant="primary">Ghi sổ</Button></footer>
        </aside>
      </div> : <ScreenState onRetry={() => setState("filled")} screen="warehouse" state={state} />}
      <div className={styles.mobileSticky}><Button onClick={() => setState("success")} variant="primary">Tạo phiếu nhập</Button></div>
    </div>
  );
}

function EmployeeWizard({ state, setState }: { state: PreviewState; setState: (state: PreviewState) => void }) {
  const contentState = state === "filled" || state === "open" || state === "success" || state === "error";
  const hasErrors = state === "error";
  return (
    <div className={styles.screenBody}>
      <ContextHeader action={<Button onClick={() => setState("success")} variant="primary">Lưu và tiếp tục</Button>} eyebrow="Nhân sự · Hồ sơ nhân viên" meta={<span>Bản nháp · 14:28</span>} title="Tạo nhân viên" />
      <ol aria-label="Tiến trình tạo nhân viên" className={styles.stepper}><li data-complete="true"><span><Check aria-hidden="true" size={15} /></span><strong>Cá nhân</strong></li><li aria-current="step"><span>2</span><strong>Công việc</strong></li><li><span>3</span><strong>Tài khoản</strong></li><li><span>4</span><strong>Xác nhận</strong></li></ol>
      {contentState ? <form className={styles.formWorkspace} onSubmit={(event) => { event.preventDefault(); setState("success"); }}>
        {hasErrors ? <section className={styles.errorSummary} data-state-marker="error" role="alert" tabIndex={-1}><AlertTriangle aria-hidden="true" size={19} /><div><strong>Cần kiểm tra 2 trường</strong><a href="#golden-position">Chức vụ chưa được chọn</a><a href="#golden-company-email">Email công ty không hợp lệ</a></div></section> : null}
        <fieldset className={styles.fieldGroup}><legend>Thông tin công việc</legend><div className={styles.formGrid}>
          <Select defaultValue="operations" label="Phòng ban" options={[{ label: "Khối vận hành", value: "operations" }, { label: "Nhân sự", value: "hr" }]} required />
          <Select error={hasErrors ? "Chọn chức vụ của nhân viên" : undefined} id="golden-position" label="Chức vụ" options={[{ label: "Giám sát công trường", value: "supervisor" }, { label: "Nhân viên kho", value: "warehouse" }]} placeholder="Chọn chức vụ" required />
          <Select defaultValue="official" label="Loại nhân sự" options={[{ label: "Chính thức", value: "official" }, { label: "Thử việc", value: "probation" }]} required />
          <Input defaultValue="24/09/2026" label="Ngày bắt đầu" readOnly />
          <Select label="Quản lý trực tiếp" options={[{ label: "Nguyễn Minh Anh · NV001", value: "nv001" }]} placeholder="Chưa gán" />
          <Input defaultValue={hasErrors ? "an.nguyen@" : "an.nguyen@chaautuan.vn"} error={hasErrors ? "Nhập địa chỉ email đầy đủ" : undefined} id="golden-company-email" label="Email công ty" type="email" />
        </div></fieldset>
        <details className={styles.additionalFields} open={state === "open"}><summary>Thông tin bổ sung <ChevronDown aria-hidden="true" size={18} /></summary><div className={styles.formGrid}><Input label="Mã số thuế cá nhân" /><Input label="Số tài khoản ngân hàng" /></div></details>
        <footer className={styles.formFooter}><Button variant="secondary">Quay lại</Button><div><Button onClick={() => setState("open")} variant="soft">Cấp tài khoản</Button><Button type="submit" variant="primary">Lưu và tiếp tục</Button></div></footer>
      </form> : <ScreenState onRetry={() => setState("filled")} screen="employee" state={state} />}
      <div className={styles.mobileSticky}><Button onClick={() => setState("success")} variant="primary">Lưu và tiếp tục</Button></div>
    </div>
  );
}

function PersonalDashboard({ state, setState }: { state: PreviewState; setState: (state: PreviewState) => void }) {
  const contentState = state === "filled" || state === "open" || state === "success";
  return (
    <div className={styles.screenBody}>
      <ContextHeader action={<Button leftIcon={<Plus aria-hidden="true" size={17} />} onClick={() => setState("success")} variant="primary">Tạo ghi chú</Button>} eyebrow="Thứ Năm, 24/09/2026" meta={<><span>Vai trò: Quản lý vận hành</span><StatusBadge tone="warning">5 việc cần xử lý</StatusBadge></>} title="Chào buổi chiều, Anh Nam" />
      <FunctionToolbar onOpen={() => setState("open")}><button className={styles.segmentActive} type="button">Hôm nay</button><button type="button">Tuần này</button></FunctionToolbar>
      {contentState ? <div className={styles.dashboardGrid}>
        <section className={`${styles.primarySurface} ${styles.attentionList}`}><header className={styles.surfaceHeader}><div><span>Ưu tiên</span><h2>Việc cần xử lý</h2></div><StatusBadge tone="warning">5</StatusBadge></header><button type="button"><span className={styles.itemIcon}><ClipboardCheck aria-hidden="true" size={18} /></span><span><strong>Duyệt điều chỉnh chấm công</strong><small>3 yêu cầu · Hạn 16:00</small></span><ChevronRight aria-hidden="true" size={18} /></button><button type="button"><span className={styles.itemIcon}><PackageCheck aria-hidden="true" size={18} /></span><span><strong>Ghi sổ phiếu nhập PN-018</strong><small>Kho trung tâm · 128.400.000 ₫</small></span><ChevronRight aria-hidden="true" size={18} /></button><button type="button"><span className={styles.itemIcon}><AlertTriangle aria-hidden="true" size={18} /></span><span><strong>Xử lý vướng mắc công trường</strong><small>Gói CT-2408 · Quá hạn 2 ngày</small></span><ChevronRight aria-hidden="true" size={18} /></button></section>
        <aside className={styles.dashboardAside}><section><header><CalendarDays aria-hidden="true" size={19} /><h2>Lịch hôm nay</h2></header><ol><li><time>09:00</time><span><strong>Họp tiến độ CT-2408</strong><small>Phòng họp 2</small></span></li><li><time>14:30</time><span><strong>Đối chiếu tồn kho</strong><small>Kho trung tâm</small></span></li></ol></section><section><header><FileCheck2 aria-hidden="true" size={19} /><h2>Gần đây</h2></header><button type="button"><span>Báo cáo tiến độ tuần 38</span><ChevronRight aria-hidden="true" size={17} /></button><button type="button"><span>Biên bản kiểm kê tháng 9</span><ChevronRight aria-hidden="true" size={17} /></button></section></aside>
      </div> : <ScreenState onRetry={() => setState("filled")} screen="dashboard" state={state} />}
      <div className={styles.mobileSticky}><Button onClick={() => setState("success")} variant="primary">Tạo ghi chú</Button></div>
    </div>
  );
}

function PrototypeDrawer({ screen, onClose }: { screen: ScreenId; onClose: () => void }) {
  const content = {
    tasks: { title: "Bộ lọc công việc", icon: ClipboardCheck },
    warehouse: { title: "Bộ lọc chứng từ", icon: Truck },
    employee: { title: "Cấp tài khoản", icon: CircleUserRound },
    dashboard: { title: "Lọc việc của tôi", icon: Filter }
  }[screen];
  const DrawerIcon = content.icon;
  return <><button aria-label="Đóng panel" className={styles.scrim} onClick={onClose} type="button" /><aside aria-label={content.title} aria-modal="false" className={styles.drawer} role="dialog"><header><span><DrawerIcon aria-hidden="true" size={19} /></span><h2>{content.title}</h2><IconButton label="Đóng" onClick={onClose}><X aria-hidden="true" size={19} /></IconButton></header><div className={styles.drawerFields}>{screen === "employee" ? <><Checkbox defaultChecked label="Tạo tài khoản đăng nhập" /><Input defaultValue="an.nguyen" label="Tên đăng nhập" /><Select defaultValue="supervisor" label="Vai trò" options={[{ label: "Giám sát công trường", value: "supervisor" }, { label: "Nhân viên", value: "employee" }]} /></> : <><Select label="Trạng thái" options={[{ label: "Đang xử lý", value: "active" }, { label: "Cần chú ý", value: "attention" }]} placeholder="Tất cả trạng thái" /><Select label="Phụ trách" options={[{ label: "Tôi phụ trách", value: "me" }, { label: "Nhóm của tôi", value: "team" }]} placeholder="Tất cả" /><Input label="Từ ngày" type="date" /></>}</div><footer><Button onClick={onClose} variant="secondary">Đặt lại</Button><Button onClick={onClose} variant="primary">Áp dụng</Button></footer></aside></>;
}

function SuccessToast({ screen, onClose }: { screen: ScreenId; onClose: () => void }) {
  const messages: Record<ScreenId, string> = { tasks: "Đã lưu cập nhật hiện trường", warehouse: "Đã lưu phiếu nhập nháp", employee: "Đã lưu hồ sơ nhân viên", dashboard: "Đã lưu ghi chú" };
  return <div aria-live="polite" className={styles.successToast} data-state-marker="success" role="status"><span><Check aria-hidden="true" size={18} /></span><strong>{messages[screen]}</strong><IconButton label="Đóng thông báo" onClick={onClose}><X aria-hidden="true" size={17} /></IconButton></div>;
}

export function GoldenVisualPrototype() {
  const [screen, setScreen] = useState<ScreenId>("tasks");
  const [previewState, setPreviewState] = useState<PreviewState>("filled");
  const [collapsed, setCollapsed] = useState(false);

  function chooseScreen(next: ScreenId) { setScreen(next); setPreviewState("filled"); }
  const screenProps = { state: previewState, setState: setPreviewState };

  return (
    <main className={styles.studio}>
      <section className={styles.studioControls} data-prototype-controls>
        <div><span>Golden candidate A · V1</span><strong>Refined Industrial ERP</strong></div>
        <div aria-label="Chọn màn hình" className={styles.controlGroup} role="group">{screens.map(({ id, label, icon: Icon }) => <button aria-pressed={screen === id} key={id} onClick={() => chooseScreen(id)} type="button"><Icon aria-hidden="true" size={16} />{label}</button>)}</div>
        <div aria-label="Chọn trạng thái" className={styles.stateSelect}><label htmlFor="golden-state">Trạng thái</label><select id="golden-state" onChange={(event) => setPreviewState(event.target.value as PreviewState)} value={previewState}>{previewStates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
      </section>
      <section className={styles.canvas} data-golden-canvas data-golden-screen={screen} data-golden-state={previewState}>
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} screen={screen} />
        <div className={styles.appArea}><AppTopbar />{screen === "tasks" ? <TaskWorkspace {...screenProps} /> : screen === "warehouse" ? <WarehouseWorklist {...screenProps} /> : screen === "employee" ? <EmployeeWizard {...screenProps} /> : <PersonalDashboard {...screenProps} />}</div>
        {previewState === "open" ? <PrototypeDrawer onClose={() => setPreviewState("filled")} screen={screen} /> : null}
        {previewState === "success" ? <SuccessToast onClose={() => setPreviewState("filled")} screen={screen} /> : null}
      </section>
    </main>
  );
}

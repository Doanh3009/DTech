import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, "src", "app", "(app)");

async function collectPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await collectPages(target));
    if (entry.isFile() && entry.name === "page.tsx") pages.push(target);
  }
  return pages;
}

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTsxFiles(target));
    if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(target);
  }
  return files;
}

function routeFor(file) {
  const relative = path.relative(appRoot, path.dirname(file)).replaceAll(path.sep, "/");
  return relative ? `/${relative}` : "/";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pages = await collectPages(appRoot);
const classifications = { direct: [], delegated: [], redirect: [] };

for (const file of pages) {
  const source = await readFile(file, "utf8");
  const route = routeFor(file);
  if (/\bredirect\s*\(/.test(source)) classifications.redirect.push(route);
  else if (/<(?:PageHeader|h1)\b/.test(source)) classifications.direct.push(route);
  else if (/from\s*["']@\/(?:features|components)\//.test(source) || /export\s*\{\s*default\s*\}\s*from\s*["']\.\.\/page["']/.test(source)) classifications.delegated.push(route);
  else throw new Error(`Route ${route} không có title owner trực tiếp, redirect hoặc component được ủy quyền.`);
}

const [header, shell, rail, registry, layout, css, themeCss, tokenCss, employeePage, employeeFilters, employeeTable, dashboardView, workbench, dataTable, moduleRegistry, moduleIconRegistry, moduleLauncher, backLink, overlays, warehouseViews, importExportViews] = await Promise.all([
  readFile(path.join(root, "src/components/layout/AppHeader.tsx"), "utf8"),
  readFile(path.join(root, "src/components/layout/AppShell.tsx"), "utf8"),
  readFile(path.join(root, "src/components/layout/AppRail.tsx"), "utf8"),
  readFile(path.join(root, "src/config/routeRegistry.ts"), "utf8"),
  readFile(path.join(root, "src/app/layout.tsx"), "utf8"),
  readFile(path.join(root, "src/app/globals.css"), "utf8"),
  readFile(path.join(root, "src/app/theme.css"), "utf8"),
  readFile(path.join(root, "src/styles/tokens.css"), "utf8"),
  readFile(path.join(root, "src/features/employees/pages/EmployeeListPage.tsx"), "utf8"),
  readFile(path.join(root, "src/features/employees/components/EmployeeListFilters.tsx"), "utf8"),
  readFile(path.join(root, "src/features/employees/components/EmployeeListTable.tsx"), "utf8"),
  readFile(path.join(root, "src/features/dashboard/components/DashboardView.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/Workbench.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/DataTable.tsx"), "utf8"),
  readFile(path.join(root, "src/config/moduleRegistry.ts"), "utf8"),
  readFile(path.join(root, "src/config/moduleIconRegistry.ts"), "utf8"),
  readFile(path.join(root, "src/components/shared/ModuleLauncher.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/BackLink.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/Overlays.tsx"), "utf8"),
  readFile(path.join(root, "src/features/warehouse/components/WarehouseListViews.tsx"), "utf8"),
  readFile(path.join(root, "src/features/import-export/components/ImportExportViews.tsx"), "utf8")
]);

const [actionBars, pageHeader, filterBar, imageUploader, workerAttendanceWizard, loadingExperience, formControls, formLayout, uiPlayground, loginForm, passwordForm] = await Promise.all([
  readFile(path.join(root, "src/components/shared/ActionBars.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/PageHeader.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/FilterBar.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/ImageUploader.tsx"), "utf8"),
  readFile(path.join(root, "src/features/worker-attendance/components/WorkerAttendanceWizard.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/LoadingExperience.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/FormControls.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/FormLayout.tsx"), "utf8"),
  readFile(path.join(root, "src/components/shared/UiPlayground.tsx"), "utf8"),
  readFile(path.join(root, "src/features/auth/components/LoginForm.tsx"), "utf8"),
  readFile(path.join(root, "src/features/auth/components/ChangePasswordForm.tsx"), "utf8")
]);

assert(!/applicationForPath/.test(header), "Topbar đang sở hữu lại tên ứng dụng/route.");
assert(!/app-header__(?:identity|application)/.test(header), "Topbar đang render lại khối định danh ứng dụng.");
assert(/app-header__mobile-leading/.test(header) && /app-header__mobile-title/.test(header) && /<AppLogo compact href="\/personal"/.test(header), "Topbar mobile phải có một tên route gọn trong header và điều hướng về Cá nhân.");
assert(!/\bBreadcrumb\b|\bgetBreadcrumbs\b|page-breadcrumb/.test(shell), "AppShell vẫn render đường dẫn breadcrumb.");
assert(/getBackHref/.test(shell) && /<BackLink\s+href=\{backHref\}/.test(shell), "AppShell chưa bảo đảm nút Trở lại cho mọi route nghiệp vụ.");
assert(/href\s*=\s*\{href\}/.test(backLink), "BackLink chưa dùng route cha an toàn được truyền vào.");
assert(!/<AppSidebar/.test(shell), "AppShell vẫn render sidebar trắng thứ hai.");
assert(/contextualNavigationGroups/.test(rail), "Sidebar chính chưa dùng menu module theo ngữ cảnh.");
assert(/pathname\s*===\s*["']\/dashboard["'][\s\S]{0,80}?return\s*\[\]/.test(registry), "Dashboard vẫn sinh breadcrumb lặp.");
assert(/@fontsource\/inter\/400\.css/.test(layout), "Thiếu Inter đầy đủ Latin + Vietnamese 400.");
assert(/@fontsource\/inter\/500\.css/.test(layout), "Thiếu Inter đầy đủ Latin + Vietnamese 500.");
assert(/@fontsource\/inter\/600\.css/.test(layout), "Thiếu Inter đầy đủ Latin + Vietnamese 600.");
assert(!/@fontsource\/inter\/700\.css/.test(layout), "Visual direction mới không tải Inter 700 mặc định.");
assert(!/@fontsource\/inter\/vietnamese-(?:400|500|600)\.css/.test(layout), "Không được dùng riêng subset Vietnamese vì sẽ thiếu glyph Latin.");
assert(/--topbar-height:\s*56px/.test(tokenCss), "Topbar ERP phải dùng token 56px.");
assert(!/top:\s*(?:58|66)px/.test(css), "Vẫn còn sticky offset hardcode 58/66px.");
assert(/<EmployeeListFilters/.test(employeePage) && /className=["']employee-filter-bar["']/.test(employeeFilters), "Màn Nhân viên chưa dùng compact filter toolbar trên đầu bảng.");
assert((employeeFilters.match(/\blabelHidden\b/g) ?? []).length === 4, "Bốn select lọc Nhân viên chưa giữ label accessible dạng compact.");
assert(/className=["']employee-table["']/.test(employeeTable), "Bảng Nhân viên chưa có contract độ rộng riêng.");
assert(!/\bid:\s*["']joinDate["']/.test(employeeTable), "Bảng Nhân viên vẫn còn cột Ngày vào làm.");
assert(/\.page-main \.data-table-scroll[^{}]*\{[^}]*overflow-x:\s*auto/.test(themeCss), "Bảng dữ liệu chưa có chiến lược cuộn ngang khi cần.");
assert(/\.employee-table \.data-table,[\s\S]{0,180}?min-width:\s*0/.test(css), "Bảng Nhân viên chưa co vừa vùng nội dung.");
assert(/const widgets = model\?\.widgets \?\? \[\]/.test(dashboardView) && !/dashboardModuleFor/.test(dashboardView), "Dashboard chưa dùng dữ liệu tổng hợp theo vai trò.");
assert(/styles\.metrics/.test(dashboardView) && /slice\(0, 5\)/.test(dashboardView), "Dashboard chưa giới hạn năm chỉ số thực theo mẫu tham chiếu.");
assert(/<ModuleChart/.test(dashboardView) && /styles\.chartGrid/.test(dashboardView) && /overviewChart/.test(dashboardView) && /secondaryChart/.test(dashboardView), "Dashboard chưa giới hạn hai biểu đồ từ dữ liệu theo vai trò.");
assert(!/QuickActions|PersonalTodoWidget|PersonalNoteWidget|InboxTable|ScheduleWidget/.test(dashboardView), "Dashboard vẫn còn danh sách hoặc biểu mẫu không thuộc tổng quan phân hệ.");
assert(/<ModuleLauncher/.test(dashboardView), "Dashboard thiếu ô ứng dụng.");
assert(/model\?\.attention/.test(dashboardView), "Dashboard chưa hiển thị việc cần xử lý theo vai trò.");
assert(/visibleApplications/.test(moduleLauncher) && /application\.id\s*!==\s*["']overview["']/.test(moduleLauncher), "Ứng dụng của tôi chưa lọc theo quyền hoặc vẫn tự liên kết Dashboard.");
assert(/moduleIconRegistry/.test(moduleIconRegistry) && /ModuleIconDefinition/.test(moduleIconRegistry), "Thiếu ModuleIconRegistry tập trung.");
assert(/\.module-icon-card:hover/.test(themeCss) && /translateY\(-2px\)/.test(themeCss), "Module card thiếu phản hồi hover ổn định.");
assert(!/WarehouseDashboardView/.test(warehouseViews) && !/ImportExportDashboardView/.test(importExportViews), "Dashboard module cũ chưa được loại bỏ.");
assert(/operational-section__body/.test(workbench), "Panel nghiệp vụ chưa tách header và body.");
assert(/--app-bg:\s*#f0fdfa/.test(tokenCss), "App background chưa dùng trust-teal enterprise token.");
assert(/--radius-card:\s*12px/.test(tokenCss) && /--radius-card-large:\s*16px/.test(tokenCss), "Card radius chưa được khóa ở token enterprise 12/16px.");
assert(/--radius-control:\s*9px/.test(tokenCss) && /--control-height-md:\s*44px/.test(tokenCss), "Control geometry chưa đi qua token chung.");
assert(/--sidebar-width:\s*232px/.test(tokenCss) && /--sidebar-collapsed-width:\s*84px/.test(tokenCss), "Sidebar mở rộng và rail icon mẫu chưa đi qua token chung.");
assert(/--reference-surface:/.test(tokenCss) && /--reference-shadow:/.test(tokenCss) && /--reference-orange:/.test(tokenCss), "Thiếu hệ vật liệu mềm và màu điểm nhấn theo mẫu.");
assert(/--erp-primary:\s*#0f766e/.test(tokenCss) && /--erp-data-blue:\s*#2563eb/.test(tokenCss) && /--erp-attention:\s*#ea580c/.test(tokenCss), "Thiếu trust teal/blue/orange palette theo design system.");
assert(/\.page-main \.page-header/.test(themeCss) && /font-weight:\s*600/.test(themeCss), "Thiếu theme chung nhẹ cho tiêu đề trang.");
assert(/onDoubleClick/.test(dataTable) && /event\.key\s*===\s*["']Enter["']/.test(dataTable), "Bảng dữ liệu chưa hỗ trợ mở bản ghi bằng double-click và Enter.");
assert(/actionLabel\s*=\s*["']Thao tác["']/.test(dataTable), "Cột thao tác chưa có nhãn nhất quán.");
assert(/keepFocusInside/.test(overlays) && /acquireBodyScrollLock/.test(overlays), "Popup chưa khóa cuộn nền an toàn hoặc giữ focus trong hộp thoại.");
assert(/applicationsForLauncher/.test(moduleRegistry) && /accessible/.test(moduleRegistry), "Registry chưa giữ ứng dụng bị khóa trong launcher.");
assert(!/href=["']\/workspace["']/.test(rail) && !/href=["']\/workspace["']/.test(moduleLauncher), "Màn component vẫn còn liên kết trong shell hoặc Dashboard.");

assert(/function PageActionBar/.test(actionBars) && /function TableActionBar/.test(actionBars) && /function CompactActionMenu/.test(actionBars) && /function ActionButton/.test(actionBars), "Thiếu shared action bar contract.");
assert(/<PageActionBar>\{action\}<\/PageActionBar>/.test(pageHeader) && /<TableActionBar className=["']filter-bar__actions["']>/.test(filterBar), "PageHeader hoặc FilterBar chưa dùng action bar chung.");
assert(/URL\.createObjectURL/.test(imageUploader) && /URL\.revokeObjectURL/.test(imageUploader) && /onRetry/.test(imageUploader) && /role=["']progressbar["']/.test(imageUploader), "ImageUploader thiếu preview, cleanup, retry hoặc progress.");
assert(/<ImageUploader/.test(workerAttendanceWizard) && /capture=["']environment["']/.test(workerAttendanceWizard), "Ảnh điểm danh công trường chưa dùng ImageUploader chung.");
assert(/GlobalRouteLoader\s*=/.test(loadingExperience) && /function PageSkeleton/.test(loadingExperience) && /function TableSkeleton/.test(loadingExperience) && /function ChartSkeleton/.test(loadingExperience), "Thiếu loading experience dùng chung.");
assert(/function PasswordInput/.test(formControls) && /<PasswordInput/.test(loginForm) && /<PasswordInput/.test(passwordForm), "PasswordInput chưa được dùng nhất quán.");
assert(/id \?\? generatedId/.test(formControls) && /role=["']alert["']/.test(formControls), "Form controls chưa giữ custom id hoặc chưa công bố lỗi nội tuyến.");
assert(/data-readonly/.test(formControls) && /data-disabled/.test(formControls), "Form controls chưa phân biệt read-only và disabled.");
assert(/function FormErrorSummary/.test(formLayout) && /href=\{`#\$\{error\.fieldId\}`\}/.test(formLayout), "Thiếu error summary liên kết về trường lỗi.");
assert(/\.field__required/.test(themeCss) && /:read-only/.test(themeCss) && /:disabled/.test(themeCss), "Theme chưa bao phủ trạng thái trường ERP.");
assert(/\.form-error-summary/.test(themeCss) && /\.erp-choice-group/.test(themeCss), "Theme thiếu validation summary hoặc nhóm lựa chọn ERP.");
assert(/<FormErrorSummary/.test(uiPlayground) && /<StickyActionBar/.test(uiPlayground) && /<FilterBar/.test(uiPlayground), "UI preview chưa bao phủ form, bộ lọc và thanh lưu ERP.");

const featureFiles = await collectTsxFiles(path.join(root, "src", "features"));
const nativeTableAllowlist = new Set([
  // Accessible chart data fallback; not an interactive business listing.
  "src/features/dashboard/components/ModuleChart.tsx",
  "src/features/projects/components/package-workspace/PackageAttendanceWorkspace.tsx",
  "src/features/timesheets/components/CalendarSettings.tsx",
  "src/features/timesheets/components/TimesheetMatrix.tsx",
  "src/features/warehouse/components/StockCountEditor.tsx"
]);
const nativeTables = [];
for (const file of featureFiles) {
  const source = await readFile(file, "utf8");
  if (/<table\b/.test(source)) nativeTables.push(path.relative(root, file).replaceAll(path.sep, "/"));
  assert(!/(?:rounded|bg|text|shadow|p|gap)-\[/.test(source), `Arbitrary visual value còn trong ${path.relative(root, file)}.`);
}
assert(nativeTables.every((file) => nativeTableAllowlist.has(file)), `Standard table chưa migrate sang DataTable: ${nativeTables.filter((file) => !nativeTableAllowlist.has(file)).join(", ")}`);
assert(nativeTables.length === nativeTableAllowlist.size, "Native table allowlist đã thay đổi; cập nhật audit sau khi kiểm tra loại bảng.");

console.log(`PASS ${pages.length} authenticated routes`);
console.log(`  title trực tiếp: ${classifications.direct.length}`);
console.log(`  title trong component được ủy quyền: ${classifications.delegated.length}`);
console.log(`  redirect: ${classifications.redirect.length}`);
console.log("PASS UI/UX Pro Max enterprise ERP theme, data-rich dashboard, responsive tables và Inter contract");
console.log(`PASS standard tables use DataTable; ${nativeTableAllowlist.size} specialized attendance/calendar/matrix/editor/chart tables remain native`);

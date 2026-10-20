import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, "src", "app", "(app)");

async function collect(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(target, predicate));
    if (entry.isFile() && predicate(entry.name)) files.push(target);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function routeFor(file) {
  const relative = path.relative(appRoot, path.dirname(file)).replaceAll(path.sep, "/");
  return relative ? `/${relative}` : "/";
}

async function assertContract(relativeFile, markers) {
  const source = await readFile(path.join(root, relativeFile), "utf8");
  for (const marker of markers) {
    assert(source.includes(marker), `${relativeFile} thiếu screen contract: ${marker}`);
  }
}

const pages = await collect(appRoot, (name) => name === "page.tsx");
const pageSources = await Promise.all(pages.map(async (file) => ({
  file,
  route: routeFor(file),
  source: await readFile(file, "utf8")
})));

for (const page of pageSources) {
  assert(!/PlaceholderPage|SettingsPlaceholderPage/.test(page.source), `Route ${page.route} vẫn dùng placeholder.`);
  assert(!/coming soon|sắp ra mắt|đang phát triển/i.test(page.source), `Route ${page.route} còn nội dung tạm.`);
  assert(
    /\bredirect\s*\(|<(?:PageHeader|h1)\b|from\s*["']@\/(?:features|components)\//.test(page.source) || /export\s*\{\s*default\s*\}\s*from/.test(page.source),
    `Route ${page.route} chưa có screen owner.`
  );
}

const families = [
  ["Dashboard / workspace", /^\/(?:dashboard|home|workspace)/],
  ["HR", /^\/employees/],
  ["Attendance / timesheet / leave", /^\/(?:attendance|timesheets|shifts|leave)/],
  ["Projects / field attendance", /^\/(?:projects|project-monitoring|worker-attendance)/],
  ["Warehouse", /^\/warehouse/],
  ["Import export / partners", /^\/import-export/],
  ["Accounting", /^\/accounting/],
  ["Messaging / notifications", /^\/(?:messages|notifications)/],
  ["Operations", /^\/(?:approvals|documents|reports)/],
  ["Profile / search", /^\/(?:profile|search|command)/],
  ["Administration", /^\/(?:settings|system-admin)/]
];

const counts = new Map(families.map(([name]) => [name, 0]));
let supporting = 0;
for (const { route } of pageSources) {
  const family = families.find(([, pattern]) => pattern.test(route));
  if (family) counts.set(family[0], (counts.get(family[0]) ?? 0) + 1);
  else supporting += 1;
}

await Promise.all([
  assertContract("src/features/dashboard/components/DashboardView.tsx", ["model?.widgets", "model?.attention", "styles.metrics", "styles.chartGrid", "<ModuleChart", "<ModuleLauncher"]),
  assertContract("src/features/employees/pages/EmployeeDetailPage.tsx", ["EmployeeAttendanceTab", "EmployeeProjectsTab", "<Tabs", "PermissionDeniedState", "EmptyState"]),
  assertContract("src/features/attendance/components/AttendanceCameraExperience.tsx", ["capturedOffline", "LoadingState", "ErrorState", "attendance-success-card"]),
  assertContract("src/features/timesheets/components/TimesheetPeriodDetail.tsx", ["StatusBadge", "EntityContextHeader", "ContextTabs", "LoadingState", "ErrorState", "disabled={busy}"]),
  assertContract("src/features/leave/components/LeaveRequestDetail.tsx", ["LoadingState", "ErrorState", "styles.timeline", "item.approvalSteps.map", "router.refresh"]),
  assertContract("src/features/projects/components/package-workspace/PackageWorkspace.tsx", ["PackageConstructionWorkspace", "PackageAttendanceWorkspace", "PackageDocumentWorkspace", "PackageRecordWorkspace", "PermissionDeniedState"]),
  assertContract("src/features/projects/components/package-workspace/PackageContextHeader.tsx", ["StatusBadge", "EntityContextHeader", "Select"]),
  assertContract("src/features/projects/components/package-workspace/PackageRecordWorkspace.tsx", ["ProjectHealthControl", "healthDisplay", "Thông tin gói"]),
  assertContract("src/features/warehouse/components/InventoryDocumentEditor.tsx", ["warehouse-document-heading", "StatusBadge", "disabled={busy}"]),
  assertContract("src/features/warehouse/components/StockCountEditor.tsx", ["LoadingState", "ErrorState", "data-table-scroll", "disabled={busy}"]),
  assertContract("src/features/import-export/components/ImportExportViews.tsx", ["DataTable", "StatusBadge", "emptyTitle", "Tabs"]),
  assertContract("src/features/messaging/MessageCenter.tsx", ["message-center", "ImageUploader", "sending", "postgres_changes"]),
  assertContract("src/features/shared-platforms/components/NotificationCenter.tsx", ["LoadingState", "ErrorState", "EmptyState", "useDomainReconciliation"]),
  assertContract("src/app/(app)/profile/page.tsx", ["<PageHeader", "self-profile-card", "ChangePasswordForm", "PersonalUiSettings"]),
  assertContract("src/components/shared/DataTable.tsx", ["aria-sort", "mobile-record-list", "emptyTitle", "ErrorState"]),
  assertContract("src/components/shared/LoadingExperience.tsx", ["PageSkeleton", "TableSkeleton", "ModuleTransition"]),
  assertContract("src/components/shared/States.tsx", ["EmptyState", "LoadingState", "ErrorState", "PermissionDeniedState", "OfflineState"]),
  assertContract("src/components/shared/ImageUploader.tsx", ["URL.createObjectURL", "URL.revokeObjectURL", "role=\"progressbar\"", "onRetry"])
]);

const featureFiles = await collect(path.join(root, "src", "features"), (name) => name.endsWith(".tsx"));
let sharedStateConsumers = 0;
let statusConsumers = 0;
for (const file of featureFiles) {
  const source = await readFile(file, "utf8");
  if (/EmptyState|LoadingState|ErrorState|PermissionDeniedState|OfflineState/.test(source)) sharedStateConsumers += 1;
  if (/\bStatusBadge\b/.test(source)) statusConsumers += 1;
}

assert(sharedStateConsumers >= 28, `State coverage giảm còn ${sharedStateConsumers} feature files.`);
assert(statusConsumers >= 50, `Status coverage giảm còn ${statusConsumers} feature files.`);

console.log(`PASS ${pages.length} authenticated screens · no route placeholder or temporary copy`);
for (const [name, count] of counts) console.log(`  ${name}: ${count}`);
console.log(`  Supporting routes: ${supporting}`);
console.log(`PASS critical screen contracts · ${sharedStateConsumers} state consumers · ${statusConsumers} status consumers`);
console.log("PASS dashboard, detail, process, responsive table, upload and realtime presentation contracts");

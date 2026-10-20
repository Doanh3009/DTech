import { existsSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";

const required = [
  "src/styles/tokens.css",
  "src/styles/enterprise.css",
  "src/components/shared/FloatingPanel.tsx",
  "src/components/shared/SelectControl.tsx",
  "src/components/shared/Button.tsx",
  "src/components/shared/FormControls.tsx",
  "src/components/shared/DataTable.tsx",
  "src/components/shared/FilterBar.tsx",
  "src/components/shared/PageHeader.tsx",
  "src/components/shared/PageLayouts.tsx",
  "src/components/shared/Primitives.tsx",
  "src/components/shared/StatusBadge.tsx",
  "src/components/shared/Overlays.tsx",
  "src/components/layout/AppShell.tsx"
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`Missing centralized UI building block: ${file}`);
}

const uiCoreContracts = [
  ["src/components/shared/PageHeader.tsx", ["ResponsivePageHeader", "EntityContextHeader"]],
  ["src/components/shared/Tabs.tsx", ["ContextTabs", "aria-current"]],
  ["src/components/shared/ActionBars.tsx", ["FunctionToolbar", "export function ActionBar"]],
  ["src/components/shared/DataTable.tsx", ["export function Worklist"]],
  ["src/components/shared/FormLayout.tsx", ["export function FieldGroup"]],
  ["src/components/shared/FilterBar.tsx", ["export function FilterSheet"]],
  ["src/components/shared/Uploads.tsx", ["export function UploadPreview"]],
  ["src/components/shared/States.tsx", ["export const NoPermission"]]
];
for (const [file, markers] of uiCoreContracts) {
  const source = readFileSync(file, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`UI Core contract ${marker} missing from ${file}`);
  }
}

const realConsumers = [
  ["src/features/employees/pages/EmployeeListPage.tsx", "ResponsivePageHeader"],
  ["src/features/employees/components/EmployeeListTable.tsx", "Worklist"],
  ["src/features/projects/components/package-workspace/PackageContextHeader.tsx", "EntityContextHeader"],
  ["src/features/projects/components/package-workspace/WorkspaceNav.tsx", "ContextTabs"]
];
for (const [file, marker] of realConsumers) {
  if (!readFileSync(file, "utf8").includes(marker)) throw new Error(`UI Core contract ${marker} has no verified business consumer in ${file}`);
}

const mobileBottomNav = readFileSync("src/components/layout/MobileBottomNav.tsx", "utf8");
if (!mobileBottomNav.includes("resolveMobileNavigation(pathname, user)") || !mobileBottomNav.includes("activeMobileDestination(pathname, model)")) {
  throw new Error("Mobile navigation must use the shared route and permission resolver.");
}

const tokens = readFileSync("src/styles/tokens.css", "utf8");
for (const token of ["--font-family-sans", "--font-body", "--page-padding-x", "--section-gap", "--radius-card", "--shadow-card", "--control-height-md", "--container-max-width", "--sidebar-width", "--table-row-height", "--z-modal", "--breakpoint-sm", "--motion-fast"]) {
  if (!tokens.includes(token)) throw new Error(`Missing required token: ${token}`);
}

for (const file of ["src/app/globals.css", "src/app/theme.css"]) {
  if (/^:root\s*\{/m.test(readFileSync(file, "utf8"))) {
    throw new Error(`${file} defines runtime tokens. Move them to src/styles/tokens.css.`);
  }
}

const uiFiles = globSync("src/**/*.{tsx,css}", { nodir: true });
const normalize = (file) => file.replaceAll("\\", "/");
const inlineStyleFiles = uiFiles
  .filter((file) => file.endsWith(".tsx") && readFileSync(file, "utf8").includes("style={{"))
  .map(normalize);
const cssModuleFiles = uiFiles.filter((file) => file.endsWith(".module.css"));
const pageCount = globSync("src/app/**/page.tsx", { nodir: true }).length;

const inlineStyleAllowlist = new Set([
  "src/components/layout/AppRail.tsx",
  "src/components/shared/LoadingExperience.tsx",
  "src/features/accounting/components/AccountingOverview.tsx",
  "src/features/dashboard/components/DashboardView.tsx",
  "src/features/dashboard/components/ModuleChart.tsx",
  "src/features/employees/pages/EmployeeDetailPage.tsx",
  "src/features/projects/components/ProjectProgressTree.tsx",
  "src/features/projects/components/ProjectPeopleAttendanceWorkspace.tsx",
  "src/features/projects/components/package-workspace/PackageAttendanceWorkspace.tsx",
  "src/features/projects/components/package-workspace/PackageConstructionWorkspace.tsx",
  "src/features/projects/pages/ProjectMonitoringPage.tsx",
  "src/features/system-admin/pages/AppearancePage.tsx",
  "src/features/system-admin/pages/PayslipTemplatePage.tsx"
]);
const unexpectedInlineStyles = inlineStyleFiles.filter((file) => !inlineStyleAllowlist.has(file));
if (unexpectedInlineStyles.length) throw new Error(`Unexpected inline presentation styles: ${unexpectedInlineStyles.join(", ")}`);

const manualPageHeaders = uiFiles
  .filter((file) => file.endsWith(".tsx") && normalize(file) !== "src/components/shared/PageHeader.tsx")
  .map((file) => ({ file: normalize(file), source: readFileSync(file, "utf8") }))
  .filter(({ source }) => source.includes('className="page-header"') || source.includes('className="page-header__copy"'));
if (manualPageHeaders.length) throw new Error(`Manual PageHeader duplicates: ${manualPageHeaders.map(({ file }) => file).join(", ")}`);

const nativeTableAllowlist = new Set([
  "src/features/dashboard/components/ModuleChart.tsx",
  "src/features/projects/components/package-workspace/PackageAttendanceWorkspace.tsx",
  "src/features/timesheets/components/CalendarSettings.tsx",
  "src/features/timesheets/components/TimesheetMatrix.tsx",
  "src/features/warehouse/components/StockCountEditor.tsx"
]);
const nativeFeatureTables = uiFiles
  .filter((file) => file.endsWith(".tsx") && readFileSync(file, "utf8").includes("<table"))
  .map(normalize)
  .filter((file) => file !== "src/components/shared/DataTable.tsx");
const unexpectedNativeTables = nativeFeatureTables.filter((file) => !nativeTableAllowlist.has(file));
if (unexpectedNativeTables.length) throw new Error(`Feature tables must use DataTable or be allowlisted: ${unexpectedNativeTables.join(", ")}`);

const rawColorFiles = uiFiles
  .filter((file) => file.endsWith(".tsx") && /#[\da-f]{6,8}\b/i.test(readFileSync(file, "utf8")))
  .map(normalize)
  .filter((file) => file !== "src/features/system-admin/pages/AppearancePage.tsx");
if (rawColorFiles.length) throw new Error(`Raw colors in feature JSX: ${rawColorFiles.join(", ")}`);

const nativeFeatureSelects = uiFiles.filter((file) => file.endsWith(".tsx") && normalize(file).startsWith("src/features/") && /<select\b|<datalist\b/.test(readFileSync(file, "utf8")));
if (nativeFeatureSelects.length) throw new Error(`Feature choices must use the shared Select/Combobox: ${nativeFeatureSelects.join(", ")}`);
const shell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
if (/app-content--mobile-blocked|isMobilePersonalRoute/.test(shell)) throw new Error("Business screens must remain available on mobile within the same RBAC.");
const header = readFileSync("src/components/layout/AppHeader.tsx", "utf8");
if (header.includes("QuickCreateMenu")) throw new Error("Creation belongs in the owning page header.");
const pageHeader = readFileSync("src/components/shared/PageHeader.tsx", "utf8");
if (/<h1 className="sr-only"/.test(pageHeader)) throw new Error("PageHeader must render the actual visible main title.");

console.log(`PASS centralized UI architecture · ${pageCount} pages · ${uiFiles.length} UI files`);
console.log(`PASS PageHeader has no manual duplicates · ${nativeFeatureTables.length} specialized native tables allowlisted`);
console.log(`INFO reviewed runtime/data-driven inline-style files: ${inlineStyleFiles.length}`);
console.log(`INFO CSS modules found: ${cssModuleFiles.length}`);

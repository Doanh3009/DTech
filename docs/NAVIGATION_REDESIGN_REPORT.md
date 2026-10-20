# NAVIGATION REDESIGN REPORT

## Icon duplicates found

| Conflicting meaning | Previous icon | Why it was ambiguous |
| --- | --- | --- |
| Social insurance / leave | `Umbrella` | Two unrelated HR tasks looked identical when collapsed. |
| Department / warehouse | `Building2` | Organization structure and physical storage shared one silhouette. |
| Position / payslip | `BadgeCheck` | Job title and payroll document had no distinct information scent. |
| My requests / stock count | `ClipboardList` | Personal workflow and inventory operation appeared interchangeable. |
| Timesheet / payroll | `Table2` | Adjacent data-heavy functions used the same grid metaphor. |
| Project updates / integrations | `GitBranch` | Activity feed and system connection shared a technical icon. |
| Documents / import documents | `Files` | General records and shipment documents were indistinguishable. |
| Inventory adjustment / settings | `SlidersHorizontal` | Operational transaction looked like configuration. |
| Warehouse ledger / system audit | `ScrollText` | Inventory movement and security audit shared one log icon. |

## Icon replacements

| Function | Semantic icon |
| --- | --- |
| Position | `IdCard` |
| Social insurance | `HeartPulse` |
| Personal leave / leave management | `CalendarOff` / `CalendarCheck` |
| My requests | `Send` |
| Timesheet matrix | `TableProperties` |
| Attendance log | `FileClock` |
| Project updates / monitoring | `Newspaper` / `ChartSpline` |
| Warehouse / adjustment / stock count / ledger | `Warehouse` / `Scale` / `ScanLine` / `BookOpenCheck` |
| Purchase contract / shipment documents | `Handshake` / `FolderArchive` |
| Payroll / payslip | `Calculator` / `ReceiptText` |
| General documents / reports | `Library` / `ChartNoAxesCombined` |
| Integrations / import-export settings / system audit | `Cable` / `PackageCheck` / `ShieldAlert` |

Sibling items in every desktop navigation group are now guarded by a unit test requiring distinct icons.

## Module identity system

- A single `moduleIconRegistry` defines the icon, restrained accent and soft surface for all ten application identities.
- Dashboard, HR, personal attendance, projects, warehouse, import-export, accounting, messaging, operations and system administration use distinct semantic icons.
- Module accents now reference design tokens instead of raw colors.
- App Rail, module launcher and mobile navigation resolve icons from the same Lucide registry.
- Navigation icon sizes are centralized in `navigationIconSizes`.

## Sidebar expanded changes

- Existing permission-aware contextual groups remain the source of truth.
- Active state combines background, inset border, accent bar, icon and text emphasis.
- Hover/focus feedback does not change layout or swap icons.
- Brand identity stays in the rail; the desktop header does not repeat a large logo.

## Sidebar collapsed changes

- Labels are removed completely instead of being visually clipped.
- Every item keeps an accessible name and receives a keyboard/mouse tooltip rendered through a portal so the rail scroll container cannot clip it.
- Group separators remain visible and labelled for assistive technology.
- The active item retains a strong shape and accent indicator in peripheral vision.

## Mobile navigation changes

- Bottom navigation remains limited to four permission/role-selected functions plus “Thêm”.
- The More drawer reuses the same groups, icons, active-route logic and permission filtering as desktop.
- Drawer links now expose `aria-current`; personal leave uses the same `CalendarOff` identity as desktop.

## Permission handling

- Navigation items are filtered by direct, alternative and alternative-list permissions before rendering.
- Disabled modules and configured hidden items are filtered before groups are produced.
- Empty groups are removed, so collapsed separators and mobile sections never become orphaned.
- Sidebar preference remains persisted by the existing shell architecture.

## Remaining UX risks

- Notification counts are not shown in the rail because no reliable per-route count is available; no synthetic badges were introduced.
- Final recognition speed should be observed with real users familiar with the ERP vocabulary, especially for `Scale`, `ScanLine` and `PackageCheck`.
- Very short desktop viewports should be checked with the largest permission set, although the rail remains vertically scrollable.


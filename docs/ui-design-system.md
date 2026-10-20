# Châu Tuấn ERP — UI design system

Updated 2026-10-03. The authenticated workspace follows the supplied pearl dashboard reference: a gray canvas with pink, peach and lilac haze, translucent white-edged surfaces, soft highlight/shadow pairs, collapsible navigation and colored KPI rings. Operational data and existing permissions determine the content.

## Ownership and cascade

1. `src/styles/tokens.css` owns primitive and semantic values: color, type, spacing, density, radius, depth and shell geometry.
2. `src/app/theme.css` maps compatibility classes and configured appearance settings to those tokens.
3. `src/app/mobile.css` provides responsive compatibility for specialized workflows.
4. `src/styles/enterprise.css`, imported last in the root layout, owns the final shared workspace appearance. Feature CSS owns specialized composition, not a second palette or control skin.
5. Shared primitives and enterprise components compose dashboard/list/form/detail/report templates. Feature code owns data, business validation and permission checks.

Keep existing CSS as a compatibility layer. Fix shared controls in their shared component or canonical stylesheet instead of adding a page-specific override.

## Tokens

| Concern | Canonical tokens / owner |
| --- | --- |
| Workspace | `--workspace-canvas`, `--surface`, `--surface-elevated`, `--surface-border` |
| Reference material | `--reference-surface`, `--reference-border`, `--reference-shadow`, `--reference-control-shadow`, `--reference-panel-radius` |
| Reference charts | `--reference-orange`, `--reference-cyan`, `--reference-yellow`, `--reference-green`, `--reference-violet`, `--reference-ring-track` |
| Brand | Configurable `--primary`, `--primary-hover`, `--primary-soft`; appearance settings remain authoritative |
| Status | `--success`, `--warning`, `--danger`, `--info` with soft partners; always show text |
| Data | Semantic `dataVisualizationPalette`, preserving point tone |
| Typography | Inter; `--font-page`, `--font-section`, `--font-card`, `--font-body`, `--font-meta`; tabular figures |
| Spacing | `--space-*`, `--page-padding-*`, `--section-gap`, `--grid-gap`, `--card-padding` |
| Geometry | `--radius-control`, `--radius-card`, `--radius-card-large`, `--radius-panel`; full-width working surfaces |
| Depth | `--shadow-sm`, `--shadow-md`, `--shadow-card`, `--shadow-card-hover`, `--shadow-floating`, `--shadow-control` |
| Shell | `--sidebar-width`, `--sidebar-collapsed-width`, `--topbar-height` (56px) |
| Controls | `--control-height-*`; phone controls and primary touch targets at least 44px |
| Tables | `--table-header-height`, `--table-row-height`, `--table-cell-padding-x` |
| Motion | `--motion-*`, `--ease-*`; respect reduced motion |

## Shell and page hierarchy

- Desktop opens with a 232px white sidebar displaying function names beside icons, the organization identity, current module navigation and permission-filtered applications. The footer's `Thu gọn` button collapses it to an 84px icon rail with tooltips; `Mở rộng điều hướng` restores labels.
- The layout choice uses the account-scoped local key `ct:sidebar-layout:v2:<account-id>`. This version starts expanded after the user's request to show labels, then retains explicit compact/expanded choices across reloads. User changes still update the existing preference API. Density and other workspace preferences retain their existing behavior.
- The 56px transparent header contains floating search, messaging, notifications and account controls. Creation actions belong to their owning page header. The desktop chat launcher sits above the expand action in the rail, preserving equal page gutters and reachable table actions.
- `PageHeader` / `ResponsivePageHeader` renders one visible `h1` on desktop and phone. `EntityContextHeader` adds record context. Do not repeat the title as a greeting, eyebrow or second heading.
- Phone users retain authorized module access through applications and shared bottom navigation. A small viewport must not impose business permissions or redirect every module to Personal.
- UI shows labels, states and actionable data. No descriptions beneath actions, permissions, navigation or function headings. Detailed guidance belongs in documentation.

## Shared components

- `Button`, `IconButton`, `Card`, `StatusBadge` own action, surface and status styles.
- `DataTable` / `Worklist` own sorting, record navigation, selection and responsive records. Primary mobile identity follows column priority. Standard tables use horizontal separators and no vertical cell borders.
- `FilterBar` keeps desktop filters inline; `FilterSheet` keeps phone controls mounted while closed. Portaled fields belong to the original form via the `form` attribute. Apply submits that form; Reset clears route parameters and field values.
- `Select` uses `SelectControl` and `FloatingPanel`. Long lists support Vietnamese accent-insensitive search. Arrows/Home/End/Enter, outside dismissal, Escape, active option scrolling, disabled and empty states are shared. A hidden native select preserves `FormData`, existing change handlers, reset and required validation.
- `ComboboxControl` supports a free value and keyboard option selection without browser datalist UI.
- `DropdownMenu` portals row actions above scrolling tables, supports keyboard opening/navigation and restores focus. Floating panels stay inside the viewport and a parent dialog's focus boundary.
- `Modal` and `Drawer` trap/restore focus, lock background scroll and dismiss the uppermost popup first. Nested menu/select Escape must not close the parent.
- Shared fields, `FormSection` and `StickyActionBar` preserve business field order, explicit labels, native form semantics and validation. Inline errors remain visible.
- Loading, empty, error, permission and retry states use shared state components.

## Dashboard

The authorized “Ứng dụng của tôi” bar appears first, before the dashboard title and analytics, with permission filtering and pinned order. `DashboardView` consumes the existing scoped read model: up to five real role-specific metrics, at most two meaningful charts in a 2:1 desktop grid, followed by a deduplicated work queue and recent items/notifications. KPI cards are horizontal with decorative colored rings, values above labels and smaller text metrics. A single real percentage uses a semicircle gauge; comparisons use capsule bars and trends use smooth lines. When the only chart is a percentage, a companion comparison may count the complete deduplicated work collection by actual category; it is not a historical trend. Charts retain accessible tabular data and CSV export with spreadsheet formula protection. Do not synthesize trends, fake counts or tasks to fill a reference layout. Account-scoped personal tasks and notes retain their existing APIs through `PersonalWorkspaceCards`.

## Validation

Run `lint`, `typecheck`, `test`, `build`, `ui:audit`, `ui:architecture-audit` and `ui:screen-audit`. `ui:reference-qa` checks the reference material, real KPI/gauge values, labelled sidebar, compact/expanded persistence, header control spacing and responsive dashboard/list screens for three roles. Its sidebar scenario mocks the two preference PUTs locally and does not modify the server preference. `ui:release-qa` checks authenticated production views at phone/tablet/desktop widths. `ui:interaction-qa` checks filter persistence, empty/reset, keyboard menus, nested select dismissal and negative permissions without submitting business records. `ui:core-qa` uses development previews.

Static route coverage is not business UAT. See [production review](UI_UX_PRODUCTION_REVIEW_2026-10-03.md) for measured coverage and [production readiness](operations/production-readiness.md) for deployment prerequisites. Preview routes stay inaccessible in production.

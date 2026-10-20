# Mobile ERP architecture blueprint

## Current mobile architecture

`AppShell` renders a desktop-oriented `AppHeader`, a separate top `MobileContextNav`, page-local tabs/toolbars, and a fixed global `MobileBottomNav`. The package workspace adds its own mobile bottom bar. Navigation destinations are split between `desktopNavigation`, `mobileNavigation`, module registry, and page-local arrays. Many page components depend on responsive CSS applied to desktop composition.

## Problems

- A module can show top context tabs and a bottom bar simultaneously; project workspace can own a second bottom bar.
- The global bottom bar does not respond to the active module and its route list is independent of the desktop permission-aware menu.
- Headings, filters, tab strips, tables, and sticky actions compete for phone height; page-level CSS patches obscure the underlying composition problem.
- Current responsive checks do not cover the required 320px baseline or route/permission matrix.

## Target mobile architecture

`AppShell` is the only owner of mobile header, safe-area page container, and one bottom navigation. A shared resolver derives root and module destinations from the existing permission-filtered navigation source. It selects up to four direct destinations and an optional secondary-action sheet; workflow routes may suppress the bar when a full-screen camera or chat composer needs the space. On the Personal/attendance root, the established center quick-attendance action remains one tap from camera. Page-local tabs remain desktop/tablet-only when they duplicate module navigation. All module links use real routes and existing RBAC/module flags.

## Shared components and contracts

- `MobileBottomNav`: one dock, route-driven active state, permission-filtered items, sheet for secondary routes.
- `AppHeader`: 52–60px mobile chrome with one orientation title or root identity, back and contextual actions only.
- `AppShell`: shared 16px phone gutter (12px for dense surfaces), safe-area and bottom-bar insets, no extra top module toolbar.
- `Drawer`/`Modal`: shared phone bottom-sheet or full-screen treatment; no desktop-width popover.
- `DataTable`, `FilterBar`, `FormLayout`, `ActionBars`: shared list, search/filter sheet, one-column and sticky-action patterns.
- Project workspace: register or derive the current project destinations in the shared dock instead of rendering its own bar.

## Migration sequence

1. Shell/navigation resolver, project-nav integration, safe-area and shared sheets; remove legacy duplicate mobile chrome.
2. Personal dashboard, attendance, calendar, leave, projects/worksites, chat workflows.
3. HR, accounting, warehouse/import-export, progress/documents, profile/admin workflows.
4. Audit all authenticated routes and required widths, then lint, typecheck, tests, production build. Mark a module complete only when its route matrix and task flows pass.

## Compatibility boundary

Do not alter APIs, database schema, authentication, permissions, realtime, attendance/payroll calculations, or existing business validation for a presentation-only migration. Keep desktop behavior at 768px and above unless a shared accessibility fix is needed. Existing design tokens and brand colors remain authoritative; this blueprint supersedes the previous desktop-first mobile guidance in `design-system/chau-tuan-erp/MASTER.md` only for mobile composition.

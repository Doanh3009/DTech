# Frontend UI architecture

## Source of truth

`src/styles/tokens.css` is the single runtime source for global visual values:

- typography, spacing and page/container sizing;
- color and semantic status colors;
- radius, elevation and control dimensions;
- table density, sidebar/topbar dimensions, z-index and responsive tiers.

System branding may set the `--color-primary` family at runtime in `src/app/layout.tsx`. No feature may set a global token.

`src/app/globals.css` contains compatibility and feature presentation selectors. `src/app/theme.css` maps shared primitives and layouts to the tokens. Neither file may define `:root` tokens.

## Layering

```
Design tokens       src/styles/tokens.css
UI primitives       src/components/shared (Button, FormControls, Card, Badge, StatusBadge, Tooltip, Popover)
Shared components   DataTable, FilterBar, Pagination, Tabs, States, Overlays
Layout components   src/components/layout + PageLayouts
Page patterns       ListPageLayout, FormPageLayout, DetailPageLayout, SplitView
Feature screens     src/features and src/app routes
```

## Required components

- Buttons: `Button`, `IconButton`, `ActionButton`
- Form controls: `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `SearchInput`, `DateField`, `UploadField`
- Form chrome: `FormField`, `FieldLabel`, `RequiredIndicator`, `HelperText`, `FieldError`
- Data: `DataTable`, `FilterBar`, `TableToolbar`, `Pagination`, `StatusBadge`, `RowActions`, `ColumnVisibilityMenu`
- Feedback: `EmptyState`, `LoadingState`, `ErrorState`, `Skeleton`, `Toast`
- Navigation and overlays: `Tabs`, `DropdownMenu`, `Tooltip`, `Popover`, `Dialog`/`Modal`, `Drawer`, `ConfirmDialog`
- Layout: `AppShell`, `PageContainer`, `PageContent`, `PageHeader`, `PageToolbar`, `PageSection`, `ContentGrid`, `SplitView`, `DetailPanel`, `FullWidthWorkspace`, `NarrowFormContainer`
- Form structure: `FormSection`, `FormActions`, `StickyActionBar`, `FormErrorSummary`

## Creating a page

Pages only fetch/prepare data, choose a page pattern and compose shared components. They must not define their own global visual system.

```tsx
export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Danh sách" />
      <DataSurface>
        <div className="data-surface__toolbar">
          <FilterBar><SearchInput placeholder="Tìm kiếm" value="" /></FilterBar>
        </div>
        <DataTable columns={columns} data={rows} />
      </DataSurface>
    </PageContainer>
  );
}
```

Use variants, props and composition when a module differs. Do not copy a shared component to a feature folder just to alter spacing, color, radius or shadow.

`PageHeader` is the only standard route header. Use its `eyebrow`, `meta` and `action` slots for record context instead of rebuilding its markup. Do not add descriptions beneath actions, permissions or navigation items.

## Status system

`src/components/shared/StatusBadge.tsx` owns the semantic status-to-tone mapping. Pass the business key through `status`; provide children only when the domain needs a more specific Vietnamese label:

```tsx
<StatusBadge status={record.status} />
<StatusBadge status="active">Đang hiệu lực</StatusBadge>
```

Do not duplicate ternary color mappings in feature modules. Add a genuinely new business status to `statusPresentation`, using only the existing semantic tones.

## Responsive policy

Responsive tiers are documented in `src/styles/tokens.css`: 700px for mobile/form collapse, 900–1100px for shell and tablet composition, and 1250px for wide data layouts. CSS custom properties cannot drive media-query conditions, so the numeric query must match one of these documented tiers. New feature-specific breakpoints are prohibited.

Standard `DataTable` renders a record-list view on mobile. The only native-table exceptions are the timesheet matrix, work calendar and inline stock-count editor because their interactions are intrinsically tabular; `scripts/ui-architecture-audit.mjs` enforces this allowlist.

## Global changes

- Font, spacing, colors, radius, shadows, page width, sidebar width and table density: edit `src/styles/tokens.css`.
- Shared behavior/markup: edit its component in `src/components/shared`.
- App shell/sidebar/topbar: edit `src/components/layout`.
- Feature-specific semantics/data: edit the relevant `src/features` screen only.

## Migration policy

1. Prefer a shared primitive before writing HTML controls.
2. Prefer a page pattern before a feature layout wrapper.
3. Do not add `:root` outside `src/styles/tokens.css`.
4. Inline visual style requires review; use semantic classes and tokens instead.
5. Native specialized calendar/matrix/editor tables may remain native, but must consume table tokens.
6. Data-driven inline widths/colors and runtime brand variables are allowed only through the reviewed audit allowlist.
7. Run `npm run ui:architecture-audit`, `npm run ui:audit`, typecheck and UI QA before merging.

## Prohibited duplicates

- raw `page-header` markup outside `PageHeader`;
- a feature copy of a shared button, field, modal, drawer, badge, state or table;
- a fourth native feature table without an architecture review;
- `:root` tokens outside `src/styles/tokens.css`;
- raw color literals in feature JSX, except administrator-selectable color values;
- visual constants in inline styles unless they are runtime/data-driven and audit-allowlisted;
- page-specific padding, maximum width, radius, shadow or control height.

## Migration phases

1. Tokens — centralize runtime values.
2. Primitives — controls, feedback and overlays.
3. Layout — shell, containers and page patterns.
4. Table/form — data and form composition.
5. Feature screens — migrate remaining custom markup to primitives.
6. Legacy removal — delete unused selectors/components after each migration batch.
7. Visual consistency audit — test all routes and responsive breakpoints.

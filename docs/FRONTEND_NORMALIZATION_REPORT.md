# FRONTEND NORMALIZATION REPORT

## Duplicates found

- Page header markup was being recreated outside the shared `PageHeader` contract.
- Form label, required mark, helper text and error markup existed in several local variants.
- Status labels and tones were mapped repeatedly inside feature modules.
- Tables had no shared sorting contract and several screens handled desktop/mobile state independently.
- Layout width, section spacing, workbench width and form width were expressed by page-specific wrappers.
- Badge, tooltip, popover, dialog and upload naming did not expose one consistent primitive API.

## Shared components created/refined

- Added shared `Badge`, accessible `Tooltip` and `Popover` primitives.
- Exposed `Dialog`, `UploadField` and `DateField` aliases through the shared public API.
- Exported `FormField`, `FieldLabel`, `RequiredIndicator`, `HelperText` and `FieldError` so custom controls retain the same field contract.
- Added `PageToolbar`, `PageSection`, `ContentGrid`, `FullWidthWorkspace` and `NarrowFormContainer`.
- Extended `PageHeader` with `eyebrow` and `meta` slots without creating a second header implementation.

## Layout normalized

- Tokens live in `src/styles/tokens.css`; global behavior remains in `src/app/globals.css` and the visual theme in `src/app/theme.css`.
- App shell, 232 px expanded rail, 64 px collapsed rail, 60 px header, page gutters, section rhythm and responsive workspaces use shared tokens.
- Manual `page-header` clones were removed from feature screens and replaced with `PageHeader`.
- Full-width data workspaces and narrow forms now have explicit shared layout contracts.

## Data table normalized

- `DataTable` owns loading, error, empty, desktop and mobile-record presentation.
- Sortable columns now expose keyboard-operable controls and `aria-sort`, with controlled or local sorting.
- Row actions, selection, links and responsive hiding remain compatible with existing consumers.
- Only three specialized native tables remain allowlisted: attendance calendar, timesheet matrix and stock-count editor.

## Form system normalized

- Labels, required state, helper text, validation messages, read-only state and disabled state are centralized.
- Form sections, validation summary, sticky action bar, upload progress and retry behavior use shared components.
- Login and password-change flows share `PasswordInput` behavior.

## Status system normalized

- `StatusBadge` now resolves business status through a central presentation registry.
- Accounting, attendance, leave, contract, inventory, import-export and worker-attendance screens were moved away from local tone maps where a shared status exists.
- Status remains text plus tone; meaning never depends on color alone.

## Legacy UI removed

- Removed the duplicate commented token block from `theme.css`.
- Removed manual page-header implementations detected by the architecture audit.
- Placeholder page components remain unreferenced compatibility exports; no authenticated route renders them.
- No CSS-module design system exists in parallel with the token/shared-component architecture.

## Routes migrated

- The route audit covers 180 authenticated routes: direct page owners, delegated feature screens and intentional redirects.
- Shared header migrations include administration, search, project monitoring, project detail and project updates.
- The architecture audit covers 183 app pages and 404 TSX/CSS UI files.

## Remaining inconsistencies

- Three domain-specific matrix/editor tables intentionally stay native because their cell-editing grammar does not match a generic row table.
- Nine reviewed files retain data-driven inline custom properties or geometry; the audit rejects new unreviewed inline presentation styles.
- A few compact legacy feature files remain candidates for readability-only refactoring; their screen and state contracts are covered by tests/audits.

## Manual QA required

- Verify authenticated screens with production-like permissions and long Vietnamese content.
- Exercise create/edit/post/approve flows against representative data, including conflict and validation errors.
- Recheck sticky actions, drawers and dense tables on physical mobile devices in addition to automated viewport sweeps.


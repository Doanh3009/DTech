# Package / Worksite workspace hard reset

## Component audit

| Previous presentation | Decision | Replacement |
| --- | --- | --- |
| `ProjectContextHeader` | REPLACE UI | `PackageContextHeader` with one compact context line and the `Thông tin gói` drawer |
| shared `Tabs` on the project route | REPLACE UI | `WorkspaceNav` with Thi công / Chấm công / Hồ sơ / Tài liệu |
| `ProjectDetailView` | DELETE FROM PAGE | `PackageWorkspace` and one focused workspace body per route section |
| `ProjectProgressTree` | REPLACE UI | `PackageConstructionWorkspace` |
| `ProjectPeopleAttendanceWorkspace` | REPLACE UI | `PackageAttendanceWorkspace` |
| `ProjectRecordWorkspace` | DELETE FROM PAGE | `PackageRecordWorkspace` without package metadata fields |
| `ProjectDocumentWorkspace` | REPLACE UI | `PackageDocumentWorkspace` |
| API routes, repositories, permissions, attendance draft sync | KEEP DATA | Reused without schema or contract changes |

## Component tree

Before:

```text
ProjectDetailPage
├── ProjectContextHeader
├── Tabs
└── ProjectDetailView
    ├── ProjectProgressTree
    ├── ProjectPeopleAttendanceWorkspace
    ├── ProjectRecordWorkspace
    └── ProjectDocumentWorkspace
```

After:

```text
ProjectDetailPage
└── PackageWorkspace
    ├── PackageContextHeader
    ├── WorkspaceNav
    ├── WorkspaceBody
    │   ├── PackageConstructionWorkspace
    │   ├── PackageAttendanceWorkspace
    │   ├── PackageRecordWorkspace
    │   └── PackageDocumentWorkspace
    └── MobileActionBar
```

The main project route no longer imports any previous presentation component.

## Completion checks

- Desktop checked at 1366×768; mobile checked at 390×844.
- All four workspaces were opened against the seeded remote data with no horizontal overflow.
- Metadata appears once in the context header and only expands in `Thông tin gói`.
- Thi công uses a 70/30 worklist/look-ahead layout and compact task rows.
- `Cập nhật hiện trường` is implemented with the shared `Drawer`, which becomes full-screen on mobile.
- Chấm công uses one summary line and a 70/30 people/session layout; no KPI card row remains.
- The attendance flow exposes `Có mặt tất cả`, exception-only row actions, panoramic photo capture and sticky completion.
- Hồ sơ contains only record requirements and selected record detail; package metadata is absent.
- Tài liệu contains search, type filter, upload, file list, open/download, and derived version labels where versions exist.
- Loading uses route-shaped task, employee, or document rows rather than a blank-screen spinner.
- Visual evidence is under `docs/ui-evidence/package-workspace-*.png`.
- Automated visual checks are in `scripts/package-workspace-qa.mjs`.


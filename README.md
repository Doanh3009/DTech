# Hệ thống nội bộ Châu Tuấn

Next.js 16 App Router + TypeScript strict + Supabase. Release candidate 0.1.0 gồm HR/RBAC, attendance, leave/timesheet, project, warehouse, XNK, shared platform, integrations và operations hardening.

## Local setup

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Áp dụng toàn bộ `supabase/migrations` trước khi đăng nhập. Tạo admin trực tiếp bằng tên tài khoản: đặt mật khẩu trong biến tạm `BOOTSTRAP_ADMIN_PASSWORD`, rồi chạy `npm run bootstrap:admin -- --username=<username> --name=<name>`. Để đổi mật khẩu admin hiện hữu mà giữ nguyên username và tên hiển thị, dùng `npm run bootstrap:admin -- --existing-email=<email>`. Script không gửi email và không có mật khẩu mặc định.

## Quality gate

```bash
npm run validate:migrations
npm run lint
npm run typecheck
npm test
npm run build
```

Smoke trên deployment: đặt `SMOKE_BASE_URL` rồi chạy `npm run smoke`.

## Documentation

- [UI/UX và kiểm tra bản production 03/10/2026](docs/UI_UX_PRODUCTION_REVIEW_2026-10-03.md)
- [UI design system và quy tắc component dùng chung](docs/ui-design-system.md)
- [Production readiness](docs/operations/production-readiness.md), [deployment](docs/operations/deployment.md), [backup/restore](docs/operations/backup-restore.md), [security runbook](docs/operations/security-runbook.md)
- [Architecture](docs/architecture/README.md), [data dictionary](docs/architecture/data-dictionary.md), [business rules](docs/architecture/business-rules.md)
- [Permission catalog](docs/security/permissions.md), [settings catalog](docs/configuration/settings-catalog.md)
- [QA matrix](docs/qa/qa-matrix.md), [test report](docs/qa/test-report.md), [UAT sign-off](docs/uat/uat-signoff.md)
- [Migration inventory](docs/migration/data-inventory.md), [mapping](docs/migration/mapping.md), [runbook](docs/migration/runbook.md), [validation report](docs/migration/validation-report.md)
- [Go-live checklist](docs/go-live/go-live-checklist.md), [blockers](docs/go-live/blockers.md), [scorecard](docs/go-live/readiness-scorecard.md), [evidence](docs/go-live/evidence/README.md)
- Role guides: [Employee](docs/user-guide/employee.md), [Supervisor](docs/user-guide/supervisor.md), [HR](docs/user-guide/hr.md), [Warehouse](docs/user-guide/warehouse.md), [XNK](docs/user-guide/import-export.md), [Manager](docs/user-guide/manager.md), [Admin](docs/user-guide/admin.md)

Current technical readiness is **NOT READY** until production/staging configuration, verified backup/restore drill, real migration reconciliation, device pilot and business UAT evidence exist.

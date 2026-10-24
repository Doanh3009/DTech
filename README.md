# DTech ERP

Nền tảng ERP cấu hình theo doanh nghiệp, dùng Next.js 16 App Router + TypeScript strict + Supabase. ERP nội bộ và các bản cài riêng hiện có giữ luồng dữ liệu cũ; không gian khách mới dùng chung project, bảng `business_*` và session riêng tách theo `tenant_id`. Xem [kiến trúc tenant](docs/erp/shared-project-architecture.md) và ma trận hoàn thiện trước khi nghiệm thu thương mại.

Trên bản DTech, trang giới thiệu tại `/`, đăng ký tại `/dang-ky-dung-thu`, ERP đăng nhập tại `/login`. **Team setup dùng CRM riêng tại `/control-center/login`** để tiếp nhận data, khảo sát, custom gói ngành/module và quản lý môi trường từng khách hàng. Case xây dựng hiện có nhãn minh họa. [Hướng dẫn CRM triển khai](docs/commercial-erp/operator-crm-guide.md).

Bật `DTECH_CONTROL_CENTER_ENABLED=true` chỉ cho bản DTech. Khách dùng không gian tenant đăng nhập tại `/erp/[slug]/login`; không cấp tài khoản khách vào ERP nội bộ hoặc CRM team setup. Cờ `false` vẫn dành cho các bản cài riêng hiện có.

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

Kiểm tra manifest local: `npm run deployment:validate` và `npm run deployment:plan`. Xem [hướng dẫn manifest khách hàng](docs/commercial-erp/deployment-manifest-guide.md). Hai lệnh này không đọc secrets hoặc ghi cloud. Kiểm tra luồng ERP trên bản review tại cổng 3100 bằng `npm run smoke:foundation`; công cụ chỉ đọc nghiệp vụ và tạo/kết thúc phiên kiểm tra.

Thiết lập doanh nghiệp tại `/system-admin/setup`: bốn bước, bản nháp trình duyệt, xuất bản nguyên tử có kiểm tra phiên bản và retry. [Hướng dẫn UI/CLI activation](docs/commercial-erp/customer-activation-guide.md). `npm run deployment:activation` mặc định chỉ preview local; `npm run test:settings:integration` chạy PostgreSQL tạm theo [hướng dẫn](supabase/tests/atomic-settings.README.md). `npm run smoke:setup` mặc định không xuất bản; tùy chọn `--publish` chỉ dành cho kiểm tra DTech development được chỉ định.

Hồ sơ nhân sự và nghỉ việc dùng một command nguyên tử có kiểm tra phiên bản, quyền và quản trị viên cuối cùng. [Hợp đồng command](docs/commercial-erp/employee-profile-command-guide.md). `npm run test:employee:integration` kiểm tra PostgreSQL cô lập; `npm run smoke:employee` duyệt form và mô phỏng lỗi trong trình duyệt, không gửi thay đổi hồ sơ thật.

Cấp/xóa tài khoản dùng yêu cầu phục hồi bền vững; thông tin nhạy cảm và lưu trữ nhân sự dùng command có phiên bản chung. Hai migration `202610220002`/`202610220003` đã áp dụng trên DTech development; xem [hướng dẫn vòng đời tài khoản](docs/commercial-erp/account-lifecycle-recovery-guide.md), [command phụ trợ nhân sự](docs/commercial-erp/employee-auxiliary-command-guide.md) và [bằng chứng rollout](docs/commercial-erp/evidence/lifecycle-rollout.json). Panel phục hồi có tại `/settings/users` và ngay tab Tài khoản của hồ sơ nhân sự; người đã có quyền mở tab và `account.create` hoặc `account.delete` không cần thêm `user.view` chỉ để tiếp tục yêu cầu của nhân sự đó.

`npm run test:lifecycle:integration` có 165 kiểm tra PostgreSQL native, dùng bảng Auth stub; `npm run smoke:lifecycle` duyệt giao diện và chặn/mô phỏng mutation. Chưa nghiệm thu tạo/xóa Auth thật hay toàn bộ Supabase stack. Đây chưa phải ERP hoàn chỉnh để phát hành thương mại.

`npm run test:trial:integration` kiểm tra intake/review trên PostgreSQL tạm; `npm run smoke:marketing` duyệt landing, form, cổng module và tiếp nhận trong quản trị ở 1440/768/390px, intercept toàn bộ lead thử. Migration `202610220004` đã áp dụng development; quyền xem/xử lý riêng, giới hạn tần suất, consent, request UUID và review CAS được thực thi ở server/DB. Thẻ module không có spinner/nút phụ; khung nghiệp vụ dùng bề mặt trung tính và điều hướng trong module.

## Documentation

- [Giao hàng từng phần theo đơn bán](docs/erp/sales-fulfillment.md): chi tiết đơn → giao nhiều dòng nguyên tử → tồn kho → công nợ; có CAS, retry và phiếu đảo. Migration business chưa được tự áp dụng lên cloud. `node supabase/tests/business-platform.integration.mjs` chạy PostgreSQL tạm với dữ liệu tổng hợp.

- [Kiểm kê và kiến trúc ERP thương mại P0](docs/commercial-erp/progress.md), [ma trận hoàn thiện module](docs/commercial-erp/16-module-completion-matrix.md), [roadmap theo PR](docs/commercial-erp/17-roadmap-and-pr-plan.md)
- [Cấu hình khách hàng và bộ cài nền tảng](docs/commercial-erp/deployment-manifest-guide.md)

- [Nền tảng DTech ERP và thiết lập theo doanh nghiệp](docs/erp/platform.md)
- [Design DNA dùng chung](design-system/dtech-erp/MASTER.md), [hợp đồng phát triển module](docs/erp/module-contract.md)

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

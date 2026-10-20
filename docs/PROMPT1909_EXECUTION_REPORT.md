# Báo cáo thực hiện prompt1909

Cập nhật: 2026-09-19 (Asia/Ho_Chi_Minh)

## 1. UI/UX Pro Max

- Skill chưa có trong danh sách Codex ban đầu. Đã xác minh nguồn chính thức `nextlevelbuilder/ui-ux-pro-max-skill` và cài bằng CLI chính thức vào `.agents/skills/ui-ux-pro-max`.
- Đã đọc toàn bộ `SKILL.md`. Máy không có Python 3; theo chính sách của skill, không tự cài runtime hệ thống và dùng Quick Reference tích hợp thay cho script tìm kiếm.
- Hướng thiết kế cập nhật theo yêu cầu tiếp theo: enterprise ERP tươi sáng, data-dense, shell trust-teal, surface trắng, blue cho dữ liệu và orange cho attention, responsive theo nhiệm vụ. Python 3.13 đã được cài để chạy và xác minh dữ liệu cục bộ của skill; skill không được dùng để thay entity, workflow, permission hoặc API.

## 2. Business Preservation Matrix

| Blueprint Requirement | Current Implementation | Status | Files/API/DB | Action |
| --- | --- | --- | --- | --- |
| Employee Profile tách User Account | `employees`, `app_accounts`, account action/API riêng | COMPLETE | `src/features/employees`, `/api/v1/employees`, `/api/v1/accounts`, migration `202609090002` | Giữ nguyên domain; không gộp trong UI |
| Hồ sơ nhân sự đầy đủ và timeline | Profile cá nhân, CCCD, hợp đồng, tài liệu, sensitive API, history | COMPLETE | employee service/repository, migration `202609180002` | Giữ form progressive, field nhạy cảm theo permission |
| Permission-level authorization | Permission catalog, server guard, role persistence, RLS foundation | COMPLETE | `src/lib/auth/permissions.ts`, `src/services/authorization`, `/settings/roles` | Không thay bằng role label |
| Chấm công cá nhân | Camera/GPS, queue IndexedDB, sync lock, idempotency, photo route | COMPLETE | `src/features/attendance`, migration `202609110001` | Giữ tách biệt worker attendance |
| Điểm danh công nhân | Assignment/roster/session/photos/temporary worker/submit/close-day | COMPLETE | `src/features/worker-attendance`, `/api/v1/worker-attendance/*`, migrations `202609110002`, `202609110003`, `202609180003` | Giữ checklist là config bổ sung, không thay roster/session |
| Timesheet tổng hợp và khóa kỳ | Period, matrix, exception, adjustment, recompute, lock/unlock | COMPLETE | `src/features/timesheets`, `/api/v1/timesheet-periods/*`, migration `202609110006` | Không tính công rải trong UI |
| Leave workflow + ledger + PDF | Draft/submit/approve/reject/cancel, balance ledger, PDF | COMPLETE | `src/features/leave`, `/api/v1/leave-*`, migrations `202609110004`, `202609110005` | Giữ ledger là source of truth |
| Project/Worksite/Assignment/Roster | Route/service riêng, project updates/issues và assignment/roster API | COMPLETE | `src/features/projects`, `/api/v1/projects/*`, migration `202609120001` | Không ép WBS/KPI mới |
| Warehouse stock ledger | Receipt/issue/transfer/stocktake/adjustment/post/reverse/ledger | COMPLETE | `src/features/warehouse`, `/api/v1/warehouse/*`, migrations `202609120002`, `202609150004` | Không cập nhật on-hand trực tiếp |
| XNK liên kết kho | Contract/shipment/line/container/document/customs/partial receiving/create receipt | COMPLETE | `src/features/import-export`, `/api/v1/shipments/*`, migrations `202609120003`, `202609150005` | Giữ shipment line làm nguồn receipt |
| Report engine template-driven | Template designer, field registry, export job và download | COMPLETE | `src/features/timesheets/services`, `/api/v1/report-*`, migration `202609110006` | Không tạo export hard-code mới |
| Document/approval/notification | Document version/private route, workflow/delegation, notification preference/template | COMPLETE | `src/features/shared-platforms`, migrations `202609120004`, `202609150006` | Giữ permission và audit ở service/API |
| Admin configuration | Organization, attendance, leave, warehouse, XNK, report, permission, integration | COMPLETE | `/settings/*`, `/system-admin/*`, configuration service | Policy biến động tiếp tục nằm ở cấu hình |
| API/integration/audit | `/api/v1`, external `/api/external/v1`, API key/webhook/audit | COMPLETE | route handlers, integration services, audit service | Không nối DB trực tiếp từ external system |
| Realtime đa domain | Coordinator, scoped subscriptions, dedup, reconnect/resume/focus/pageshow | COMPLETE | `src/lib/realtime`, migration `202609150003` | Thêm log fingerprint khi reconciliation lỗi |
| Back/Forward/BFCache | `pageshow` reconcile domain đang mount, state fetch không dùng force reload | COMPLETE (source/test) | coordinator + regression test | Vẫn cần UAT authenticated trên Vercel với dữ liệu thật |
| 12 giờ không hoạt động | DB `last_seen_at` kiểm tra trước khi cập nhật; client timer chỉ hỗ trợ UX | COMPLETE | `src/services/auth/sessionService.ts`, `AppShell.tsx` | Refresh sau timeout không bypass kiểm tra server |
| Private upload | Storage service, permission route, stable internal file/photo route | COMPLETE | `src/services/storage`, `/api/v1/files`, photo/document routes | Không xuất signed URL ngắn hạn cố định |
| RLS/permission thực tế nhiều tài khoản | Có policy/migration và guard server | PARTIAL | Supabase migrations, permission tests | Chưa có staging multi-user JWT để chứng minh allow/deny toàn ma trận |
| Workflow concurrency/end-to-end | Có rule/unit test và command hardening | PARTIAL | service tests, hardening migrations | Cần staging dataset cô lập cho concurrent post/approve/receive |
| Backup/restore retention | Có runbook, chưa có bằng chứng phục hồi mới trong đợt này | UNKNOWN | `docs/operations/backup-restore.md` | Cần diễn tập do người vận hành xác nhận |

Không phát hiện chức năng đang dùng nằm ngoài Blueprint cần xóa. Accounting, payroll, insurance, messaging và integration console được giữ là `EXTENSION`; không xóa hoặc giản lược trong đợt UI này.

## 3. Nghiệp vụ COMPLETE / PARTIAL / MISSING / CHANGED

- COMPLETE theo source và test: HR foundation, personal attendance, worker attendance architecture, leave ledger, timesheet periods, projects/worksites, warehouse ledger, XNK-to-warehouse, reports, documents, approvals, notifications, API v1, audit, permission catalog.
- PARTIAL về bằng chứng môi trường: RLS nhiều user, realtime hai tài khoản, concurrency ledger/approval/receiving và visual UAT các route authenticated.
- MISSING: không phát hiện hạng mục Blueprint cốt lõi hoàn toàn không có implementation. Không đồng nghĩa mọi workflow đã được production UAT.
- CHANGED: theme pastel/radius lớn đã được thay bằng bright enterprise ERP tokens theo yêu cầu mới của người dùng. Business workflow không đổi.
- Khôi phục trong đợt này: không phải khôi phục domain đã mất; giữ nguyên toàn bộ domain và sửa lớp thiết kế, lint boundary, BFCache evidence và error observability.

## 4. Design system và shared UI

- Token source of truth: `src/app/theme.css`; brand primary tiếp tục được map từ System Settings trong `src/app/layout.tsx`.
- Shared primitives: Button, Card, DataTable, FormControls, FormSection, PageHeader, PageLayouts, FilterBar, StatusBadge, States, Overlays, ImageUploader, ActionBars, Workbench.
- Page templates: `PageContainer` với list/form/detail/report width mode; dashboard sử dụng grid adaptive và widget theo permission.
- Thay đổi visual: canvas trust-teal rất nhạt, sidebar teal đậm, surface trắng, border rõ, radius card 12–16px, shadow nhẹ, table row 52px, section gap 24px, KPI/module card dùng gradient màu ngữ nghĩa tiết chế.
- Legacy CSS chưa xóa toàn bộ vì 180 route vẫn dùng selector tương thích. `theme.css` là compatibility mapping duy nhất; xóa ngay sẽ gây regression diện rộng.
- Module migrate: thay đổi token/shared selector áp dụng đồng thời cho dashboard, nhân sự, chấm công, nghỉ phép, dự án, worker attendance, kho, XNK, approvals, documents, settings và admin.

## 5. Responsive, adaptive data và navigation

- Mobile giữ bottom navigation tối đa 5 mục, CTA/touch control 44px, form một cột và table chuyển mobile record khi phù hợp.
- Desktop list/table dùng gần full workspace; form/detail giữ bounded layout; padding không tăng vô hạn ở 1920/2560.
- Empty/loading/error components tồn tại dùng chung; dashboard không tạo KPI giả. Data table có scroll có kiểm soát và mobile representation.
- Active navigation lấy từ pathname, detail có URL riêng, breadcrumb/back route lấy từ route registry.
- Filter quan trọng của các list chính dùng search params/URL theo implementation từng module; không dùng giant activeTab page làm router chính.

## 6. Back/Vercel, auth, realtime và upload

- Root failure mode được xử lý ở lifecycle data: khi trang được phục hồi từ BFCache hoặc quay lại foreground, coordinator phát reconciliation cho đúng domain đang mount. Burst được coalesce, event được dedup, listener cleanup cân bằng.
- Không dùng `window.location.reload`, random key, global cache disable hoặc `router.refresh()` như workaround điều hướng. Các `router.refresh()` còn lại phục vụ auth transition hoặc cập nhật Server Component sau mutation.
- Session timeout 12 giờ dựa trên `app_sessions.last_seen_at` ở server. Password input có show/hide, policy tối thiểu 8 ký tự và không có `maxLength=8`.
- Mật khẩu admin hiện hữu đã được cập nhật qua Supabase Auth bằng biến tiến trình; không ghi plaintext vào repo. Bootstrap script nay cho phép `--existing-email` để giữ username/tên hiển thị.
- Realtime giữ scoped channel, dedup, reconnect, BroadcastChannel và periodic reconcile. Lỗi background reconcile có log fingerprint, không còn catch im lặng.
- Upload dùng shared preview/validation/retry/progress; file nhạy cảm đi qua private service/API và permission.

## 7. Kiểm thử và bằng chứng

| Gate | Kết quả |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 58 file / 196 test |
| `npm run validate:migrations` | PASS, 31 migration đúng thứ tự |
| `npm run ui:audit` | PASS, 180 route authenticated |
| `npm run build` | PASS, 267 route; có fallback log system settings khi DB không phản hồi lúc prerender |
| `npm run ui:qa` | PASS, 14 viewport 320–2560, zoom 80/100/125/150, UI preview 390/1440, protected redirect |
| `npm run start` + `npm run smoke` | PASS live/login; ready trả 503 đúng contract vì DB môi trường local không sẵn sàng |

Data volume 0/1/5 được phủ bởi empty/list/component tests và UI patterns. Dataset 20/100+ cùng latency/memory production chưa được đo trong phiên authenticated, nên giữ trạng thái PARTIAL thay vì tuyên bố đạt.

## 8. Files changed và thay đổi vận hành

- `.agents/skills/ui-ux-pro-max/**`: skill UI/UX Pro Max chính thức.
- `src/app/theme.css`: token và compatibility mapping bright enterprise ERP.
- `src/components/shared/UiPlayground.tsx`: tên preview phù hợp design system mới.
- `src/lib/realtime/useDomainReconciliation.ts` và test: observability lỗi nền.
- `src/lib/realtime/coordinator.test.ts`: regression BFCache pageshow.
- `scripts/ui-route-audit.mjs`, `scripts/ui-qa.mjs`: contract QA mới.
- `scripts/bootstrap-admin.mjs`, `README.md`, `docs/operations/security-runbook.md`: cập nhật an toàn admin hiện hữu.
- `eslint.config.mjs`: không lint nội dung tool trong `.agents`.
- `docs/ui-evidence/*`: ảnh responsive được cập nhật bởi Playwright.

Không thêm migration, không sửa schema, không đổi seed và không thay API contract trong đợt này. Có một thay đổi auth ngoài repository: mật khẩu admin hiện hữu đã được cập nhật qua cơ chế Supabase Auth.

## 9. Cần người dùng xác nhận

1. Cung cấp/cho phép tài khoản staging theo role HR, giám sát, kho và XNK để chạy visual + business UAT authenticated.
2. Chốt rule thực tế còn cố ý configurable: giờ chuẩn, đi trễ/về sớm, OT, lễ, UOM/lot/bin/barcode, XNK checklist, Incoterm/currency bắt buộc, mẫu PDF và retention/backup.
3. Quyết định có thu hồi toàn bộ phiên admin hiện tại sau thay đổi mật khẩu hay không; đợt này không tự thu hồi vì đó là tác động bổ sung cần phê duyệt rõ.

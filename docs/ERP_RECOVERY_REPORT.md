# ERP RECOVERY REPORT

Cập nhật: 2026-09-19 (Asia/Ho_Chi_Minh)

Phạm vi báo cáo là forensic audit và hardening trên repository hiện tại, Supabase remote cấu hình trong `.env.local`, seed `TEST-*` và hai vai trò test. Không có một phiên bản ERP cũ hoàn chỉnh trong 9 commit để rollback; nguồn sự thật được lấy từ migrations, repositories/services, permission catalog, tests và dữ liệu quan hệ thật.

## 1 Original business flows recovered

- Giữ nguyên ranh giới Employee Profile và User Account: employee có thể tồn tại không có login; account có thể ở trạng thái chờ liên kết employee.
- Xác nhận chuỗi auth thật là `auth.users.id -> app_accounts.auth_user_id -> app_accounts.employee_id -> employees.id`.
- Khôi phục khả năng đi từ hồ sơ nhân viên sang chấm công và dự án bằng query thật, không dùng mock.
- Bảo toàn các luồng attendance cá nhân, worker attendance theo roster, leave ledger/approval, timesheet lock/version, project/worksite/assignment, warehouse ledger, XNK partial receiving, documents/notifications/approvals, payroll/insurance, chat và integration.
- Không thay nghiệp vụ cũ bằng UI mới; thay đổi UI chỉ xử lý cấu trúc detail tab, empty state và responsive.

## 2 Broken relations fixed

- Hai auth user test hiện liên kết đúng `app_accounts.auth_user_id`; audit không có auth user mồ côi, account-role mồ côi hoặc account-employee FK mồ côi.
- Employee detail dùng `project_assignments.employee_id` để hiển thị project thật và `attendance_events.employee_id` để hiển thị chấm công thật.
- Không tự gán 1 active account chưa có employee: đây là Case A cần thao tác quản trị có chủ đích.
- Bốn employee không có account được giữ nguyên vì là mô hình hợp lệ cho nhân sự/công nhân không đăng nhập.

## 3 Queries fixed

- Attendance repository áp scope trước khi đọc: quyền company-level được xem toàn bộ; `attendance.view_team` chỉ được xem bản thân và direct reports; self permission chỉ xem chính mình.
- Projects, warehouse, timesheets, report và import-export repositories không còn nuốt lỗi query/relation rồi trả `[]` hoặc coi là not-found. Lỗi nguồn được ném lên error boundary/API để không tạo “empty page” giả.
- Report locked/live không còn xuất dữ liệu rỗng khi query attendance, leave, ledger hoặc snapshot thất bại.
- Warehouse stock count phân biệt lỗi đọc, không tìm thấy và lỗi lines.
- XNK kiểm tra lỗi actor, shipment scope, item snapshot, customs, settings và reference data.

## 4 Employee linking fixes

- Thêm tab `Chấm công` và `Dự án` vào registry detail employee.
- Tab chỉ hiện khi user có quyền phù hợp; truy cập trực tiếp tab ngoài quyền trả permission denied.
- `listEmployeeProjects` tái sử dụng scope từ `listProjects`, sau đó lọc assignment của employee, tránh mở rộng quyền ngầm.
- Smoke xác nhận supervisor mở được employee-project liên kết thật; employee role bị 403 ở `/api/v1/employees` và `/api/v1/projects`.

## 5 Modules restored

Các module có route, service/API, permission và schema hiện diện được kiểm kê tại [BUSINESS_INVENTORY.md](./BUSINESS_INVENTORY.md). Bản đồ khóa ngoại/liên kết xuyên module nằm tại [RELATIONSHIP_MAP.md](./RELATIONSHIP_MAP.md).

Không phát hiện module cốt lõi bị xóa cần dựng lại. Accounting, payroll, insurance, messaging và integration được giữ như extension hợp lệ. Các phần chưa có bằng chứng production được ghi là rủi ro/UAT còn lại, không gắn nhãn “mất chức năng”.

## 6 End-to-end scenarios passed

- `test.supervisor`: login; dashboard; employees; employee project tab; projects; project team; worker attendance; notifications; các API tương ứng.
- Deny case supervisor: yêu cầu attendance của employee ngoài team trả 403.
- `test.employee`: login; dashboard; attendance self; timesheets; leave self; profile; notifications; các API self tương ứng.
- Deny case employee: employees và projects API trả 403.
- Health: `/api/health/live`, `/api/health/ready`, `/login` đều 200 khi dev server kết nối Supabase thật.
- Build production: Next.js 16.3.4 compile/typecheck/prerender thành công 267 route.

## 7 UI screens completed

- Employee detail có tab attendance/project dựa trên quyền và dữ liệu thật.
- Shared `DataTable` giữ header/cột khi không có bản ghi thay vì thay cả bảng bằng một hộp rỗng.
- Desktop table và mobile record representation dùng cùng nguồn dữ liệu, action và empty state.
- Audit route xác nhận 180 authenticated routes có title contract; 3 bảng chuyên biệt calendar/matrix/editor được giữ native theo mục đích.

## 8 Empty states added

- Bảng zero-row nay vẫn cho người dùng thấy cấu trúc cột và empty state có tiêu đề/hướng dẫn.
- Mobile không để `mobile-record-list` trắng khi dữ liệu rỗng.
- Loading, error, permission denied và offline dùng shared states; lỗi backend không còn bị biến thành empty state trong các repository đã harden.

## 9 Mobile fixes

- Smoke Playwright ở viewport 390px đã PASS cho dashboard, attendance self, leave và profile.
- Không phát hiện horizontal overflow ở các route mobile đã kiểm.
- Data table desktop chuyển sang mobile records; zero-row có empty state riêng trên breakpoint nhỏ.
- Kiểm tra theo UI/UX Pro Max tập trung vào hierarchy, table semantics, empty state và responsive; skill không được dùng để đổi entity, permission hoặc workflow.

## 10 Realtime fixes

- Kiến trúc hiện có giữ scoped subscriptions, dedup, reconnect/resume/focus/pageshow và domain reconciliation.
- Các thay đổi repository/UI không dùng realtime làm source of truth và không mở rộng scope subscription.
- Unit/regression tests hiện có PASS. Đợt này chưa chứng minh một event live giữa hai browser session đồng thời; mục đó còn trong manual QA.

## 11 Performance fixes

- Query employee-project tái sử dụng project scope và chỉ tải assignments cần thiết.
- Permission scope attendance được tính trước truy vấn thay vì tải toàn bộ rồi che ở UI.
- Không thêm polling toàn cục, full-page reload, mock dataset hay query unbounded mới.
- Chưa benchmark latency/memory với 100+ records hoặc tải đồng thời production; không tuyên bố performance production hoàn tất.

## 12 Seed data

- `npm run seed:storage -- --allow-remote` đã đồng bộ idempotent hai TEST auth users và private storage object; script hỗ trợ `SUPABASE_SECRET_KEY` và fallback `SUPABASE_SERVICE_ROLE_KEY`.
- Audit chỉ đọc PASS: 4 auth users, 4 accounts, 7 employees, 5 roles, 4 account-role links; không có orphan/missing role/auth link.
- Dữ liệu liên kết có attendance/photo, leave/ledger, project/assignments/updates, warehouse/items/balances/document, partner/contract/shipment, notification/approval/document và timesheet period.
- `stock_ledger=0` là đúng với seed hiện tại vì chứng từ kho đang `submitted`, chưa post; không được sửa bằng cách chèn ledger giả.
- Lệnh lặp lại: `npm run audit:data-health` và `npm run smoke:authenticated`; hướng dẫn nằm trong [development-seed.md](./development-seed.md).

## 13 Remaining risks

- 1 active account chưa liên kết employee cần người quản trị xác nhận liên kết hoặc chủ đích giữ là tài khoản hệ thống.
- Chưa chạy ma trận RLS với nhiều JWT cho toàn bộ roles trên staging/production.
- Chưa chạy mutation concurrency thật cho post/reverse kho, approve/reject leave, lock/recompute timesheet và partial receiving XNK.
- Chưa chạy realtime hai browser session để đo delivery/reconciliation thực tế.
- Chưa diễn tập backup/restore và retention với bằng chứng vận hành mới.
- Công thức payroll, policy ngày công/nghỉ, UOM/lot/bin/barcode, checklist XNK và mẫu PDF cần chủ nghiệp vụ ký xác nhận.
- Build trong sandbox ghi log `system_settings.read_failed` khi prerender do network bị chặn; build vẫn PASS bằng fallback. Health ready ngoài sandbox với Supabase thật trả 200.

## 14 Manual QA checklist

- [ ] Xác định owner và quyết định cho active account chưa liên kết employee.
- [ ] Dùng các role HR, supervisor, warehouse, XNK và employee để test allow/deny cả UI lẫn API.
- [ ] Mở hai browser session, thay đổi attendance/project/notification và xác nhận realtime + back/forward/BFCache.
- [ ] Clock in/out với GPS, ảnh, offline queue, retry và duplicate request.
- [ ] Tạo leave request, duyệt/từ chối đồng thời, kiểm tra ledger reversal và PDF.
- [ ] Recompute, adjust, lock/unlock timesheet; đối chiếu snapshot trước/sau.
- [ ] Tạo receipt/issue/transfer/count, post/reverse đồng thời; đối chiếu `stock_ledger` và `inventory_balances`.
- [ ] Nhận shipment từng phần, close-short và chống tạo receipt trùng.
- [ ] Tải file nhạy cảm/private bằng user được phép và user bị từ chối.
- [ ] Kiểm tra 375px portrait/landscape, keyboard navigation, focus-visible, zoom và reduced-motion trên các form/list chính.
- [ ] Benchmark list 20/100+ rows, export lớn và API latency trong staging gần production.
- [ ] Chạy backup, restore vào môi trường cô lập và lưu biên bản RPO/RTO.

## Verification summary

| Gate | Kết quả |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 60 files / 204 tests |
| `npm run validate:migrations` | PASS — 31 migrations |
| `npm run ui:audit` | PASS — 180 authenticated routes |
| `npm run build` | PASS — 267 routes |
| `npm run audit:data-health` | PASS — không orphan/missing role/auth link |
| `npm run smoke` | PASS — live/ready/login 200 |
| `npm run smoke:authenticated` | PASS — supervisor, employee, deny cases và mobile 390px |

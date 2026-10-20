# Ma trận Realtime

PostgreSQL/API là nguồn dữ liệu có thẩm quyền. Realtime chỉ mang metadata để invalidate; UI refetch từ API và fallback reconcile theo lifecycle/polling.

| Domain | Nguồn thay đổi | Audience / scope | Filter transport | UI bị invalidate | Dedup key | Reconcile khi reconnect | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Notifications | `notifications` | đúng `recipient_account_id` | `recipient_account_id=eq.<account>` + RLS | chuông, unread count, danh sách | commit + event + notification ID | refetch unread/list | polling 60 giây |
| Approvals | `approval_cases`, `approval_steps`, `approval_delegations` | requester, assignee/delegate hoặc người có `approval.inbox.view` | outbox `audience=eq.authenticated` + RLS permission | inbox, chi tiết, pending count, dashboard | `event_key` outbox | refetch view hiện tại | lifecycle 60 giây |
| Attendance | `attendance_events` | chủ tài khoản hoặc `attendance.view_all` | outbox + RLS | trạng thái hôm nay, lịch sử, dashboard | `event_key` | refetch dashboard/history; sync queue riêng | lifecycle + queue retry |
| Leave | `leave_requests` | người tạo hoặc `leave.view_all` | outbox + RLS | danh sách, chi tiết, approval/dashboard | `event_key` | refetch scope hiện tại | lifecycle 60 giây |
| Employees | `employees` | `employee.view` | outbox + RLS | danh sách/chi tiết HR, dashboard | `event_key` | refetch route đang mở | lifecycle 60 giây |
| Projects | `projects`, `project_assignments`, `worksites`, `project_updates`, `project_issues` | `project.view`/quyền project tương ứng; API ép assigned/managed/created/all | outbox + RLS | danh sách, chi tiết, update, monitoring/dashboard | `event_key` | refetch API scoped | lifecycle 60 giây |
| Worker attendance | `worker_attendance_sessions` | `worker_attendance.view_project`; API ép project scope | outbox + RLS | hôm nay, danh sách, chi tiết phiên | `event_key` | refetch API; không ghi đè wizard đang sửa | lifecycle 60 giây |
| Timesheets/shifts | `shifts`, `shift_assignments`, `timesheet_periods`, `timesheet_exceptions`, `work_calendar_days` | `shift.view`/`timesheet.view` | outbox + RLS | kỳ công, chi tiết mobile, ngoại lệ, ca, lịch, dashboard | `event_key` | refetch period/list | lifecycle 60 giây |
| Warehouse | `inventory_documents`, `inventory_balances`, `stock_counts` | `warehouse.view`; API ép warehouse scope | outbox + RLS | dashboard, chứng từ, tồn, ledger | `event_key` | refetch authoritative ledger/balance | lifecycle 60 giây |
| Import/export | `shipments`, `import_contracts`, `business_partners` | assignee hoặc permission module tương ứng | outbox + RLS | dashboard, shipment/contract/partner | `event_key` | refetch API scoped | lifecycle 60 giây |
| Settings | `system_settings`, `approval_workflows` | app account active; workflow event yêu cầu quyền quản lý; payload không chứa cấu hình | outbox + RLS | shell/settings/workflow khi consumer đăng ký | `event_key` | đọc lại config API | reload/lifecycle |
| System notices | `system_notices` | mọi app account active; API lọc audience cụ thể | outbox + RLS, dữ liệu thật qua API | banner | `event_key` | refetch active notices | lifecycle 60 giây |
| Executive dashboard | mọi invalidation domain có liên quan | quyền dashboard + quyền widget trong API | fan-out nội bộ từ coordinator | metrics, attention, recent activity | cùng event domain | refetch toàn read model hoặc widget | lifecycle 60 giây |

## Trạng thái triển khai

- Coordinator, lifecycle, dedup, BroadcastChannel, token bridge và consumer reconciliation: đã triển khai trong code.
- Migration outbox/RLS/publication: đã tạo, chưa áp remote.
- Notification trực tiếp: đã nối.
- Domain bus: hoạt động sau khi migration được review và áp.
- RLS/integration/multi-user trên Supabase thật: chưa có bằng chứng; không đánh dấu production-complete.

## Quy tắc mở rộng

Chỉ thêm trigger khi thay đổi persisted có ích cho người đang xem. Không đưa payload nghiệp vụ/PII vào outbox. Consumer mới phải dùng domain hiện có, refetch API scoped và cleanup subscription khi unmount.

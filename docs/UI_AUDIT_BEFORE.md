# UI audit trước MASTER 03

Audit ngày 2026-09-15. Dữ liệu, mutation, permission và Realtime hiện hữu là nguồn sự thật; bảng này chỉ mô tả kiến trúc trình bày cần thay đổi.

| Route / nhóm route | Người dùng | Đối tượng và tác vụ chính | Archetype hiện tại / vấn đề | Archetype đích | Realtime cần giữ | Desktop / tablet / mobile | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/login` | Mọi người dùng | Phiên đăng nhập | Brand split-screen đã có; shadow/radius còn nặng | Cổng đăng nhập thương hiệu tiết chế | Không áp dụng | 2 cột desktop; 1 cột mobile | Trung bình |
| `/workspace` | Người có nhiều module | Chọn ứng dụng được cấp quyền | Launcher tốt nhưng card/icon pastel và shortcut còn giống dashboard | Application launcher gọn, theo quyền | Thông báo/attention refetch | Grid co giãn; mobile dùng bottom nav | Trung bình |
| `/dashboard`, `/dashboard/*`, `/home` | Điều hành, HR, kho, XNK, giám sát, nhân viên | Ngoại lệ, hàng đợi, thay đổi gần đây | Auto-fit card grid; KPI lồng card; `HIGH/LOW`; Quick Actions; cùng item có thể lặp | Operational Briefing ưu tiên ngoại lệ | Domain dashboard invalidate + refetch, dedup | 2 vùng bất đối xứng desktop; 1 luồng mobile | Rất cao — Golden A |
| `/employees`, `/employees/[id]/*`, `/employees/new` | HR/quản lý | Danh sách và hồ sơ nhân viên | List/table tốt nhưng detail rời ngữ cảnh; filter nằm trong card toolbar | Roster workspace + inspector/dedicated edit | Employees domain reconciliation | Table rộng; tablet inspector drawer; mobile detail route | Cao |
| `/attendance`, `/attendance/history*`, `/attendance/records*` | Nhân viên, HR/reviewer | Chấm vào/ra và xử lý ngoại lệ | Luồng camera đúng nhưng hai card desktop, nhãn Online/Offline; timeline yếu | Timeline/field task | Attendance domain + IndexedDB queue | Field-first mobile; review table desktop | Rất cao — Golden C |
| `/timesheets*`, `/shifts`, `/settings/attendance/*` | HR/quản lý | Kỳ công, ngoại lệ, ca/lịch/chính sách | Form/list dùng card đồng đều, hierarchy theo component cũ | Exception queue + period workspace + configuration forms | Timesheets/shifts invalidate + refetch | Table desktop; stacked record mobile | Cao |
| `/leave*` | Nhân viên, quản lý, HR | Tạo/xem/duyệt đơn và số dư | Nhiều card/form, điều hướng rời | Request workspace và decision context | Leave + approvals domain | Split context desktop; sheet/detail mobile | Cao |
| `/projects*`, `/project-monitoring*` | PM/kỹ sư/điều hành | Theo dõi dự án, milestone, issue, update | Card/timeline pha trộn; summary có xu hướng KPI đều | Project control board | Projects domain scoped refetch | Board + timeline desktop; task feed mobile | Cao |
| `/worker-attendance*` | Giám sát công trường | Điểm danh/chốt phiên công nhân | Wizard/detail đã có nhưng card container nặng | Site roster field task | Worker-attendance domain; không ghi đè draft | Split roster desktop; one-hand mobile | Cao |
| `/warehouse`, `/warehouse/receipts*` | Thủ kho/người ghi sổ | Hàng đợi, lập và ghi sổ phiếu nhập | 4 KPI card; editor là card thông tin + card dòng + card action | Transaction workbench master/document/inspector | Warehouse invalidate sau commit, authoritative refetch | 3 vùng desktop; 2 vùng tablet; detail mobile | Rất cao — Golden B |
| `/warehouse/issues*`, `/warehouse/transfers*`, `/warehouse/adjustments*`, `/warehouse/stock-counts*` | Thủ kho | Phiếu xuất/chuyển/điều chỉnh/kiểm kê | Bốn CRUD page gần như giống nhau | Cùng document grammar, khác field/lifecycle thật | Warehouse domain | Như phiếu nhập, không ép modal | Cao |
| `/warehouse/items*`, `/warehouse/warehouses*`, `/warehouse/inventory`, `/warehouse/ledger` | Thủ kho/quản lý | Danh mục, số dư, sổ kho | Table dùng được; card state lớn; mã chưa thống nhất mono | Dense operational tables | Warehouse domain | Full-width table; mobile row card có kiểm soát | Cao |
| `/import-export`, `/import-export/shipments*` | Nhân viên XNK/quản lý | Theo dõi lô, milestone, chứng từ, nhận hàng | Tab/detail/card grammar, một số thuật ngữ Anh | Shipment desk + timeline + inspector | Import-export domain scoped refetch | Master-detail desktop; drawer/detail mobile | Cao |
| `/import-export/contracts*`, `/partners`, `/documents` | XNK | Hợp đồng, đối tác, chứng từ | List-first một phần; còn card summary | Dense list + contextual create/detail | Import-export domain | Table/drawer | Trung bình |
| `/approvals*` | Quản lý/người duyệt | Duyệt/từ chối liên tiếp | Inbox và detail tách route, context dễ mất | Decision queue + inspector | Approval domain + reconciliation | Split queue; full-screen detail mobile | Cao |
| `/notifications*` | Mọi người dùng | Đọc thông báo | List card, metadata nhỏ | Activity inbox | Notification scoped subscription | List desktop/mobile | Trung bình |
| `/reports` | HR/điều hành | Xuất dữ liệu | Cấu hình/template card | Report/export workbench | Job/report state refresh | Form giới hạn chiều rộng; history full width | Trung bình |
| `/settings*`, `/system-admin*` | Admin được cấp quyền | Cấu hình, user, role, audit, tích hợp | Sidebar trong sidebar; nhãn `Dashboard`, `Audit log`, `Webhook deliveries`, `Data mappings`; card lồng | Configuration workspace | Settings/workflow/system notices | Context nav + form canvas | Cao |
| Error/loading/not-found | Mọi người dùng | Phục hồi trạng thái | State box lớn, spinner/description chung | Inline state cùng hình dạng nội dung | Kết nối/retry đúng nguồn | Không chiếm toàn màn hình vô ích | Cao |

## Nguyên nhân dùng chung

1. `AppSidebar` vừa làm bộ chuyển ứng dụng vừa làm điều hướng module; chưa có App Rail riêng.
2. `AppHeader` vừa hiển thị route title vừa để route lặp `PageHeader`, đồng thời chứa menu tạo mới toàn hệ thống không theo ngữ cảnh.
3. `Card` và `.page-stack` được dùng như container mặc định nên nhiều module khác nhau có cùng cấu trúc thị giác.
4. Dashboard registry còn widget `quick_actions`; view hiển thị priority code tiếng Anh trực tiếp.
5. Font chính là Noto Sans/Be Vietnam Pro fallback, chưa phải IBM Plex self-host theo contract.
6. Route metadata còn copy kiểu developer (`route`, `extension point`, `module sẽ triển khai`) và nhãn pha tiếng Anh.
7. Table đã responsive nhưng empty/loading state thay toàn bảng bằng khối lớn; mã nghiệp vụ chưa có quy ước mono tập trung.
8. Layout `page-main` khóa `max-width: 1440px`, tạo khoảng trống ở ultrawide cho workbench dữ liệu lớn.

## Design contract cho route trọng yếu

| Route | Tác vụ quyết định | Primary action | Ngoại lệ ưu tiên | Context phải giữ | Mobile khác biệt | Chức năng bất biến |
| --- | --- | --- | --- | --- | --- | --- |
| Executive briefing | Chọn việc cần xử lý kế tiếp | Mở item ưu tiên cao nhất | Duyệt chờ, dự án, công, kho, lô hàng | Hàng đợi và activity | Một luồng ưu tiên theo thời gian | Dashboard API, permission widget, Realtime refetch |
| Warehouse receipt | Hoàn thiện và ghi sổ phiếu | Lưu nháp hoặc ghi sổ theo trạng thái | Lỗi tải, conflict, phiếu đã khóa | Header phiếu, dòng hàng, trạng thái/lịch sử | Detail theo section, action sticky | Payload, idempotency, post/reverse, attachment |
| Attendance | Ghi nhận chấm vào/ra an toàn | Chấm vào / Chấm ra | GPS, camera, offline queue, chưa sync | Trạng thái mạng, địa điểm, timeline hôm nay | Một tay, camera-first, safe area | IndexedDB, retry, server confirmation, Realtime |

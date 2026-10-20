# PROMPT 14 — DASHBOARD TỔNG HỆ THỐNG, TRANG CHỦ THEO VAI TRÒ, TÌM KIẾM TOÀN CỤC VÀ COMMAND/SEARCH CENTER

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã triển khai hoặc xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- Nhân sự
- tài khoản / RBAC
- Admin Console
- chấm công cá nhân
- Project / Worksite
- điểm danh công nhân
- nghỉ phép / approval / phép năm / PDF
- bảng công / khóa kỳ / Excel
- cập nhật dự án / issue / dashboard dự án
- Kho
- Xuất nhập khẩu
- Approval Center
- Notification Center
- Document Center
- Audit Log
- Business Configuration Center
- API / Webhook / Integration Platform

Prompt này triển khai **Dashboard tổng hệ thống và Global Search/Command Center**.

Mục tiêu là giúp mỗi nhóm người dùng khi vào hệ thống thấy đúng việc cần xử lý, thay vì mọi người nhìn một dashboard giống nhau.

Không xây dashboard kiểu trình diễn với quá nhiều chart.

Không dùng fake KPI.

Không tạo “Welcome back” marketing UI.

---

# 1. MỤC TIÊU

Xây:

1. Dashboard tổng hệ thống.
2. Dashboard theo vai trò/quyền.
3. Trang chủ cho nhân viên.
4. Trang chủ cho giám sát.
5. Trang chủ cho HR.
6. Trang chủ cho Kho.
7. Trang chủ cho XNK.
8. Trang chủ cho quản lý/ban giám đốc.
9. Global Search.
10. Search Center.
11. Command Palette.
12. Quick Actions.
13. Recent Items.
14. My Work / Việc cần xử lý.
15. Cross-module attention center.
16. Permission-aware result filtering.
17. Mobile home tối giản.
18. Search index/read model foundation.
19. Dashboard widgets configurable trong giới hạn an toàn.
20. Admin config cho default landing page.

---

# 2. NGUYÊN TẮC DASHBOARD

Dashboard phải trả lời:

```text
Hôm nay có gì?
Có gì bất thường?
Tôi cần xử lý gì?
Tôi cần đi đâu tiếp theo?
```

Không phải:

```text
Có bao nhiêu card đẹp?
Có bao nhiêu biểu đồ?
```

---

# 3. ROLE-BASED KHÔNG ĐỒNG NGHĨA HARD-CODE ROLE

Không làm:

```ts
if (role === "HR") renderHRDashboard()
```

Phải dựa trên:

```text
permissions
user context
assignments
scope
```

Có thể có dashboard profile/preset theo nhóm người dùng, nhưng access/data vẫn permission-driven.

---

# 4. DEFAULT LANDING PAGE

Admin Console có thể cấu hình default landing page theo user type hoặc permission profile.

Ví dụ:

```text
Nhân viên → /home
Giám sát → /worker-attendance/today
HR → /dashboard/hr
Kho → /dashboard/warehouse
XNK → /dashboard/import-export
BGĐ → /dashboard/management
```

Nếu user không có quyền route đó:

- fallback route hợp lệ
- không 403 ngay sau login

---

# 5. ROUTING

Ví dụ:

```text
/home

/dashboard
/dashboard/hr
/dashboard/warehouse
/dashboard/import-export
/dashboard/management

/search
/search/results

/command
```

Command palette không nhất thiết có route riêng nếu là overlay, nhưng search result phải deep-link được.

---

# 6. DASHBOARD CHUNG

Route:

```text
/dashboard
```

Hiển thị theo permission:

```text
Việc cần xử lý
Cảnh báo
Hoạt động gần đây
Quick actions
```

Không cố hiển thị mọi module.

---

# 7. MY WORK / VIỆC CẦN XỬ LÝ

Đây là section quan trọng nhất.

Nguồn có thể gồm:

```text
Approval cần duyệt
Timesheet exception
Pending sync
Project issue assigned
Shipment cần chú ý
Warehouse document chờ post
Document expiring
System notice
```

Mỗi item:

```text
Type
Title
Context
Priority
Due/age
Deep link
```

---

# 8. CROSS-MODULE ATTENTION CENTER

Có service/read model gom các exception quan trọng từ nhiều module.

Ví dụ:

```text
3 đơn chờ duyệt
5 bảng công cần xử lý
2 shipment cần chú ý
1 project có issue nghiêm trọng
```

Không copy data thủ công vào dashboard.

Dashboard query từ domain summary/read models.

---

# 9. KHÔNG ĐỂ DASHBOARD TỰ SỬA NGHIỆP VỤ

Dashboard chỉ:

- hiển thị
- deep link
- quick action an toàn

Không nhét full complex edit vào card.

---

# 10. NHÂN VIÊN — MOBILE HOME

Route:

```text
/home
```

Ưu tiên:

```text
Ngày hôm nay
Ca làm
Trạng thái chấm công
Primary CTA
Đơn đang chờ
Thông báo
Bảng công gần đây
```

Ví dụ:

```text
Thứ Tư, 09/09/2026

Ca hành chính
08:00–17:00

[ CHẤM VÀO ]

Đơn nghỉ
1 đơn đang chờ duyệt

Thông báo
2 thông báo mới
```

Không chart.

---

# 11. GIÁM SÁT — MOBILE HOME

Ưu tiên:

```text
Công trường hôm nay
Số công nhân dự kiến
Trạng thái điểm danh
Quick CTA
Project issues
Recent updates
```

Ví dụ:

```text
Cảng ABC — QC03
18 công nhân dự kiến

[ ĐIỂM DANH BUỔI SÁNG ]

Cần chú ý
1 vấn đề mức cao

Cập nhật gần đây
...
```

---

# 12. HR DASHBOARD

Route:

```text
/dashboard/hr
```

Sections:

```text
Việc cần xử lý
- Đơn nghỉ chờ duyệt
- Hồ sơ nhân sự chưa hoàn thiện
- Công nhân tạm chờ HR hoàn thiện
- Bảng công có exception
- Tài liệu nhân sự sắp hết hạn nếu có

Tổng quan nhân sự
- Đang làm việc
- Thử việc
- Nghỉ việc gần đây nếu cần

Chấm công hôm nay
- Đã chấm
- Chưa chấm
- Có vấn đề

Hoạt động gần đây
```

Không cần biểu đồ cầu kỳ.

---

# 13. WAREHOUSE DASHBOARD

Route:

```text
/dashboard/warehouse
```

Sections:

```text
Phiếu chờ xử lý
Hàng sắp hết
Hết hàng
Kiểm kê đang mở
Giao dịch gần đây
```

Quick actions:

```text
+ Phiếu nhập
+ Phiếu xuất
+ Chuyển kho
```

Theo permission.

---

# 14. IMPORT-EXPORT DASHBOARD

Route:

```text
/dashboard/import-export
```

Sections:

```text
Sắp về
Đang vận chuyển
Đang thông quan
Chờ nhập kho
Cần chú ý
```

Quick links:

```text
Tạo shipment
Xem shipment
Chứng từ thiếu
```

---

# 15. MANAGEMENT DASHBOARD

Route:

```text
/dashboard/management
```

Dành cho:

- quản lý
- ban giám đốc

Hiển thị:

```text
Project health
Projects cần chú ý
Open high/critical issues
Nhân sự tổng quan
Attendance/timesheet anomalies high level
Warehouse alerts high level
Shipment alerts
Approvals important
```

Không show chi tiết vận hành quá sâu mặc định.

---

# 16. MANAGEMENT DASHBOARD KHÔNG PHẢI SUPERUSER VIEW

Ban giám đốc không nhất thiết thấy dữ liệu nhạy cảm HR.

Ví dụ:

- thấy headcount
- không thấy CCCD/bank
- thấy timesheet issue count
- không thấy ảnh chấm công nếu không permission

Dashboard respect permissions.

---

# 17. KPI DESIGN

Chỉ dùng KPI có ý nghĩa.

Ví dụ:

```text
Dự án đang hoạt động
Dự án có rủi ro
Shipment cần chú ý
Phiếu chờ duyệt
```

Không tạo:

```text
Productivity Score
Efficiency Index
Employee Happiness
```

nếu hệ thống không có dữ liệu thật.

---

# 18. NO FAKE CHART

Không dựng chart sample.

Nếu chưa có đủ dữ liệu:

```text
Chưa có dữ liệu.
```

Không seed production-looking demo chart.

---

# 19. CHART USAGE

Nếu dùng chart:

- chỉ khi trend thật sự hữu ích
- tối đa một vài chart
- không 3D
- không animation mạnh
- tooltip rõ

Ví dụ hợp lý:

```text
Headcount theo tháng
Shipment ETA trend
Warehouse movement trend
```

Nhưng không bắt buộc.

---

# 20. DASHBOARD CARD

Card nhỏ, data-oriented.

Không bo quá lớn.

Card:

```text
Label
Value
Context / trend if real
Deep link
```

Không decorative illustration.

---

# 21. RECENT ACTIVITY

Nguồn từ human-readable activity projections.

Ví dụ:

```text
HR A đã cập nhật hồ sơ NV001
Kho đã ghi sổ PNK-001
Shipment SHP-001 cập nhật ETA
Project ABC có issue mới
```

Không show raw audit kỹ thuật.

---

# 22. RECENT ITEMS

Theo user:

```text
Nhân viên vừa xem
Project vừa xem
Shipment vừa xem
Phiếu vừa xem
```

Có thể lưu:

```text
recent_entity_access
```

Không lưu sensitive content.

---

# 23. FAVORITES — OPTIONAL

Có thể cho pin/favorite entity:

```text
Project A
Warehouse main
Shipment X
```

V1 optional.

Không biến thành social/bookmark feature phức tạp.

---

# 24. QUICK ACTIONS

Quick actions theo permission.

Ví dụ HR:

```text
+ Thêm nhân viên
+ Tạo đơn nghỉ thay nếu permission
+ Mở bảng công
```

Kho:

```text
+ Phiếu nhập
+ Phiếu xuất
```

Giám sát:

```text
Điểm danh hôm nay
+ Cập nhật dự án
```

Không show action user không có quyền.

---

# 25. GLOBAL SEARCH — MỤC TIÊU

User có thể search một chỗ:

```text
NV001
Nguyễn Văn A
SHP-2026-001
PNK-2026-005
Cảng ABC
B/L 12345
```

và được kết quả đúng module.

---

# 26. GLOBAL SEARCH ENTRY

Header có search:

```text
Tìm nhân viên, dự án, shipment, chứng từ...
```

Shortcut:

```text
Ctrl/Cmd + K
```

hoặc:

```text
/
```

nếu không conflict.

---

# 27. COMMAND PALETTE

Command Palette mở bằng shortcut.

Sections:

```text
Tìm kiếm
Đi đến
Tạo mới
Gần đây
```

Ví dụ:

```text
Đi đến Nhân viên
Đi đến Bảng công
Tạo phiếu nhập
Tạo shipment
Mở Project ABC
```

Không show command không có permission.

---

# 28. SEARCH ENTITIES

Ít nhất support:

```text
Employee
Project
Worksite
Warehouse Item
Warehouse Document
Shipment
Import Contract
Leave Request
Timesheet Period
Document
```

Có thể mở rộng.

---

# 29. SEARCH RESULT MODEL

Mỗi result:

```text
entity_type
entity_id
title
subtitle
reference
status
icon
deep_link
score
```

Không trả full entity data.

---

# 30. SEARCH PERMISSION

Search phải enforce permission **ở backend**.

Không fetch tất cả rồi filter client.

Ví dụ user không có:

```text
employee.view
```

thì không thấy employee result.

---

# 31. SEARCH SENSITIVE DATA

Không index/show:

```text
CCCD
bank account
home address
private document content
```

mặc định.

Search theo sensitive fields chỉ nếu:

- use case thật sự cần
- permission riêng
- backend secure

V1 metadata search là đủ.

---

# 32. SEARCH EMPLOYEE

Search theo:

```text
employee code
name
phone if permission
company email
```

Kết quả:

```text
Nguyễn Văn A
NV001 · Kỹ thuật · Kỹ sư
```

Không show CCCD.

---

# 33. SEARCH PROJECT

Search:

```text
project code
project name
customer
worksite
```

Respect project scope.

---

# 34. SEARCH WAREHOUSE

Search:

```text
item code
item name
receipt number
issue number
transfer number
```

Respect warehouse scope.

---

# 35. SEARCH XNK

Search:

```text
shipment number
contract number
BL number
container number
supplier
```

Respect XNK permission.

---

# 36. SEARCH DOCUMENT

Search metadata:

```text
title
document number
type
owner reference
```

Không full content indexing ở V1.

---

# 37. SEARCH SUGGESTION

Khi user gõ:

```text
SHP
```

suggest recent/relevant shipment.

Không cần fuzzy AI.

Dùng deterministic search/ranking.

---

# 38. SEARCH RANKING

Ranking có thể dựa:

```text
exact code match
prefix match
name/title match
recent access
entity relevance
```

Không cần ML.

---

# 39. EXACT MATCH PRIORITY

Ví dụ search:

```text
NV001
```

Employee code exact phải lên trước người có name chứa NV001.

---

# 40. SEARCH TYPO TOLERANCE

Có thể support basic fuzzy search.

Không cần external search engine nếu database đủ.

Nếu dataset lớn sau này mới cân nhắc dedicated search index.

---

# 41. SEARCH CENTER PAGE

Route:

```text
/search?q=...
```

Cho:

```text
All
Employees
Projects
Warehouse
Shipments
Documents
```

Tab/filter.

URL giữ query.

---

# 42. COMMAND PALETTE VS SEARCH PAGE

Command palette:

- nhanh
- top results
- navigation/action

Search page:

- full results
- filters
- pagination

Không nhét hàng trăm kết quả vào palette.

---

# 43. SEARCH INDEX STRATEGY

V1 có thể dùng DB query + indexed normalized columns.

Có thể tạo read model:

```text
search_index
```

nếu cần.

Fields:

```text
entity_type
entity_id
title
subtitle
keywords
reference
scope metadata
updated_at
```

Nhưng phải đảm bảo permission filtering.

---

# 44. SEARCH INDEX KHÔNG CHỨA SENSITIVE DATA

Không index:

- password
- token
- CCCD
- bank
- private content

Chỉ searchable metadata.

---

# 45. SEARCH INDEX SYNC

Khi entity update:

```text
event
↓
update search index
```

hoặc transactionally update read model.

Không để search stale lâu.

---

# 46. SEARCH INDEX FAILURE

Nếu index update fail:

- core business save vẫn phải xử lý đúng
- retry indexing
- log

Không mất business data.

---

# 47. RECENT SEARCH

Có thể lưu:

```text
recent_search_queries
```

per user.

Không lưu sensitive search nếu query có thể chứa PII.

V1 có thể không lưu query history, chỉ recent entities.

---

# 48. COMMAND ACTION SAFETY

Command:

```text
Tạo phiếu nhập
```

deep link đến form.

Không thực hiện destructive action trực tiếp từ palette.

Không:

```text
Delete Employee
Post Receipt
```

qua command quick action.

---

# 49. GLOBAL CREATE

Command palette có:

```text
Tạo nhân viên
Tạo project
Tạo phiếu nhập
Tạo shipment
```

Theo permission.

---

# 50. MOBILE SEARCH

Mobile header có search icon.

Mở full-screen search.

UI:

```text
Tìm kiếm
[ input ]

Gần đây
Kết quả
```

Không command palette keyboard-centric trên mobile.

---

# 51. MOBILE DASHBOARD

Không thu nhỏ desktop dashboard.

Mỗi role mobile chỉ show:

```text
primary task
attention
recent
notifications
```

Không dense KPI grid.

---

# 52. DASHBOARD CONFIGURATION

Admin có thể configure limited widget visibility.

Route:

```text
/system-admin/dashboard
```

Cho:

- bật/tắt widget có sẵn
- reorder widget trong preset
- default dashboard preset
- default landing

Không cho arbitrary dashboard builder.

---

# 53. WIDGET REGISTRY

Tạo registry:

```text
my_approvals
timesheet_exceptions
project_attention
warehouse_low_stock
shipment_attention
recent_activity
```

Mỗi widget có:

```text
key
label
required_permission
allowed_dashboard_profiles
```

---

# 54. WIDGET PERMISSION

Nếu admin bật widget nhưng user không permission:

- widget không render

Không bypass permission.

---

# 55. WIDGET ERROR ISOLATION

Một widget API fail không làm toàn dashboard crash.

Ví dụ:

```text
Không thể tải thông tin shipment.
[Thử lại]
```

Các widget khác vẫn hoạt động.

---

# 56. WIDGET LOADING

Skeleton per widget.

Không block toàn dashboard vì một query chậm.

---

# 57. DASHBOARD QUERY PERFORMANCE

Không gọi 20 API sequential.

Có thể:

- parallel queries
- aggregated dashboard endpoint
- cache summary

Tùy stack.

Không fetch full records khi chỉ cần count.

---

# 58. AGGREGATE ENDPOINT

Có thể:

```text
GET /api/v1/dashboard
```

trả các sections user có permission.

Hoặc dedicated endpoints.

Không return sensitive fields không cần.

---

# 59. DASHBOARD CACHE

Summary data có thể cache ngắn.

Nhưng:

- approval count
- attendance current state

cần fresh hơn.

Không cache một kiểu cho mọi widget.

---

# 60. USER CONTEXT

Dashboard có thể query:

```text
current employee
current assignments
project memberships
warehouse scopes
permissions
```

Không hard-code department logic trong UI.

---

# 61. NO PERSONALIZED AI SUMMARY IN V1

Không tự generate:

```text
AI says your day is productive
```

Không cần LLM trong dashboard.

Nếu sau này có AI summary, prompt riêng.

---

# 62. TIME AWARENESS

Dashboard dùng timezone config.

Ví dụ:

```text
Hôm nay
```

theo Asia/Ho_Chi_Minh.

Không server UTC day boundary làm user thấy sai ngày.

---

# 63. EMPTY STATE

Ví dụ Management:

```text
Không có dự án cần chú ý.
```

Không tạo fake item.

HR:

```text
Không có bảng công cần xử lý.
```

---

# 64. ALERT PRIORITY

Cross-module alert normalize:

```text
INFO
LOW
MEDIUM
HIGH
CRITICAL
```

Nhưng domain severity vẫn giữ riêng.

Dashboard chỉ map để sort attention.

---

# 65. ATTENTION SORT

Ưu tiên:

```text
critical
high
overdue
older unresolved
```

Không sort random.

---

# 66. ATTENTION DEDUP

Nếu một shipment có:

```text
ETA delayed
Document missing
Customs issue
```

có thể show:

```text
SHP-001 · 3 vấn đề cần chú ý
```

thay vì spam 3 card nếu UX phù hợp.

Click vào detail.

---

# 67. MY APPROVAL COUNT

Dashboard dùng central Approval Platform Prompt 12.

Không query từng domain approval riêng.

---

# 68. NOTIFICATION COUNT

Dùng Notification Center unread-count endpoint.

Không duplicate count logic.

---

# 69. RECENT ACTIVITY SOURCE

Dùng domain activity projections/audit summaries.

Không expose audit raw detail.

---

# 70. DASHBOARD EMPLOYEE SELF

Employee không được thấy:

- project issue all company
- warehouse balances
- XNK shipment
- HR statistics

trừ permission.

---

# 71. DASHBOARD HR SCOPE

HR có thể thấy all HR, nhưng project/warehouse chỉ nếu permission.

Không coi HR là superuser.

---

# 72. DASHBOARD MANAGEMENT SCOPE

Management có thể có broader read permissions nhưng still explicit.

Không hard-code executive bypass.

---

# 73. ACCESSIBILITY

Dashboard:

- card focusable nếu clickable
- semantic heading
- no color-only status
- keyboard navigation
- search combobox ARIA
- command palette focus trap
- shortcut not conflict with browser/input

---

# 74. COMMAND PALETTE ACCESSIBILITY

Requirements:

- opens via shortcut/button
- focus input
- arrow navigation
- Enter select
- Esc close
- screen-reader label
- active descendant semantics nếu appropriate

---

# 75. SEARCH KEYBOARD

Desktop:

```text
Ctrl/Cmd + K
```

Nếu user đang typing input:

- shortcut vẫn có thể open nếu expected
- "/" shortcut không trigger khi typing

---

# 76. RESPONSIVE

Dashboard desktop:

- grid vừa phải
- no huge cards
- 2–4 columns tùy screen

Tablet:

- 2 columns

Mobile:

- 1 column

Không horizontal overflow.

---

# 77. WIDE SCREEN

Không kéo card full 2000px.

Use max content width hoặc adaptive grid.

Tables có thể full width.

---

# 78. SEARCH PERFORMANCE

Debounce input.

Không request mỗi keystroke ngay lập tức nếu backend load.

Ví dụ:

```text
200–300ms
```

Không hard-code nếu library handles.

---

# 79. SEARCH MIN LENGTH

Code exact search có thể 1–2 chars.

General fuzzy search nên 2–3 chars để tránh heavy query.

UX:

```text
Nhập ít nhất 2 ký tự.
```

---

# 80. SEARCH CANCELLATION

Cancel stale requests khi user gõ tiếp.

Không để response cũ overwrite kết quả mới.

---

# 81. SEARCH PAGINATION

Search page:

- paginate
- per entity totals if cheap

Không show 10,000 results.

---

# 82. SEARCH ANALYTICS — OPTIONAL

Có thể log:

```text
search performed
no result
result clicked
```

nhưng không lưu sensitive query raw nếu privacy concern.

V1 optional.

---

# 83. NO RESULT

UI:

```text
Không tìm thấy kết quả cho "SHP999".
```

Suggestions:

```text
Kiểm tra lại mã hoặc tên.
```

Không generic AI text.

---

# 84. SEARCH DEEP LINK

Result click:

```text
Employee → /employees/:id/profile
Shipment → /import-export/shipments/:id/overview
Project → /projects/:id/overview
```

Không mở generic detail modal nếu route entity tồn tại.

---

# 85. RECENT ENTITY ACCESS

Khi user mở entity:

record:

```text
user_id
entity_type
entity_id
last_accessed_at
```

Không record every refresh spam.

Upsert.

---

# 86. RECENT ITEM SECURITY

Nếu permission bị revoke:

- recent item không hiện nữa
- direct route permission denied

Không cache stale title sensitive.

---

# 87. USER PINNED SHORTCUTS — OPTIONAL

Có thể cho user pin:

```text
Bảng công
Project A
Kho chính
```

V1 optional.

Nếu implement, no permission bypass.

---

# 88. ADMIN DASHBOARD PRESET

Admin Console:

```text
Dashboard presets
```

Ví dụ:

```text
Employee
Supervisor
HR
Warehouse
Import Export
Management
```

Preset chỉ chọn widget/landing layout.

Permission vẫn quyết định dữ liệu.

---

# 89. PRESET ASSIGNMENT

Không assign preset dựa hard-code role name nếu không cần.

Có thể:

- default by permission profile
- user preference
- admin assignment

Keep simple.

---

# 90. USER DASHBOARD PREFERENCE

Cho user reorder/hide widget cá nhân nếu feature nhẹ.

Không cho bật widget họ không có permission.

Nếu không cần V1, chỉ admin preset.

---

# 91. SERVER-SIDE DASHBOARD AUTH

Mọi dashboard endpoint:

- authenticate
- authorize each dataset
- scope filter

Không trả all data rồi UI hide.

---

# 92. GLOBAL SEARCH API

Ví dụ:

```text
GET /api/v1/search?q=...&types=employee,project,shipment
```

Response:

```text
results
next cursor
```

Permission filtered.

---

# 93. ENTITY SEARCH ENDPOINTS

Có thể dùng:

```text
/api/v1/search/employees
/api/v1/search/projects
```

nếu performance/permission dễ hơn.

Global search service orchestrates.

---

# 94. SEARCH SERVICE

Tạo:

```text
GlobalSearchService
```

Không scatter search query logic trong header component.

---

# 95. SEARCH PROVIDER REGISTRY

Mỗi module register provider:

```text
EmployeeSearchProvider
ProjectSearchProvider
WarehouseSearchProvider
ShipmentSearchProvider
DocumentSearchProvider
```

GlobalSearchService merge/rank.

Không build hard-coded giant switch nếu dễ mở rộng.

---

# 96. PROVIDER CONTRACT

Concept:

```text
search(query, userContext, limit)
```

Return standardized result.

Permission handled in provider/service.

---

# 97. SEARCH TIMEOUT

Nếu one provider chậm:

- return partial results nếu architecture phù hợp
- label unavailable category if needed

Không để shipment search làm toàn palette đứng.

---

# 98. COMMAND REGISTRY

Command Palette action registry:

```text
key
label
keywords
required_permission
route/action type
```

Không hard-code commands rải nhiều component.

---

# 99. COMMAND TYPES

V1 chỉ support:

```text
NAVIGATE
CREATE_ROUTE
OPEN_SEARCH
```

Không support:

```text
POST
DELETE
APPROVE
REVERSE
```

trực tiếp.

---

# 100. AUDIT

Không cần audit mọi dashboard view.

Audit/search access chỉ nếu sensitive domain existing policies yêu cầu.

Recent access không phải audit.

---

# 101. PRIVACY

Không show personal/private data trong global results nhiều hơn cần.

Employee result:

```text
name
employee code
department
position
```

Không:

```text
home address
CCCD
bank
```

---

# 102. DASHBOARD TEST CASES

- employee dashboard
- supervisor dashboard
- HR dashboard
- warehouse dashboard
- XNK dashboard
- management dashboard
- user with mixed permissions
- default landing fallback
- one widget API failure isolation
- no fake data

---

# 103. SEARCH TEST CASES

- exact employee code
- employee name
- project code
- shipment number
- BL number
- warehouse item code
- document title
- permission filtering
- project scope
- warehouse scope
- no sensitive field
- stale request cancellation
- no-result state

---

# 104. COMMAND PALETTE TEST CASES

- Ctrl/Cmd+K opens
- keyboard navigation
- Esc closes
- permission filters commands
- create route
- recent items
- mobile fallback search
- no destructive command

---

# 105. RECENT ITEMS TEST CASES

- entity opened
- appears recent
- upsert timestamp
- permission revoked disappears
- deleted/archived entity handled gracefully

---

# 106. ACCEPTANCE CRITERIA

## Dashboard

- [ ] Dashboard theo context/quyền.
- [ ] Không hard-code role logic.
- [ ] Employee home.
- [ ] Supervisor home.
- [ ] HR dashboard.
- [ ] Warehouse dashboard.
- [ ] XNK dashboard.
- [ ] Management dashboard.
- [ ] My Work / attention center.
- [ ] Widget error isolation.
- [ ] No fake KPI/chart.

## Search

- [ ] Global Search.
- [ ] Search Center.
- [ ] Multi-entity results.
- [ ] Permission filtering server-side.
- [ ] Scope filtering.
- [ ] No sensitive data leak.
- [ ] Exact code priority.
- [ ] Deep links.

## Command Center

- [ ] Ctrl/Cmd+K.
- [ ] Navigate/create/search commands.
- [ ] Permission-aware.
- [ ] No destructive commands.
- [ ] Keyboard accessible.

## Mobile

- [ ] Mobile home role-specific.
- [ ] Full-screen search.
- [ ] No desktop dashboard shrink.
- [ ] Touch-friendly.

## Admin

- [ ] Default landing page config.
- [ ] Dashboard presets/widgets limited config.
- [ ] Permission still source of truth.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Search performance reviewed.
- [ ] Production build pass.
- [ ] Responsive/accessibility review pass.

---

# 107. THỨ TỰ TRIỂN KHAI

1. Inspect dashboard/header/search foundation.
2. Thiết kế Dashboard Widget Registry.
3. Thiết kế dashboard read models.
4. Employee home.
5. Supervisor home.
6. HR dashboard.
7. Warehouse dashboard.
8. XNK dashboard.
9. Management dashboard.
10. Cross-module attention service.
11. GlobalSearchService.
12. Search provider registry.
13. Search Center page.
14. Command registry.
15. Command Palette.
16. Recent entities.
17. Admin dashboard preset/default landing config.
18. Permission/security review.
19. Performance/caching.
20. Tests.
21. Responsive/accessibility.
22. Lint/typecheck/build.
23. Báo cáo.

---

# 108. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Dashboards

- routes
- widgets
- data sources
- permission behavior

## Attention Center

- sources
- priority mapping
- deep links

## Global Search

- providers
- searchable entities
- ranking
- permission filtering

## Command Palette

- commands
- shortcuts
- security rules

## Admin Config

- presets
- default landing

## Performance

- caching
- query strategy

## Tests

- cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 109. QUY TẮC CUỐI

Không xây dashboard giống template SaaS marketing.

Không fake KPI.

Không fake chart.

Không hard-code dashboard theo role string.

Không cho Management dashboard bypass permission dữ liệu nhạy cảm.

Không search toàn bộ database rồi filter client.

Không index CCCD/ngân hàng/private content mặc định.

Không cho Command Palette thực hiện destructive action trực tiếp.

Không làm mobile dashboard bằng cách shrink desktop.

Không để một widget lỗi làm toàn dashboard crash.

**Dừng sau khi Dashboard theo context + My Work + Global Search + Search Center + Command Palette hoàn chỉnh, permission-safe, test/build pass và báo cáo kết quả.**

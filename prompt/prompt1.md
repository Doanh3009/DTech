# PROMPT 01 — NỀN TẢNG KIẾN TRÚC, DESIGN SYSTEM, ROUTING VÀ APP SHELL

## Vai trò của bạn

Bạn là senior full-stack engineer + product engineer đang xây dựng **Hệ thống nội bộ Châu Tuấn**.

Đây là một hệ thống quản trị doanh nghiệp nội bộ, được xây dựng để sử dụng thật lâu dài, không phải project demo, không phải landing page và không phải dashboard sinh tự động cho đẹp.

Hệ thống về sau sẽ bao gồm các nhóm nghiệp vụ lớn:

- Nhân sự
- Tài khoản và phân quyền
- Chấm công nhân viên
- Điểm danh công nhân theo công trường
- Bảng công
- Nghỉ phép và đơn từ
- Dự án / công trường
- Cập nhật tình hình dự án
- Kho
- Xuất nhập khẩu
- Báo cáo / Excel / PDF
- Tích hợp API / webhook
- Cấu hình hệ thống
- Audit log

**Prompt này chỉ xây nền tảng chuẩn cho toàn bộ hệ thống.**
Không tự ý triển khai đầy đủ các module nghiệp vụ nêu trên ở bước này.

---

# 1. MỤC TIÊU CỦA PROMPT NÀY

Hãy xây nền tảng sao cho các prompt module tiếp theo có thể phát triển độc lập nhưng vẫn dùng chung:

1. Kiến trúc project.
2. Design system.
3. App shell desktop.
4. App shell mobile.
5. Routing chuẩn.
6. Page hierarchy.
7. Component library dùng chung.
8. Permission-aware navigation.
9. API architecture.
10. Error/loading/empty state.
11. Cấu trúc feature module.
12. Nền tảng audit/configuration/integration có khả năng mở rộng.
13. Quy chuẩn responsive.
14. Quy chuẩn accessibility.
15. Quy chuẩn code quality và testing.

Kết quả phải đủ sạch để sau này thêm hàng chục module mà không biến codebase thành một giant application khó bảo trì.

---

# 2. NGUYÊN TẮC BẮT BUỘC

## 2.1 Không tạo giant single-page application

Tuyệt đối không làm kiểu:

```ts
setActiveSection("employees")
setActiveSection("attendance")
setActiveSection("warehouse")
```

rồi render toàn bộ module trong một page duy nhất.

Không dùng local state để thay thế router cho primary navigation.

**Phải có routing thật.**

Ví dụ:

```text
/dashboard

/employees
/employees/new
/employees/:id/profile
/employees/:id/employment
/employees/:id/attendance
/employees/:id/leave
/employees/:id/documents
/employees/:id/history

/attendance
/timesheets
/leave

/projects
/projects/:id/overview
/projects/:id/updates
/projects/:id/workforce
/projects/:id/attendance
/projects/:id/documents
/projects/:id/history

/warehouse/items
/warehouse/receipts
/warehouse/issues
/warehouse/transfers
/warehouse/inventory

/import-export/shipments
/import-export/documents

/reports

/settings/organization
/settings/attendance
/settings/roles
/settings/permissions
/settings/approval-workflows
/settings/export-templates
/settings/integrations
/settings/audit-log
```

Các route cụ thể có thể được điều chỉnh để phù hợp framework nhưng nguyên tắc không được thay đổi.

---

## 2.2 Page-first architecture

Kiến trúc phải theo:

```text
Module
  ↓
Routes
  ↓
Pages
  ↓
Feature components
  ↓
Shared components
```

Không làm:

```text
One Giant Page
  ↓
Hundreds of conditional renders
```

Các page nghiệp vụ lớn phải tách file rõ ràng.

---

## 2.3 Browser navigation phải hoạt động chuẩn

Bắt buộc:

- Refresh tại detail route không được quay về dashboard.
- Browser Back hoạt động đúng.
- Browser Forward hoạt động đúng.
- Route trực tiếp bằng URL hoạt động.
- URL có thể bookmark.
- Deep link hoạt động.
- Main filters quan trọng nên có thể phản ánh lên query string.
- Không mất page context vô lý khi refresh.

Ví dụ:

```text
/employees?department=engineering&status=active&page=2

/timesheets?month=2026-09&department=engineering
```

---

# 3. CÔNG NGHỆ

## 3.1 Trước tiên phải kiểm tra codebase hiện tại

Không được xóa hoặc rewrite project vô lý.

Hãy:

1. Kiểm tra package manager.
2. Kiểm tra framework.
3. Kiểm tra routing.
4. Kiểm tra database integration.
5. Kiểm tra auth.
6. Kiểm tra styling system.
7. Kiểm tra environment variables.
8. Kiểm tra component library.
9. Kiểm tra existing migrations.
10. Kiểm tra lint/test/build scripts.

Nếu codebase đã có nền tảng tốt, giữ lại và refactor có kiểm soát.

Nếu project còn trống hoặc rất sơ khai, ưu tiên stack phù hợp cho internal web application hiện đại:

- TypeScript.
- React-based framework có server-side capabilities và routing chuẩn.
- PostgreSQL.
- Supabase có thể dùng cho database/auth/storage nếu project đã chọn Supabase.
- Utility CSS hoặc design-token based styling.
- Reusable accessible component primitives.
- Schema validation ở cả client/server.
- API layer rõ ràng.

Không khóa project vào một implementation quá khó thay đổi.

---

# 4. UI/UX DIRECTION

## 4.1 Nếu skill `ui-ux-pro-max` đã được cài

Hãy sử dụng:

```text
$ui-ux-pro-max
```

cho:

- design system review
- responsive review
- mobile UX
- accessibility
- touch target
- navigation
- form usability
- typography
- spacing

Nhưng:

**Business requirements và design direction trong prompt này luôn là source of truth.**

Skill không được tự ý đổi giao diện sang phong cách khác.

---

# 5. PHONG CÁCH GIAO DIỆN

Đây là enterprise internal software.

Phong cách mong muốn:

- chuyên nghiệp
- tối giản
- rõ ràng
- data-oriented
- thực tế
- có cảm giác product team thiết kế
- không có cảm giác AI generated
- không có cảm giác template demo
- phù hợp người Việt sử dụng hàng ngày

Có thể tham khảo tinh thần UX của:

- MISA AMIS
- Base.vn
- Odoo
- Linear
- Notion

Chỉ tham khảo cách tổ chức UX, không sao chép trực tiếp.

---

# 6. NHỮNG PHONG CÁCH CẤM

Không sử dụng tràn lan:

- gradient xanh tím
- glassmorphism
- neon
- blob background
- hero section
- decorative illustrations không cần thiết
- oversized cards
- border radius 20–30px
- huge shadows
- mỗi card một màu
- pastel icon tiles ở mọi nơi
- emoji trong nghiệp vụ
- marketing copy kiểu “Welcome back 👋”
- excessive animation
- fake charts
- fake statistics chỉ để giao diện đẹp
- card thay cho table khi table phù hợp hơn
- cấm tràn chữ dọc trên giao diện điện thoại

Clarity > Decoration.

Consistency > Creativity.

Usability > Animation.

---

# 7. DESIGN TOKENS

Tạo design tokens tập trung, không hard-code style rải rác.

## Spacing

```text
4
8
12
16
20
24
32
40
48
```

## Border radius

Gợi ý:

```text
input: 6–8px
button: 6–8px
card: 8–10px
modal: 10–12px
```

Không dùng pill tràn lan.

## Typography

Ưu tiên:

- Inter
- Be Vietnam Pro
- system font

Phải hiển thị tiếng Việt chính xác.

Gợi ý:

```text
Page title: 22–24px
Section title: 16–18px
Body: 14–16px
Secondary: 13–14px
Table: 13–14px
```

Font weights chính:

```text
400
500
600
```

Không lạm dụng 700/800.

## Color

Neutral enterprise palette.

Gợi ý:

```text
Main background: #F7F8FA hoặc tương đương
Surface: #FFFFFF
Border: neutral gray
Primary text: gray 900
Secondary text: gray 600
Muted: gray 500
```

Chỉ chọn **một primary brand color** cho:

- primary button
- active navigation
- important link
- selected state

Semantic:

- success
- warning
- error
- info

Màu semantic chỉ dùng khi có ý nghĩa.

---

# 8. APP SHELL DESKTOP

Desktop phục vụ chủ yếu:

- HR
- Admin
- Kế toán
- Kho
- Xuất nhập khẩu
- Kỹ sư văn phòng
- Ban giám đốc

Layout:

```text
Sidebar fixed
Top header
Main content
```

Sidebar khoảng:

```text
240–260px
```

Header:

```text
56–64px
```

Sidebar phải hỗ trợ:

- logo/tên hệ thống
- navigation groups
- active item
- hover
- permission filtering
- collapsed behavior nếu hợp lý
- responsive fallback

Menu dự kiến:

```text
CHÂU TUẤN

Tổng quan

NHÂN SỰ
- Nhân viên
- Chấm công
- Bảng công
- Ca làm
- Nghỉ phép

DỰ ÁN
- Dự án / Công trường
- Cập nhật dự án
- Điểm danh công nhân

KHO
- Hàng hóa
- Nhập kho
- Xuất kho
- Chuyển kho
- Kiểm kê

XUẤT NHẬP KHẨU
- Lô hàng
- Chứng từ

QUẢN LÝ
- Phê duyệt
- Báo cáo

HỆ THỐNG
- Người dùng
- Vai trò & Quyền
- Cấu hình
```

Không cần render item nếu user không có quyền xem.

---

# 9. APP SHELL MOBILE

Không lấy desktop rồi thu nhỏ.

Mobile ưu tiên:

- nhân viên
- kỹ sư hiện trường
- giám sát công trường

Nguyên tắc:

```text
1 screen = 1 primary task
```

Mobile bottom navigation tối đa 5 destination.

Ví dụ nhân viên:

```text
Trang chủ
Chấm công
Đơn từ
Thông báo
Cá nhân
```

Giám sát có thể được điều chỉnh theo quyền:

```text
Trang chủ
Điểm danh
Dự án
Thông báo
Cá nhân
```

Không hiển thị desktop sidebar nguyên bản trên điện thoại.

---

# 10. MOBILE UX RULES

Bắt buộc:

- touch target >= 44x44px
- primary actions nên 52–56px nếu phù hợp
- không phụ thuộc hover
- không nhét desktop table nguyên bản
- tránh horizontal overflow
- safe area đúng
- bottom nav không che nội dung
- keyboard không che field quan trọng
- responsive với điện thoại nhỏ
- responsive với điện thoại tiêu chuẩn
- responsive với điện thoại lớn
- tablet portrait phải dùng được

Body mobile thường khoảng:

```text
15–16px
```

Không thu font quá nhỏ để cố nhét dữ liệu.

---

# 11. DESKTOP TABLE VS MOBILE LIST

Desktop:

```text
DataTable
```

Mobile:

```text
Task-oriented list
Compact rows
Detail screens
```

Không đơn giản shrink table.

Chỉ dùng horizontal table scrolling khi thật sự cần so sánh dữ liệu dạng bảng.

---

# 12. PAGE LAYOUT CHUẨN

Các list page phải theo structure thống nhất:

```text
PageHeader
  Title
  Description
  Primary Action

Toolbar
  Search
  Filters
  Date filter nếu cần
  Export nếu cần
  Column settings nếu cần

DataTable / List

Pagination
```

Không để mỗi module tự sáng tạo layout mới.

---

# 13. NAVIGATION PATTERN

Phân biệt rõ:

## Route

Dùng cho:

- module khác
- entity khác
- nghiệp vụ lớn
- form dài
- detail page
- page có khả năng bookmark
- page người dùng cần browser back

## Route-backed tab

Dùng trong entity detail.

Ví dụ:

```text
/employees/:id/profile
/employees/:id/attendance
/employees/:id/leave
```

## Drawer

Dùng cho:

- quick preview
- quick edit
- detail vừa phải

## Modal

Dùng cho:

- confirm
- thao tác ngắn
- form nhỏ

## Lightbox

Dùng cho:

- ảnh
- gallery
- document preview nhẹ

Không dùng modal cho hồ sơ nhân viên 40 fields.

---

# 14. SHARED COMPONENT LIBRARY

Tạo các component dùng lại được.

Ít nhất:

```text
AppShell
AppSidebar
AppHeader
MobileBottomNav
PageHeader
Breadcrumb

Button
IconButton
Input
Textarea
Select
Combobox
Checkbox
Radio
Switch
DatePicker
DateRangePicker

SearchInput
FilterBar
FilterChip

DataTable
Pagination
ColumnVisibilityMenu

StatusBadge
DropdownMenu
Tabs

Card
StatCard

Modal
Drawer
ConfirmDialog
Lightbox

EmptyState
LoadingState
Skeleton
ErrorState
PermissionDeniedState
OfflineState

Toast

FileUpload
ImageUpload
AttachmentList

Avatar
UserMenu
```

Không tạo 5 phiên bản nút giống nhau trong 5 module.

---

# 15. DATA TABLE FOUNDATION

Table phải hỗ trợ:

- loading
- empty
- error
- pagination
- sorting
- row selection
- search
- filtering
- column visibility
- actions menu
- sticky header nếu cần
- responsive fallback
- keyboard accessibility hợp lý

Table ưu tiên:

- readable
- compact
- light borders
- subtle hover
- clear headers

---

# 16. FORM FOUNDATION

Form phải:

- có label rõ
- validation rõ
- helper text nếu cần
- error gần field
- required marker
- giữ dữ liệu khi temporary error
- dùng schema validation
- hỗ trợ server-side validation
- không chỉ tin client validation

Form dài:

- chia section
- hoặc page riêng
- không nhét modal

---

# 17. LOADING / EMPTY / ERROR / PERMISSION

Mọi page phải có pattern cho:

```text
Loading
Empty
Error
Permission denied
Network disconnected
```

Không để blank page.

Không show raw stack trace hoặc raw server error cho end user.

Technical detail có thể log cho developer.

---

# 18. TOAST & FEEDBACK

Toast dùng cho:

- tạo thành công
- cập nhật thành công
- lỗi thao tác
- đồng bộ hoàn tất nếu thật sự cần

Không spam toast.

Các destructive action phải confirm.

---

# 19. ACCESSIBILITY

Bắt buộc kiểm tra:

- keyboard navigation cơ bản
- visible focus state
- label/input association
- semantic buttons
- correct aria cho icon-only action
- color contrast
- không dùng color làm tín hiệu duy nhất
- error có text rõ
- screen reader semantics hợp lý

---

# 20. KIẾN TRÚC FEATURE

Ưu tiên cấu trúc gần dạng:

```text
src/
  app/ hoặc routes/
  components/
    shared/
    layout/
  features/
    employees/
      pages/
      components/
      hooks/
      api/
      schemas/
      types/
      utils/

    attendance/
    timesheets/
    leave/
    projects/
    worker-attendance/
    warehouse/
    import-export/
    approvals/
    reports/
    settings/

  lib/
  services/
  hooks/
  types/
  config/
```

Không cần ép đúng tên folder nếu framework có convention khác, nhưng separation of concern phải rõ.

---

# 21. API-FIRST ARCHITECTURE

Thiết kế hệ thống để sau này có thể tích hợp:

- app mobile
- MISA
- ERP khác
- máy chấm công
- Power BI
- Google Workspace
- Zalo / notification service
- các hệ thống nội bộ khác

Không để integration khác truy cập database trực tiếp.

Kiến trúc logic:

```text
Web / Future Mobile
        ↓
API Layer
        ↓
Business Services
        ↓
Database
```

External integration:

```text
External System
        ↓
Châu Tuấn API
        ↓
Authorization
Validation
Business Logic
Audit
        ↓
Database
```

---

# 22. VERSION API

Chuẩn bị API versioning ngay từ đầu.

Ví dụ:

```text
/api/v1/employees
/api/v1/attendance
/api/v1/leave-requests
/api/v1/projects
/api/v1/warehouse
```

Không expose database table API một cách tùy tiện làm public contract.

---

# 23. WEBHOOK FOUNDATION

Chuẩn bị kiến trúc để sau này hỗ trợ events như:

```text
employee.created
employee.updated

attendance.checked_in
attendance.checked_out

leave.approved

project.updated

warehouse.receipt.posted
warehouse.issue.posted

shipment.updated
```

Prompt này chỉ cần chuẩn bị pattern/abstraction, không cần implement mọi webhook business event.

---

# 24. AUTHENTICATION / AUTHORIZATION FOUNDATION

Hệ thống sau này sẽ có:

```text
Employee Record
≠
User Account
```

Không được gắn cứng mỗi employee bắt buộc phải có account.

Chuẩn bị auth architecture để support:

- account active
- account disabled
- multiple login identifiers trong tương lai
- role
- permission
- multiple roles per user
- effective permissions

Không hard-code kiểu:

```ts
if (role === "HR")
```

UI action phải hướng đến permission:

```ts
can("employee.create")
can("attendance.adjust")
can("warehouse.post_receipt")
```

Role chỉ là package quyền.

Prompt riêng sau sẽ triển khai RBAC chi tiết.

---

# 25. PERMISSION-AWARE UI

Navigation:

- ẩn item user không có quyền

Actions:

- không render hoặc disable phù hợp

Nhưng:

**Frontend permission không phải security boundary.**

Server/API vẫn phải kiểm tra permission.

---

# 26. CONFIGURATION OVER HARD-CODE

Từ nền tảng, chuẩn bị cách để business configuration không nằm rải rác trong code.

Ví dụ sau này các giá trị như:

```text
ca làm
giờ bắt đầu
giờ kết thúc
bán kính GPS
loại nghỉ
quy trình duyệt
template export
```

phải đến từ configuration/domain data khi phù hợp.

Không hard-code policy công ty vào UI.

---

# 27. AUDIT LOG FOUNDATION

Chuẩn bị audit architecture cho các thay đổi quan trọng.

Audit entry cần có khả năng chứa:

```text
actor
action
entity_type
entity_id
timestamp
before
after
reason
metadata
```

Không log password/token/secret.

Audit module chi tiết sẽ có prompt riêng.

---

# 28. FILE / IMAGE STORAGE FOUNDATION

Chuẩn bị storage abstraction.

Yêu cầu:

- private storage mặc định cho dữ liệu nội bộ nhạy cảm
- không phụ thuộc public bucket
- stable internal resource URL khi cần
- backend có thể tạo signed access tạm thời
- permission check trước khi truy cập file nhạy cảm
- metadata riêng khỏi binary file
- không hard-code storage URL vào business data

Ảnh chấm công, CCCD, hợp đồng, PDF đơn nghỉ về sau đều phải đi qua cùng foundation phù hợp.

---

# 29. SECURITY BASELINE

Bắt buộc:

- không expose secret lên client
- service role chỉ dùng server-side
- sanitize/validate input
- authorization server-side
- upload validation
- MIME/type limit
- file size limit
- safe file naming
- no arbitrary path access
- no raw SQL từ client
- no trusting client timestamps cho nghiệp vụ quan trọng
- CSRF strategy phù hợp framework
- secure session handling
- avoid leaking PII in logs
- rate-limit các endpoint nhạy cảm khi cần

Nếu dùng Supabase:

- áp dụng RLS phù hợp
- không dùng service-role key trên browser
- storage policy phải private cho dữ liệu nhạy cảm

---

# 30. DATE / TIME STANDARD

Hệ thống dùng timezone doanh nghiệp Việt Nam.

UI hiển thị theo timezone phù hợp.

Database nên lưu timestamp theo chuẩn an toàn, tránh timezone bug.

Không tin thời gian do thiết bị client cung cấp làm timestamp nghiệp vụ duy nhất.

Cần phân biệt:

```text
captured_at_client
received_at_server
effective_at
```

khi module nghiệp vụ yêu cầu.

---

# 31. INTERNATIONALIZATION READINESS

V1 giao diện tiếng Việt.

Tất cả text:

- đúng chính tả
- không lỗi font
- tự nhiên
- ngắn gọn
- phù hợp doanh nghiệp Việt Nam

Không cần triển khai đa ngôn ngữ đầy đủ nếu chưa cần, nhưng tránh hard-code text rải rác đến mức khó chuyển i18n sau này.

---

# 32. ERROR HANDLING FOUNDATION

Tạo error model nhất quán.

Ví dụ categories:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
PERMISSION_DENIED
NOT_FOUND
CONFLICT
NETWORK_ERROR
SERVER_ERROR
```

UI hiển thị tiếng Việt dễ hiểu.

Technical details log ở server/monitoring.

---

# 33. OBSERVABILITY

Chuẩn bị logging hợp lý.

Cần phân biệt:

- application log
- security log
- audit log

Không dùng console.log tràn lan.

Không log:

- password
- token
- CCCD đầy đủ nếu không cần
- sensitive file URL
- private personal information quá mức

---

# 34. PERFORMANCE FOUNDATION

Bắt buộc:

- route-level code splitting nếu framework hỗ trợ
- lazy load phần nặng
- không preload ảnh full-size hàng loạt
- query pagination
- avoid fetching toàn bộ records
- cache có kiểm soát
- avoid N+1 requests
- image optimization
- skeleton hợp lý
- no blocking dashboard by unrelated request

---

# 35. DASHBOARD FOUNDATION

Prompt này chỉ tạo dashboard shell/demo tối thiểu.

Không fake hàng loạt chart.

Dashboard sau này phải trả lời:

```text
Hôm nay có chuyện gì?
Có gì bất thường?
Tôi cần xử lý gì?
```

Không tạo 15 card KPI chỉ để đẹp.

---

# 36. PLACEHOLDER PAGES

Có thể tạo placeholder route cho module tương lai để chứng minh routing hoạt động.

Placeholder phải tối giản:

```text
Tên module
Mô tả ngắn
“Module sẽ được triển khai ở bước tiếp theo”
```

Không tự implement business logic chưa được yêu cầu.

---

# 37. RESPONSIVE STRATEGY

Không chỉ định breakpoint một cách tùy tiện.

Ở mỗi breakpoint, quyết định component nên:

```text
resize
stack
collapse
simplify
move
replace presentation
```

Mobile và desktop là cùng một product nhưng không bắt buộc cùng layout.

---

# 38. ROUTE-BACKED TABS

Entity detail pages dùng route-backed tabs.

Ví dụ future employee detail:

```text
/employees/NV001/profile
/employees/NV001/employment
/employees/NV001/attendance
/employees/NV001/leave
/employees/NV001/documents
/employees/NV001/history
```

Nếu user refresh tại `/attendance`, phải ở nguyên `/attendance`.

Không quản lý các tab lớn chỉ bằng `useState`.

---

# 39. FILTER STATE

Main business filter nên cân nhắc lưu query string:

```text
?month=2026-09
?project=PRJ001
?department=engineering
?status=active
?page=2
```

Không cần đẩy mọi transient UI state lên URL.

---

# 40. BREADCRUMB

Breadcrumb phải theo route/entity hierarchy.

Ví dụ:

```text
Nhân sự / Nguyễn Văn A / Chấm công
```

Không hard-code breadcrumb độc lập ở từng page theo cách khó bảo trì.

---

# 41. NO PREMATURE BUSINESS LOGIC

Ở prompt này KHÔNG được tự quyết định:

- công thức tính công
- số ngày phép
- rule đi trễ
- quy tắc OT
- workflow nghỉ phép
- logic kho
- landed cost
- shipment lifecycle

Những thứ này sẽ có prompt riêng.

Chỉ tạo extension points / interfaces hợp lý.

---

# 42. DATABASE FOUNDATION

Nếu project đã có DB:

- không drop dữ liệu
- không reset production DB
- dùng migration
- review schema hiện tại

Nếu cần tạo schema foundation, chỉ tạo các bảng/system primitives cần thiết cho nền tảng, ví dụ:

- user/account mapping nếu thật sự cần cho auth foundation
- roles/permissions scaffold nếu cần
- app configuration scaffold nếu cần
- audit log scaffold
- file metadata scaffold

Không tạo toàn bộ domain tables ở prompt này.

---

# 43. MIGRATION RULES

Mọi schema change:

- migration có tên rõ
- reversible khi hợp lý
- không sửa migration đã chạy nếu project production
- có seed data tối thiểu cho development nếu cần
- không seed fake production data

---

# 44. ENVIRONMENT VARIABLES

Tạo `.env.example`.

Không commit secret.

Document:

- required variables
- optional variables
- local setup

Nếu project đã có env naming convention, giữ nhất quán.

---

# 45. CODE QUALITY

Bắt buộc:

- TypeScript strict nếu stack cho phép
- không dùng `any` tùy tiện
- schema validation
- reusable utilities
- no duplicated business helper
- no giant 2000-line components
- no giant services
- clear naming
- Vietnamese UI, English code identifiers
- comments chỉ khi cần giải thích intent
- không comment lại điều code đã nói rõ

---

# 46. TEST FOUNDATION

Thiết lập hoặc giữ hệ thống test phù hợp.

Ít nhất phải có khả năng test:

- routing
- permission-aware navigation
- core shared components
- validation
- API utilities

Không cần viết test cho domain chưa tồn tại.

---

# 47. BUILD QUALITY GATE

Trước khi hoàn thành prompt này phải chạy:

- install nếu cần
- lint
- typecheck
- tests liên quan
- production build

Không báo hoàn thành nếu build lỗi.

Nếu có lỗi từ code cũ không liên quan:

- ghi rõ
- không che giấu
- sửa nếu an toàn

---

# 48. UI QUALITY GATE

Review toàn bộ foundation ở:

- desktop
- mobile
- tablet portrait

Kiểm tra:

- no horizontal overflow
- sidebar đúng
- bottom nav đúng
- header đúng
- active route đúng
- Vietnamese wrapping đúng
- empty state
- loading state
- error state
- permission denied
- keyboard focus
- touch size

Nếu có `ui-ux-pro-max`, chạy final UX audit.

---

# 49. DELIVERABLES BẮT BUỘC

Sau khi hoàn thành code, cung cấp report ngắn gồm:

## A. Architecture implemented

- routing
- app shell
- feature structure
- API structure
- permission strategy
- storage strategy

## B. Routes created

Liệt kê route.

## C. Shared components created

Liệt kê component.

## D. Database/migrations changed

Liệt kê chính xác.

## E. Security decisions

Tóm tắt.

## F. Commands run

Ví dụ:

```text
lint
typecheck
test
build
```

và kết quả.

## G. Known limitations

Chỉ liệt kê limitation thật.

## H. Next recommended module

Không tự triển khai module kế tiếp.

---

# 50. ACCEPTANCE CRITERIA

Prompt chỉ được coi là hoàn thành nếu tất cả tiêu chí sau đạt.

### Routing

- [ ] Sidebar dùng router thật.
- [ ] Không dùng `activeSection` làm primary navigation.
- [ ] URL thay đổi khi chuyển module.
- [ ] Refresh giữ đúng route.
- [ ] Browser Back/Forward đúng.
- [ ] Deep links hoạt động.

### Architecture

- [ ] Không giant page.
- [ ] Feature separation rõ.
- [ ] Shared components rõ.
- [ ] Không duplicate app layout.
- [ ] Không duplicate design tokens.

### UI

- [ ] Enterprise style.
- [ ] Không AI-looking.
- [ ] Không gradient/glassmorphism tràn lan.
- [ ] Desktop usable.
- [ ] Mobile usable.
- [ ] Tablet usable.
- [ ] Vietnamese text đúng.

### Mobile

- [ ] Không dùng desktop sidebar nguyên bản.
- [ ] Bottom navigation phù hợp.
- [ ] Touch target đủ lớn.
- [ ] Không horizontal overflow.
- [ ] Mobile list pattern chuẩn.

### States

- [ ] Loading.
- [ ] Empty.
- [ ] Error.
- [ ] Permission denied.
- [ ] Offline pattern foundation.

### Security

- [ ] Không secret ở client.
- [ ] Server-side authorization foundation.
- [ ] Private storage strategy.
- [ ] Input validation.
- [ ] Sensitive data không leak log.

### API

- [ ] API-first structure.
- [ ] `/api/v1` convention hoặc tương đương.
- [ ] Không expose DB trực tiếp cho external integration.
- [ ] Webhook-ready architecture.

### Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Relevant tests pass.
- [ ] Production build pass.

---

# 51. CÁCH THỰC HIỆN

Thực hiện theo thứ tự:

1. Inspect codebase.
2. Report ngắn những gì đang tồn tại.
3. Xác định phần có thể giữ.
4. Xác định phần cần refactor.
5. Thiết lập design tokens.
6. Thiết lập shared component primitives.
7. Thiết lập routing.
8. Tạo AppShell desktop.
9. Tạo AppShell mobile.
10. Thiết lập permission-aware navigation foundation.
11. Thiết lập API/client/server boundary.
12. Thiết lập error/loading/empty foundation.
13. Thiết lập audit/config/storage abstraction nếu cần.
14. Tạo các placeholder route tối thiểu.
15. Responsive review.
16. Accessibility review.
17. Run tests/lint/typecheck/build.
18. Trả report.

---

# 52. QUY TẮC CUỐI CÙNG

Không được chạy theo mục tiêu “làm cho đẹp”.

Mục tiêu là:

> Tạo một nền tảng doanh nghiệp ổn định, rõ ràng, có routing đúng, responsive tốt và đủ sạch để tất cả module tiếp theo được xây dựng nhất quán.

Nếu phải lựa chọn giữa:

```text
UI sáng tạo nhưng khó dùng
```

và:

```text
UI đơn giản nhưng rõ ràng
```

luôn chọn UI đơn giản, rõ ràng.

Nếu phải lựa chọn giữa:

```text
code nhanh nhưng hard-code
```

và:

```text
code có cấu trúc, dễ mở rộng
```

luôn chọn cấu trúc dễ mở rộng.

Không triển khai đầy đủ Nhân sự, Chấm công, Kho hoặc Xuất nhập khẩu ở prompt này.

**Dừng sau khi foundation hoàn chỉnh và báo cáo kết quả.**

# PROMPT 02 — FRONTEND UI/UX HOÀN CHỈNH CHO HỆ THỐNG NỘI BỘ CHÂU TUẤN

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Prompt trước đã xác lập nền tảng kiến trúc, routing, app shell, design system và nguyên tắc code.

Prompt này tập trung **riêng vào FRONTEND UI/UX**.

Không triển khai sâu business logic backend trong prompt này.
Không tự ý xây hoàn chỉnh các module nghiệp vụ.
Mục tiêu là tạo ra một frontend enterprise hoàn chỉnh, nhất quán, mượt, responsive và đủ tốt để các module sau chỉ cần gắn nghiệp vụ vào.

---

# 1. MỤC TIÊU

Xây frontend sao cho:

- nhìn như một sản phẩm enterprise thật
- không giống giao diện AI-generated
- không giống template dashboard
- không giống landing page
- dùng tốt trên desktop
- dùng rất đơn giản trên mobile
- có routing thật
- có page hierarchy rõ
- có component system tái sử dụng
- có states đầy đủ
- có animation vừa đủ
- có responsive behavior hợp lý
- có accessibility cơ bản
- có interaction feedback rõ
- có nền tảng UI cho các module sau

---

# 2. UI DIRECTION

Phong cách:

```text
Enterprise
Clean
Minimal
Professional
Data-oriented
Operational software
```

Tham khảo tinh thần UX của:

- MISA AMIS
- Base.vn
- Odoo
- Linear
- Notion

Không sao chép trực tiếp.

---

# 3. SỬ DỤNG UI UX PRO MAX

Nếu skill `ui-ux-pro-max` đã được cài, hãy sử dụng:

```text
$ui-ux-pro-max
```

cho các bước:

- design system review
- responsive review
- accessibility review
- mobile UX review
- navigation review
- typography review
- form review
- touch interaction review

Nhưng:

**Business requirement và design direction của project là source of truth.**

Không được để skill tự đổi phong cách giao diện.

---

# 4. TUYỆT ĐỐI TRÁNH

Không sử dụng tràn lan:

- gradient xanh tím
- glassmorphism
- neon
- decorative blobs
- huge shadow
- card bo 24px
- icon pastel box khắp nơi
- hero section
- emoji nghiệp vụ
- fake chart
- fake KPI chỉ để đẹp
- large decorative whitespace
- animation quá nhiều
- mỗi page một style khác nhau
- overly rounded pill buttons
- dashboard marketing style

Không dùng copy kiểu:

```text
Welcome back 👋
Let's get started
Boost your productivity
```

---

# 5. DESIGN SYSTEM

## 5.1 Typography

Ưu tiên:

```text
Inter
Be Vietnam Pro
System font
```

Tiếng Việt phải hiển thị chuẩn.

Gợi ý:

```text
Page title: 22–24px
Section title: 16–18px
Body: 14–16px
Secondary: 13–14px
Table: 13–14px
```

Weight:

```text
400
500
600
```

Không lạm dụng 700+.

---

## 5.2 Spacing

Dùng scale:

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

---

## 5.3 Radius

```text
input: 6–8px
button: 6–8px
card: 8–10px
modal: 10–12px
```

Không dùng radius 20–30px nếu không có lý do.

---

## 5.4 Shadow

Chỉ dùng shadow nhẹ cho:

- dropdown
- popover
- modal
- floating surfaces

Table/card thông thường ưu tiên border.

---

# 6. MÀU SẮC

Dùng neutral palette.

Ví dụ:

```text
Background: #F7F8FA
Surface: #FFFFFF
Primary text: gray 900
Secondary text: gray 600
Muted: gray 500
Border: gray 200/300
```

Chọn một primary brand color duy nhất.

Primary dùng cho:

- primary action
- active nav
- active tab
- link chính
- selected state

Semantic:

```text
Success
Warning
Error
Info
```

Không dùng màu chỉ để trang trí.

---

# 7. DESKTOP LAYOUT

Desktop ưu tiên cho:

- HR
- Admin
- Kế toán
- Kho
- XNK
- Kỹ sư văn phòng
- Ban giám đốc

Layout:

```text
Sidebar trái
Header trên
Main content
```

Sidebar:

```text
240–260px
```

Header:

```text
56–64px
```

Main content:

- max width hợp lý
- không quá rộng
- table có thể full width
- page padding nhất quán

---

# 8. SIDEBAR

Sidebar phải có group rõ ràng.

Ví dụ:

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

Active state rõ nhưng tinh tế.

Không dùng màu nền quá đậm ở nhiều item.

---

# 9. HEADER

Header desktop chỉ nên có:

- breadcrumb hoặc context title
- global search nếu cần
- notification
- user menu
- optional quick action nếu thật sự cần

Không làm header cao và rối.

---

# 10. PAGE HEADER

Mọi page dùng pattern:

```text
Page title
Description
Primary action
```

Ví dụ:

```text
Nhân viên                         + Thêm nhân viên
Quản lý hồ sơ nhân sự trong công ty.
```

---

# 11. TOOLBAR

List page có toolbar:

- search
- filter
- date filter
- column settings
- export
- bulk actions nếu cần

Không nhét quá nhiều button cùng cấp.

Primary action phải rõ.

---

# 12. DATA TABLE

Tạo một DataTable chuẩn dùng toàn hệ thống.

Hỗ trợ:

- loading
- empty
- error
- sorting
- search
- filter
- pagination
- row selection
- column visibility
- action menu
- sticky header nếu cần

Style:

- compact
- readable
- row height hợp lý
- border nhẹ
- hover nhẹ
- không zebra stripe quá mạnh
- header rõ

---

# 13. TABLE ACTION

Không đặt 5 icon action trên mỗi row.

Ưu tiên:

```text
⋯
```

mở action menu.

Chỉ giữ action trực tiếp nếu thật sự thường dùng.

---

# 14. MOBILE APP EXPERIENCE

Mobile không phải bản thu nhỏ của desktop.

Mobile ưu tiên:

- nhân viên
- kỹ sư hiện trường
- giám sát

Nguyên tắc:

```text
1 màn hình = 1 nhiệm vụ chính
```

---

# 15. MOBILE NAVIGATION

Không dùng desktop sidebar.

Dùng bottom navigation tối đa 5 mục.

Nhân viên:

```text
Trang chủ
Chấm công
Đơn từ
Thông báo
Cá nhân
```

Giám sát:

```text
Trang chủ
Điểm danh
Dự án
Thông báo
Cá nhân
```

Active state rõ.

Safe area đúng.

---

# 16. MOBILE HOME

Nhân viên:

```text
Ngày hiện tại
Ca làm
Trạng thái chấm công
Primary CTA
Việc cần xử lý
Quick links
Thông báo gần đây
```

Không show dashboard analytics nặng.

---

# 17. MOBILE TABLE RULE

Không shrink desktop table.

Desktop:

```text
Date | Check-in | Check-out | Hours | Status
```

Mobile:

```text
09/09/2026
08:01 → 17:05
8 giờ 04 phút
Đủ công
```

Tap để mở chi tiết.

---

# 18. FORM UX

Desktop form dài:

- chia section
- 2 cột nếu hợp lý
- không quá dày
- sticky action bar nếu form dài

Mobile:

- 1 cột
- input lớn
- keyboard-friendly
- native date/time input nếu phù hợp
- validate gần field
- không mất data khi lỗi mạng

---

# 19. MODAL / DRAWER / PAGE

Quy tắc:

## Modal

- confirm
- thao tác ngắn
- form nhỏ

## Drawer

- quick detail
- quick edit
- contextual information

## Page

- form dài
- workflow phức tạp
- entity detail
- nghiệp vụ cần bookmark

## Lightbox

- ảnh
- gallery

---

# 20. ROUTE-BACKED TABS

Ví dụ employee:

```text
/employees/:id/profile
/employees/:id/employment
/employees/:id/attendance
/employees/:id/leave
/employees/:id/documents
/employees/:id/history
```

Tab phải phản ánh route.

Không dùng state-only tab cho các section lớn.

---

# 21. COMPONENTS CẦN HOÀN THIỆN

Ít nhất:

```text
AppShell
Sidebar
Header
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

---

# 22. STATUS BADGE

Badge nhỏ và có semantic meaning.

Ví dụ:

```text
Đang làm
Nghỉ việc
Chờ duyệt
Đã duyệt
Từ chối
Đi trễ
Chờ đồng bộ
Đã đồng bộ
```

Không dùng badge cho mọi field.

---

# 23. EMPTY STATE

Không viết copy marketing.

Ví dụ:

```text
Chưa có nhân viên
Thêm nhân viên đầu tiên để bắt đầu quản lý hồ sơ.
[+ Thêm nhân viên]
```

---

# 24. ERROR STATE

Không show:

```text
500 Internal Server Error
TypeError...
```

Show:

```text
Không thể tải dữ liệu
Vui lòng thử lại.
[Thử lại]
```

---

# 25. OFFLINE STATE

Chuẩn bị style dùng chung:

```text
Không có kết nối Internet
Một số thao tác sẽ được đồng bộ khi có mạng.
```

Không dùng màu đỏ cho mọi offline state.

---

# 26. SKELETON

Dùng skeleton cho:

- table
- detail header
- card
- image

Không dùng spinner fullscreen quá lâu.

---

# 27. IMAGE VIEWER FOUNDATION

Chuẩn bị lightbox/gallery mượt.

Yêu cầu:

- thumbnail
- lazy load full image
- next/previous
- keyboard arrow
- close bằng ESC
- zoom vừa phải nếu cần
- loading state
- error state
- image metadata area

Không preload hàng trăm ảnh full-size.

---

# 28. ATTENDANCE CAMERA UI FOUNDATION

Chưa cần business logic chấm công đầy đủ, nhưng cần style chuẩn cho future flow:

```text
Camera preview
GPS status
Network status
Capture button
Preview
Retake
Use photo
Success state
Pending sync state
```

Nút chụp lớn.

Không giống file upload.

---

# 29. WORKER ATTENDANCE UI FOUNDATION

Chuẩn bị mobile layout cho giám sát:

```text
Project
Date
Expected workforce
Select all present
Worker list
Exceptions
Photo gallery
Review
Submit
```

Không implement nghiệp vụ hoàn chỉnh ở prompt này.

---

# 30. PROJECT UPDATE UI FOUNDATION

Chuẩn bị timeline style:

```text
Project update
Type
Author
Timestamp
Content
Attachments
Status
Issue severity
```

Timeline phải dễ đọc.

Không biến thành social feed.

---

# 31. DASHBOARD UI

Chỉ dựng layout hợp lý.

Top level:

```text
Tổng quan
Các vấn đề cần xử lý
Hoạt động gần đây
Dự án cần chú ý
```

Không tạo quá nhiều chart.

---

# 32. SETTINGS UI

Settings phải chia route.

Không làm page dài 5000px.

Ví dụ:

```text
/settings/organization
/settings/attendance
/settings/roles
/settings/permissions
/settings/approval-workflows
/settings/export-templates
/settings/integrations
/settings/audit-log
```

Settings page dùng left subnav hoặc tab route-backed hợp lý.

---

# 33. RESPONSIVE BREAKPOINT BEHAVIOR

Ở mỗi breakpoint, xác định:

```text
resize
stack
collapse
hide
move
replace presentation
```

Không chỉ dùng CSS shrink.

---

# 34. RESPONSIVE TEST

Test:

- 360px
- 390px
- 430px
- tablet portrait
- laptop
- desktop wide

Không horizontal overflow.

Không button bị cắt.

Không text Việt wrap lỗi.

---

# 35. ACCESSIBILITY

Check:

- keyboard
- focus ring
- button semantics
- labels
- aria-label
- color contrast
- touch target
- icon-only button
- modal focus trap
- escape behavior
- reduced motion nếu có animation

---

# 36. ANIMATION

Chỉ dùng nhẹ:

- drawer
- modal
- dropdown
- toast
- lightbox
- state transition

Duration ngắn.

Không animate table rows vô lý.

---

# 37. USER MENU

User menu:

```text
Tên
Vai trò
Cá nhân
Đổi mật khẩu
Đăng xuất
```

Không nhét quá nhiều setting.

---

# 38. NOTIFICATION PANEL

UI foundation:

- unread
- read
- timestamp
- type
- mark read
- empty state

Không implement notification backend hoàn chỉnh.

---

# 39. PERMISSION-AWARE FRONTEND

Component/action phải có khả năng hide theo permission.

Ví dụ:

```text
employee.create
employee.edit
attendance.adjust
warehouse.receive
```

Không hard-code theo role string.

---

# 40. URL / FILTER UX

Main list filters nên giữ query string.

Ví dụ:

```text
/employees?status=active&department=engineering&page=2
```

Refresh không mất filter.

---

# 41. BREADCRUMB

Ví dụ:

```text
Nhân sự / Nguyễn Văn A / Chấm công
```

Không hard-code vô tổ chức.

---

# 42. PLACEHOLDER PAGES

Tạo frontend placeholder có style hoàn chỉnh cho:

- Nhân viên
- Chấm công
- Bảng công
- Nghỉ phép
- Dự án
- Điểm danh công nhân
- Kho
- XNK
- Báo cáo
- Cài đặt

Không fake nghiệp vụ sâu.

Mục đích là kiểm tra:

- route
- layout
- consistency
- mobile
- permission navigation

---

# 43. FRONTEND CODE QUALITY

Bắt buộc:

- không giant component
- không duplicate layout
- không duplicate style
- không inline styles tràn lan
- không magic spacing
- không hard-code color rải rác
- reusable components
- clear naming
- TypeScript strict
- không dùng any tùy tiện

---

# 44. FRONTEND STATE MANAGEMENT

Không đưa mọi thứ vào global store.

Phân loại:

```text
Server state
URL state
Local UI state
Form state
Auth state
```

Dùng đúng công cụ cho từng loại.

Primary navigation không dùng local state.

---

# 45. PERFORMANCE

Bắt buộc:

- lazy route
- lazy image
- pagination
- no full image preload
- no unnecessary re-render
- avoid giant bundle
- avoid fetching placeholder modules
- skeleton instead of blocking spinner
- no unnecessary animation

---

# 46. FINAL UX AUDIT

Nếu có `ui-ux-pro-max`, chạy final audit.

Kiểm tra:

- visual consistency
- typography
- spacing
- accessibility
- responsive
- touch
- forms
- navigation
- states
- mobile
- desktop
- tablet

---

# 47. DELIVERABLE

Sau khi hoàn thành, báo cáo:

## Routes/UI pages

Liệt kê.

## Components

Liệt kê.

## Responsive behavior

Tóm tắt.

## Accessibility

Tóm tắt.

## Known UI limitations

Chỉ ghi limitation thật.

## Screens/pages đã review

Liệt kê.

---

# 48. ACCEPTANCE CRITERIA

### Visual

- [ ] Không AI-looking.
- [ ] Không template-looking.
- [ ] Enterprise style.
- [ ] Design token nhất quán.
- [ ] Typography nhất quán.
- [ ] Spacing nhất quán.

### Desktop

- [ ] Sidebar chuẩn.
- [ ] Header chuẩn.
- [ ] Table readable.
- [ ] Form rõ.
- [ ] Page header nhất quán.

### Mobile

- [ ] Bottom nav.
- [ ] Không desktop sidebar.
- [ ] Touch target >= 44px.
- [ ] Primary action lớn.
- [ ] Không table shrink.
- [ ] Không horizontal overflow.

### Navigation

- [ ] Route thật.
- [ ] Back/Forward hoạt động.
- [ ] Refresh giữ route.
- [ ] Route-backed tabs.
- [ ] Breadcrumb đúng.

### States

- [ ] Loading.
- [ ] Empty.
- [ ] Error.
- [ ] Offline.
- [ ] Permission denied.

### Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Build pass.
- [ ] Responsive review pass.
- [ ] Accessibility review pass.

---

# 49. THỨ TỰ THỰC HIỆN

1. Inspect frontend hiện tại.
2. Review prompt 01 foundation.
3. Refine design tokens.
4. Refine shared components.
5. Hoàn thiện desktop shell.
6. Hoàn thiện mobile shell.
7. Hoàn thiện navigation.
8. Hoàn thiện table/list pattern.
9. Hoàn thiện form pattern.
10. Hoàn thiện modal/drawer/lightbox.
11. Hoàn thiện states.
12. Hoàn thiện placeholder pages.
13. Responsive review.
14. Accessibility review.
15. UI/UX Pro Max audit nếu có.
16. Lint/typecheck/build.
17. Báo cáo.

---

# 50. QUY TẮC CUỐI

Không tự triển khai business logic sâu.

Prompt này chỉ được coi là xong khi frontend nền tảng có cảm giác như một sản phẩm thật và tất cả module tương lai có thể dùng chung design system này.

**Không chuyển sang module Nhân sự cho tới khi frontend foundation này đạt acceptance criteria.**

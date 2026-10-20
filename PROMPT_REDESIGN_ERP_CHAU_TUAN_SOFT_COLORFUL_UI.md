# PROMPT CODEX — REDESIGN TOÀN BỘ ERP CHÂU TUẤN THEO SOFT COLORFUL ENTERPRISE UI

> **Mục tiêu:** Thay đổi toàn bộ giao diện hệ thống ERP Châu Tuấn sang một design language mới: mềm mại, hiện đại, nhiều màu pastel có kiểm soát, nhiều khoảng thở, ít border, có hover/micro-interaction, giàu dữ liệu như một ERP hoàn chỉnh. Quan trọng nhất: mọi thay đổi về font, spacing, radius, màu, shadow, kích thước control, table density, hover... phải được quản lý tập trung và **thay đổi một nơi phải đồng bộ toàn hệ thống**, tuyệt đối không sửa thủ công từng màn hình.

---

## 0. NGUYÊN TẮC BẮT BUỘC TRƯỚC KHI CODE

Đây **không phải** yêu cầu chỉnh đẹp một vài màn hình. Đây là một **UI architecture refactor toàn hệ thống**.

Không được làm theo kiểu:

- sửa riêng trang Chức vụ;
- sửa riêng Dashboard;
- copy class Tailwind sang từng page;
- mỗi module tự định nghĩa `padding`, `radius`, `border`, `shadow`, `button`, `table` khác nhau;
- đổi một design detail rồi phải search-and-replace hàng chục file.

Phải xây dựng một **Design System + Shared UI Layer** trước, sau đó migrate toàn bộ giao diện hiện tại sang hệ thống chung đó.

### Tuyệt đối không thay đổi

- Business logic.
- Database schema.
- Supabase logic.
- API contract.
- Authentication.
- Authorization / permission.
- Realtime logic.
- Validation nghiệp vụ.
- Routing nghiệp vụ.
- Offline logic nếu đang có.
- Dữ liệu hiện tại.
- Các service/domain logic đã hoạt động.

Chỉ được refactor:

- Presentation layer.
- CSS/design tokens.
- Layout.
- Shared UI components.
- Frontend composition.
- Accessibility và responsive behavior.

Nếu trong quá trình refactor phát hiện business logic đang nằm lẫn trong UI component, chỉ được **tách logic ra mà không thay đổi hành vi**.

---

# 1. DESIGN DIRECTION

Thiết kế theo phong cách:

## **Soft Colorful Enterprise ERP**

Đặc trưng:

- hiện đại;
- mềm mại;
- thân thiện;
- nhiều màu pastel;
- không trẻ con;
- vẫn chuyên nghiệp;
- nhiều khoảng trắng;
- card bo tròn;
- ít border;
- shadow rất mềm;
- typography rõ hierarchy;
- dashboard giàu dữ liệu;
- chart đẹp;
- table sạch;
- form thoáng;
- hover rõ;
- micro-interaction tinh tế;
- cảm giác giống một sản phẩm SaaS/ERP cao cấp hiện đại, không giống Bootstrap/PHP admin cũ.

### Không được biến thành

- landing page marketing;
- dashboard quá tối giản;
- glassmorphism quá mức;
- neumorphism;
- UI neon;
- gradient khắp nơi;
- UI màu mè ngẫu nhiên;
- mỗi card một màu không có semantic meaning;
- card lồng card lồng card;
- table giống Excel grid cũ.

---

# 2. FONT

Giữ font hiện tại:

**Inter**

Không đổi font family.

Phải chuẩn hóa typography toàn hệ thống bằng typography tokens.

Đề xuất:

```text
Page title:       24–26px / 650–700
Page subtitle:    13–14px / 400
Section title:    16–18px / 600
Card title:       14–16px / 600
Body:             14px / 400
Table body:       14px / 400
Table header:     13px / 600
Form label:       13px / 500
Meta/helper:      12px / 400
Button:           14px / 600
Badge:            12px / 500
Sidebar item:     14px / 500
Sidebar group:    11px / 600
```

Không dùng bold ở mọi nơi.

Chỉ title chính và số liệu quan trọng mới có weight cao.

---

# 3. KIẾN TRÚC DESIGN SYSTEM — BẮT BUỘC

## 3.1. Tạo một nguồn sự thật duy nhất

Phải có **Single Source of Truth** cho giao diện.

Tùy stack hiện tại, triển khai theo một trong các cách sau, nhưng nguyên tắc phải giữ nguyên:

- CSS Variables trong `globals.css` / `theme.css`;
- design token file trung tâm;
- Tailwind theme mapping về CSS variables;
- variant system dùng `class-variance-authority` hoặc giải pháp tương đương nếu project đã có;
- shared primitives.

Không hard-code design value rải rác trong page.

Ví dụ các giá trị sau **không được** xuất hiện hàng trăm lần dưới dạng arbitrary values:

```text
rounded-[17px]
p-[23px]
gap-[19px]
shadow-[...]
bg-[#F5F4FA]
text-[#...]
```

Thay vào đó phải gọi từ token chung.

---

## 3.2. Design tokens bắt buộc

Tạo hệ thống token tối thiểu:

```text
--app-bg
--surface-1
--surface-2
--surface-hover

--text-primary
--text-secondary
--text-muted
--text-disabled

--border-subtle
--border-default
--border-focus

--primary
--primary-hover
--primary-soft

--blue-50 / 100 / 200 / 500 / 600
--mint-50 / 100 / 200 / 500 / 600
--lavender-50 / 100 / 200 / 500 / 600
--orange-50 / 100 / 200 / 500 / 600
--yellow-50 / 100 / 200 / 500 / 600
--cyan-50 / 100 / 200 / 500 / 600
--rose-50 / 100 / 200 / 500 / 600

--success
--success-soft
--warning
--warning-soft
--danger
--danger-soft
--info
--info-soft

--space-1
--space-2
--space-3
...

--radius-sm
--radius-md
--radius-lg
--radius-xl
--radius-pill

--shadow-sm
--shadow-card
--shadow-card-hover
--shadow-floating

--control-height-sm
--control-height-md
--control-height-lg

--sidebar-width
--topbar-height
--page-padding-x
--page-padding-y
--section-gap
--grid-gap

--motion-fast
--motion-normal
--motion-slow
```

---

# 4. QUY TẮC QUAN TRỌNG NHẤT: THAY ĐỔI MỘT NƠI → TOÀN HỆ THỐNG ĐỔI

Đây là yêu cầu kiến trúc bắt buộc.

## Không được có tình trạng

Ví dụ tôi yêu cầu sau này:

> đổi radius card từ 16px lên 20px

mà phải sửa 30 file.

Hoặc:

> tăng khoảng cách page từ 24px lên 32px

mà chỉ trang Chức vụ đổi, còn Nhân viên, Kho, Dự án không đổi.

Hoặc:

> thay hover table row

mà phải sửa từng DataTable của từng module.

### Kết quả bắt buộc

Những thay đổi sau phải chỉ cần sửa **một token hoặc một shared component**:

| Muốn thay đổi | Chỉ sửa tại |
|---|---|
| App background | Theme token |
| Toàn bộ card radius | Radius token |
| Toàn bộ page padding | Layout token / PageShell |
| Khoảng cách section | Spacing token / layout primitive |
| Chiều cao input | Control token / Input |
| Chiều cao button | Button primitive |
| Hover button | Button variants |
| Hover card | InteractiveCard primitive |
| Table row height | DataTable primitive |
| Table hover | DataTable primitive |
| Badge màu trạng thái | StatusBadge |
| Sidebar spacing | AppSidebar |
| Sidebar active state | NavItem |
| Font scale | Typography tokens |
| Shadow card | Shadow token |
| Form field spacing | Form primitives |
| List page structure | ListPageLayout |
| Form page structure | FormPageLayout |
| Detail page structure | DetailPageLayout |
| Dashboard spacing/grid | DashboardGrid |

Nếu một thay đổi về visual phải chỉnh thủ công nhiều page thì kiến trúc chưa đạt yêu cầu.

---

# 5. CẤM DUPLICATE PRESENTATION LOGIC

Codex phải audit source và tìm:

- `PageHeader` được tự viết lại ở nhiều file;
- `table` tự viết ở từng module;
- button class duplicate;
- form wrapper duplicate;
- card class duplicate;
- breadcrumb duplicate;
- filter toolbar duplicate;
- badge trạng thái duplicate;
- modal style duplicate;
- pagination duplicate;
- hover class duplicate;
- cùng một giá trị spacing/radius được hard-code nhiều nơi.

Phải gom chúng về shared UI.

Không abstract business logic quá mức. Chỉ abstract những pattern giao diện thực sự lặp lại.

---

# 6. CẤU TRÚC SHARED COMPONENT BẮT BUỘC

Tạo hoặc chuẩn hóa các component sau.

## Foundation

```text
AppShell
AppSidebar
SidebarGroup
SidebarItem
TopHeader
GlobalSearch
QuickCreateMenu
MainWorkspace
```

## Page primitives

```text
PageContainer
PageHeader
PageTitle
PageDescription
Breadcrumbs
PageActions
Section
SectionHeader
```

## Dashboard

```text
DashboardGrid
MetricCard
ChartCard
ProgressCard
ActivityCard
ScheduleCard
TaskCard
NotificationCard
DashboardTableCard
```

## Data / List

```text
ListPageLayout
DataSurface
FilterToolbar
FilterControl
DataTable
DataTableHeader
DataTableRow
DataTableCell
RowActionMenu
Pagination
BulkActions
```

## Form

```text
FormPageLayout
FormSection
FormGrid
FormField
FormLabel
FormDescription
FormActions
```

## Detail

```text
DetailPageLayout
EntityHeader
DetailSummary
DetailTabs
DetailSection
ActivityTimeline
RelatedRecords
```

## Base controls

```text
Button
IconButton
Input
Textarea
Select
DatePicker wrapper
Checkbox
Radio
Switch
Tabs
DropdownMenu
Popover
Tooltip
Modal
Drawer
StatusBadge
Avatar
Skeleton
EmptyState
ErrorState
```

Không copy class Tailwind của những component này vào page.

---

# 7. COLOR SYSTEM

Tôi muốn hệ thống có **nhiều màu như các giao diện tham chiếu**, không phải chỉ trắng + xanh lá.

Tuy nhiên màu phải có logic.

## Palette định hướng

```text
Blue soft       #E8F1FF
Blue accent     #4C8DFF

Mint soft       #E3F8EE
Mint accent     #27B77C

Lavender soft   #EEE9FF
Lavender accent #8B6EF5

Orange soft     #FFF0DF
Orange accent   #FF9D45

Yellow soft     #FFF6D7
Yellow accent   #E7B62F

Cyan soft       #E1F8FA
Cyan accent     #32B8C5

Rose soft       #FFE8EB
Rose accent     #EF5C67
```

Không nhất thiết dùng đúng hex nếu đã có hệ màu tốt hơn, nhưng phải giữ cùng tinh thần.

## Semantic mapping gợi ý

```text
Nhân sự / trạng thái tốt     → mint
Dự án / thông tin chung      → blue
Báo cáo / analytics          → lavender
Kho / tồn / chờ xử lý        → orange hoặc yellow
Chấm công / realtime         → cyan
Quá hạn / lỗi / rủi ro       → rose/red
```

Không dùng màu pastel để thay thế semantic status một cách mơ hồ.

Trạng thái critical vẫn phải đủ contrast.

---

# 8. APP BACKGROUND VÀ SURFACE

Không dùng white toàn màn hình.

Ứng dụng cần có soft neutral app background.

Ví dụ tinh thần:

```text
App background: #F5F6F9 hoặc cool-gray cực nhạt
Surface chính:   #FFFFFF
Surface phụ:     tinted-neutral
```

Card phải được nhận diện chủ yếu nhờ:

1. background contrast;
2. spacing;
3. radius;
4. subtle shadow;
5. border chỉ khi thực sự cần.

Không dùng border để phân vùng mọi thứ.

---

# 9. SPACING SYSTEM

Chuẩn hóa spacing scale:

```text
4px
8px
12px
16px
20px
24px
28px
32px
40px
48px
```

Không dùng arbitrary spacing nếu không có lý do đặc biệt.

## Default desktop

```text
Page horizontal padding: 32px
Page top padding:        28px
Page bottom padding:     40px
Section gap:             28–32px
Grid gap:                18–20px
Card padding:            20–24px
Toolbar to table:        18–20px
Label to control:        8px
Form row gap:            18–20px
```

Khoảng cách phải tạo hierarchy:

- thành phần cùng nhóm gần nhau;
- section khác nhóm cách xa nhau rõ rệt.

Không để mọi khoảng cách đều 12–16px như UI hiện tại.

---

# 10. RADIUS SYSTEM

Định hướng mềm mại như ảnh tham chiếu.

```text
Small control:      10px
Input/Button:       12px
Nav active:         12–14px
Card:               16–18px
Large dashboard:    18–20px
Modal/Drawer:       20px
Pill badge:         999px
```

Không phải mọi thứ đều pill.

Không dùng radius random mỗi component.

---

# 11. SHADOW SYSTEM

Shadow rất mềm.

Không dùng shadow đen rõ.

Tạo token:

```text
shadow-sm
shadow-card
shadow-card-hover
shadow-floating
```

Card bình thường gần như phẳng.

Interactive card khi hover mới tăng shadow nhẹ.

Dropdown/popover/modal dùng floating shadow rõ hơn card.

---

# 12. BORDER POLICY

Giảm mạnh border.

Thứ tự ưu tiên để phân tầng UI:

```text
spacing
→ typography
→ background/surface
→ alignment
→ divider
→ border
→ shadow
```

## Border được phép chủ yếu ở

- input;
- textarea;
- select;
- focus state;
- modal/drawer boundary khi cần;
- outer data surface rất nhẹ;
- divider table;
- separator.

## Không được dùng border cho

- page title container;
- section title box;
- breadcrumb box;
- mọi toolbar;
- từng table cell;
- từng sidebar item inactive;
- card lồng card không cần thiết.

---

# 13. APP SHELL

## Sidebar

Desktop width khoảng:

```text
236–248px
```

Không quá nhỏ.

## Topbar

```text
60–64px
```

## Main workspace

Nền riêng, content padding rõ.

Sidebar + TopHeader + Workspace phải là shared layout duy nhất cho toàn bộ authenticated app.

Không module nào tự dựng sidebar/topbar riêng.

---

# 14. SIDEBAR REDESIGN

Sidebar phải mềm, sạch, nhiều khoảng thở.

### Menu item

```text
height: 42–44px
radius: 12px
font: 14px / 500
icon-size: đồng bộ
```

Inactive:

- không border;
- transparent hoặc background rất nhẹ khi hover.

Hover:

- soft background;
- text/icon tăng contrast;
- có thể `translateX(2px)`;
- duration 160–180ms.

Active:

- pastel background;
- icon + text nổi rõ;
- không đồng thời dùng background + border + left bar + shadow.

Chỉ dùng 1–2 visual signals.

### Group label

```text
font-size 11px
font-weight 600
uppercase hoặc small caps
letter-spacing nhẹ
muted
```

Group gap:

```text
20–24px
```

Sidebar phải phản ánh ERP đầy đủ, ví dụ:

```text
Tổng quan

BÁN HÀNG
MUA HÀNG
KHO HÀNG
DỰ ÁN / CÔNG TRƯỜNG
SẢN XUẤT

NHÂN SỰ
Nhân viên
Phòng ban
Chức vụ
Hợp đồng
BHXH
Chấm công
Bảng công
Kỳ công

TÀI CHÍNH / KẾ TOÁN
TÀI SẢN / THIẾT BỊ
KHÁCH HÀNG
BÁO CÁO

HỆ THỐNG
```

Giữ đúng module thực tế đang có trong source, không tự thêm business module không tồn tại.

---

# 15. TOP HEADER

Global search lớn, hiện đại, soft.

Placeholder theo nghiệp vụ thực tế:

```text
Tìm nhân viên, dự án, lô hàng, chứng từ...
```

Không border cứng.

Bên phải gồm:

```text
+ Tạo nhanh
Notification
Message
User avatar/name
```

Quick Create là shared dropdown.

Không hard-code từng nơi.

Icon button có soft hover surface.

---

# 16. DASHBOARD — KHÔNG ĐƯỢC SƠ SÀI

Dashboard là **trung tâm điều hành ERP**, phải information-rich.

Không thiết kế kiểu chỉ có 4 KPI + 2 chart rồi hết.

## Dashboard tối thiểu gồm

### A. Greeting / Context

```text
Chào buổi sáng, [User]
Dưới đây là tình hình hoạt động của doanh nghiệp hôm nay.
```

Có thể kèm ngày/phạm vi dữ liệu.

### B. KPI cards

4–6 KPI quan trọng tùy role.

Ví dụ:

- Nhân sự;
- Dự án đang triển khai;
- Công trình hoạt động;
- Giá trị tồn kho;
- Chờ xử lý;
- Chấm công hôm nay.

KPI cards có thể dùng pastel background khác nhau.

### C. Large charts

- trend chart;
- project status;
- attendance trend;
- inventory movement;
- revenue/expense nếu role được phép.

### D. Operational cards

- tình hình kho hàng;
- tiến độ dự án;
- nhân sự & chấm công;
- cảnh báo;
- approvals.

### E. Actionable widgets

- công việc cần làm;
- lịch hôm nay;
- thông báo;
- hoạt động gần đây.

### F. Data table

Dashboard phải có ít nhất một bảng dữ liệu gần đây nếu phù hợp role:

- phiếu nhập/xuất gần đây;
- dự án cập nhật gần đây;
- đơn gần đây;
- phê duyệt gần đây.

## Grid

Desktop lớn dùng 12-column grid.

Ví dụ:

```text
Row 1: KPI x 4
Row 2: Main chart 7 cols + status chart 5 cols
Row 3: warehouse 4 + project 4 + HR 4
Row 4: recent table 8 + tasks 4
```

Hoặc layout có right rail:

```text
Main: 9 cols
Right rail: 3 cols
```

Right rail có:

- lịch;
- thông báo;
- branding visual nếu cần.

## Dashboard card

```text
radius: 18–20px
padding: 20–24px
gap: 16–20px
```

Cho phép pastel full-card ở KPI.

Không cho mọi card cùng một màu trắng nếu làm dashboard quá nhạt.

---

# 17. CHART DESIGN

Không dùng chart mặc định thô.

Phải customize:

- soft grid line;
- rounded tooltip;
- smooth line;
- pastel palette;
- clear legend;
- readable label;
- hover state;
- responsive container.

Không animation chart quá dài.

Không rerender chart không cần thiết.

---

# 18. LIST PAGE TEMPLATE

Tất cả list page phải dùng chung `ListPageLayout`.

Ví dụ:

- Nhân viên;
- Phòng ban;
- Chức vụ;
- Hợp đồng;
- Bảo hiểm xã hội;
- Dự án;
- Kho;
- Phiếu nhập;
- Phiếu xuất;
- danh mục khác.

## Cấu trúc chuẩn

```text
Breadcrumb

Page title                                      Primary action
Page description

Filters / Search

Data table

Pagination
```

### Tuyệt đối không

```text
[box title]
[box search]
[box table]
```

Page title không nằm trong bordered rectangle.

Search/filter + table có thể nằm chung một DataSurface lớn.

---

# 19. DATA TABLE REDESIGN

Table là một trong những thành phần phải refactor triệt để.

## Bỏ

- vertical borders;
- grid cell borders;
- nút `Chỉnh sửa` bordered ở mỗi row;
- row quá thấp;
- header quá đậm;
- button clutter.

## Chuẩn mới

```text
Header height:       44–48px
Row height:          54–58px
Cell horizontal pad: 16px
Body:                14px
Header:              13px / 600
```

Dùng horizontal divider rất nhẹ.

Header có neutral/pastel tint cực nhẹ.

Row hover:

- background đổi nhẹ;
- transition 140–160ms.

Selected row:

- soft accent background.

Action:

```text
•••
```

Mở dropdown:

```text
Xem
Chỉnh sửa
...
```

Status dùng shared `StatusBadge`.

Pagination dùng shared component.

Nếu table có selection thì bulk action xuất hiện có chủ đích.

---

# 20. FORM PAGE REDESIGN

Tất cả create/edit page phải dùng `FormPageLayout`.

## Không làm

Một chuỗi 7–10 input full-width kéo dọc toàn màn hình.

## Desktop ưu tiên grid 2 cột

Ví dụ:

```text
Breadcrumb

Tạo dự án
Thêm dự án mới vào hệ thống

[Thông tin cơ bản]
Mã dự án               Tên dự án
[input]                 [input]

Khách hàng              Trạng thái
[select]                [select]

Ngày bắt đầu            Ngày kết thúc
[date]                  [date]

[Thông tin dự án]
Địa điểm                Ngân sách
[input]                 [input]

Quản lý dự án           Loại công trình
[select]                [select]

Mô tả
[textarea full width]
```

Form section:

```text
radius: 18px
padding: 24px
```

Section title không cần box riêng.

Input:

```text
height: 42px
radius: 12px
```

Focus ring mềm nhưng rõ.

Form action nhất quán toàn hệ thống.

---

# 21. DETAIL PAGE

Tạo `DetailPageLayout` cho các trang chi tiết.

Cấu trúc:

```text
Breadcrumb
EntityHeader
Summary
Tabs
Main detail sections
Activity / Timeline
Related records
```

Không tạo hàng loạt bordered box nhỏ.

---

# 22. CARD SYSTEM

Tạo variants chung:

```text
neutral
blue
mint
lavender
orange
yellow
cyan
rose
```

Card props nên kiểm soát:

```text
variant
padding
interactive
```

Không cho page tự chọn class màu/radius/shadow tùy tiện.

## Interactive cards

Chỉ card có thể click mới hover lift.

Hover:

```text
translateY(-2px)
shadow tăng nhẹ
180ms
```

Không hover lift card tĩnh.

---

# 23. BUTTON SYSTEM

Tạo variants:

```text
primary
secondary
soft
ghost
danger
icon
```

Không tự viết button style tại page.

Default:

```text
height 40–42px
radius 12px
font 14px / 600
```

Hover:

```text
background shift
translateY(-1px)
shadow nhẹ nếu phù hợp
```

Active:

```text
translateY(0)
```

Disabled không animation.

---

# 24. INPUT / CONTROL SYSTEM

Input, select, date input, textarea phải cùng visual language.

Không browser-default lộ ra khác biệt giữa các control.

Default:

```text
height: 42px
radius: 12px
border: subtle
background: white/soft surface
font-size: 14px
```

Hover:

- border rõ hơn chút.

Focus:

- accent border/ring.

Error:

- error message + danger state rõ.

Disabled:

- muted nhưng vẫn readable.

---

# 25. MICRO-INTERACTIONS / HOVER

Tôi muốn toàn hệ thống có hover rõ và dễ chịu.

Nhưng phải nhanh.

## Motion tokens

```text
fast:   140–160ms
normal: 180–220ms
slow:   tối đa ~260ms cho modal/drawer nếu cần
```

Không dùng 400–600ms cho thao tác thường.

## Áp dụng hover cho

- Sidebar items.
- Buttons.
- Icon buttons.
- Interactive cards.
- Table rows.
- Dropdown items.
- Tabs.
- Filter chips.
- Pagination.
- Notification rows.
- Task rows.

## Ví dụ behavior

Sidebar:

```text
background soft
translateX(2px)
```

Button:

```text
translateY(-1px)
```

Card clickable:

```text
translateY(-2px)
shadow increase
```

Table row:

```text
background tint only
```

Icon button:

```text
soft circular background
```

Không scale card/button quá lớn.

Respect `prefers-reduced-motion`.

---

# 26. DROPDOWN / POPOVER / MODAL / DRAWER

Các floating surface phải đồng bộ:

```text
radius 14–20px
soft shadow
subtle border nếu cần
padding chuẩn
```

Dropdown item có hover rõ.

Modal không có header/body/footer mỗi phần một border nặng.

Drawer dùng cùng form controls và spacing system.

---

# 27. EMPTY / LOADING / ERROR STATES

Không để spinner đơn độc giữa màn hình ở mọi nơi.

Tạo shared:

```text
Skeleton
EmptyState
ErrorState
```

Skeleton phải giống shape của content thật.

Empty state ngắn gọn, có CTA khi phù hợp.

---

# 28. RESPONSIVE

ERP desktop-first nhưng vẫn responsive.

## >= 1440px

- full dashboard grid;
- sidebar đầy đủ;
- form 2 cột;
- table density chuẩn.

## 1024–1439px

- giảm số cột dashboard;
- giữ usability;
- toolbar có thể wrap hợp lý.

## Tablet

- form chuyển 1 cột khi cần;
- sidebar có thể collapse/drawer;
- table có strategy rõ.

## Mobile

- sidebar thành drawer;
- actions không overflow;
- table có horizontal scroll hoặc mobile view có chủ đích.

Không phá desktop UX chỉ để ưu tiên mobile.

---

# 29. ACCESSIBILITY

Đảm bảo:

- keyboard focus rõ;
- contrast text đủ;
- trạng thái không chỉ truyền đạt bằng màu;
- button/icon button có accessible name;
- dropdown/modal keyboard usable;
- reduced motion;
- focus visible.

Pastel background không được làm text quá nhạt.

---

# 30. PERFORMANCE

UI mới không được làm hệ thống chậm hơn.

Không thêm animation library nặng nếu CSS transition làm được.

Không import chart library nhiều lần.

Không rerender toàn dashboard vì một hover state.

Không tạo context global khổng lồ chỉ để quản lý style.

Không inject runtime styling phức tạp không cần thiết.

Lazy-load heavy dashboard module/chart nếu hợp lý.

Giữ interaction nhanh.

---

# 31. MIGRATION STRATEGY — PHẢI LÀM THEO GIAI ĐOẠN

## Phase 1 — Audit

Liệt kê:

- tất cả layout hiện có;
- table variants;
- page header variants;
- buttons;
- forms;
- cards;
- duplicated Tailwind classes;
- hard-coded colors;
- hard-coded radius;
- hard-coded spacing;
- legacy CSS.

Không đổi business logic.

## Phase 2 — Foundation

Tạo:

- theme tokens;
- typography;
- spacing;
- radius;
- color;
- shadow;
- motion;
- primitives.

## Phase 3 — App shell

Migrate:

- Sidebar;
- TopHeader;
- MainWorkspace;
- Global search;
- Quick actions.

## Phase 4 — Dashboard

Redesign dashboard đầy đủ theo Soft Colorful Enterprise ERP.

## Phase 5 — List pages

Migrate toàn bộ CRUD list về `ListPageLayout` + `DataTable` chung.

## Phase 6 — Form pages

Migrate create/edit về `FormPageLayout` + `FormSection`.

## Phase 7 — Detail pages

Migrate detail screens.

## Phase 8 — Floating UI

Modal, drawer, dropdown, popover, toast.

## Phase 9 — States

Loading, error, empty, disabled, selected.

## Phase 10 — Legacy audit

Search toàn codebase để tìm UI cũ còn sót.

Không kết thúc khi chỉ Dashboard hoặc vài màn đã đẹp.

---

# 32. QUY TẮC KHI MIGRATE PAGE

Mỗi page phải ưu tiên composition.

Ví dụ list page:

```tsx
<ListPageLayout>
  <PageHeader
    title="Chức vụ"
    description="Quản lý chức vụ và phân bổ nhân sự trong tổ chức"
    breadcrumbs={...}
    actions={<CreatePositionButton />}
  />

  <DataSurface>
    <FilterToolbar ... />
    <DataTable ... />
  </DataSurface>
</ListPageLayout>
```

Không được viết lại layout bằng nhiều `div className="..."` giống nhau trong từng module.

Ví dụ form:

```tsx
<FormPageLayout>
  <PageHeader ... />

  <FormSection title="Thông tin cơ bản">
    <FormGrid>
      ...
    </FormGrid>
  </FormSection>

  <FormSection title="Thông tin dự án">
    ...
  </FormSection>

  <FormActions ... />
</FormPageLayout>
```

---

# 33. COMPONENT API PHẢI NGĂN VIỆC STYLE TÙY TIỆN

Shared component phải cung cấp variant đủ dùng.

Không khuyến khích page truyền vào một chuỗi `className` dài để override toàn bộ design system.

Ví dụ:

```tsx
<MetricCard variant="mint" interactive />
<Button variant="soft" />
<StatusBadge status="active" />
```

Tốt hơn:

```tsx
<div className="bg-[#...] rounded-[...] shadow-[...] p-[...] ...">
```

Nếu cần escape hatch `className`, chỉ dùng cho layout đặc biệt, không dùng để phá core style.

---

# 34. TẠO DESIGN SYSTEM DOCUMENTATION TRONG REPO

Tạo file documentation, ví dụ:

```text
docs/ui-design-system.md
```

Nội dung phải ghi:

- typography scale;
- color tokens;
- spacing;
- radius;
- shadows;
- card variants;
- button variants;
- form rules;
- table rules;
- page templates;
- hover/motion rules;
- do/don't examples.

Mục tiêu: lần sau Codex hoặc developer khác đọc vào phải biết hệ thống thiết kế hoạt động như thế nào.

---

# 35. TẠO UI PLAYGROUND / INTERNAL DESIGN SYSTEM PAGE NẾU PHÙ HỢP

Nếu kiến trúc project cho phép, tạo một route nội bộ/dev-only hoặc Storybook-equivalent nhẹ để preview:

- colors;
- typography;
- buttons;
- badges;
- inputs;
- cards;
- table;
- form section;
- modal;
- sidebar states;
- loading states.

Mục đích là kiểm tra visual consistency mà không phải vào từng module.

Không expose route này production nếu không phù hợp.

---

# 36. CƠ CHẾ ĐỂ SAU NÀY THAY ĐỔI ĐỒNG BỘ

Codex phải đảm bảo các scenario sau hoạt động:

## Scenario A

Tôi nói:

> tăng toàn bộ card radius lên 2px

Chỉ sửa token radius hoặc Card primitive.

Không sửa page.

## Scenario B

Tôi nói:

> làm toàn hệ thống thoáng hơn

Điều chỉnh page/section/grid spacing token và shared layouts.

Không chỉnh từng module.

## Scenario C

Tôi nói:

> hover của table nhẹ hơn

Chỉ sửa DataTable row primitive.

Toàn bộ table thay đổi.

## Scenario D

Tôi nói:

> đổi primary color

Chỉ thay semantic primary tokens.

Buttons, focus ring, active controls, relevant chart accent thay theo.

## Scenario E

Tôi nói:

> button cao hơn

Chỉ đổi button/control token hoặc Button primitive.

## Scenario F

Tôi nói:

> sidebar menu rộng hơn, active mềm hơn

Chỉ sửa AppSidebar/NavItem.

## Scenario G

Tôi nói:

> page title cách content xa hơn

Chỉ sửa PageHeader/PageLayout spacing.

Không sửa từng page.

Nếu các scenario trên không thực hiện được bằng thay đổi tập trung thì refactor chưa đạt.

---

# 37. CẤM TẠO "SECOND DESIGN SYSTEM"

Không được giữ UI cũ rồi tạo thêm UI mới song song lâu dài.

Không tạo:

```text
ButtonOld
ButtonNew
CardLegacy
CardModern
Table2
TableNew
```

trừ giai đoạn migration tạm thời rất ngắn.

Sau migration phải xóa legacy component/style không còn dùng.

---

# 38. KHÔNG TỰ Ý THAY ĐỔI NGHIỆP VỤ ĐỂ HỢP UI

Nếu UI mới cần thay vị trí control thì được.

Nhưng không được:

- bỏ field;
- đổi field meaning;
- đổi workflow;
- gộp bước nghiệp vụ;
- thay role access;
- bỏ action chỉ vì "không đẹp".

Nếu action nhiều, tổ chức lại bằng menu/dropdown/drawer nhưng giữ chức năng.

---

# 39. KIỂM TRA VISUAL CONSISTENCY

Sau migration, audit toàn bộ màn hình.

Kiểm tra:

- page title giống nhau chưa;
- spacing giống nhau chưa;
- table row height giống nhau chưa;
- button cùng variant có giống nhau không;
- input height/radius có thống nhất không;
- status badge có dùng đúng semantic mapping không;
- sidebar active state có duy nhất một pattern không;
- card shadow có thống nhất không;
- dashboard card có grid/gap nhất quán không;
- hover có đồng bộ duration/easing không;
- form section có cùng cấu trúc không;
- border legacy còn sót không;
- font weight có bị quá đậm không.

---

# 40. DEFINITION OF DONE

Chỉ được coi là hoàn thành khi:

- toàn bộ authenticated application cùng một design language;
- Dashboard được redesign đầy đủ, không sơ sài;
- Dashboard nhiều màu pastel có kiểm soát;
- Sidebar, topbar, page header, table, form, detail đều đồng bộ;
- UI mềm mại, hiện đại, có khoảng thở;
- Không còn cảm giác Bootstrap/PHP admin cũ;
- Không còn title nằm trong bordered rectangle;
- Không còn toolbar box + table box tách vụn không cần thiết;
- Không còn vertical borders trong standard data tables;
- Không còn repeated bordered `Chỉnh sửa` button trong mỗi row;
- Không còn arbitrary radius/spacing/color rải rác;
- Shared design tokens được dùng thực sự;
- Thay token thay được toàn hệ thống;
- Shared components được dùng ở tất cả module phù hợp;
- Hover/micro-interaction đồng bộ;
- Inter typography thống nhất;
- Responsive không vỡ;
- Accessibility cơ bản đạt;
- Business logic không thay đổi;
- Performance không giảm đáng kể;
- Legacy style đã được audit và dọn dẹp.

---

# 41. CÁCH CODEX PHẢI LÀM VIỆC TRONG TASK NÀY

Không được bắt đầu bằng cách code ngay một trang.

Thực hiện theo trình tự:

1. Audit source.
2. Viết ra kế hoạch refactor UI architecture.
3. Xác định shared component hiện có có thể tái sử dụng.
4. Xác định component/style duplicate.
5. Tạo design tokens.
6. Tạo/chuẩn hóa primitives.
7. Refactor AppShell.
8. Refactor dashboard.
9. Refactor list page template.
10. Refactor form page template.
11. Refactor detail page template.
12. Migrate module theo nhóm.
13. Audit legacy UI.
14. Kiểm tra build/type/lint/test hiện có.
15. Báo cáo file đã thay đổi và lý do.

Nếu task quá lớn cho một lượt, chia thành nhiều commit/phase rõ ràng nhưng **không thay đổi design direction giữa các phase**.

---

# 42. KẾT QUẢ TÔI MUỐN NHÌN THẤY

Khi mở hệ thống, cảm giác đầu tiên phải là:

- đây là một ERP hiện đại;
- giao diện nhẹ mắt;
- nhiều màu nhưng không lộn xộn;
- thông tin dày nhưng không chật;
- thao tác có phản hồi hover rõ;
- dashboard có chiều sâu;
- bảng dữ liệu sạch;
- form thoáng;
- sidebar dễ scan;
- mọi màn hình rõ ràng là cùng một sản phẩm.

Điều quan trọng nhất:

> **Frontend không còn được thiết kế theo từng màn hình riêng lẻ. Từ thời điểm refactor này, mọi thay đổi visual phải đi qua design tokens, shared components hoặc page templates. Nếu một thay đổi mang tính hệ thống phải chỉnh thủ công từng page, coi như implementation sai kiến trúc và phải refactor lại.**

---

# 43. FINAL INSTRUCTION TO CODEX

Hãy coi task này như một **design-system migration** chứ không phải cosmetic restyling.

Giữ nguyên nghiệp vụ đang chạy.

Đầu tiên audit codebase, sau đó xây foundation dùng chung, rồi migrate toàn bộ ứng dụng.

Không hoàn thành task chỉ bằng cách làm đẹp Dashboard hoặc trang Chức vụ.

Không copy Tailwind class giữa các page để tạo cảm giác đồng bộ giả.

Mục tiêu cuối cùng là:

**Soft Colorful Enterprise ERP + Single Source of Truth + Shared Components + Global Visual Consistency.**

Sau khi hoàn thành, hãy xuất báo cáo gồm:

1. Design tokens đã tạo/chỉnh.
2. Shared components đã tạo/chỉnh.
3. Legacy components/styles đã xóa hoặc deprecate.
4. Các page/module đã migrate.
5. Các phần chưa migrate nếu còn.
6. Cách thay đổi global radius/spacing/color/hover sau này.
7. Kết quả build/typecheck/lint/test.

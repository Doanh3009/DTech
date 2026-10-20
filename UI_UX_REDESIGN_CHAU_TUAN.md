# PROMPT TỔNG – REDESIGN UI/UX HỆ THỐNG NỘI BỘ CHÂU TUẤN

## 0. Vai trò và mục tiêu

Bạn đang làm việc trực tiếp trên **codebase hiện tại của hệ thống nội bộ Châu Tuấn**. Hệ thống đã có chức năng và luồng nghiệp vụ đang hoạt động. Nhiệm vụ lần này là **nâng cấp toàn bộ UI/UX ở cấp hệ thống**, làm giao diện có nhận diện riêng của Châu Tuấn, hiện đại, rõ ràng, nhiều màu sắc có kiểm soát, dễ đọc, phù hợp phần mềm ERP/CRM nội bộ doanh nghiệp xây dựng; đồng thời loại bỏ cảm giác “generic AI dashboard / shadcn template / admin template”.

**Đây là một đợt UI/UX redesign, KHÔNG phải dự án viết lại hệ thống.**

Mục tiêu cuối cùng:

- Giao diện desktop hiện đại, chuyên nghiệp, có bản sắc Châu Tuấn.
- Màu sắc sử dụng từ logo công ty làm nền tảng nhận diện.
- Chữ lớn, rõ, dễ đọc hơn giao diện hiện tại.
- Phân cấp thông tin tốt, giảm khoảng trắng vô nghĩa, giảm cảm giác form/template tự sinh.
- Desktop có Workspace/App Launcher thông minh theo phân quyền, lấy cảm hứng từ cách tổ chức module của ERP như MISA nhưng **không sao chép giao diện MISA**.
- Mobile không ép launcher desktop xuống màn hình nhỏ; dùng home theo role + bottom navigation.
- Mọi module dùng chung một design system thống nhất.
- Giữ nguyên backend, database, realtime, RLS, API, route, quyền hạn và nghiệp vụ hiện có.
- Không tạo regression ở chấm công, kho, dự án, nghỉ phép, xuất nhập khẩu hay các module khác.

---

# 1. NGUYÊN TẮC AN TOÀN – BẮT BUỘC TUÂN THỦ

Trước khi sửa code, hãy đọc và phân tích toàn bộ kiến trúc frontend hiện tại: framework, router, component library, CSS/Tailwind, auth, role/permission, realtime subscription, layout, route modules và các component dùng chung.

Sau khi audit xong, **tiến hành triển khai luôn**, không dừng lại chỉ để đưa ra kế hoạch và không yêu cầu người dùng xác nhận từng bước.

Các nguyên tắc bắt buộc:

1. **Không rewrite project.**
2. **Không thay đổi database schema** chỉ để phục vụ redesign.
3. **Không thay đổi Supabase/API contract/backend logic** nếu không thật sự cần cho việc render giao diện; mặc định là không được đụng.
4. **Không thay đổi RLS, auth, role, permission hoặc dữ liệu phân quyền.**
5. **Không phá realtime.** Mọi subscription, invalidate/refetch, optimistic update hoặc cơ chế đồng bộ hiện tại phải được giữ nguyên.
6. **Không đổi route hiện có một cách tùy tiện.** Nếu cần launcher/workspace, thêm route mới mà không làm hỏng deep-link cũ.
7. **Không đổi business logic của chấm công, nghỉ phép, kho, xuất nhập kho, chuyển kho, tồn kho, dự án, điểm danh công nhân, xuất nhập khẩu.**
8. **Không xóa chức năng vì thấy giao diện cũ xấu.** Chỉ tái bố trí UI.
9. **Không nâng version hàng loạt dependency.** Chỉ thêm package khi thực sự cần và phải ưu tiên package đã có trong project.
10. **Không thay đổi git history, không reset, không xóa thay đổi hiện có của người dùng.**
11. Không tạo mock data cho các màn hình đang có dữ liệu thật.
12. Nếu một component hiện có chứa logic nghiệp vụ, hãy tách phần presentational một cách an toàn hoặc bọc lại, không copy logic sang nhiều nơi.
13. Ưu tiên refactor có kiểm soát, từng lớp: tokens → primitives → shell → shared components → pages.
14. Sau mỗi nhóm thay đổi lớn phải đảm bảo build/typecheck/lint không phát sinh lỗi mới.

---

# 2. NHẬN DIỆN THƯƠNG HIỆU CHÂU TUẤN

Logo Châu Tuấn sử dụng hai màu chính. Dùng đúng các màu sau làm brand colors:

```css
--ct-green: #19A94A;
--ct-green-hover: #158A3D;
--ct-green-active: #117533;
--ct-green-50: #ECF9F0;
--ct-green-100: #D8F2E1;

--ct-red: #DC2625;
--ct-red-hover: #BF201F;
--ct-red-50: #FDEEEE;
--ct-red-100: #FAD9D9;
```

Không thiết kế giao diện theo kiểu 50% xanh + 50% đỏ. Xanh là màu tương tác/brand chính; đỏ là secondary brand accent và danger khi phù hợp.

Bộ màu hệ thống:

```css
--bg-app: #F5F7F6;
--bg-subtle: #F8FAF9;
--surface: #FFFFFF;
--surface-hover: #F7FAF8;
--border: #E4E7EC;
--border-strong: #D0D5DD;

--text-primary: #17212B;
--text-secondary: #475467;
--text-muted: #667085;
--text-disabled: #98A2B3;

--info: #2563EB;
--info-soft: #EFF6FF;
--warning: #F59E0B;
--warning-soft: #FFFAEB;
--success: #16A34A;
--success-soft: #ECFDF3;
--danger: #DC2625;
--danger-soft: #FDEEEE;
--purple: #7C3AED;
--purple-soft: #F5F3FF;
```

Có thể tạo màu module từ các semantic colors ở trên, nhưng **không được tùy ý sinh 10–15 màu pastel khác nhau**.

### Tinh thần hình ảnh

Phong cách: **Modern Enterprise + Construction Identity + Data-centric**.

Dùng logo thật tại các vị trí branding: login, sidebar header, workspace header, admin branding preview. Không lặp logo trong mọi card.

Có thể lấy cảm hứng hình học từ logo Châu Tuấn: các đường chéo/góc tam giác, thanh line xanh/đỏ rất nhỏ hoặc decorative accent tinh tế trong login/workspace/empty state. Không biến mọi card thành hình tam giác và không làm ảnh hưởng tính đọc.

Không dùng neon, glassmorphism nặng, gradient cầu vồng, blob background kiểu landing page AI.

---

# 3. TYPOGRAPHY

Ưu tiên **Be Vietnam Pro** cho toàn hệ thống vì hiển thị tiếng Việt tốt và tạo bản sắc rõ hơn font dashboard mặc định.

Nếu project đang dùng framework có font loader tối ưu như `next/font`, dùng cách phù hợp framework hiện tại. Nếu không thể tải font mới an toàn, dùng fallback:

```css
font-family: "Be Vietnam Pro", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Quy chuẩn:

- Page title: 28–30px, weight 700.
- Page subtitle/breadcrumb: 13–14px.
- Section title: 20–22px, weight 600–700.
- Card title: 14–16px, weight 600.
- KPI number: 28–36px, weight 700.
- Body: 15–16px.
- Table: 14–15px.
- Label: 13–14px, weight 600.
- Sidebar item: 14–15px, weight 500.
- Button: 14–15px, weight 600.

Line-height phải thoáng, không dùng chữ quá nhỏ ở màn hình desktop Full HD/2K.

---

# 4. SPACING, RADIUS, SHADOW

Dùng hệ spacing có quy luật, ưu tiên 4/8px scale.

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Radius:

- Input/button: 8–10px.
- Card: 12–14px.
- Modal/drawer: 14–16px.
- Pill/badge: full radius khi phù hợp.

Không dùng bo 20–30px cho mọi thứ.

Shadow nhẹ, ưu tiên border + elevation tinh tế. Không tạo shadow đậm cho tất cả card.

---

# 5. DESIGN SYSTEM – TẠO LỚP DÙNG CHUNG

Không chỉnh CSS riêng lẻ mỗi trang. Hãy xây/chuẩn hóa các shared UI primitives phù hợp architecture hiện tại.

Nếu project dùng Tailwind/shadcn, giữ stack đó nhưng override token/component để không còn diện mạo shadcn mặc định. Nếu dùng CSS Modules/SCSS/CSS-in-JS, tạo design tokens tương đương. **Không migrate framework CSS chỉ vì redesign.**

Cần chuẩn hóa ít nhất:

- AppShell
- Sidebar
- Topbar
- MobileBottomNav
- PageHeader
- Breadcrumbs
- Button variants
- Input/Textarea/Select/Combobox
- SearchInput
- FormField
- Card
- KPI/StatCard
- StatusBadge
- ModuleBadge
- Tabs
- DataTable
- TableToolbar
- FilterBar
- EmptyState
- Skeleton
- Modal
- Drawer/Sheet
- ConfirmDialog
- Toast/Notification
- Pagination
- Dropdown/Menu
- Date/Time controls đang dùng
- Approval/Status timeline nếu hệ thống đã có

Mỗi component phải có state: default, hover, focus, active, disabled, loading, error khi phù hợp.

Focus ring dùng brand green nhưng đảm bảo accessible.

---

# 6. APP SHELL DESKTOP

## 6.1 Sidebar

Desktop sidebar rộng khoảng 252–264px. Có chế độ collapse về khoảng 72px nếu cơ chế hiện tại cho phép.

Header sidebar:

- Logo Châu Tuấn thu gọn phù hợp.
- Tên: `CHÂU TUẤN`.
- Subtitle nhỏ: `Hệ thống quản trị nội bộ`.

Menu giữ đúng module/route hiện có nhưng trình bày rõ nhóm.

Ví dụ nhóm:

```text
TỔNG QUAN
  Tổng quan

NHÂN SỰ
  Nhân viên
  Chấm công
  Bảng công
  Ca làm
  Nghỉ phép

DỰ ÁN
  Dự án / Công trường
  Cập nhật dự án
  Điểm danh công nhân
  Theo dõi dự án

KHO
  Hàng hóa
  Nhập kho
  Xuất kho
  Chuyển kho
  Tồn kho
  Tổng quan kho

XUẤT NHẬP KHẨU
  [giữ đúng các route/chức năng hiện có]

HỆ THỐNG
  [các route mà user có quyền]
```

Không tự thêm menu nghiệp vụ không tồn tại.

### Active state

- Background: `#ECF9F0`.
- Text/icon: brand green đậm.
- Có indicator 3px bên trái hoặc accent tương đương.
- Border radius 8–10px.

Hover nhẹ, không nhảy layout.

Scrollbar sidebar phải mảnh, tinh tế; không để thanh scrollbar xám dày như giao diện cũ.

Khi collapsed, tooltip cho icon.

Sidebar chỉ hiển thị item user có quyền như hiện tại. Tuyệt đối không làm lộ menu không có permission.

## 6.2 Topbar

Topbar cao khoảng 64–68px, sticky nếu architecture hiện tại phù hợp.

Bố cục:

- Khu vực page context/breadcrumb ở trái nếu cần.
- Global Search ở giữa/không gian chính.
- Right actions: `+ Tạo mới`, notification, app switcher, avatar/user menu.

Global search giữ logic hiện có. Nếu search hiện tại mới chỉ là UI, không tự viết backend search giả.

Button `+ Tạo mới` dùng brand green. Dropdown chỉ hiển thị action user được phép thực hiện và action thực sự tồn tại.

App switcher là icon 3x3 hoặc grid, đưa user về `/workspace`.

Status `Online` không cần là một badge lớn thường trực nếu nó không cung cấp giá trị nghiệp vụ; nếu hiện tại dùng để phản ánh realtime/network thì chuyển thành indicator nhỏ, tooltip rõ trạng thái.

---

# 7. WORKSPACE / APP LAUNCHER DESKTOP

## 7.1 Có launcher nhưng KHÔNG ép tất cả user đi qua một màn hình icon rỗng

Tạo/chuẩn hóa route `workspace` theo router hiện tại, ví dụ `/workspace`, nhưng không phá route cũ.

Logic điều hướng sau đăng nhập:

- User có quyền ở **từ 2 nhóm module nghiệp vụ trở lên** → vào Workspace.
- Admin/Super Admin/BGĐ/role quản trị nhiều module → vào Workspace.
- User chỉ có 1 nhóm module chính → có thể vào thẳng role home/module dashboard hiện tại.
- Nếu project hiện tại đã có landing logic khác, điều chỉnh tối thiểu để đạt hành vi này và giữ compatibility.

Workspace phải luôn có thể mở lại từ App Switcher trên topbar.

## 7.2 Workspace không được copy hình Monica/MISA

Không tạo grid icon màu đơn giản với 20 ô giống nhau.

Workspace mới cần 4 lớp thông tin:

### A. Welcome header

```text
Xin chào, {Tên người dùng}
Hôm nay, {ngày/tháng/năm}
```

Có search `Tìm chức năng, dự án, nhân viên, hàng hóa...` nếu global search hỗ trợ.

Dùng một brand panel nhẹ với hình học lấy cảm hứng logo Châu Tuấn; không dùng ảnh stock.

### B. Công việc cần xử lý

Chỉ render những dữ liệu đang có thật/đã có query tương ứng, ví dụ:

- Đơn nghỉ chờ duyệt.
- Phiếu kho chờ xử lý.
- Cập nhật dự án cần xem.
- Các approval khác hiện có.

Nếu backend chưa có một aggregate query, không tạo số liệu giả. Có thể hiển thị module shortcut trước và để khu vực này ẩn nếu chưa có dữ liệu.

### C. Ứng dụng của tôi

Module cards lớn hơn launcher cổ điển, khoảng 220–280px tùy grid.

Mỗi card:

- Icon module custom container.
- Tên module.
- Mô tả 1 dòng.
- 2–3 shortcut phụ nếu có.
- Accent color semantic, không tô cả card.
- Hover có lift rất nhẹ/outline brand.

Ví dụ module group, chỉ render theo permission thực tế:

```text
Nhân sự
Nhân viên · Hồ sơ · Ca làm

Chấm công
Chấm công · Bảng công

Dự án & Công trường
Tiến độ · Cập nhật · Nhân sự công trường

Kho hàng
Nhập · Xuất · Chuyển · Tồn

Xuất nhập khẩu
Shipment · Đối tác · Hồ sơ hiện có

Điều hành
Tổng quan · Phê duyệt · Báo cáo hiện có
```

### D. Dùng gần đây / Lối tắt

Nếu project hiện có cơ chế recent/favorites thì dùng. Nếu chưa có, có thể tạo **client-side local preference** an toàn cho shortcut gần đây, nhưng không được dựng database mới chỉ cho tính năng này trong đợt redesign.

## 7.3 Workspace theo role

- BGĐ: ưu tiên KPI/tổng quan doanh nghiệp, dự án, nhân sự, tồn kho nếu đã có dữ liệu và quyền.
- Admin/Super Admin: module access + các việc cần xử lý + system health/notification hiện có; không hiển thị thông tin backend nhạy cảm.
- HR: Nhân sự, Chấm công, Bảng công, Ca làm, Nghỉ phép nổi bật.
- Thủ kho: Kho hàng, Nhập/Xuất/Chuyển/Tồn nổi bật.
- Kỹ sư/Project: Dự án, Cập nhật dự án, Điểm danh công nhân nổi bật.

Không hard-code theo tên role nếu hệ thống permission hiện tại là permission-based. Ưu tiên suy ra từ permission/module access.

---

# 8. MOBILE – KHÔNG DÙNG LAUNCHER DESKTOP

Breakpoint theo stack hiện tại, nhưng tối ưu thật cho 360/375/390/430px.

Sau đăng nhập mobile:

- Không hiển thị grid launcher kiểu desktop như màn hình trung gian bắt buộc.
- Đi thẳng vào mobile home phù hợp quyền/role.
- Dùng bottom navigation tối đa 5 mục.

Gợi ý logic:

```text
Trang chủ | Chấm công | Dự án/Kho | Công việc | Thêm
```

Không hard-code giống nhau cho mọi role. Chọn 3–4 module/action quan trọng nhất dựa trên permission; `Thêm` mở sheet chứa các module còn lại.

Ví dụ:

Kỹ sư:
`Trang chủ | Chấm công | Công trường | Cập nhật | Thêm`

Thủ kho:
`Trang chủ | Nhập kho | Xuất kho | Tồn kho | Thêm`

Nhân viên văn phòng:
`Trang chủ | Chấm công | Nghỉ phép | Thông báo | Thêm`

Admin/BGĐ mobile:
`Tổng quan | Phê duyệt | Dự án | Thông báo | Thêm`

Đây là mapping UI; mọi action phải dựa trên permission thật.

Trên mobile:

- Sidebar chuyển thành drawer nếu vẫn cần.
- Table rộng phải dùng responsive strategy: horizontal scroll có kiểm soát hoặc card row, không ép toàn bộ cột thành chữ siêu nhỏ.
- Form dài dùng section rõ ràng.
- Drawer desktop có thể chuyển bottom sheet/full-screen modal trên mobile.
- Touch target tối thiểu khoảng 44px.
- Không để các nút quan trọng sát mép hoặc quá nhỏ.

---

# 9. DASHBOARD / TỔNG QUAN

Redesign trang Tổng quan theo hướng data-centric.

Không bắt buộc thêm chart nếu dữ liệu/logic chưa tồn tại.

Nếu có dữ liệu, bố cục đề xuất:

1. Page header + khoảng thời gian nếu đã có filter.
2. 4–6 KPI cards quan trọng.
3. Một khu vực chính 2/3 chiều rộng cho biểu đồ hoặc hoạt động chính.
4. Khu vực 1/3 cho pending approvals / alert / recent activity.
5. Phần dưới cho dự án, attendance hoặc kho tùy permission.

KPI card:

- Nền trắng.
- Icon nền soft color.
- Số lớn 30–34px.
- Label rõ.
- Trend chỉ hiển thị nếu dữ liệu thật có kỳ so sánh.

Không dùng các biểu đồ trang trí không có ý nghĩa.

---

# 10. FORM – THAY ĐỔI CÁCH BỐ TRÍ

Form hiện tại không được chiếm cả màn hình nếu chỉ có vài field.

Quy tắc:

- Trang danh sách ưu tiên **list/table trước**.
- `+ Thêm ...` mở Drawer/Modal với form nếu phù hợp.
- Form create/edit phức tạp có thể giữ page riêng.
- Không tạo một button `Thêm` rộng 50% màn hình như giao diện cũ.
- Field width theo nội dung, không mặc định full width mọi field.
- Nhóm field liên quan thành section.
- Required marker rõ.
- Error message ngay dưới field.
- Footer action của drawer/modal sticky khi form dài.

Form destructive action tách khỏi primary action.

---

# 11. DATA TABLE

Table là thành phần trọng tâm của ERP, phải ưu tiên độ đọc hơn trang trí.

Thiết kế:

- Header 44–48px.
- Row 48–56px tùy density.
- Sticky header khi danh sách dài nếu feasible.
- Zebra không bắt buộc; ưu tiên border row nhẹ.
- Hover row rõ nhưng không quá đậm.
- Cột mã/code dùng font-weight 600, không cần monospace trừ khi thật sự hữu ích.
- Status dùng badge semantic.
- Actions đặt cuối row trong menu `...` nếu có nhiều hơn 2 action.
- Checkbox selection chỉ hiện ở bảng có bulk action thật.

Toolbar:

```text
[Search................] [Loại] [Trạng thái] [Bộ lọc]     [+ Thêm]
```

Desktop bố trí trên một hàng khi đủ chỗ; responsive tốt trên tablet/mobile.

Empty state không chỉ ghi “Chưa có ...”. Có icon/illustration đơn giản bằng icon system, mô tả ngắn, CTA nếu user có quyền tạo.

---

# 12. REDESIGN MÀN HÌNH “ĐỐI TÁC” THEO ẢNH HIỆN TẠI

Màn hình hiện tại đang đặt form tạo đối tác ở đầu và một empty block lớn bên dưới. Hãy chuyển thành pattern quản trị chuẩn:

## Page header

```text
Đối tác
Quản lý nhà cung cấp, khách hàng và các đối tác liên quan đến hoạt động xuất nhập khẩu.
                                      [+ Thêm đối tác]
```

Không tự tuyên bố loại đối tác mà backend chưa hỗ trợ; mô tả phải phản ánh enum/data hiện có.

## Summary nếu có dữ liệu dễ tính từ danh sách hiện tại

Có thể hiển thị 3–4 mini stats như tổng số đối tác / nhà cung cấp / khách hàng / active, nhưng **chỉ khi dữ liệu hiện tại có trường tương ứng**. Không thêm query phức tạp chỉ để trang trí.

## Toolbar + table

```text
[Tìm mã hoặc tên đối tác...] [Loại đối tác] [Trạng thái nếu có] [Bộ lọc]
```

Table dùng các cột thực tế đang có trong schema/view model hiện tại.

## Create/Edit

Bấm `+ Thêm đối tác` → Drawer bên phải desktop khoảng 480–560px, mobile full-screen.

Form chứa đúng field hiện có:

- Mã đối tác.
- Tên đối tác.
- Loại đối tác.
- Các field khác nếu model hiện tại có.

Primary button `Lưu đối tác`, secondary `Hủy`.

Giữ nguyên mutation hiện tại. Sau create/update phải giữ cách sync/realtime/refetch đang hoạt động.

---

# 13. ÁP DỤNG CHO TOÀN BỘ MODULE

Sau khi design system + shell hoàn thành, áp dụng nhất quán cho tất cả route hiện hữu, ưu tiên theo thứ tự:

```text
1. App Shell / Navigation
2. Workspace / Launcher
3. Tổng quan
4. Nhân viên
5. Chấm công
6. Bảng công
7. Ca làm
8. Nghỉ phép
9. Dự án / Công trường
10. Cập nhật dự án
11. Điểm danh công nhân
12. Theo dõi dự án
13. Hàng hóa
14. Nhập kho
15. Xuất kho
16. Chuyển kho
17. Tồn kho
18. Tổng quan kho
19. Xuất nhập khẩu và các submodule hiện có
20. Đối tác
21. Các trang quản trị/cấu hình hiện có
22. Login / auth-related screens
23. Error / loading / empty states
```

Không thêm page chỉ vì danh sách trên nhắc tới một khái niệm không tồn tại trong codebase. Hãy lấy route thật làm source of truth.

---

# 14. MODULE-SPECIFIC VISUAL DIRECTION

Dùng màu theo semantic/module để tăng khả năng quét nhanh, nhưng giữ nền chủ yếu neutral:

- Nhân sự: brand green.
- Chấm công: amber hoặc green tùy state; success/late phải dùng semantic status.
- Dự án: blue.
- Kho: teal/brand green hoặc blue-green.
- Xuất nhập khẩu: purple/blue.
- Approval/đang chờ: amber.
- Error/quá hạn/từ chối: red.

Không dùng màu module để thay thế semantic color. Ví dụ “Từ chối” vẫn phải danger/red dù đang ở module Dự án màu blue.

---

# 15. ICONOGRAPHY

Functional icon có thể tiếp tục dùng icon library hiện tại để nhất quán.

Không để toàn hệ thống trông như một demo Lucide mặc định:

- Module-level icon dùng container riêng 44–52px, soft background, có visual weight lớn hơn.
- Sidebar functional icon 18–20px.
- Table action icon 16–18px.
- Không dùng emoji trong production UI trừ nội dung người dùng.
- Không trộn 3–4 icon library khác nhau.

Nếu project đã có logo SVG/PNG, dùng asset gốc. Không vẽ lại logo bằng CSS.

---

# 16. BUTTON HIERARCHY

Chuẩn hóa:

### Primary
Brand green, chữ trắng.

### Secondary
Nền trắng, border, chữ primary.

### Ghost
Nền trong suốt, hover neutral/green-soft.

### Danger
Red khi destructive action.

Không dùng brand red cho mọi CTA chính.

Không có nhiều hơn một primary CTA cạnh nhau trong cùng một action group trừ trường hợp thật sự cần.

Loading button phải chống double submit.

---

# 17. BADGE / STATUS

Các trạng thái phải có mapping thống nhất toàn hệ thống:

- Thành công/đã duyệt/đang hoạt động → success.
- Chờ duyệt/chờ xử lý → warning.
- Thông tin/đang thực hiện → info.
- Từ chối/lỗi/quá hạn → danger.
- Nháp/inactive → neutral.

Không hard-code text color rải rác trong từng page. Dùng component/status map chung.

---

# 18. NOTIFICATION / FEEDBACK

Mọi create/update/delete/approve/reject hiện tại phải có feedback rõ ràng:

- Loading state.
- Success toast.
- Error message có ý nghĩa, ưu tiên message từ logic hiện tại đã sanitize.
- Disable submit trong lúc pending.
- Confirm dialog cho destructive action.

Không thay đổi semantics nghiệp vụ chỉ để làm toast.

---

# 19. REALTIME VÀ NETWORK STATE – CỰC KỲ QUAN TRỌNG

Hệ thống yêu cầu realtime đồng bộ. Redesign không được làm mất subscription hoặc khiến UI hiển thị dữ liệu stale.

Khi refactor:

- Giữ nguyên Supabase realtime channel/subscription hiện có.
- Không tạo duplicate subscription do mount lại component sai cách.
- Cleanup subscription đúng lifecycle.
- Giữ query invalidation/refetch hiện có.
- Sau create/update/delete, UI phải phản ánh dữ liệu đúng như trước redesign.
- Nếu có optimistic update, không làm mất rollback/error handling.
- Nếu có offline flow/chấm công offline hiện tại, tuyệt đối không thay đổi logic đó trong task này.

Network status trên mobile/desktop chỉ hiển thị nếu hệ thống thực sự phát hiện được trạng thái. Không giả lập `Online` cố định.

---

# 20. ACCESSIBILITY

- Contrast text đạt mức đọc tốt.
- Không truyền đạt trạng thái chỉ bằng màu; có text/icon khi cần.
- Keyboard focus visible.
- Modal/drawer trap focus đúng nếu component system hỗ trợ.
- Label gắn input đúng.
- Icon-only button có aria-label/tooltip.
- Không khóa zoom mobile.

---

# 21. RESPONSIVE

Kiểm tra tối thiểu:

```text
360x800
375x812
390x844
430x932
768x1024
1024x768
1366x768
1440x900
1920x1080
```

Không chỉ làm desktop rồi scale xuống.

Desktop content max-width chỉ dùng khi page cần đọc; ERP tables có thể dùng toàn chiều rộng available.

Ở 1366px sidebar + content vẫn phải thoải mái.

---

# 22. LOGIN SCREEN

Redesign login theo brand Châu Tuấn:

Desktop có thể chia 2 vùng:

- Brand panel: logo + tên hệ thống + geometric motif xanh/đỏ rất nhẹ.
- Login panel: card/form sạch, rõ.

Mobile chỉ dùng một panel, logo trên cùng.

Không dùng ảnh stock công trường nếu project chưa có asset bản quyền/được duyệt.

---

# 23. ADMIN / CẤU HÌNH HỆ THỐNG

Nếu codebase hiện tại đã có trang cấu hình riêng (khác với khái niệm role Admin), redesign theo cùng design system.

Nếu có chức năng chỉnh logo, tên công ty, branding hoặc UI setting thì:

- Hiển thị preview.
- Không làm thay đổi permission admin.
- Không trộn cấu hình hệ thống với role management.

Nếu chức năng đó chưa tồn tại backend, **không mở rộng scope để xây mới trong prompt UI này**. Chỉ chuẩn bị component/layout có thể mở rộng sau.

---

# 24. CHỐNG “AI-GENERATED LOOK”

Bắt buộc tránh các pattern sau:

- Mỗi section là một card bo tròn lớn giống nhau.
- Khoảng trắng quá rộng nhưng nội dung rất ít.
- Nút chính dài 50–100% màn hình khi không cần.
- Gradient tím/xanh mặc định SaaS.
- Mọi icon nằm trong vòng tròn pastel ngẫu nhiên.
- Dùng quá nhiều shadow.
- Dùng text 12–13px cho nội dung chính.
- Dùng placeholder/copy kiểu “Manage your amazing ...”.
- Dùng chart giả hoặc fake trend `%` để giao diện trông đẹp.
- Mọi page có cùng một grid 4 card dù nghiệp vụ khác nhau.
- Dùng default component styling mà không gắn brand token.
- Bo tròn quá mức.
- Responsive chỉ bằng cách stack mọi thứ thành một cột.

UI phải có chủ đích theo nghiệp vụ của từng màn hình.

---

# 25. CÁCH TRIỂN KHAI TRONG CODE

Thực hiện theo thứ tự sau nhưng không dừng giữa chừng để chờ xác nhận:

## Phase A – Audit

- Kiểm tra framework và directory structure.
- Liệt kê route thực tế.
- Xác định auth/permission source.
- Xác định shell/layout hiện tại.
- Xác định shared components.
- Xác định styling solution.
- Xác định các khu vực có realtime.

## Phase B – Foundation

- Tạo brand/design tokens.
- Typography.
- Global background/text/border.
- Chuẩn hóa primitive components.

## Phase C – Navigation

- Sidebar.
- Topbar.
- Mobile nav.
- App switcher.
- Workspace.

## Phase D – Shared patterns

- PageHeader.
- KPI.
- FilterBar.
- DataTable.
- Drawer forms.
- Empty/loading/error states.
- Status badge.

## Phase E – Page migration

Migrate toàn bộ route theo thứ tự ưu tiên ở mục 13, không bỏ sót các page ít dùng.

## Phase F – QA

- Responsive.
- Permission.
- Realtime.
- Create/edit/delete.
- Loading/error.
- Keyboard/focus.
- Build/typecheck/lint.

---

# 26. QUY TẮC KHI GẶP COMPONENT/LOGIC CŨ KHÓ REFACTOR

Nếu logic và UI dính chặt:

1. Không rewrite logic một lần lớn.
2. Giữ container/data logic cũ.
3. Tách presentational component dần.
4. Truyền props/data xuống component mới.
5. Sau khi behavior parity đạt mới dọn code cũ.

Nếu không chắc một đoạn code có nghiệp vụ gì, **giữ nguyên behavior**, chỉ thay structure/class/style tối thiểu.

---

# 27. PERFORMANCE

- Không thêm animation nặng.
- Transition 120–220ms cho hover/sidebar/drawer.
- Respect `prefers-reduced-motion` nếu có thể.
- Không tải logo/image kích thước quá lớn.
- Không import toàn bộ icon pack nếu tree-shaking không hoạt động.
- Không gây remount toàn page chỉ vì sidebar toggle.
- Không tạo query mới lặp lại ở mỗi card nếu dữ liệu đã có ở parent.

---

# 28. KẾT QUẢ CẦN BÀN GIAO TRONG CODEBASE

Khi hoàn tất, phải có:

1. Design tokens tập trung theo stack hiện tại.
2. Shared UI components đã được nâng cấp.
3. App shell desktop hoàn chỉnh.
4. Mobile navigation hoàn chỉnh.
5. Workspace/App Launcher theo permission.
6. Dashboard/tổng quan được redesign.
7. Các form/list/table được thống nhất.
8. Màn hình Đối tác chuyển sang list-first + drawer create/edit.
9. Toàn bộ module hiện hữu dùng cùng design language.
10. Login/auth screens có branding Châu Tuấn.
11. Không regression nghiệp vụ/realtime.
12. Build chạy thành công.

---

# 29. ACCEPTANCE CRITERIA

Chỉ coi task hoàn tất khi đạt toàn bộ các tiêu chí sau:

### Visual

- Nhìn vào là nhận ra đây là hệ thống Châu Tuấn, không phải dashboard template chung.
- Xanh `#19A94A` là primary brand color.
- Đỏ `#DC2625` được dùng tiết chế.
- Typography lớn và rõ hơn bản hiện tại.
- Không còn button quá lớn vô lý.
- Không còn empty whitespace vô nghĩa tương tự màn hình Đối tác cũ.
- Sidebar/topbar có hierarchy tốt.
- Tables/forms dễ quét thông tin.

### UX

- User nhiều quyền có Workspace.
- User ít quyền không bị ép click qua launcher không cần thiết.
- App Switcher truy cập Workspace từ desktop.
- Mobile không hiện launcher desktop bắt buộc.
- Mobile có bottom navigation theo permission.
- Tạo/sửa dữ liệu thuận tiện bằng drawer/modal khi phù hợp.

### Functional

- Login/logout hoạt động.
- Permission hoạt động như trước.
- Deep links cũ hoạt động.
- Chấm công hoạt động như trước.
- Realtime hoạt động như trước.
- CRUD hiện có hoạt động như trước.
- Kho hoạt động như trước.
- Nghỉ phép/phê duyệt hoạt động như trước.
- Dự án/công trường hoạt động như trước.
- Xuất nhập khẩu hoạt động như trước.
- Không có fake data.

### Technical

- Không lỗi TypeScript/build mới.
- Không console error mới ở luồng chính.
- Không duplicate realtime subscription.
- Không hydration error nếu dùng SSR.
- Không hard-code permission bypass.
- Không database migration cho redesign trừ trường hợp codebase đã có migration bắt buộc từ trước và không liên quan task này.

---

# 30. BÁO CÁO SAU KHI HOÀN TẤT

Sau khi code xong, trả lời ngắn gọn theo format:

```text
UI/UX Redesign completed

1. Foundation
- ...

2. Navigation & Workspace
- ...

3. Pages redesigned
- ...

4. Responsive/mobile
- ...

5. Functional safety
- Realtime: verified / note
- Permissions: verified / note
- Build: pass / note
- Typecheck: pass / note

6. Files/folders changed
- ...

7. Remaining non-blocking items
- ...
```

Nếu có lỗi build/typecheck vốn đã tồn tại trước khi sửa, phải phân biệt rõ **pre-existing issue** và **issue introduced by redesign**.

---

# 31. CHỈ DẪN CUỐI CÙNG

Hãy bắt đầu bằng việc audit codebase hiện tại và sau đó triển khai trực tiếp toàn bộ redesign theo specification này.

**Không viết lại hệ thống từ đầu. Không thay đổi nghiệp vụ. Không làm mất realtime. Không phá phân quyền. Không tạo dữ liệu giả. Không chỉ tạo mockup. Hãy chỉnh code production hiện tại.**

Mục tiêu là biến hệ thống hiện tại thành một sản phẩm nội bộ doanh nghiệp có thiết kế riêng, hiện đại, chuyên nghiệp, dễ sử dụng và nhất quán với nhận diện Châu Tuấn trên cả desktop lẫn mobile.

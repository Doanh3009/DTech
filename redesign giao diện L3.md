# MASTER PROMPT — TỰ SETUP UI/UX PRO MAX + REFACTOR DỨT ĐIỂM FRONTEND ERP CHÂU TUẤN

## Mục tiêu

Tiếp tục trực tiếp trên source code ERP nội bộ Châu Tuấn hiện tại.

Đây là một đợt **audit + setup UI/UX Pro Max + refactor design system + sửa lỗi frontend + responsive + data lifecycle + regression test**.

Không thực hiện kiểu “thấy trang nào xấu thì vá trang đó”.

Mục tiêu cuối cùng là:

- toàn hệ thống dùng **một design system duy nhất**;
- chỉnh shared component một lần thì các module liên quan kế thừa được;
- desktop lớn không còn trống/loãng bất thường;
- mobile không còn trống trơn;
- dữ liệu test ít vẫn hiển thị hợp lý;
- dữ liệu thật nhiều sau này vẫn không vỡ layout;
- form/table/dashboard/detail có layout riêng đúng mục đích;
- không còn các page có spacing, toolbar, title, icon, card khác nhau vô lý;
- các bug hiện tại được xử lý;
- không phá business logic, permission, realtime, Supabase, route và dữ liệu hiện có;
- build production hoạt động ổn định trên Vercel.

---

# 0. QUY TẮC AN TOÀN TRƯỚC KHI LÀM

Trước khi thay đổi code:

1. Kiểm tra `git status`.
2. Không xóa/reset thay đổi hiện có không liên quan.
3. Không dùng `git clean`, `git reset --hard`, force checkout hoặc thao tác có thể làm mất code.
4. Nếu repo đang có thay đổi chưa commit, giữ nguyên và chỉ sửa phần cần thiết.
5. Không rewrite project từ đầu.
6. Không đổi database schema nếu không thật sự cần.
7. Không đổi business workflow chỉ vì muốn UI đẹp hơn.
8. Không hard-code dữ liệu production.
9. Không hard-code password plaintext trong frontend.
10. Không dùng workaround che lỗi.

Nếu cần migration/database/storage/auth change:
- tạo migration rõ ràng;
- báo cáo cuối cùng;
- không tự xóa dữ liệu hiện có.

---

# 1. TỰ KIỂM TRA VÀ SETUP UI/UX PRO MAX

Tôi không biết setup UI/UX Pro Max, vì vậy hãy tự kiểm tra và thiết lập cho project này.

## 1.1 Kiểm tra trước khi cài

Kiểm tra xem project đã có UI/UX Pro Max chưa.

Tìm các vị trí phù hợp với phiên bản Codex hiện tại, đặc biệt:

- `.agents/skills/ui-ux-pro-max/SKILL.md`
- `.codex/skills/ui-ux-pro-max/SKILL.md`
- hoặc vị trí skill được Codex hiện tại sử dụng.

Nếu đã tồn tại và hợp lệ:
- KHÔNG cài duplicate;
- đọc `SKILL.md`;
- xác định cách invoke đúng;
- tiếp tục sử dụng.

Nếu chưa có:
- kiểm tra Node.js/npm;
- kiểm tra Python 3.

Có thể dùng:
- `node --version`
- `npm --version`
- `python3 --version`
- Windows có thể thử `python --version` hoặc `py -3 --version`.

UI/UX Pro Max search scripts cần Python 3.

## 1.2 Cài UI/UX Pro Max cho Codex

Ưu tiên cách cài chính thức hiện hành cho Codex từ project root.

Nếu CLI chính thức `uipro` chưa có, cài:

```bash
npm install -g uipro-cli
```

Sau đó tại root project:

```bash
uipro init --ai codex
```

Nếu môi trường không cho phép global install:
- dùng phương án project-local/npx tương đương sau khi xác minh package hợp lệ;
- không tự tải file từ nguồn không rõ;
- không thay đổi project package dependencies nếu không cần.

Sau khi cài:
- xác minh `SKILL.md` và dữ liệu/scripts của skill tồn tại;
- nếu Codex cần restart để nhận skill, ghi rõ việc đó trong báo cáo;
- nếu môi trường hiện tại không thể restart, vẫn đọc trực tiếp `SKILL.md` nếu có thể và áp dụng hướng dẫn của skill trong phiên hiện tại.

## 1.3 Không dừng ở bước setup

Setup UI/UX Pro Max chỉ là bước đầu.

Sau khi setup/verify:
- tiếp tục audit;
- tạo design direction;
- refactor;
- sửa lỗi;
- test;
- build.

Không chỉ trả lời “đã cài skill”.

---

# 2. CÁCH DÙNG UI/UX PRO MAX TRONG PROJECT NÀY

UI/UX Pro Max là **lớp design intelligence**, KHÔNG phải source of truth của nghiệp vụ.

Đây là:
- internal ERP;
- B2B enterprise application;
- nhiều table;
- nhiều form;
- HR;
- chấm công;
- công trường/dự án;
- kho;
- admin;
- realtime;
- responsive desktop/tablet/mobile;
- giao diện tiếng Việt.

UI/UX Pro Max được phép hỗ trợ:

- visual audit;
- information architecture;
- layout composition;
- typography;
- spacing;
- information density;
- semantic color;
- icon usage;
- component proportions;
- dashboard composition;
- table UX;
- form UX;
- empty/loading/error states;
- accessibility;
- responsive/mobile behavior;
- anti-AI-generated appearance;
- visual consistency.

UI/UX Pro Max KHÔNG được:

- biến ERP thành landing page;
- tạo hero section;
- thêm decoration không có giá trị;
- thêm animation nặng;
- làm whitespace rộng hơn chỉ vì aesthetic;
- thay table hữu ích bằng card;
- thêm chart chỉ để lấp chỗ trống;
- thêm KPI giả;
- thay route;
- thay permission;
- thay nghiệp vụ;
- đổi data model tùy tiện;
- tạo visual system khác nhau cho từng module.

**Prompt này + business logic hiện có là source of truth.**

---

# 3. KHÔNG CODE NGAY — AUDIT ROOT CAUSE FRONTEND

Trước khi refactor, audit toàn bộ frontend.

Không chỉ nhìn screenshot.

Phải đọc source và xác định chính xác vì sao:

- có trang đã sửa nhưng trang khác không kế thừa;
- title/content spacing vẫn lệch;
- form có trang bị kéo full-width;
- dashboard card có trang quá lớn;
- mobile vẫn trống;
- toolbar có nơi full text, có nơi chỉ icon;
- một số module giống một design system khác;
- sửa nhiều lần nhưng vẫn không đồng bộ.

## 3.1 Audit layout hierarchy

Xác định file/component thật của:

- Root layout
- AppShell
- Header
- Sidebar
- Main
- Page wrapper
- Page container
- Page header
- Breadcrumb
- Page actions
- Toolbar
- Section
- Card
- Form wrapper
- Table wrapper
- Dashboard grid
- Modal
- Drawer
- Mobile navigation

## 3.2 Audit duplicate components

Tìm các component có chức năng giống nhau:

- PageContainer
- PageShell
- ContentContainer
- AppPage
- PageWrapper
- PageHeader
- SectionHeader
- Card
- Panel
- FormCard
- DashboardCard
- EmptyState
- FileUpload
- Button variants

Xác định:
- component chuẩn sẽ giữ;
- component nào cần merge;
- component nào legacy cần xóa sau migration.

## 3.3 Audit CSS/Tailwind conflicts

Search:

- `w-full`
- `max-w-*`
- `min-w-*`
- `h-full`
- `min-h-*`
- `h-screen`
- `min-h-screen`
- `items-stretch`
- `flex-1`
- `mt-*`
- `mb-*`
- `px-*`
- `py-*`
- `gap-*`
- `space-y-*`
- arbitrary values
- inline styles
- CSS modules
- `!important`

Phải chỉ ra root cause cụ thể:
- file;
- component;
- class/rule;
- ảnh hưởng.

Không báo cáo chung chung kiểu “spacing chưa đều”.

## 3.4 Audit page-specific overrides

Kiểm tra tất cả module:

- Dashboard
- HR
- Attendance
- Worker attendance
- Projects
- Project site
- Inventory
- Tasks
- Deadline
- Audit Log
- Messaging
- Admin
- Settings
- các module còn lại.

Tìm page nào tự override:
- page padding;
- width;
- max-width;
- min-height;
- card spacing;
- typography;
- toolbar;
- button;
- icon.

Sau audit, tiếp tục implement trong cùng đợt.

---

# 4. TẠO SINGLE SOURCE OF TRUTH CHO DESIGN SYSTEM

Từ kết quả audit + UI/UX Pro Max, tạo/chuẩn hóa một design system duy nhất cho ERP.

Không tạo design system thứ hai song song.

## 4.1 Design tokens

Chuẩn hóa tại một nguồn chung:

### Typography
- font family hỗ trợ đầy đủ tiếng Việt;
- Page Title;
- Section Title;
- Card Title;
- Body;
- Label;
- Small;
- Caption;
- font weight;
- line height.

### Spacing
- page padding;
- header spacing;
- section gap;
- card padding;
- form field gap;
- table density;
- modal/drawer spacing.

### Sizing
- header height;
- sidebar width;
- control heights;
- icon button;
- row heights;
- form max width;
- dashboard max width.

### Radius/border/shadow
- radius-sm/md/lg;
- border;
- shadow.

### Semantic colors
- neutral;
- primary;
- info;
- success;
- warning;
- danger.

Nếu project dùng Tailwind:
- map token vào theme/config hoặc CSS variables phù hợp.

Không hard-code cùng một giá trị ở nhiều module.

---

# 5. NGUYÊN TẮC SPACING ĐỂ TRỊ DỨT ĐIỂM “KHÔNG ĐỀU”

Đây là lỗi đã sửa nhiều lần nhưng vẫn tái phát.

Không chỉnh từng page bằng `mt`, `mb`, `py` riêng.

Quy tắc:

**Parent chịu trách nhiệm spacing giữa children.**

Child không tự thêm external margin nếu không có lý do.

Chuẩn hóa flow:

`Breadcrumb → Page Title → Page Actions/Toolbar → Content`

Không để khoảng cách bị cộng chồng kiểu:

`PageHeader margin-bottom`
+
`PageContent padding-top`
+
`Card margin-top`

Mọi page cùng loại phải bắt đầu content ở vị trí nhất quán.

---

# 6. PAGE TEMPLATE SYSTEM — BẮT BUỘC TOÀN HỆ THỐNG KẾ THỪA

Không dùng một layout cho tất cả.

Tạo/chuẩn hóa 4 loại page:

## 6.1 List/Data Page

Dùng cho:
- Nhân viên
- Danh sách dự án
- Kho
- Chứng từ
- Bảng công
- Audit Log
- danh sách dữ liệu.

Đặc điểm:
- tận dụng chiều ngang;
- table gần full workspace khi cần;
- toolbar/filter compact;
- không ép table vào form max-width.

## 6.2 Form Page

Dùng cho:
- Thêm nhân viên
- Tạo dự án
- Thêm hàng
- Edit
- Admin config.

Desktop:
- content form khoảng 1000–1200px;
- 2 cột khi hợp lý;
- textarea/file upload span 2 cột;
- không stretch input 1500–1700px.

Mobile:
- 1 cột.

## 6.3 Detail Page

Dùng cho:
- Chi tiết nhân viên
- Chi tiết dự án
- Chi tiết hàng hóa
- chi tiết request.

Bounded width, section rõ, không rộng như table.

## 6.4 Dashboard Page

Responsive 12-column grid.

Không fixed/min-height lớn không cần thiết.

Widget phải auto-height theo data.

---

# 7. SHARED COMPONENTS

Chuẩn hóa/reuse component chung tương đương:

- AppPage
- PageHeader
- PageBreadcrumb
- PageActions
- PageToolbar
- SectionCard
- FormSection
- FormGrid
- FormField
- DataTable
- FilterBar
- SearchInput
- StatusBadge
- PriorityBadge
- EmptyState
- ErrorState
- LoadingState
- DashboardGrid
- MetricCard
- DashboardPanel
- ConfirmDialog
- FileUpload
- ImageUpload

Nếu project đã có:
- refactor và dùng lại;
- không tạo duplicate mới.

Khi migrate xong:
- xóa legacy component;
- xóa CSS workaround;
- không giữ hai hệ song song.

---

# 8. CONTENT WIDTH — KHẮC PHỤC MÀN HÌNH LỚN BỊ TRỐNG/LOÃNG

Không áp cùng một max-width cho mọi page.

Gợi ý:

- Dashboard: khoảng 1440–1600px
- Form: khoảng 1000–1200px
- Detail: khoảng 1200–1400px
- List/Table: gần full workspace khi cần

Các số này không phải magic number bắt buộc.
Chọn theo design system và test viewport.

Không kéo input/card vô hạn trên 1920/2560px.

Màn hình lớn phải tăng **giá trị thông tin**, không tăng kích thước component vô nghĩa.

---

# 9. INFORMATION DENSITY — ERP KHÔNG PHẢI LANDING PAGE

Giảm:

- card quá cao;
- padding quá lớn;
- section gap quá lớn;
- input quá rộng;
- KPI card quá cao;
- widget chỉ 1–2 dòng nhưng chiếm hàng trăm px;
- khoảng trắng trang trí.

Không compact đến mức chật.

Mục tiêu:
**professional enterprise UI**.

---

# 10. ADAPTIVE DATA — KHÔNG TỐI ƯU CHỈ CHO DỮ LIỆU TEST

Hiện DB chỉ có một số dữ liệu test.

Không được xóa chức năng/charts hữu ích chỉ vì dữ liệu hiện tại ít.

Mỗi component phải hoạt động tốt ở:

- 0 record
- 1 record
- 3–5 record
- 8–20 record
- 100+ record

## 10.1 Panel/list

- 0 item → Empty State
- 1–4 → auto-height
- 5–8 → bounded height
- >8 → Xem tất cả / scroll / pagination tùy ngữ cảnh

Không render danh sách cực dài trên Dashboard.

## 10.2 Chart

Ví dụ donut:
- 0 data → summary/empty
- chỉ 1 nhóm dữ liệu → compact summary
- >=2 nhóm dữ liệu → chart

Không render donut 1 segment vô nghĩa.

Không xóa chart vĩnh viễn nếu sau này dữ liệu thật sẽ cần.

## 10.3 KPI

Không thêm KPI giả để grid đẹp.

Nếu có 5 KPI:
- hiển thị đúng 5.

Layout chịu được số KPI lẻ.

---

# 11. DASHBOARD = PERSONAL WORKSPACE

Dashboard là màn làm việc cá nhân.

Không tạo nhiều “Dashboard chức năng” trung gian.

Widget hiển thị theo:
- permission;
- role;
- app được sử dụng;
- dữ liệu liên quan user;
- công việc cần xử lý.

## HR
Có thể gồm:
- nhân viên nghỉ hôm nay;
- nghỉ phép chờ duyệt;
- hợp đồng sắp hết;
- bất thường chấm công.

## Supervisor/Project
Có thể gồm:
- công trường phụ trách;
- chưa điểm danh;
- checklist;
- deadline;
- issue cần xử lý.

## Inventory
Có thể gồm:
- yêu cầu nhập/xuất;
- hàng cần chú ý;
- giao dịch gần đây.

## Admin
Tổng quan rộng hơn theo permission.

Không thêm widget không có nghiệp vụ.

---

# 12. GRID “ỨNG DỤNG CỦA TÔI”

Đổi toàn bộ:

`Phân hệ của tôi`
→
`Ứng dụng của tôi`

Kiểm tra:
- dashboard;
- sidebar;
- command palette/search;
- mobile;
- tooltip;
- constants/localization.

Grid phải responsive.

Không để icon cuối rơi xuống một hàng rất xấu.

Nhưng cũng không kéo card cuối full hàng.

Ưu tiên breakpoint hợp lý và card có kích thước ổn định.

Có thể tham khảo:
- 1366: 4 cột
- 1440: 4–5
- 1920: 5–6
- 2560: 6–8

Điều chỉnh theo thực tế UI/UX Pro Max và design system.

---

# 13. MÀU SẮC NGỮ NGHĨA

Hiện icon/card dùng nhiều màu pastel không theo quy luật.

Chuẩn hóa:

- neutral = mặc định
- green/success = tốt
- yellow/orange/warning = cần chú ý
- red/danger = lỗi/nghiêm trọng
- blue/info = thông tin

Không tô đỏ/cam mạnh khi giá trị = 0.

Không làm tất cả icon/app mỗi ô một màu ngẫu nhiên.

Màu cảnh báo phải giữ được giá trị khi người dùng liếc nhanh.

---

# 14. BADGE / TAG / ICON

## Badge
Phân biệt:
- status;
- priority;
- category;
- warning.

Không dùng cùng một pill cam/đỏ cho mọi ý nghĩa.

## Tag
Không nối:
`tag1 · tag2 · tag3 · tag4`

Dùng chip:
- tối đa 2–3;
- sau đó `+N`.

## Icon
- cùng action → cùng icon;
- action khác → không dùng icon trùng;
- không dùng icon chỉ để trang trí.

---

# 15. GHI CHÚ NHANH

Khối “Ghi chú nhanh” hiện không được nổi bật hơn nghiệp vụ chính.

Dùng:
- neutral;
- pastel nhẹ;
- border accent.

Không dùng nền vàng quá mạnh nếu không phải warning.

---

# 16. MOBILE — PHẢI THIẾT KẾ THẬT SỰ

Hiện mobile còn trống.

Không coi mobile là desktop stack 1 cột.

Responsive phải thay cả **information hierarchy**.

Mobile ưu tiên:

1. Việc cần xử lý
2. Trạng thái quan trọng
3. Action thường dùng
4. Nội dung gần đây
5. App/module truy cập nhanh

Chart/analytics ít quan trọng:
- ẩn;
- rút gọn;
- hoặc đưa vào màn chi tiết.

## 16.1 Mobile dashboard
KPI:
- 2-column compact
hoặc
- horizontal metric strip.

Panel:
- auto-height;
- chỉ 3–5 item;
- có “Xem tất cả”.

## 16.2 Mobile navigation
Nếu sidebar desktop không phù hợp:

tạo mobile navigation riêng nhưng dùng cùng route system.

Ưu tiên bottom navigation 4–5 mục:
- Dashboard
- Công việc
- Ứng dụng
- Thông báo
- Tài khoản

“Ứng dụng” mở danh sách module user có quyền.

Không copy nguyên sidebar dài xuống mobile.

---

# 17. EMPTY / LOADING / ERROR STATE

Không page nào được blank.

Không dùng:
- `return null`
- `if (!data) return null`
- `if (!user) return null`

mà không có state.

Mỗi page:
- Loading
- Error
- Empty
- Success

Empty State phải có:
- icon;
- title;
- description;
- CTA nếu user có quyền/action phù hợp.

Ví dụ `Điểm danh công nhân` khi chưa liên kết hồ sơ:
không để một dòng chữ trôi giữa nền trắng.

Có thể hiển thị:
- trạng thái;
- lý do;
- nút xem hồ sơ/hướng dẫn/liên hệ quản trị tùy quyền.

---

# 18. ACTION VALIDATION

Nếu hệ thống biết trước user chưa đủ điều kiện:

button không được active rồi mới báo lỗi.

Ví dụ:
`Điểm danh hôm nay`

Nếu chưa liên kết employee profile:
- disable hoặc hide;
- giải thích;
- CTA tiếp theo phù hợp.

---

# 19. SIDEBAR / DASHBOARD / NAVIGATION

## 19.1 Thêm Dashboard
Sidebar/navigation chính phải có Dashboard.

Từ mọi module quay về Dashboard được.

Đặc biệt:
- vào Chấm công không được bị “kẹt” không quay lại Dashboard.

## 19.2 Xóa Dashboard chức năng dư
Tìm và loại:
- Dashboard Nhân sự
- Dashboard Dự án
- Dashboard Kho
- Dashboard Chấm công
- Dashboard chức năng khác

nếu chỉ là màn trung gian không cần thiết.

Luồng:
`Dashboard chính → Ứng dụng/chức năng`

## 19.3 Không lặp title
Mỗi page chỉ có 1 Page Title.

Không còn tên chức năng xuất hiện 2 lần.

Không có label “Dashboard” + menu “Dashboard” dư thừa.

---

# 20. ACTIVE MENU BUG

Hiện có lỗi:

`Dự án công trường`
→ sang
`Cập nhật dự án`
→ hiệu ứng active vẫn còn ở `Dự án công trường`.

Sửa triệt để:

- active state derive từ pathname/current route;
- tránh state thủ công nếu không cần;
- không có 2 menu cùng active;
- audit toàn navigation.

---

# 21. BREADCRUMB / BACK ACTION

Không để cùng lúc:

- Trở lại
- Breadcrumb
- Link “Danh sách ...”

cùng thực hiện một nhiệm vụ.

Sửa breadcrumb hợp lệ đang hiện:
`Hệ thống > Không tìm thấy`

Metadata/route mapping phải đúng.

---

# 22. FORM TẠO DỰ ÁN

Thiết kế lại bằng FormPage chuẩn.

Desktop:
- khoảng 1000–1200px;
- grid 2 cột hợp lý.

Gợi ý:

- Mã dự án | Tên dự án
- Khách hàng | Trạng thái
- Ngày bắt đầu | Kết thúc dự kiến
- Tóm tắt span 2 cột

Không full-width toàn workspace.

Hierarchy rõ.

Không còn khoảng trống vô nghĩa.

---

# 23. PROJECT DASHBOARD / THEO DÕI DỰ ÁN

Không lặp cùng một ý nghĩa qua quá nhiều widget.

Ví dụ không cần cùng lúc:
- KPI trạng thái;
- donut trạng thái;
- progress;
- list

nếu chỉ đang lặp dữ liệu.

Adaptive:
- ít data → compact summary;
- đủ data → chart;
- nhiều data → aggregate + drill-down.

---

# 24. DEADLINE KHÔNG ĐƯỢC GIỐNG AUDIT LOG

## Audit Log
- timeline;
- actor;
- action;
- timestamp;
- resource;
- metadata.

## Deadline
- calendar/date grouping;
- hôm nay;
- tuần này;
- sắp đến hạn;
- quá hạn;
- trạng thái công việc.

Không clone giao diện Audit Log.

---

# 25. NÚT “THÊM TÁC VỤ” BỊ THỪA

Nếu `Thêm tác vụ` và `Tạo mới` cùng mục đích:
- giữ 1 CTA chính;
- bỏ CTA trùng.

Không có hai primary button cạnh tranh nhau.

---

# 26. EMPLOYEE LIST — OVERFLOW

Mã nhân viên đang tràn.

Xử lý:
- max-width;
- ellipsis;
- tooltip;
- responsive column.

Không mất dữ liệu.

Audit thêm:
- project code;
- product code;
- email;
- phone;
- file name;
- breadcrumb;
- long select.

Không dùng overflow hidden toàn page để che lỗi.

---

# 27. THÊM NHÂN VIÊN

## 27.1 Bỏ “Đơn vị nhà thầu”
Bỏ khỏi form nhân viên nội bộ.

Không phá dữ liệu legacy nếu DB đã có.

## 27.2 Thêm ảnh
Có:
- chọn ảnh;
- preview ngay;
- thay ảnh;
- xóa ảnh;
- validation;
- loading;
- error.

Không được chọn file xong mà UI không hiện.

## 27.3 Thông tin cá nhân optional
Có thể gồm:
- ngày sinh;
- giới tính;
- số điện thoại;
- email cá nhân;
- địa chỉ;
- CCCD/CMND;
- ngày cấp;
- nơi cấp;
- mã số thuế;
- tình trạng hôn nhân;
- người liên hệ khẩn cấp;
- số điện thoại liên hệ khẩn cấp;
- ghi chú.

Tất cả không bắt buộc trừ khi business rule hiện tại yêu cầu.

Phân section:
- Thông tin công việc
- Thông tin cá nhân
- Liên hệ
- Thông tin bổ sung

---

# 28. CHẤM CÔNG NHÂN VIÊN

## Time Picker
Dùng 24h:
`HH:mm`

Không AM/PM.

## Nghỉ phép
Redesign:
- gọn;
- rõ trạng thái;
- rõ ngày;
- rõ loại nghỉ;
- rõ chờ duyệt/đã duyệt/từ chối;
- semantic color;
- không quá nhiều màu.

---

# 29. ĐIỂM DANH CÔNG NHÂN CỦA GIÁM SÁT

Luồng:

1. Chọn dự án/công trường
2. Chọn ngày/ca nếu cần
3. Danh sách công nhân
4. Điểm danh
5. Checklist
6. Ghi chú
7. Lưu

Trạng thái có thể gồm:
- Có mặt
- Vắng
- Đi trễ
- Nghỉ phép
- trạng thái nghiệp vụ hiện có.

Không hard-code quá nhiều logic vào UI.

---

# 30. CHECKLIST ĐIỂM DANH — ADMIN PHẢI CHỈNH ĐƯỢC

Checklist KHÔNG hard-code.

Admin có thể:
- thêm;
- sửa;
- xóa;
- bật/tắt;
- đổi thứ tự;
- phân nhóm nếu cần.

Màn giám sát phải lấy checklist từ cấu hình.

**Checklist lịch sử phải giữ nguyên nội dung tại thời điểm điểm danh.**

Nếu kiến trúc phù hợp:
- lưu snapshot checklist trong bản ghi attendance/checklist lịch sử.

Không để admin sửa template hôm nay làm thay đổi lịch sử tháng trước.

---

# 31. THÊM HÀNG — HÌNH ẢNH

Chức năng `Thêm hàng` phải hỗ trợ:

- chọn ảnh;
- preview;
- upload;
- thay;
- xóa;
- validation;
- loading;
- error.

Sau save + reload:
- ảnh phải hiển thị lại đúng.

Không chỉ làm UI giả.

---

# 32. AUDIT TOÀN BỘ UPLOAD ẢNH/FILE

Vì hiện có tình trạng:
chọn file được nhưng không hiện.

Audit shared upload flow:

`Select → Validate → Preview → Upload → Save URL/path → DB → Reload → Render`

Nếu nhiều màn đang duplicate upload logic:
- refactor thành shared component/hook/service phù hợp.

---

# 33. LOGIN / PASSWORD

## 33.1 Show/hide password
Login có nút xem/ẩn password.

## 33.2 Password policy
Password:
**tối thiểu 8 ký tự**

Không:
- `maxLength=8`
- `length === 8`

Phải:
- `length >= 8`

## 33.3 Admin password
Đổi password tài khoản Admin hiện tại thành:
`Chautuan`

Nhưng:
- không hard-code plaintext;
- dùng auth mechanism phù hợp;
- nếu Supabase Auth thì update đúng qua Supabase Auth;
- không lưu password plaintext vào DB app.

---

# 34. SESSION TIMEOUT — 12 GIỜ KHÔNG HOẠT ĐỘNG

Yêu cầu:
**12 giờ inactivity → logout**

Không phải 12 giờ kể từ lúc login.

Activity hợp lý:
- navigation;
- click/action chính;
- request hợp lệ;
- thao tác nghiệp vụ.

Không reset timer bằng mousemove liên tục nếu gây overhead.

Khi hết session:
- sign out/clear phù hợp;
- redirect login;
- không loop;
- hiển thị:
`Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.`

Refresh không được bypass timeout.

---

# 35. P0 — LỖI BACK TRÊN VERCEL LÀM MẤT NỘI DUNG

Hiện tượng:

- A có dữ liệu
- sang B
- Browser Back
- route A đúng
- header/sidebar còn
- content/data rỗng

Đây là P0.

## 35.1 Reproduce production-like

Test:
```bash
npm run build
npm run start
```

Không chỉ `npm run dev`.

Test:
- A → B → Back
- A → B → Forward
- List → Detail → Back
- List → Create → Back
- Dashboard → Module → Back
- Dynamic ID1 → ID2 → Back

## 35.2 Audit data lifecycle

Search:
- useEffect
- useState
- AbortController
- fetch
- Supabase
- React Query/SWR nếu có
- Zustand/Context/Redux nếu có
- reset/clear/invalidate
- route params
- searchParams

Kiểm tra:
- fetch khi nào;
- clear data khi nào;
- effect dependency;
- component remount/reuse;
- query key;
- abort handling;
- auth hydration;
- BFCache/history restore;
- Next router cache.

## 35.3 Không workaround

Không:
- `window.location.reload()`
- `router.refresh()` trên mọi page
- `setTimeout`
- random React key
- disable cache toàn app
- force full page navigation

Sửa đúng root cause.

## 35.4 List state

Nếu:
- search/filter/page 3
- mở detail
- Back

ưu tiên phục hồi:
- search;
- filter;
- page;
- scroll

nếu kiến trúc hiện tại hỗ trợ.

---

# 36. SUPABASE AUTH HYDRATION

Nếu dùng Supabase:

Audit:
- `getSession`
- `getUser`
- `onAuthStateChange`
- cookies/session
- server/client boundary

Không để:

route restored
→ session tạm undefined
→ clear data
→ session ready
→ không refetch
→ blank page.

Phân biệt:
- authLoading
- authenticated
- unauthenticated

“Chưa kiểm tra xong” không phải “đã logout”.

---

# 37. REALTIME

Không phá realtime hiện có.

Audit:
- duplicate subscriptions;
- listener cleanup;
- reconnect loop;
- stale listener;
- race condition;
- duplicate events.

Sau mutation:
- UI cập nhật đúng;
- không fetch toàn app nếu không cần;
- query/store cập nhật hợp lý.

---

# 38. PERFORMANCE

Hệ thống từng có tình trạng chậm, thao tác khoảng ~1000ms và khi thao tác nhiều có thể bị out.

Audit:

- duplicate fetch;
- request waterfall;
- unnecessary rerender;
- context quá lớn;
- client bundle;
- blocking sync work;
- listener không cleanup;
- full page reload;
- fetch toàn bộ list sau mutation;
- chart/animation nặng.

Không thêm dependency lớn chỉ vì một UI nhỏ.

Không làm performance tệ hơn sau refactor.

---

# 39. PAGE TRANSITION / LOADING FEEDBACK

Với chức năng lớn hoặc request lâu:
- skeleton/loading rõ;
- transition nhẹ;
- không để người dùng tưởng app treo.

Không dùng animation nặng.

Không full-screen spinner cho thao tác nhỏ.

---

# 40. TOOLBAR CONSISTENCY

Hiện có chỗ toolbar show full, chỗ chỉ icon.

Chuẩn hóa:

Desktop:
- action chính có text;
- chỉ collapse nếu thiếu space.

Mobile:
- có thể icon/menu overflow.

Cùng viewport → behavior nhất quán.

---

# 41. FORM STANDARD

Tất cả form:

- label;
- required indicator;
- helper text;
- input/select;
- validation error

cùng một pattern.

Không module này label trên, module khác label trái nếu không có lý do.

---

# 42. BUTTON HIERARCHY

Chuẩn hóa:
- Primary
- Secondary
- Outline
- Ghost
- Danger
- Icon Button

Một màn hình không có hai primary CTA cạnh tranh nhau.

---

# 43. REMOVE FIXED EMPTY SPACE

Audit:
- `height`
- `min-height`
- `h-full`
- `h-screen`
- `min-h-screen`
- `items-stretch`

trong:
- card;
- dashboard widget;
- page body;
- form;
- modal.

Card mặc định:
- auto-height.

Không tạo card cao chỉ vì grid row stretch.

---

# 44. RESPONSIVE VIEWPORT TEST

Bắt buộc test:

## Mobile
- 375x812
- 390x844
- 430x932

## Tablet
- 768x1024

## Desktop
- 1366x768
- 1440x900
- 1920x1080
- 2560x1440

Không tối ưu chỉ cho một resolution.

---

# 45. DATA VOLUME TEST

Dùng temporary/dev test dataset để kiểm tra:

- 0 records
- 1 record
- 5 records
- 20 records
- 100+ records

Không commit fake production data chỉ để UI nhìn đầy.

Table lớn:
- pagination/virtualization hiện có phải hoạt động;
- không render hàng trăm dòng không cần thiết.

---

# 46. ACCESSIBILITY

Theo UI/UX Pro Max và chuẩn web hợp lý:

- focus visible;
- keyboard navigation;
- button/link semantic;
- contrast;
- label/input association;
- aria khi cần;
- modal focus trap nếu component hiện tại hỗ trợ;
- target mobile đủ lớn.

Không hy sinh density bằng cách làm UI quá to.

---

# 47. LEGACY CLEANUP

Sau khi migrate:

Xóa:
- legacy layout;
- duplicate PageHeader;
- duplicate Card;
- duplicate Form wrapper;
- CSS workaround;
- dead code;
- unused classes/components.

Không giữ hệ cũ và mới song song.

---

# 48. KHÓA QUY TẮC CHO CÁC MODULE SAU NÀY

Sau refactor, quy tắc bắt buộc:

> Module mới phải dùng design system, shared components và page templates hiện có. Không tạo layout/style/component mới nếu shared UI đã đáp ứng.

Nếu phù hợp:
- thêm lint/check nhẹ để hạn chế inline style/arbitrary spacing/duplicate UI pattern.

Không phá build chỉ để thêm lint.

---

# 49. CẤU TRÚC FRONTEND MỤC TIÊU

Không bắt buộc đúng tên folder, nhưng kiến trúc phải tương đương:

```text
UI FOUNDATION
├── tokens
│   ├── typography
│   ├── spacing
│   ├── colors
│   ├── radius
│   └── sizing
│
├── primitives
│   ├── Button
│   ├── Input
│   ├── Select
│   ├── Badge
│   ├── Card
│   └── Modal
│
├── patterns
│   ├── PageHeader
│   ├── PageToolbar
│   ├── FilterBar
│   ├── FormSection
│   ├── DataTable
│   ├── EmptyState
│   └── ImageUpload
│
├── layouts
│   ├── ListPage
│   ├── FormPage
│   ├── DetailPage
│   └── DashboardPage
│
└── modules
    ├── HR
    ├── Attendance
    ├── Projects
    ├── Inventory
    ├── Tasks
    └── Admin
```

Module chỉ compose các component chuẩn.

Không tự định nghĩa nền UI mới.

---

# 50. VISUAL REGRESSION CHECK

Sau migrate, kiểm tra nhiều module cạnh nhau.

So sánh:

- PageHeader y-position;
- content start;
- title size;
- toolbar height;
- filter density;
- button height;
- input height;
- card padding;
- radius;
- table row density;
- section gap;
- empty state;
- mobile top spacing.

Không chỉ nhìn từng page riêng lẻ.

---

# 51. KHÔNG ĐƯỢC LÀM

Không:

- vá margin từng page;
- `!important`;
- duplicate component;
- hard-code width cho cả app;
- fixed-height widget vô lý;
- thêm chart giả;
- thêm KPI giả;
- thêm seed giả để lấp màn hình;
- animation trang trí nặng;
- đổi nghiệp vụ chỉ vì UI;
- full reload để chữa Back;
- `router.refresh()` rải rác;
- `setTimeout` chữa race;
- `any` để che TypeScript;
- `@ts-ignore` để che lỗi;
- catch rỗng;
- swallow error;
- bỏ error state;
- return null gây blank page.

---

# 52. TEST MATRIX NGHIỆP VỤ

Test ít nhất:

## Navigation
- Dashboard ↔ Nhân viên
- Nhân viên → Thêm nhân viên → Back
- Dự án → Tạo dự án → Back
- Dự án → Detail → Back
- Kho → Thêm hàng → Back
- Chấm công → Detail → Back
- Deadline → Detail → Back
- Audit Log → Back
- Admin → Config → Back

## Upload
- employee image select → preview → save → reload
- inventory image select → preview → save → reload

## Auth
- login
- show/hide password
- password >=8
- inactivity logic
- refresh
- expired session

## Attendance
- 24h time picker
- leave state
- worker attendance
- admin checklist changes
- historical snapshot

## Responsive
- tất cả viewport đã liệt kê.

---

# 53. ACCEPTANCE CRITERIA — CHỈ ĐƯỢC COI LÀ HOÀN THÀNH KHI ĐỦ

## UI/UX Pro Max
- [ ] Skill được detect hoặc setup thành công.
- [ ] Đã đọc/apply skill.
- [ ] Không dùng skill để thay business rule.

## Design system
- [ ] Một design token source.
- [ ] Một PageHeader chuẩn.
- [ ] Một PageContainer/layout system chuẩn.
- [ ] Shared Button/Input/Select/Card/Badge.
- [ ] Không còn duplicate phổ biến.
- [ ] Legacy styles được dọn.

## Layout
- [ ] List/Form/Detail/Dashboard có behavior riêng.
- [ ] Title/content spacing đồng bộ.
- [ ] Form không stretch vô hạn.
- [ ] Table không bị ép nhỏ.
- [ ] Dashboard không có card khổng lồ vì ít data.

## Large screen
- [ ] 1920 không loãng bất thường.
- [ ] 2560 không phóng component vô nghĩa.
- [ ] Khoảng trắng còn lại là intentional whitespace.

## Mobile
- [ ] 375 sử dụng tốt.
- [ ] Mobile không trống trơn.
- [ ] Mobile không chỉ là desktop stack.
- [ ] Navigation mobile hợp lý.
- [ ] Dashboard mobile có hierarchy riêng.

## Adaptive data
- [ ] 0 record đẹp.
- [ ] 1 record đẹp.
- [ ] 5 record đẹp.
- [ ] 20 record đẹp.
- [ ] 100+ record không vỡ.
- [ ] Chart adaptive.
- [ ] KPI không fake.

## Dashboard
- [ ] “Ứng dụng của tôi” được dùng.
- [ ] Grid app không rơi dòng xấu.
- [ ] Widget theo role/permission.
- [ ] Không Dashboard chức năng thừa.
- [ ] Ghi chú không lấn át nghiệp vụ.

## Navigation
- [ ] Có Dashboard button.
- [ ] Từ mọi module quay Dashboard được.
- [ ] Active menu đúng route.
- [ ] Breadcrumb hợp lệ.
- [ ] Không duplicate title/action.

## Projects
- [ ] Form Tạo dự án đúng FormPage.
- [ ] Project dashboard adaptive.
- [ ] Không chart vô nghĩa khi ít data.
- [ ] Deadline khác Audit Log.

## Employee
- [ ] Employee code không overflow.
- [ ] Add employee có ảnh.
- [ ] Preview ảnh hoạt động.
- [ ] Có optional personal information.
- [ ] Bỏ Đơn vị nhà thầu khỏi form nội bộ.

## Attendance
- [ ] 24h.
- [ ] Leave UI đồng bộ.
- [ ] Supervisor điểm danh công nhân.
- [ ] Admin chỉnh checklist.
- [ ] Checklist không hard-code.
- [ ] History không đổi khi template đổi.

## Inventory
- [ ] Thêm hàng upload ảnh được.
- [ ] Preview.
- [ ] Reload vẫn còn ảnh.

## Auth
- [ ] Show/hide password.
- [ ] Password >=8.
- [ ] Không maxLength 8.
- [ ] Admin password được cập nhật an toàn.
- [ ] 12h inactivity logout.
- [ ] Không redirect loop.

## Vercel/Back
- [ ] Browser Back không mất content.
- [ ] Forward không mất content.
- [ ] router.back() đúng.
- [ ] Không full reload workaround.
- [ ] Auth hydration không clear data sai.
- [ ] Dynamic route đúng ID.
- [ ] List state phục hồi hợp lý.

## Performance
- [ ] Không duplicate fetch nghiêm trọng.
- [ ] Không duplicate realtime listener.
- [ ] Không memory leak rõ.
- [ ] Không animation nặng.
- [ ] Không regression đáng kể.

## Build quality
- [ ] Production build pass.
- [ ] Typecheck pass.
- [ ] Lint pass hoặc chỉ còn lỗi legacy được giải thích rõ.
- [ ] Không dùng type suppression để che lỗi mới.

---

# 54. BÁO CÁO CUỐI CÙNG BẮT BUỘC

Sau khi hoàn thành, trả về báo cáo có cấu trúc:

1. UI/UX Pro Max đã setup/detect như thế nào.
2. Vị trí skill được dùng.
3. Root causes frontend inconsistency.
4. Design tokens nằm ở đâu.
5. Shared components chuẩn.
6. Duplicate/legacy components đã loại.
7. CSS/layout conflicts đã xử lý.
8. Các page đã migrate.
9. Page nào là List/Form/Detail/Dashboard.
10. Những override còn giữ và lý do.
11. Cách xử lý desktop large screen.
12. Cách xử lý mobile.
13. Cách adaptive 0/ít/nhiều data.
14. Lỗi Back/Vercel root cause và fix.
15. Auth/session fix.
16. Realtime fix/verification.
17. Upload image/file fix.
18. Checklist admin implementation.
19. Password/admin credential handling.
20. Performance improvements.
21. Viewport test results.
22. Data volume test results.
23. Build/typecheck/lint result.
24. File đã thay đổi.
25. Migration/seed/storage/auth change nếu có.
26. Vấn đề còn lại chưa hoàn thành và lý do.

Không chỉ nói “đã sửa xong”.

---

# 55. QUY TẮC CUỐI

Không tối ưu chỉ cho screenshot hiện tại.

Không tối ưu chỉ cho seed data hiện tại.

Không tối ưu chỉ cho 1920px.

Không tối ưu chỉ cho desktop.

Không tối ưu chỉ cho một module.

Không để UI/UX Pro Max tạo một style đẹp nhưng không phù hợp ERP.

Mục tiêu cuối:

> Một ERP nội bộ Châu Tuấn có frontend nhất quán, kế thừa được, dễ bảo trì, responsive thật sự, mật độ thông tin phù hợp, dùng tốt trên desktop lớn và điện thoại, dữ liệu ít/nhiều đều ổn định, navigation/data lifecycle không lỗi và production Vercel hoạt động đáng tin cậy.

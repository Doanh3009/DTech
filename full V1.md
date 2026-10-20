# ERP CHÂU TUẤN — FINAL MASTER REFACTOR PROMPT

## 0. NGUYÊN TẮC THỰC THI

Đây là task refactor + hoàn thiện hệ thống hiện có, KHÔNG xây lại project.

Ưu tiên:
1. Logic/data integrity.
2. Workflow nghiệp vụ.
3. Kiến trúc UI dùng chung.
4. Responsive/overflow.
5. Personal Workspace.
6. Hoàn thiện module.
7. Visual polish/motion.

KHÔNG thay đổi business logic đã đúng chỉ để refactor đẹp code.
KHÔNG sửa từng page nếu lỗi xuất phát từ shared component/token.
KHÔNG thêm dependency nặng nếu stack hiện tại đã giải quyết được.
KHÔNG viết giải thích dài. Audit -> sửa -> test -> báo cáo ngắn.

Các ảnh UI reference đã cung cấp = VISUAL SOURCE OF TRUTH.

Phong cách bắt buộc:
Soft Pastel Rounded Productivity ERP:
- pastel nhiều màu;
- bo mềm;
- airy;
- ít border;
- spacing rõ;
- hierarchy mạnh;
- hover mượt;
- không Bootstrap/PHP admin;
- không corporate blue-white;
- giữ font Inter.

==================================================
1. KIẾN TRÚC FRONTEND — SINGLE SOURCE OF TRUTH
==================================================

Mọi visual system phải theo:

DESIGN TOKENS
→ UI PRIMITIVES
→ SHARED COMPONENTS
→ PAGE TEMPLATES
→ FEATURE PAGES

Tạo/chuẩn hóa token chung cho:
- colors
- spacing
- typography
- radii
- shadows
- control height
- sidebar width
- table row height
- transitions

Nếu sau này đổi:
- card radius;
- spacing;
- input height;
- table density;
- sidebar width;
- hover;
- module icon;

thì chỉ sửa token/shared component/registry.

Nếu một thay đổi toàn hệ thống vẫn phải sửa thủ công nhiều page:
=> kiến trúc chưa đạt.

Không hard-code hàng loạt:
rounded-[...]
mt-[...]
gap-[...]
shadow riêng
color riêng
trong feature pages.

==================================================
2. TEST DATA / DB GIẢ
==================================================

Tạo bộ dữ liệu seed đủ để test workflow thật:

- account/users
- employee profiles
- departments
- positions
- contracts
- shifts
- sites
- projects
- workers
- attendance
- site roll-calls
- leave requests
- timesheets
- payroll inputs
- tasks
- notes
- notifications
- warehouse
- materials
- stock
- receipts/issues/transfers
- import/export shipments
- messages + attachments

Dữ liệu phải liên kết hợp lệ để test end-to-end.

Seed phải:
- chạy lại được;
- reset được;
- phân biệt rõ test data;
- không làm hỏng schema;
- có thể xóa sạch trước production.

Ưu tiên seed script/staging approach, không tạo dữ liệu giả thủ công rải rác.

==================================================
3. FILE ATTACHMENT TRONG TIN NHẮN
==================================================

Hiện attachment chưa hoạt động.

Fix hoàn chỉnh flow:

select file
→ validate
→ upload
→ progress
→ object storage
→ message metadata
→ send message
→ realtime receiver
→ preview/download
→ permission
→ retry/error handling

Không coi upload thành công nếu message metadata chưa lưu.

Không public file nhạy cảm nếu không cần.

==================================================
4. AVATAR + PERSONAL UI SETTINGS
==================================================

Mỗi account hỗ trợ:
- avatar;
- display preferences;
- pinned modules;
- dashboard widget visibility/order;
- theme/UI preference nếu project hỗ trợ.

Chỉ customize PRESENTATION.

Không cho cá nhân hóa:
- permission;
- workflow;
- nghiệp vụ core;
- validation;
- security.

==================================================
5. SAU LOGIN
==================================================

Desktop/khối văn phòng:

LOGIN
→ PERSONAL DASHBOARD

Không còn:
LOGIN
→ Component launcher bắt buộc.

Nếu route/component launcher cũ tồn tại:
- bỏ khỏi entry flow;
- hoặc chuyển thành Personal Dashboard;
- không để nút cũ dẫn tới màn vô dụng.

Các module KHÔNG có dashboard riêng nữa.

Ví dụ:

Dashboard cá nhân
→ Kho
→ Tồn kho / Nhập / Xuất / ...

KHÔNG:

Dashboard cá nhân
→ Kho
→ Dashboard Kho
→ Tồn kho

==================================================
6. DASHBOARD = PERSONAL WORKSPACE
==================================================

Dashboard là màn làm việc của PERSON ĐANG ĐĂNG NHẬP.

Không phải company KPI dashboard cố định.

Thứ tự ưu tiên dữ liệu:
1. Cá nhân.
2. Việc được giao.
3. Dự án/phòng ban phụ trách.
4. Module có quyền.
5. Dữ liệu toàn công ty chỉ khi permission cho phép.

Cấu trúc desktop:

Greeting + date + realtime clock

Phân hệ của tôi

Lịch hôm nay
Việc cần làm / Todo

Ghi chú
Thông báo

Widget nghiệp vụ theo quyền

Hoạt động gần đây

Không đặt Ghi chú ở cuối trang.

Greeting dùng:
"Chào, {displayName}"

Không dùng "Chào buổi sáng/tối" để tránh sai thời gian.

==================================================
7. CHỈ KHỐI VĂN PHÒNG CÓ DASHBOARD ĐẦY ĐỦ
==================================================

Giám sát công trường trên mobile KHÔNG dùng dashboard phức tạp.

Mobile supervisor home phải task-oriented:

- công trường hiện tại;
- Điểm danh công nhân;
- công việc hôm nay;
- thông báo;
- trạng thái đồng bộ/offline;
- chức năng chính cần thao tác nhanh.

Không KPI/chart dư thừa trên mobile supervisor.

==================================================
8. PHÂN HỆ CỦA TÔI + ICON SYSTEM
==================================================

Dashboard desktop có khu:

"Phân hệ của tôi"

Hiển thị trực tiếp module user có quyền.

Click icon:
→ đi thẳng chức năng chính module.

Không bắt:
Dashboard → Tất cả phân hệ → Module.

Nếu quá nhiều module:
6–8 module ưu tiên + Tất cả.

Tạo ModuleIconRegistry duy nhất:

module:
- icon
- label
- route
- permission
- pastel identity
- accent
- hover variant

QUY TẮC CỨNG:

- Không 2 top-level module dùng cùng icon.
- Không 2 module đang hiển thị dùng cùng primary pastel identity.
- Icon cùng một SVG language.
- Không trộn outline/filled/3D/PNG.

Ví dụ identity:
HR → UsersRound → lavender
Attendance → Clock → cyan
Projects → Briefcase → blue
Warehouse → Warehouse → yellow
Logistics → Ship → mint
Tasks → ListTodo → rose
Finance → Wallet → green
Reports → Chart → peach
System → Settings → soft purple-gray

Nếu thêm module, mở rộng palette.

==================================================
9. HOVER / CLICK
==================================================

Module card hover:
- translateY(-3px)
- icon scale 1.04
- shadow tăng nhẹ
- pastel đậm hơn rất nhẹ
- 160–200ms ease

Active:
translateY(-1px)

Button hover:
translateY(-1px)

Table row:
soft tint

Sidebar item:
soft background + translateX(2px)

Dropdown item:
soft tinted hover

Không:
- bounce;
- rotate;
- neon glow;
- animation >300ms.

Visual surface = hover surface = click surface = focus surface.

Fix tất cả trường hợp hover/click lệch vùng.

Respect prefers-reduced-motion.

==================================================
10. SPACING / HIERARCHY — BẮT BUỘC AUDIT TOÀN APP
==================================================

Lỗi hiện tại:
- tiêu đề xa nội dung;
- content trong card dính nhau;
- spacing giữa section không đều;
- nội dung sát góc bo;
- toolbar/table sát nhau.

Dùng shared tokens:

PageTitle → Description: 4–6px
PageHeader → FirstSection: 20–24px

SectionTitle → Description: 4px
SectionHeader → Content: 12–16px

Section → NextSection: 28–32px

Card padding: 24–28px
CardTitle → Body: 12–16px
BodyBlock → BodyBlock: 16–20px

Label → Control: 6–8px
FieldGroup → FieldGroup: 16–20px

Toolbar → Table/List: 16–20px

GOLDEN RULE:
Một title phải gần content mà nó mô tả hơn section trước.

Không dùng khoảng 40px vô lý giữa title và chính content của title.

==================================================
11. ROUNDED SAFE AREA
==================================================

radius 20 → padding >=24
radius 24 → padding 26–28
radius 28 → padding 30–32

Không đặt text/icon/button/filter/table sát vùng bo.

Tất cả border radius phải dùng token.

Không để trên bo 24, dưới bo 14, input bo khác kiểu ngẫu nhiên.

==================================================
12. BORDER
==================================================

Default:
NO BORDER nếu spacing/background đã đủ hierarchy.

Ưu tiên:
spacing
→ typography
→ surface
→ divider
→ border
→ shadow

Không nested bordered rectangles.

==================================================
13. TABLE — KHÔNG ĐƯỢC TRÀN
==================================================

Audit toàn bộ table.

BẤT KỲ TABLE NÀO cũng không được:
- phá viewport;
- phá card;
- tràn page;
- ép layout rộng;
- text đè nhau.

Không chỉ thêm overflow-x-auto rồi kết thúc.

Fix:
- parent `min-width: 0`;
- grid/flex children;
- fixed width sai;
- nowrap;
- min-content/max-content;
- action width;
- column sizing.

Column priority:

P1 bắt buộc
P2 quan trọng
P3 phụ

Desktop:
hiển thị đầy đủ hợp lý.

Tablet:
ẩn P3.

Mobile:
chỉ dữ liệu chính hoặc chuyển thành record card/expandable detail.

Table:
header 44–48px
row 54–58px
cell-X 16px
horizontal divider nhẹ
không vertical grid

Text dài:
truncate / clamp / tooltip đúng ngữ cảnh.

Action:
•••
không lặp button "Chỉnh sửa" chiếm chỗ.

==================================================
14. FORM RESPONSIVE
==================================================

Desktop:
2-column khi phù hợp.

Dùng:
repeat(2, minmax(0, 1fr))

Không dùng width 50% + gap gây overflow.

Mobile:
1 column.

Controls width 100%.

==================================================
15. DROPDOWN
==================================================

Redesign shared dropdown:

- radius 14–16;
- soft shadow;
- không border cứng;
- padding 6–8;
- item 38–42px;
- item radius 10–12;
- hover pastel;
- selected state rõ;
- check icon;
- search nếu option nhiều;
- animation 150–180ms.

Không dùng dropdown browser/basic-looking nếu component custom đã phù hợp.

==================================================
16. SIDEBAR / FUNCTION BAR
==================================================

Fix:
- khoảng bo ngoài thừa;
- inner/outer radius không khớp;
- hover/click lệch;
- active state quá nhiều effect.

Segmented/tab control dùng consistent geometry.

Ví dụ:
outer radius 16
inner radius 12
outer padding 4

Sidebar item:
42–44px
soft pill
consistent spacing

==================================================
17. BỎ BREADCRUMB DƯ THỪA
==================================================

Ẩn các chuỗi dạng:
> > >
hoặc breadcrumb dài không cần thiết.

Chỉ giữ khi thực sự giúp xác định context.

Page đơn giản:
Title + description là đủ.

==================================================
18. ĐIỂM DANH CÔNG NHÂN
==================================================

Đặt:

Dự án/Công trường
→ Công trường
→ Điểm danh công nhân

Khác với chấm công văn phòng.

Workflow:

Supervisor mở phiên điểm danh
→ chọn công trường
→ chụp ảnh tập thể
→ tick nhân viên có mặt
→ ghi chú nếu cần
→ xác nhận
→ realtime gửi HR

Lưu:
- site
- project
- supervisor
- timestamp thiết bị
- server timestamp
- evidence photo key
- GPS nếu có
- worker list
- present/absent
- notes
- sync status

Ảnh tập thể = evidence của SESSION, không bắt ảnh từng worker.

==================================================
19. HR XEM ĐIỂM DANH TRÊN WEB
==================================================

HR phải có màn:

Chấm công
→ Điểm danh hôm nay

Hiển thị đẹp:

Công trường
Giám sát
Giờ điểm danh
Số có mặt / tổng
Ảnh minh chứng
Danh sách có mặt
Danh sách vắng
Ghi chú
Sync/status

Ảnh xem trực tiếp thumbnail/lightbox.

Excel vẫn xuất được.

Không bắt HR tải Excel để xem attendance hằng ngày.

==================================================
20. ATTENDANCE → TIMESHEET → PAYROLL
==================================================

Audit logic thật kỹ.

Flow bắt buộc:

Attendance events
→ Daily attendance
→ corrections/approval
→ HR review
→ Monthly Timesheet
→ HR CLOSE/LOCK
→ Accounting selects locked timesheet
→ Payroll Batch
→ salary calculation
→ accounting review
→ approval/final lock
→ payslip

Accounting KHÔNG tính lương trực tiếp từ raw attendance.

Sau HR lock:
không sửa âm thầm.

Nếu reopen:
- quyền phù hợp;
- lý do;
- audit log.

Kiểm tra:
- OT;
- leave;
- unpaid leave;
- allowances;
- deductions;
- contract salary;
- attendance corrections;
- duplicate calculations;
- payroll locking/idempotency.

==================================================
21. ẢNH CHẤM CÔNG — RETENTION 45 NGÀY
==================================================

AUDIT SOURCE TRƯỚC.

Xác định ảnh hiện đang lưu:
- Supabase Storage;
- Cloudflare R2;
- hoặc storage khác.

Không đoán.

Sau audit:
báo ngắn nơi đang lưu.

Retention:

photo >45 days
→ delete object
→ giữ attendance record
→ giữ metadata cần audit
→ đánh dấu evidence expired/deleted
→ tránh orphan object

Không xóa:
- attendance history;
- workers;
- timestamps;
- approvals;
- payroll-linked records.

Job chạy tự động định kỳ.

==================================================
22. REALTIME
==================================================

Realtime bắt buộc cho dữ liệu cần phản ánh tức thời:

- attendance;
- site roll-call;
- notifications;
- task/todo;
- approvals;
- chat/messages;
- file attachment state;
- important warehouse state;
- relevant calendar updates.

Database vẫn là source of truth.

Không dùng realtime như nguồn dữ liệu duy nhất.

Reconnect/resync phải an toàn.

==================================================
23. LỊCH + ĐỒNG HỒ
==================================================

Dashboard desktop:
- realtime clock;
- date;
- calendar;
- meetings/tasks/deadlines.

Clock client-side, không gây unnecessary network requests.

Calendar cập nhật realtime khi dữ liệu liên quan thay đổi.

==================================================
24. NOTES + TODO
==================================================

Ghi chú ở khu vực trên/mid dashboard, không nằm cuối.

Notes có Todo.

Todo tối thiểu:
- title;
- due date;
- priority;
- completed;
- user_id.

Không biến Notes thành module quản lý dự án thứ hai.

==================================================
25. MODULES CHƯA HOÀN THIỆN
==================================================

Sau core/UI foundation mới hoàn thiện:

PROJECT:
- list;
- detail;
- sites;
- members;
- tasks;
- progress;
- documents;
- issues;
- roll-call.

WAREHOUSE:
- stock;
- receipts;
- issues;
- transfers;
- warehouses;
- adjustments;
- inventory count;
- item transaction history.

IMPORT/EXPORT:
- shipments;
- carrier;
- documents;
- ETA;
- status;
- cost;
- warehouse linkage;
- history.

Không tạo dashboard riêng cho các module này.

==================================================
26. ERROR / EMPTY / LOADING STATES
==================================================

Shared:
ErrorState
WarningState
InfoState
EmptyState
Skeleton

Không đặt error sát card edge.
Không dùng full-width red line lỗi kiểu cũ.

Soft semantic surfaces:
error rose
warning peach/yellow
info blue
success mint.

==================================================
27. RESPONSIVE QA
==================================================

Test tối thiểu:

1920
1440
1280
1024
768
390

Không được có:
- page overflow;
- card overlap;
- table overflow phá layout;
- title overflow;
- button đẩy layout;
- module icons vỡ grid;
- mobile supervisor UI dư dashboard.

==================================================
28. PERFORMANCE
==================================================

Không đánh đổi performance lấy animation.

Ưu tiên CSS transitions.

Lazy load heavy chart khi phù hợp.

Không rerender toàn Dashboard vì hover một card.

Reuse/cache query nếu nhiều widget dùng cùng data.

==================================================
29. THỨ TỰ IMPLEMENT — KHÔNG LÀM LUNG TUNG
==================================================

PHASE 1
Audit + seed DB + attachments + storage/retention + attendance/payroll logic + realtime.

PHASE 2
UI tokens/primitives/shared components + overflow/spacing/radius/table/dropdown/navigation.

PHASE 3
Personal Dashboard + module icons + permission-aware widgets + office/supervisor experiences.

PHASE 4
Project + Warehouse + Import/Export completion.

PHASE 5
Animations/polish + responsive/visual regression audit.

Không polish hover trước khi core overflow/workflow ổn.

==================================================
30. ACCEPTANCE TEST
==================================================

Chỉ hoàn thành khi:

- Login desktop → Personal Dashboard.
- Office Dashboard thực sự cá nhân.
- Supervisor mobile không có dashboard dư thừa.
- Module dashboards dư đã bỏ.
- Module icons không trùng icon.
- Module identity colors không trùng.
- Hover/click đúng surface.
- Spacing toàn app đồng đều.
- Title không xa content.
- Content trong card không dính.
- Safe padding quanh bo đúng.
- Không table nào phá layout.
- Dropdown đẹp và đồng bộ.
- HR xem ảnh điểm danh ngay trên web.
- Attendance → HR locked timesheet → Accounting payroll đúng workflow.
- Attachments hoạt động.
- Avatar/personal UI hoạt động.
- Calendar/clock/todo hoạt động.
- Realtime hoạt động.
- Project/Kho/XNK không còn sơ sài.
- Global visual changes chỉ sửa shared layer.
- Business logic hiện có không regression.

==================================================
31. CÁCH LÀM ĐỂ TIẾT KIỆM TOKEN
==================================================

Không mô tả lại source cho tôi.

Không viết kế hoạch dài.

Không paste toàn bộ file không thay đổi.

Không tạo tài liệu giải thích trừ khi cần.

Trước mỗi phase:
audit nhanh code hiện tại và REUSE những gì đúng.

Không rewrite component đang hoạt động nếu chỉ cần sửa shared primitive.

Ưu tiên sửa ROOT CAUSE.

Sau mỗi phase chỉ báo:
- đã sửa gì;
- file/shared component chính;
- test nào đã chạy;
- blocker còn lại.

Nếu không có blocker:
tiếp tục phase kế tiếp.

Không hỏi lại những quyết định đã được định nghĩa trong prompt này.


==================================================
32. PAGE / MODULE TRANSITIONS & LOADING EXPERIENCE
==================================================

Hệ thống hiện thiếu feedback rõ khi chuyển giữa các chức năng lớn hoặc khi route/data mất thời gian tải.

Bổ sung shared transition/loading system.

KHÔNG dùng spinner mặc định/basic.

Tạo shared:

- GlobalRouteLoader
- ModuleTransition
- PageSkeleton
- TableSkeleton
- CardSkeleton
- ChartSkeleton

## Route transition strategy

Không hiển thị loader nếu navigation hoàn thành rất nhanh.

Gợi ý:

< 200ms:
không render loading UI để tránh flicker.

200–600ms:
hiển thị lightweight module loader.

> 600ms:
hiển thị module loader hoặc page shell + skeleton phù hợp.

Không cố tình delay page chỉ để animation đẹp.

## Major module navigation

Khi chuyển giữa các module lớn như:

- Nhân sự
- Dự án
- Kho
- Xuất nhập khẩu
- Chấm công
- Tài chính

sidebar/topbar phải giữ ổn định.

Chỉ vùng main workspace transition.

Flow:

click module
→ active navigation state cập nhật ngay
→ main content fade/transition nhẹ
→ loading state
→ page shell xuất hiện
→ skeleton nếu data chưa sẵn sàng
→ real content

Không blank toàn viewport.

## Center module loader

Khi cần loading giữa màn hình:

- đặt ở center của MAIN WORKSPACE
- không center theo toàn viewport nếu sidebar đang tồn tại
- dùng icon của module đang mở
- dùng đúng pastel identity của module
- text ngắn

Ví dụ:

[Warehouse icon]

Đang mở Kho hàng...

Không dùng message kỹ thuật.

## Animation

Duration:
150–220ms

Allowed:
- opacity fade
- translateY 4–8px
- subtle scale 0.99 → 1

Không dùng:
- bounce
- rotate page
- long slide
- heavy blur
- animation >300ms

## Prevent layout shift

Loading UI và real UI phải giữ layout ổn định.

Không để content nhảy mạnh khi data xuất hiện.

Skeleton phải gần kích thước content thật.

## Data loading

Sau khi page shell đã render:

- table → TableSkeleton
- chart → ChartSkeleton
- cards → CardSkeleton

Không giữ global loader chỉ vì một widget nhỏ chưa load xong.

## Interaction safety

Trong quá trình navigation:
- ngăn double navigation nếu cần
- không tạo duplicated requests
- không mất form state ngoài ý muốn
- không reset global layout
- không reconnect realtime vô ích

## Performance

Ưu tiên CSS transition.
Không thêm animation library nặng nếu không cần.

Transition không được làm route chậm hơn.

Respect:
prefers-reduced-motion.

## Acceptance

- Không còn cảm giác click rồi đứng im.
- Không có spinner flash khi route rất nhanh.
- Module lớn có transition/loading rõ ràng.
- Sidebar/topbar không biến mất.
- Loader đúng icon/màu của module.
- Table/chart/card có skeleton riêng.
- Không blank screen.
- Không layout shift mạnh.

==================================================
33. LOGIN UX — PASSWORD VISIBILITY TOGGLE
==================================================

Màn đăng nhập bắt buộc có nút xem/ẩn mật khẩu.

Password field phải có icon eye/eye-off nằm bên phải input.

Yêu cầu:

- Mặc định: type="password".
- Click icon lần 1 → hiển thị password bằng type="text".
- Click lần 2 → ẩn lại bằng type="password".
- Không làm mất focus khỏi input khi toggle.
- Không làm reset giá trị password.
- Không submit form khi click icon.
- Button phải có type="button".
- Có accessible label:
  - "Hiển thị mật khẩu"
  - "Ẩn mật khẩu"
- Có keyboard focus state rõ.
- Icon phải cùng style SVG với toàn hệ thống.
- Hover dùng soft background, không border cứng.
- Hit area tối thiểu khoảng 36–40px để dễ thao tác.
- Icon phải căn giữa theo chiều dọc input.
- Không để icon đè lên text; input phải có padding-right phù hợp.
- Không thay đổi logic authentication hiện tại.
- Không log hoặc expose password.
- Không lưu password plaintext trong localStorage/sessionStorage.

Ví dụ interaction:

[ Mật khẩu.......................... 👁 ]

hover icon:
- soft pastel/neutral background
- transition 150–180ms

click:
- eye ↔ eye-off
- giữ nguyên layout
- không gây layout shift

## Login visual consistency

Màn login phải dùng cùng design system:

- Inter
- radius token
- control height token
- soft shadow
- pastel accent vừa phải
- spacing đồng đều
- error state mềm, rõ
- không basic browser form

Khoảng cách tham chiếu:

Label → Input: 6–8px
Field → Field: 16–20px
Input → Error text: 6–8px
Form group → Primary action: 20–24px

Password visibility button phải nằm trong shared PasswordInput component hoặc Input variant dùng chung.

Không implement riêng chỉ ở một login page nếu hệ thống có màn:
- đổi mật khẩu
- tạo mật khẩu
- xác nhận mật khẩu
- reset mật khẩu

Hãy reuse cùng PasswordInput component ở tất cả nơi cần password field.

## Acceptance

- Login có nút xem/ẩn mật khẩu.
- Toggle không submit form.
- Toggle không mất dữ liệu.
- Focus/hover/click area khớp icon.
- Không layout shift.
- Accessibility label đúng.
- PasswordInput được dùng lại ở các màn password liên quan.
- Không thay đổi auth logic.


==================================================
34. TOOLBAR / ACTION BAR — BẮT BUỘC ĐỒNG BỘ TOÀN HỆ THỐNG
==================================================

Hiện tại toolbar/action bar không đồng bộ:
- có màn hiển thị đầy đủ icon + text;
- có màn chỉ còn icon;
- có màn tự ẩn action vào menu;
- có màn spacing/radius/action placement khác nhau.

Phải refactor về shared Toolbar / ActionBar duy nhất.

Tạo:
- PageActionBar
- TableActionBar
- CompactActionMenu
- ActionButton

Không để feature page tự quyết style riêng.

## Desktop behavior

Trên desktop đủ rộng:

Primary action:
icon + text

Ví dụ:
[ + Thêm nhân viên ]

Secondary actions quan trọng:
icon + text

Ví dụ:
[ Xuất Excel ]
[ Bộ lọc ]

Tertiary/rare actions:
có thể nằm trong menu "..."

Không được có màn desktop đủ chỗ nhưng lại chỉ hiện icon khó hiểu.

## Tablet behavior

Giữ:
- primary action icon + text
- secondary actions có thể thu gọn nếu thiếu chỗ

Có thể chuyển action phụ sang:
[...]

## Mobile behavior

Trên mobile:
- primary action vẫn phải rõ nghĩa;
- action phụ có thể thu gọn thành icon/menu;
- icon-only bắt buộc có tooltip hoặc accessible label khi phù hợp.

## Breakpoint rules

Toolbar behavior phải dựa trên responsive breakpoint chung.

Không được mỗi màn tự dùng logic kiểu:
- page A collapse ở 1280px
- page B collapse ở 1024px
- page C luôn icon-only

Tất cả dùng cùng responsive policy từ shared component.

Ví dụ:

>= 1200:
primary + secondary show icon + text

768–1199:
primary show icon + text
secondary compact nếu cần

< 768:
primary giữ rõ nghĩa
secondary đưa vào overflow menu

Không hard-code nếu project đã có breakpoint system tương đương; hãy map vào token/breakpoint hiện tại.

## Icon-only rule

Chỉ dùng icon-only khi:
- hành động rất quen thuộc;
- không gian nhỏ;
- hoặc trong compact/mobile mode.

Ví dụ phù hợp:
- refresh
- close
- more
- notification
- search trigger

Không dùng icon-only cho các hành động nghiệp vụ khó đoán như:
- Chốt công
- Tính lương
- Tạo phiếu xuất
- Duyệt đơn

Các action này cần text rõ ràng.

## Geometry

Mọi toolbar button dùng chung:
- control height
- radius
- icon size
- gap icon-text
- hover
- active
- focus

Visual surface = click surface.

Không được:
- icon nằm lệch;
- button trên/dưới không thẳng hàng;
- outer pill dư khoảng bo;
- toolbar cao thấp khác nhau giữa page.

## Acceptance

- Toolbar toàn hệ thống cùng một pattern.
- Không còn chỗ show full, chỗ icon-only ngẫu nhiên.
- Desktop ưu tiên icon + text.
- Mobile/compact mới thu gọn có kiểm soát.
- Các action nghiệp vụ quan trọng luôn có text.
- Action overflow dùng shared menu.
- Không sửa toolbar từng page bằng tay.

==================================================
35. IMAGE UPLOAD — PHẢI CÓ PREVIEW + TRẠNG THÁI RÕ
==================================================

Hiện tại nút chọn ảnh đã mở file picker nhưng sau khi chọn:
- không thấy preview;
- không biết file đã được nhận chưa;
- không biết đã upload chưa;
- không biết lỗi ở bước nào.

Phải chuẩn hóa toàn bộ image upload flow.

Tạo shared component:

ImageUploader

Dùng lại cho:
- avatar;
- ảnh minh chứng chấm công;
- ảnh công trường;
- ảnh tài liệu nếu phù hợp;
- các field upload ảnh khác.

## Required states

ImageUploader phải có đầy đủ state:

1. Empty
2. File selected
3. Preview ready
4. Uploading
5. Upload success
6. Upload error
7. Replace
8. Remove

Không được chọn file xong mà UI không thay đổi.

## File selection

Sau khi chọn ảnh:

Ngay lập tức:
- validate type;
- validate size;
- tạo local preview bằng object URL/FileReader;
- hiển thị thumbnail;
- hiển thị filename nếu cần;
- hiển thị dung lượng nếu hữu ích.

Local preview phải xuất hiện TRƯỚC khi upload hoàn tất.

Ví dụ:

╭────────────────────────────╮
│ [ thumbnail ảnh ]          │
│                            │
│ IMG_1234.jpg               │
│ 2.4 MB                     │
│                            │
│ [Thay ảnh]   [Xóa]         │
╰────────────────────────────╯

## Upload state

Khi upload:

thumbnail vẫn giữ nguyên.

Hiển thị:
- loading/progress;
- "Đang tải lên..."
- disable thao tác gây duplicate nếu cần.

Không blank preview trong lúc upload.

## Success state

Sau upload thành công:

- giữ thumbnail;
- hiển thị success state nhẹ;
- lưu object key/url theo architecture hiện tại;
- cập nhật form state thật sự.

Không chỉ upload file mà quên bind vào record/form.

## Error state

Nếu upload lỗi:

- giữ local preview nếu hợp lý;
- báo lỗi rõ;
- có nút Retry;
- không bắt user chọn lại file nếu không cần.

Ví dụ:
"Tải ảnh thất bại. Thử lại"

Không hiển thị lỗi kỹ thuật thô cho end-user.

## Avatar upload

Avatar phải:
- crop/cover hợp lý;
- preview ngay;
- thay avatar được;
- xóa avatar được nếu nghiệp vụ cho phép;
- dùng placeholder nếu chưa có ảnh.

## Attendance evidence

Ảnh minh chứng chấm công:
- preview ngay sau chụp/chọn;
- có thể mở xem lớn;
- có timestamp/context nếu cần;
- không cho submit phiên điểm danh nếu ảnh bắt buộc mà upload chưa thành công.

## Multiple images

Nếu field cho phép nhiều ảnh:

dùng grid thumbnail.

Mỗi item có:
- preview
- progress/state
- remove/retry

Không dùng một danh sách filename thô.

## Memory cleanup

Nếu dùng `URL.createObjectURL`:
- revoke object URL khi thay/xóa/unmount;
- tránh memory leak.

## Security

Validate cả client và server:
- MIME type
- extension
- size
- allowed image types

Không tin client-only validation.

## Acceptance

- Chọn ảnh xong phải thấy preview ngay.
- Có trạng thái upload rõ.
- Thành công giữ preview.
- Lỗi có retry.
- Có thay/xóa ảnh.
- Avatar và ảnh minh chứng dùng shared uploader.
- Không có field upload nào chọn ảnh xong mà UI im lặng.

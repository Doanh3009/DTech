# Inventory component UI dùng chung

Cập nhật: 2026-09-15. Số consumer được đếm tĩnh từ JSX trong `src`; component gọi gián tiếp hoặc tên native không nằm trong con số này.

| Component | Mục đích / variant | Responsive và state | Rủi ro lặp | Consumer chính / số JSX |
| --- | --- | --- | --- | --- |
| `AppRail` | chuyển ứng dụng toàn cục, active marker | ẩn dưới 900px; tooltip/aria bắt buộc | không chứa route title | `AppShell` / 1 |
| `AppSidebar` (Context Panel) | điều hướng trong phân hệ, expanded/collapsed | ẩn dưới 900px; bỏ hẳn khi chỉ có ≤1 item | identity chỉ xuất hiện một lần | `AppShell` / 1 |
| `AppHeader` (Global Topbar) | search, connection, notification, profile | desktop search; tablet/mobile icon; action không wrap | không render module/route title/breadcrumb | `AppShell` / 1 |
| `Breadcrumb` | hierarchy có chiều sâu | wrap có kiểm soát; trả `null` nếu <2 item | không lặp breadcrumb một cấp | `AppShell` / 1 |
| `PageHeader` | một `h1`, action theo route | grid trên mobile, line-height an toàn dấu | owner duy nhất của title route chuẩn | 101 |
| `WorkbenchLayout` | canvas + inspector / solo | inspector 270–340px, stack dưới 900px | inspector chỉ khi selection/decision | 4 |
| `CommandBar` | hành động ngữ cảnh | wrap/stack ở mobile; sticky theo token topbar khi cần | không sao chép action shell | 1 |
| `WorkCanvas` | dữ liệu/form chính | `min-width:0` | không có title riêng mặc định | 4 |
| `Inspector` | preview, metadata, quyết định | internal layout; stack mobile | không hiện nếu không có thông tin | 4 |
| `Button` | primary/secondary/ghost/danger; sm/md/lg | min-height ổn định; label không tách dọc | một primary theo workflow | 63 |
| `IconButton` | action biểu tượng có label | touch target và tooltip native | không dùng icon không nhãn | 10 |
| `Input`/`Textarea`/`Select` | field chuẩn, required/error/disabled native | width 100%, form grid collapse | label chỉ tại control | 37/15/29 |
| `SearchInput` | tìm trong list | full-width mobile | không lặp global search | 9 |
| `FilterBar` | toolbar lọc | column mobile | chỉ filter thuộc dataset | 7 |
| `DataTable` | table desktop + mobile renderer | scroll nội bộ/record list, loading/empty | header/toolbar không tự sinh | 10 |
| `Pagination` | previous/next/page count | justify-between mobile | chỉ hiện khi có nhiều trang | 2 |
| `Tabs` | peer views trong cùng object/module | scroll ngang, nowrap | không thay breadcrumb/title | 16 |
| `StatusBadge` | neutral/info/success/warning/error | text label + color | không dùng chấm màu đơn độc | 56 |
| `DropdownMenu` | action overflow/profile | details + keyboard/browser behavior | menu item có nhãn | 3 |
| `Drawer`/`Modal`/`Sheet` | nội dung phụ có focus handling | max viewport, internal scroll | không dùng cho form quá phức tạp | Drawer 4 |
| `FormSection`/`StickyActionBar` | nhóm form và action cuối | grid collapse; safe-area khi phù hợp | không lặp helper text | 7+ |
| `EmptyState` | không có dữ liệu | action tùy chọn | không render empty card vô nghĩa | 11 |
| `LoadingState`/`Skeleton` | initial loading | aria-live/reduced motion | background refetch giữ content | Loading dùng rộng; Skeleton export |
| `ErrorState` | lỗi có thể thử lại | role alert | route boundary chứa lỗi cục bộ | 12 |
| `PermissionDeniedState` | thiếu quyền | role alert, không lộ dữ liệu | dùng thay disabled giả | 8 |
| `Toast` | phản hồi ngắn | live region | không phát một toast mỗi event burst | export, chưa có JSX trực tiếp |
| `NotificationBell` | unread count | icon action, aria label | một instance trong topbar | 1 |
| `Uploads` | dropzone/upload list | giới hạn file và trạng thái | không nhân đôi nút tải | consumer qua export |
| PDF/Excel actions | download server-generated asset | busy/disabled tại workflow | không chạy tạo file nặng trên main thread | leave/report/timesheet |

## Component cũ/không còn trong shell

- `QuickCreateMenu` vẫn còn source để tránh xóa nhầm consumer lịch sử, nhưng không còn được render trong `AppHeader`.
- Không có component Tooltip riêng; `title` + `aria-label` đang là chuẩn cho App Rail/IconButton. Nếu cần tooltip tương tác phong phú phải bổ sung một primitive duy nhất.
- `Card` còn nhiều consumer legacy. MASTER 03/04 làm phẳng qua token/CSS và chỉ migrate markup ở workflow trọng yếu; không xóa cho đến khi từng consumer được xác minh.

## Gate khi đổi component dùng chung

1. Chạy `rg` để lập consumer trước sửa.
2. Giữ API component tương thích nếu chưa migrate hết.
3. Kiểm tra long Vietnamese label, disabled, focus-visible và mobile.
4. Chạy typecheck, lint, unit test, build và screenshot sweep.
5. Với shell/Realtime, kiểm tra cleanup và burst test trước khi chấp nhận.

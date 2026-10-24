# DTech ERP — Design DNA 1.0

Chuẩn sản phẩm cho mọi module. Thương hiệu khách hàng là cấu hình của một bản triển khai. Hồ sơ Châu Tuấn trong thư mục kế bên ghi lại giao diện khách hàng ban đầu; module mới áp dụng tài liệu này và component đang chạy.

## Nhận diện

- Không gian sáng, nền vận hành xám trung tính, bề mặt trắng rõ và màu pastel theo nghiệp vụ trong icon/thẻ module; một màu thương hiệu chính. Không dùng nền gradient trang trí cho màn nghiệp vụ.
- Inter đầy đủ tiếng Việt; Lucide là bộ icon duy nhất. Tên công ty, logo và màu lấy từ `SystemSettingsProvider`.
- Bề mặt, chữ, hình khối, bảng, form và trạng thái nhất quán giữa các ngành. Ngành quyết định module và cấu hình nghiệp vụ.
- UI chỉ có nhãn, trạng thái và dữ liệu cần thao tác. Không đặt mô tả dưới chức năng, hành động, quyền hoặc điều hướng.

## Ba lớp token

| Lớp | Nguồn | Ví dụ |
| --- | --- | --- |
| Primitive | `src/styles/tokens.css` | Spacing, font weight, nhóm màu |
| Semantic | cùng file + cấu hình thương hiệu | `--surface`, `--text-primary`, `--color-primary`, `--danger` |
| Component | cùng file + CSS component | `--erp-module-card-bg`, `--erp-module-card-radius`, `--control-height-md` |

Component dùng token semantic/component; không chép mã hex hay giá trị bo góc vào mỗi trang. Root layout/provider đã chọn màu chữ đủ tương phản. Đổi thương hiệu không đổi màu trạng thái.

## Kích thước

| Thành phần | Quy tắc |
| --- | --- |
| Nội dung | `--font-body`: 16px |
| Nhãn, trạng thái | `--font-meta`: 13px |
| Tiêu đề khu vực | `--font-section`: 21px |
| Tiêu đề trang nghiệp vụ | `--font-page`: 24–30px |
| Khoảng cách | 4, 8, 12, 16, 20, 24, 32, 40, 48px |
| Điều khiển | 44px; toolbar desktop có token riêng 36px |
| Bo góc | Điều khiển 12px, card 18px, overlay 22px |
| Motion | Token `--motion-fast` / motion hiện hữu; tôn trọng reduced motion |
| Cột thao tác bảng | `--table-action-column-width`, mặc định 104px; bảng có nhãn dài đặt token theo nội dung và dùng `DataTable.actions` để giữ vùng nút trên điện thoại |

Gateway `/applications` cho phép tiêu đề 28–40px và card 160px trên desktop. Màn nghiệp vụ dùng mật độ bảng/form hiện hữu.

## Component chuẩn

| Nhu cầu | Component |
| --- | --- |
| Tiêu đề | `PageHeader`, một `h1` |
| Vào module | `ErpModuleCard`, dữ liệu từ `applicationRegistry` |
| Thao tác | `Button`, `IconButton`, `StickyActionBar` |
| Biểu mẫu | `Input`, `PasswordInput`, `Select`, `Switch`, `FormSection` |
| Danh sách | `DataTable` / `Worklist`, `FilterBar` / `FilterSheet` |
| Trạng thái | `StatusBadge`, luôn kèm nhãn |
| Rỗng/lỗi/tải | `EmptyState`, `ErrorState`, `LoadingState` |
| Overlay | `Modal`, `Drawer`, `DropdownMenu` hiện hữu |

Catalog trực tiếp ở `/system-admin/design-dna`. Dữ liệu ghi “Mẫu” chỉ dùng để xem component, thao tác mẫu không ghi dữ liệu nghiệp vụ. Thẻ module dẫn đến route thật mà người dùng được phép mở.

## Bố cục

- Đăng nhập: nhận diện doanh nghiệp và form đăng nhập; không hiển thị danh sách module.
- Gateway: khối nhận diện và tài khoản → tìm module → module → công cụ quản trị theo quyền. Không có bộ lọc nhóm hoặc module Dashboard độc lập. Lưới 4/3/2 cột. Thẻ module có bề mặt trắng, icon pastel theo nghiệp vụ và nhãn; toàn thẻ là liên kết, không thêm nút tròn, spinner, watermark hoặc mô tả.
- Trong module: nhận diện module và điều hướng nghiệp vụ của chính module đó. Một liên kết “Tất cả module” quay về gateway; không lặp danh sách ứng dụng hoặc dãy “Ứng dụng của tôi” trong màn nghiệp vụ. Menu điện thoại và tìm kiếm tuân theo cùng phạm vi.
- Nhận diện module nằm trong breadcrumb; không lặp một thẻ module lớn trong sidebar. Lối về gateway là biểu tượng cạnh thương hiệu. Chuyển route không dịch chuyển/fade toàn vùng nội dung; loading dùng thanh mảnh chung có độ trễ 200ms. Thẻ module không nhúng spinner, giữ nguyên kích thước khi chọn; prefetch đầy đủ khi hover/focus/touch theo hướng dẫn Next đang cài.
- Trang giới thiệu sản phẩm ở `/`; đăng ký ở `/dang-ky-dung-thu`, đăng nhập riêng ở `/login`. Thiết kế marketing tại [page override](pages/marketing.md); không đưa dữ liệu nhân sự/chứng từ hoặc tên khách hàng chưa được phép công khai vào landing.
- Nghiệp vụ: tiêu đề và hành động chính → bộ lọc → bảng/vùng làm việc → phân trang.
- Form: label, nhóm theo luồng nhập, validation máy chủ, thanh lưu dùng chung. Một cột trên điện thoại.
- Bàn phím, focus, tên truy cập của icon và trạng thái lỗi/tải phải hoạt động; không phụ thuộc hover.
- Không tạo KPI, dữ liệu doanh nghiệp hoặc lịch sử giả để lấp giao diện.

## Module mới

Trung tâm triển khai `/control-center` là portal nội bộ của team DTech, có shell và quyền riêng, không phải application/module của ERP khách hàng. Dùng cùng component/token; cấu hình prospective customer nằm trong hồ sơ CRM. Thiết kế tại [CRM triển khai](pages/operator-crm.md).

Áp dụng [hợp đồng module](../../docs/erp/module-contract.md). Chỉ đăng ký module khả dụng khi có route, service, lưu trữ và kiểm tra quyền. Tính năng dự kiến nằm trong lộ trình ngành.

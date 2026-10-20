# Hệ thống giao diện Operational Workbench

Cập nhật: 2026-09-15 (Asia/Ho_Chi_Minh)

## Mục tiêu

Giao diện phục vụ công việc nội bộ có mật độ dữ liệu cao: người dùng nhìn thấy ngoại lệ, trạng thái, hàng đợi và hành động kế tiếp trước; điều hướng và trang trí lùi về sau. Hệ thống giữ nguyên quyền, API, workflow, Realtime, offline queue và dữ liệu thật.

## Kiến trúc shell

Shell desktop gồm ba lớp độc lập:

1. `AppRail`: rail tối, hẹp, chỉ chứa các ứng dụng người dùng được quyền truy cập và dấu hiệu ứng dụng hiện hành.
2. `AppSidebar`: context panel sáng, chỉ chứa tên ứng dụng và điều hướng cục bộ của ứng dụng đó.
3. Workspace: header yên tĩnh, command bar theo ngữ cảnh, work canvas và inspector khi cần quyết định hoặc xem nhanh.

Mobile thu rail và context panel vào điều hướng hiện có; hành động chính được giữ trong vùng chạm thuận tay. Các màn hình cấu hình dùng thanh điều hướng con nằm ngang để tránh sidebar lồng sidebar.

## Primitive dùng chung

| Primitive | Vai trò | Quy tắc |
| --- | --- | --- |
| `WorkbenchLayout` | Chia work canvas và inspector | Inspector chỉ xuất hiện khi có selection hoặc quyết định thật |
| `CommandBar` | Tập trung tác vụ theo ngữ cảnh | Không biến thành một hàng nút đồng hạng |
| `WorkCanvas` | Vùng dữ liệu và biểu mẫu chính | Ưu tiên section phẳng, bảng và hàng compact |
| `Inspector` | Trạng thái, metadata, preview, quyết định | Thu về một cột trên tablet/mobile |
| `OperationalSection` | Nhóm nội dung nghiệp vụ | Dùng border/spacing thay card trang trí |

Các component cũ vẫn tương thích. CSS chung chuyển `Card`, filter bar, state và bảng về bề mặt phẳng hơn để các route chưa refactor markup vẫn nhận được ngôn ngữ mới.

## Typography và token

- UI: IBM Plex Sans, trọng lượng 400/500/600, hỗ trợ Latin Extended và dấu tiếng Việt.
- Mã nghiệp vụ, số chứng từ và giá trị kỹ thuật dùng Roboto với chữ số tabular để giữ một hệ typography thống nhất.
- PDF nghỉ phép: nhúng IBM Plex Sans trực tiếp, không subset, để tránh mất dấu tiếng Việt và lỗi fontkit với tập glyph phức tạp.
- Bán kính nhỏ; không dùng bo góc lớn hoặc shadow mặc định cho mọi vùng.
- Màu xanh là accent cấu trúc và hành động chính, không phủ toàn màn hình.
- Màu trạng thái có nhãn chữ tiếng Việt; không truyền đạt bằng màu hoặc chấm màu đơn độc.
- Heading trang dùng một `h1`; phân cấp section bằng `h2`/`h3`, weight và spacing thay vì nhiều khối card.

## Mẫu màn hình

### Bản tin điều hành

`/dashboard` là bản tin ngoại lệ bất đối xứng: ưu tiên xử lý ở cột chính, công việc và diễn biến ở cột phụ. Chỉ số bằng 0 được lược bỏ; item ưu tiên đã xuất hiện ở Attention không lặp lại trong queue. Widget hành động nhanh bị bỏ khỏi preset mặc định và không còn render trong bản tin.

### Hàng đợi quyết định

Approval inbox giữ danh sách khi Realtime refetch, cho phép chọn hàng và xem bằng chứng trong inspector. Trang chi tiết đặt bối cảnh/timeline ở canvas và chỉ hiện vùng quyết định khi request còn chờ. Reassign, approve, reject và URL nghiệp vụ giữ nguyên.

### Bản ghi nghiệp vụ

Chứng từ kho dùng command bar, metadata và dòng hàng trong canvas; vòng đời, trạng thái, tải tệp, post/reverse nằm trong inspector. API payload, idempotency và state transition không đổi.

### Danh sách + inspector

Danh sách nhân viên giữ filter, pagination và permission. `?selected=<id>` mở preview trong inspector mà không rời hàng đợi; URL hồ sơ đầy đủ vẫn là đường dẫn chuẩn.

### Field flow

Chấm công ưu tiên hành động vào/ra, camera, preview và timeline hôm nay. Mobile đặt primary action gần đáy, dùng safe area; trạng thái phân biệt rõ “Máy chủ đã xác nhận” và “Đã lưu trên thiết bị”. IndexedDB queue và quy trình đồng bộ không đổi.

### Cấu hình

Điều hướng cấu hình là subnav ngang; label đã đổi sang tiếng Việt như “Bố cục bản tin”, “Phân hệ”, “Nhật ký hệ thống”. Mỗi setting/action/nav chỉ hiển thị nhãn, trạng thái hoặc dữ liệu cần thao tác, không có đoạn mô tả bên dưới.

## Responsive

- 320–430px: một cột, không tràn ngang; nút và input rộng theo viewport; action chính ở vùng thuận ngón cái.
- 768–1024px: inspector thu hẹp hoặc chuyển dưới canvas; bảng dùng chiến lược responsive sẵn có.
- 1366–1920px: mật độ desktop chuẩn, canvas và inspector cùng hiện khi hữu ích.
- Trên 1920px: giới hạn chiều dài đọc của từng vùng, nhưng dùng thêm chiều ngang cho nhiều queue/attention thay vì kéo một hàng quá dài.

## Trạng thái và Realtime

Shell hiển thị trạng thái có nhãn: đồng bộ tức thời, đang kết nối lại, gián đoạn hoặc ngoại tuyến. Realtime tiếp tục dùng coordinator và domain reconciliation, sau tín hiệu chỉ refetch API có authorization. UI không áp payload subscription trực tiếp vào state nghiệp vụ. Loading, empty, error, stale và offline giữ dữ liệu đang có khi có thể; không thay toàn bộ queue bằng spinner trong background refresh.

## Hai lượt tinh chỉnh Golden Screens

Lượt 1 tập trung hierarchy và density: tách rail/context, loại card grid, đưa ngoại lệ và primary action lên trước, thêm inspector có điều kiện.

Lượt 2 tập trung nhãn và responsive: Việt hóa trạng thái/ưu tiên, loại action chung chung, giảm lặp, bổ sung sticky mobile action, safe area, độ rộng tablet/ultrawide và typography mono cho mã nghiệp vụ.

## Bằng chứng và giới hạn QA

- Script `npm run ui:qa` kiểm tra trang đăng nhập tại 320, 360, 390, 430, 768, 1024, 1366, 1440, 1920 và 2560px; xác minh không tràn ngang, `lang=vi`, IBM Plex Sans và redirect của các route được bảo vệ.
- Ảnh chính xác được lưu tại `docs/ui-evidence/*-playwright.png` và được chụp lại bằng production server để không có dev overlay.
- Typecheck, lint, 146 test và production build là regression gate.
- Ba Golden Screen được kiểm tra tĩnh và qua test/build, nhưng chưa có bằng chứng browser authenticated ở đủ viewport vì workspace không cung cấp tài khoản staging. Không tạo, reset hoặc giả mạo tài khoản Supabase để vượt qua ranh giới này.
- Realtime đa tài khoản, RLS và reconnect hai phiên cần staging credentials/dataset và thuộc checklist UAT, không được tuyên bố đã đạt trong đợt này.

## Quy tắc tiếp tục mở rộng

1. Chọn archetype trước khi chọn component: queue, record, list + inspector, field flow hoặc configuration.
2. Chỉ thêm inspector nếu người dùng đang chọn một bản ghi hoặc ra quyết định.
3. Không dùng card làm container mặc định; dùng section, row, border và spacing.
4. Không hiển thị mô tả dưới từng chức năng, action, permission hoặc mục điều hướng.
5. Không đưa “Tạo mới” chung vào shell; action tạo mới phải thuộc module và permission cụ thể.
6. Mọi thay đổi Realtime phải đối chiếu `REALTIME_MATRIX.md` và tiếp tục refetch qua API có thẩm quyền.
7. Mọi thay đổi typography xuất file phải có fixture tiếng Việt gồm dấu ghép và ký tự Latin Extended.

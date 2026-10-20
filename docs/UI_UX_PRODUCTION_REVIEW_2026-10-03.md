# Thiết kế lại UI/UX và kiểm tra production — 03/10/2026

## Phạm vi

Đã triển khai trực tiếp vào mã nguồn và làm lại lớp hình thức theo mẫu HR dashboard được người dùng nhấn mạnh: nền xám ngọc trai với vùng hồng đào/tím nhạt, card bán trong suốt có viền trắng và bóng sáng–tối, sidebar trắng có thể thu gọn, header nổi trên nền, KPI nằm ngang có vòng màu và bố cục ưu tiên biểu đồ. Giữ thương hiệu Châu Tuấn; dữ liệu KPI/biểu đồ lấy từ read model hiện có theo quyền người dùng.

Giữ các thay đổi có sẵn trong working tree. Đợt thiết kế này không đổi API, schema, authentication, RBAC hoặc phép tính nghiệp vụ; không seed/reset database và chưa triển khai hosting. UI chỉ hiện nhãn, trạng thái và dữ liệu thao tác theo `AGENTS.md`.

## Thay đổi chính

- Chuẩn hóa token, độ sâu, typography, shell 56px và lớp giao diện dùng chung tại `src/styles/enterprise.css`. Hướng dẫn sở hữu CSS tại [UI design system](ui-design-system.md).
- Theo yêu cầu hiển thị tên chức năng, sidebar mặc định mở rộng 232px với nhãn cạnh icon. Nút `Thu gọn` ở cuối thanh thu lại thành rail icon 84px có tooltip và accessible name; nút `Mở rộng điều hướng` bật lại nhãn. Lựa chọn mới lưu theo tài khoản tại `ct:sidebar-layout:v2:<account-id>` và vẫn gửi vào API preference cũ; trạng thái của phiên bản rail cũ không ép người dùng tiếp tục dùng icon-only. Header trong suốt giữ các control tìm kiếm/chat/thông báo nổi; bỏ menu tạo mới toàn cục. Nút mở chat desktop nằm trong vùng footer rail, giữ hai lề trang bằng nhau và không che thao tác bảng.
- Mỗi trang làm việc có một tiêu đề chính hiển thị, kể cả trên điện thoại. Bỏ lời chào/eyebrow/mô tả lặp dưới chức năng.
- Dashboard có tối đa 5 KPI thực với vòng màu, giá trị trên và nhãn dưới. Tối đa hai biểu đồ nằm trước hàng việc cần xử lý/hoạt động: đường cong cho xu hướng thật, cột capsule cho so sánh, gauge bán nguyệt cho một phần trăm thật. Khi chỉ có gauge, biểu đồ đi kèm đếm toàn bộ tập công việc đã loại trùng theo nhóm thực. Không thêm lịch sử hoặc số liệu minh họa. Giữ bảng số liệu accessible, thêm xuất CSV có bảo vệ công thức spreadsheet. Ghi chú và việc cá nhân tiếp tục dùng API cũ, cùng chất liệu card mới.
- Nút tạo của bảng lương, mức lương, vật tư, kiểm kê, chứng từ kho, lô hàng, hợp đồng mua hàng và đối tác nằm trong header sở hữu chức năng, với điều kiện quyền cũ.
- Bảng rộng, hàng dễ đọc, phân cách ngang, trạng thái có chữ, menu thao tác không bị cắt bởi vùng cuộn. Bản ghi mobile dùng cột được đánh dấu danh tính chính.
- Select dùng popup thống nhất: tìm tiếng Việt không dấu cho danh sách dài, bàn phím, active option, disabled, rỗng, required, reset và FormData. Các feature không còn select/datalist native hiển thị.
- Bộ lọc mobile giữ giá trị khi đóng và gửi dữ liệu đúng form qua portal; reset đồng bộ URL và trường nhập.
- Modal/drawer/menu/select giữ focus và thứ tự Escape. Portal chờ client trước khi mở, sửa lỗi `document is not defined` khi truy cập trực tiếp đường dẫn có drawer.
- Mobile truy cập các module đã được cấp quyền, dùng cùng nguồn điều hướng; không ép mọi trang về Cá nhân. Giữ luồng chấm công/camera và phiếu lương cá nhân.
- Avatar hiện chữ viết tắt trong thời gian tải hoặc khi ảnh lỗi.

## Sidebar có nhãn

Theo yêu cầu tiếp theo, thanh trái mặc định hiện tên chức năng cạnh icon. Nút `Thu gọn` ở footer chuyển 232px→84px, nút `Mở rộng điều hướng` bật lại 232px. Lựa chọn compact/expanded được lưu theo tài khoản qua tải lại trang; API preference hiện có vẫn được dùng khi thao tác thật. Control có accessible name, `aria-expanded` và `aria-controls`; rail thu gọn giữ tooltip và tên truy cập của từng chức năng.

Khi sidebar mở rộng trên tablet, thanh tìm kiếm được giới hạn theo cột header để không chồng lên chat/thông báo/tài khoản. Việc cần xử lý và các card cá nhân chuyển một cột ở màn hình ≤1023px để nội dung dễ đọc.

Build sidebar cuối có `BUILD_ID=-dIcZ0XRVYYrrzJWiojp-`, chạy tại localhost:3200. ESLint tập trung, typecheck, 6 test layout hiện có và production build PASS. Reference QA chạy lại PASS 20 lượt ở 390/768/1366/1440/1920px qua 3 vai trò, kiểm tra nhãn/icon, header control không chồng nhau, dữ liệu và không tràn ngang. Scenario Giám sát 1440px PASS thu gọn→reload→mở rộng→reload, giữ nguyên link/tên truy cập; hai PUT preference được mock cục bộ, không đổi preference server thật. Evidence mới được ghi lúc `2026-10-03T08:52:24Z` tại `docs/ui-evidence/reference-match/`, gồm ảnh sidebar mở rộng và thu gọn.

Lượt QA đầu bị chặn bởi backend trả `PGRST303: JWT issued at future` khi đăng nhập. Luồng đăng nhập cục bộ hoạt động lại ở lần thử tiếp theo; không đổi khóa, cấu hình hoặc logic xác thực. Kết quả PASS trên thuộc lượt chạy sau khi đăng nhập phục hồi.

## Thanh ứng dụng và hiệu năng

Theo yêu cầu tiếp theo, `Ứng dụng của tôi` đã được chuyển lên đầu dashboard, trước tiêu đề và các KPI/biểu đồ. Desktop hiển thị thành một thanh ngang; tablet/mobile giữ lưới ứng dụng theo quyền hiện có.

Đã gom invalidation realtime trong cửa sổ 150ms, tránh tải trùng khi trang vừa mở, hoãn refresh khi tab bị ẩn và dùng chung BroadcastChannel theo tài khoản. Reconnect vẫn buộc đọc lại dữ liệu; các sự kiện thay đổi dữ liệu thật không bị giới hạn bởi cooldown focus. Các lượt đọc độc lập của chấm công/dự án chạy song song; phần phân giải tài khoản/nhân viên của dự án dùng một truy vấn, giữ nguyên phạm vi quyền và fallback. Dashboard giảm prefetch các bản ghi chưa được mở; rail và thanh ứng dụng tiếp tục prefetch. Font ưu tiên subset tiếng Việt phù hợp, giữ fallback các bảng chữ cái khác.

Đo production trước/sau bằng tài khoản Giám sát cho thấy API tải đầu giảm 10→8, request RSC 24→13 và byte response của font giảm khoảng 54%. Thời gian dashboard warm chỉ thay đổi 1,94→1,87 giây; chuyển trang chưa cải thiện đáng kể. Mẫu đầu sau khi khởi động server mới là 3,00 giây, chậm hơn mẫu đầu baseline 2,51 giây. Bản development cổng 3000 đo được 10,9–13,6 giây để dashboard sẵn sàng. Chi tiết phương pháp, bằng chứng và giới hạn tại [báo cáo hiệu năng](UI_PERFORMANCE_2026-10-03.md).

Lần cập nhật này đã chạy lại lint, typecheck, toàn bộ 356 unit tests, route audit, production build, 20 lượt reference QA và authenticated smoke. Reference QA bổ sung assertion thanh ứng dụng đứng đầu dashboard. Hai regression mới kiểm tra reconnect trong tab ẩn và reset pending theo tài khoản. Các bộ 12 interaction/83 release cùng architecture/screen audit dưới đây thuộc lần thiết kế trước; không xem đó là đo lại hiệu năng của lần cập nhật này.

Build của lần sửa regression reconnect có `BUILD_ID=tkPOEzb08QsUwgG9EjHpd`. Số đo hiệu năng được lưu trên build ngay trước sửa reconnect, như ghi rõ trong báo cáo hiệu năng. Thay đổi sidebar có nhãn được thực hiện tiếp theo; không xem bằng chứng hiệu năng/ảnh của lần trước là phép đo của sidebar mới.

## Kiểm tra mã nguồn

| Kiểm tra | Kết quả |
| --- | --- |
| ESLint | PASS, không lỗi/cảnh báo |
| TypeScript | PASS |
| Unit tests | PASS: 91 files, 356 tests |
| Production build | PASS: 274 routes được build/generate |
| Route audit | PASS: 183 authenticated routes |
| Architecture audit | PASS: 187 pages; 5 bảng chuyên dụng được allowlist |
| Screen audit | PASS: 183 screens, shared state/status contracts |
| Migration validator | PASS: 38 migrations có thứ tự; không áp dụng vào database |

## Kiểm tra trình duyệt

Sau lần làm lại hình thức theo mẫu HR, đã chạy lại bản build production, authenticated smoke, 20 lượt reference appearance, 12 lượt interaction và 83 lượt release trên localhost:3200; tất cả PASS. Lint, typecheck, 334 unit tests và ba UI audit cũng PASS trên mã nguồn của lần chỉnh này. UI Core và kiểm tra camera chuyên biệt dưới đây được thực hiện trong lần chuẩn hóa trước.

- Reference appearance QA: PASS 20 ảnh production tại 390/768/1366/1440/1920px: dashboard của Nhân viên/Giám sát/Kế toán QA và danh sách nhân viên của Giám sát. Assertion kiểm tra KPI/gauge khớp read model, canvas gradient, card có bóng/radius, sidebar mặc định 232px có nhãn và trạng thái thu/mở accessible, header control không chồng nhau, vật liệu roster dùng token chung, một h1, không tràn ngang, không select native hiển thị và không lỗi runtime/API. Đã xem trực tiếp ảnh desktop/tablet/mobile để đối chiếu vật liệu và tỷ lệ với mẫu. Bộ kiểm tra chỉ đọc dữ liệu nghiệp vụ và mock lưu sidebar preference trong scenario tương tác.
- UI Core: PASS tại 360/390/430/1366/1440/1920px và reduced motion.
- Mobile cá nhân/phiếu lương: PASS tại 320/360/390/430px; camera chấm công ở 390px không che thao tác.
- Authenticated smoke: PASS cho Nhân viên/Giám sát, API đọc, negative permissions, trạng thái sidebar được khôi phục và chat launcher không che thao tác.
- Interaction QA: PASS 12 lượt tại 320/390/430/1440px cho lọc nhân viên, giữ giá trị khi đóng, Apply, empty/reset, menu bằng bàn phím, giới hạn portal, drawer báo vướng mở bằng deep link và Escape từng lớp. Header mobile không chồng nút; launcher ứng dụng mở được trên trang con. Tài khoản payroll QA có quyền xem nhưng không có `payroll.create`; UI giữ ẩn nút tạo và API nhân viên giữ trả 403.
- Production release QA: PASS 83 lượt trang theo vai trò tại 390/768/1366/1440/1920px, cùng kiểm tra phục hồi login.

Release QA kiểm tra các tổ hợp sau ở 390/768/1366/1440/1920px, thêm Cá nhân khi login trên điện thoại:

| Vai trò QA | Trang |
| --- | --- |
| Nhân viên | Dashboard, lịch sử công, nghỉ phép, tạo đơn nghỉ, hồ sơ |
| Giám sát | Dashboard, danh sách nhân viên, lịch sử nhân viên, danh sách gói, tiến độ, nhân sự/chấm công, tài liệu, điểm danh |
| Kế toán QA | Dashboard, bảng lương, phiếu lương |

Các assertion gồm tiêu đề chính, không tràn ngang, shell trong viewport, bảng và bộ lọc hiển thị, trạng thái dữ liệu, điều hướng đang chọn, touch target, lỗi runtime/API. Liveness/readiness/login trả 200, security headers có DENY/nosniff, CSP không có unsafe-eval. Các đường dẫn preview trả 404 ở production. Login phục hồi sau response HTML 503, giữ thông tin nhập và focus lỗi. Sau lượt release QA, kiểm tra launcher phát hiện CSS cũ ẩn actions trên trang con mobile; đã sửa và bổ sung kiểm tra header/launcher trong interaction QA.

Ảnh đối chiếu mẫu mới và kết quả assertion nằm tại `docs/ui-evidence/reference-match/` cùng `appearance-evidence.json` (base URL production localhost:3200). Ảnh kiểm tra nghiệp vụ nằm tại `docs/ui-evidence/production-ui/`; `docs/ui-evidence/erp-redesign/` là ảnh của lần chỉnh trước. Đây là bằng chứng UI theo tài khoản QA, không thay cho UAT toàn bộ nghiệp vụ hoặc kiểm thử mọi quyền admin/kho/xuất nhập khẩu trên dữ liệu thật.

## Chạy lại

```powershell
npm run lint
npm run typecheck
npm test
npm run ui:audit
npm run ui:architecture-audit
npm run ui:screen-audit
npm run build
npm run start -- --port 3200
```

Trong terminal khác, đặt `UI_QA_BASE_URL=http://localhost:3200` và `SEED_TEST_PASSWORD` qua môi trường rồi chạy `npm run ui:reference-qa`, `npm run ui:release-qa` và `npm run ui:interaction-qa`. Dùng database QA có các tài khoản test.employee/test.supervisor/test.payroll. Các bộ QA không gửi thao tác ghi nghiệp vụ; authenticated smoke có kiểm tra preference rồi khôi phục.

`ui:core-qa` dùng server development vì preview bị ẩn trong production. Không chạy build ghi vào cùng `.next` khi server production QA còn hoạt động.

## Điều kiện sử dụng chính thức

Bản production đã được kiểm tra tại localhost:3200. Hosting/staging, backup/restore, đối soát dữ liệu, UAT camera/GPS/offline thực địa, quyền người dùng thật và đầu mối vận hành vẫn cần bằng chứng theo [production readiness](operations/production-readiness.md) và [go-live blockers](go-live/blockers.md).

Build trong sandbox có log `system_settings.read_failed` do môi trường chặn kết nối backend; build thành công với fallback. Server QA được chạy ngoài sandbox với cấu hình hiện có và readiness trả 200. Cần xác minh cấu hình/kết nối tương ứng tại môi trường triển khai chính thức.

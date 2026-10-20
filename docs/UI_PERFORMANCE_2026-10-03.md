# Kiểm tra hiệu năng UI — 03/10/2026

Các thay đổi giảm lượng tải font và số request nền trên dashboard. Số đo hiện có chưa chứng minh tốc độ mở trang hoặc chuyển module tăng đáng kể. Lần mở đầu tiên sau khi khởi động bản production mới còn chậm hơn baseline; thời gian chờ dữ liệu phía server vẫn là phần đáng chú ý.

## Phương pháp và giới hạn

Đo bằng Edge headless, Playwright, viewport desktop 1440 × 900, ba tài khoản QA `test.supervisor`, `test.employee`, `test.payroll`. Mỗi tài khoản mở trực tiếp `/dashboard` hai lần. Supervisor được đo thêm thao tác bấm sidebar sang `/employees`, quay lại dashboard, idle 5 giây, một nhóm 6 sự kiện focus và cuộn mobile 390 × 844 trong 60 frame.

Script đăng nhập rồi chặn các request cùng origin có phương thức ngoài GET/HEAD/OPTIONS; không tạo hoặc sửa dữ liệu nghiệp vụ. Khi kiểm tra development, chỉ endpoint đọc stack frame của Next dev được miễn chặn. Không chạy các bộ browser QA khác đồng thời với lượt đo sau thay đổi.

Baseline production được đo trên server đã chạy trước đó. Lượt đo sau thay đổi bắt đầu ngay sau khi khởi động server production mới. Trong báo cáo này, **warm** chỉ lần mở thứ hai trên runtime/server đang chạy: cơ chế `page.route` dùng để chặn ghi dữ liệu tắt HTTP cache của Playwright, nên đây không phải phép đo browser HTTP cache đã nóng.

Evidence baseline hoàn tất lúc `2026-10-03T07:46:41.380Z`; evidence sau thay đổi lúc `2026-10-03T07:55:00.674Z`. Bản production dùng để đo sau thay đổi có `BUILD_ID=Tqcxo7cjY6s6rFhiCo3Pc`. Các số dưới đây thuộc bản build này, không tự động áp dụng cho những bản build tiếp theo.

`headersMs` là thời gian từ khi script bắt đầu điều hướng đến khi Playwright nhận response ở trạng thái `commit`. `navigation.ttfbMs` lấy từ Navigation Timing: `responseStart - requestStart`. `readyMs` kết thúc khi metric dashboard hoặc hàng dữ liệu nhân viên hiện ra và loading state đã hết; không đồng nghĩa mọi request nền đã hoàn tất.

Baseline supervisor cuối cùng và toàn bộ lượt đo sau thay đổi đếm request ngay khi bắt đầu, rồi bổ sung status, thời gian và kích thước khi có response. Baseline employee/payroll và development trước đó chỉ ghi request hoàn tất; không dùng tổng request/RSC của các lượt này để kết luận tăng hoặc giảm. Chỉ có hai mẫu điều hướng trực tiếp mỗi vai trò, chưa đủ cho kết luận thống kê hoặc SLA.

## Thời gian quan sát được

| Phép đo supervisor | Trước | Sau |
| --- | ---: | ---: |
| Lần mở đầu: nhận headers | 550 ms | 1.438 ms |
| Lần mở đầu: metric hiện ra | 2.512 ms | 2.995 ms |
| Lần mở thứ hai, warm: nhận headers | 458 ms | 440 ms |
| Lần mở thứ hai, warm: Navigation TTFB | 416 ms | 392 ms |
| Lần mở thứ hai, warm: metric hiện ra | 1.941 ms | 1.873 ms |
| Bấm sidebar: loader đầu tiên | 33 ms | 38 ms |
| Bấm sidebar: dữ liệu nhân viên hiện ra, tính từ click | 1.413 ms | 1.432 ms |
| Browser back: dữ liệu dashboard hiện ra | 79 ms | 76 ms |

Lần mở đầu sau thay đổi tăng khoảng 483 ms ở mốc dữ liệu hiện ra. Hai server có trạng thái khởi động khác nhau, nên không xem chênh lệch này là phép so sánh cold start đồng điều kiện. Mẫu warm giảm khoảng 67 ms; chuyển sang nhân viên gần như giữ nguyên. Chưa có cơ sở khẳng định hệ thống nhanh lên đáng kể.

Trong production, employee mở dashboard mất khoảng 1.465–1.526 ms trước và 1.362–1.448 ms sau; payroll mất khoảng 1.315–1.525 ms trước và 1.413–1.421 ms sau. Không ghi nhận JavaScript long task trong các mẫu production.

Trên server development `localhost:3000`, supervisor chờ headers khoảng 8,85–11,72 giây và metric khoảng 10,89–13,64 giây; có 1–2 long task. Đây là trạng thái runtime development quan sát tại thời điểm đo, bao gồm công việc của Next dev, không phải cam kết thời gian cho mọi lần chạy. Thời gian này khác rõ production; cần xác định đang dùng `next dev` hay `next start` khi kiểm tra cảm giác chậm.

## Request và font

Các số sau lấy từ pha mở dashboard lần thứ hai của supervisor, cùng phương pháp đếm request bắt đầu:

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| Tổng request bắt đầu | 68 | 52 |
| Request API | 10 | 8 |
| Request RSC, có query `_rsc` | 24 | 13 |
| `/api/v1/system-notices/active` | 2 | 1 |
| `/api/v1/notifications/unread-count` | 2 | 1 |
| Số response font | 9 | 6 |
| Tổng `bytes` của response font | 202.917 byte | 92.945 byte |

Font giảm 109.972 byte, khoảng 54,2%. **Trường `bytes` trong script là `request.sizes().responseBodySize + responseHeadersSize`**: body response đã mã hóa cộng HTTP response headers. Đây không phải chỉ `encodedBodySize` hay kích thước file font đã giải mã. Ba font Latin Extended không còn tải trong các màn tiếng Việt được đo; các charset vẫn có trong CSS.

Nhóm 6 focus events tạo 3 GET ở cả hai bản: dashboard, thông báo hệ thống và số thông báo chưa đọc. Lượt đổi tab/focus diễn ra ngay sau nhóm này không tạo thêm request; idle 5 giây không phát sinh request. Số đo xác nhận hành vi không tải lặp trong nhóm sự kiện này, không chứng minh giảm thêm so với baseline vốn đã giới hạn lifecycle events. Các response streaming chưa hoàn tất có thể có `bytes = 0`; không dùng tổng byte của toàn bộ request làm số tải xuống tuyệt đối.

## Phạm vi thay đổi đã kiểm tra

- Realtime gom các invalidation trong cửa sổ 150 ms; giữ pending khi tab ẩn; chỉ xử lý `pageshow` khi khôi phục từ bfcache. Reconnect bỏ qua giới hạn lifecycle 3 giây; reconciliation dữ liệu vẫn qua cửa sổ gom 150 ms.
- Chấm công tải identity và policy song song. Dự án đọc account ID/employee ID cùng một truy vấn và chạy các nhánh đọc danh sách độc lập song song; giữ phạm vi phân công, quyền truy cập và fallback hiện có.
- CSS font đặt subset Vietnamese sau các khai báo Inter tương ứng để tránh tải Latin Extended cho các ký tự tiếng Việt trùng phạm vi.
- Tắt prefetch cho link metric, việc cần xử lý và hoạt động dashboard. Sidebar và launcher ứng dụng giữ prefetch để hỗ trợ thao tác chuyển module.
- Launcher ứng dụng chuyển lên đầu dashboard, dùng thanh gọn để truy cập module sớm. Loading skeleton hiện có được giữ lại; không tính việc thêm loading route là một thay đổi của đợt này.

Sau lượt đo, kiểm tra mã nguồn phát hiện thêm trường hợp reconnect xảy ra khi tab đang ẩn và resume trong vòng 3 giây sau focus. Luồng này được sửa và kiểm tra bằng regression unit: focus → ẩn tab → offline → online → hiện tab trong 1 giây không tải khi ẩn, rồi phát đúng một reconciliation reconnect khi hiện lại; focus/resume đồng thời không tải lặp, đổi tài khoản xóa pending reconnect. Bộ realtime 24 test trên 3 file, ESLint tập trung và TypeScript đạt sau sửa. Không đo lại browser timing cho thay đổi coordinator riêng này. Bản build cuối có sửa phục hồi này cần được phân biệt với `BUILD_ID` của lượt đo hiệu năng nêu trên.

## Cuộn mobile

Mẫu cuộn headless 60 frame có median 16,7 ms ở cả hai bản, p95 khoảng 17,3 ms trước và 17,0 ms sau; không có frame vượt 34 ms. Quãng cuộn thay đổi theo chiều cao nội dung, từ 1.926 px thành 1.965 px.

Các mẫu này không cho thấy stall trong môi trường kiểm tra, nhưng không xác định được hiệu năng GPU, cuộn bằng tay hoặc tình trạng lag trên điện thoại thật. Chưa đo thiết bị vật lý; không kết luận đã sửa lag cuộn dựa trên kết quả headless.

## Chạy lại

Khởi động bản production đã build riêng trước khi đo. Dùng cùng máy, tài khoản QA, viewport và điều kiện mạng; dừng các bộ browser QA khác để giảm nhiễu.

```powershell
$env:UI_QA_BASE_URL = 'http://localhost:3200'
$env:UI_PERFORMANCE_LABEL = 'before'
npm run ui:performance-qa

# Sau khi build và khởi động bản cần đối chiếu:
$env:UI_PERFORMANCE_LABEL = 'after'
npm run ui:performance-qa
```

`UI_QA_BASE_URL` chọn server cần đo; `UI_PERFORMANCE_LABEL` nhận `before` hoặc `after`. Các lệnh ghi đè file tương ứng. Có thể cung cấp `SEED_TEST_PASSWORD` cho tài khoản QA của môi trường; không ghi mật khẩu vào báo cáo.

Đo development riêng bằng `UI_QA_BASE_URL=http://localhost:3000`, `UI_PERFORMANCE_ENV=development`, `UI_PERFORMANCE_ROLES=test.supervisor`; output có hậu tố `-dev`. Không trộn số request của baseline development cũ với bộ đếm production cuối cùng.

Nguồn kiểm tra: [baseline production](ui-evidence/performance/before.json), [sau thay đổi](ui-evidence/performance/after.json), [baseline development](ui-evidence/performance/before-dev.json) và [script đo](../scripts/ui-performance-qa.mjs).

# Dashboard tổng hệ thống và Search/Command Center

## Dashboard

Các route theo context gồm `/home`, `/dashboard`, `/dashboard/hr`, `/dashboard/warehouse`, `/dashboard/import-export` và `/dashboard/management`. Profile được chọn từ tập permission hiện có, không dựa vào tên role. Khi profile được yêu cầu không còn phù hợp, backend tự chọn profile được phép hoặc landing page khả dụng đầu tiên.

Widget registry khai báo cố định `key`, nhãn, permission bắt buộc và profile được phép. Các widget gồm công việc cá nhân, việc chờ duyệt, ngoại lệ bảng công, dự án cần chú ý, tồn kho, lô hàng, hoạt động gần đây, thông báo và quick action. Admin có thể bật/tắt và sắp xếp các widget đã đăng ký; permission backend vẫn là nguồn quyết định cuối cùng.

`GET /api/v1/dashboard` tổng hợp dữ liệu bằng các repository đã có scope bảo mật của từng domain. Các truy vấn widget chạy song song bằng `Promise.allSettled`; lỗi một nguồn chỉ đưa widget đó sang trạng thái lỗi và có thể thử lại riêng. UI dùng skeleton theo widget, không tạo KPI hoặc biểu đồ giả.

Nguồn dữ liệu chính:

- Cá nhân/giám sát: attendance cá nhân và phiên điểm danh công nhân.
- HR: employee, leave, timesheet exception và kỳ bảng công.
- Management: project monitoring, issue, approval trung tâm và activity projection.
- Kho/XNK: dashboard/repository của Warehouse và Import Export.
- Thông báo: Notification Center; phê duyệt: Approval Center.

Attention Center chuẩn hóa mức ưu tiên về `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, ưu tiên critical/high, quá hạn và tuổi sự việc. Các mục trùng deep link được gộp, giữ liên kết về màn hình nghiệp vụ thực.

## Global Search

`GET /api/v1/search?q=...&types=...&cursor=...&limit=...` điều phối provider cho employee, project/worksite, item/chứng từ kho, shipment/hợp đồng nhập khẩu, đơn nghỉ, kỳ bảng công và tài liệu. Backend chỉ gọi provider khi user có permission; mỗi provider tiếp tục áp project scope, warehouse scope hoặc domain scope trước khi trả dữ liệu.

Search chỉ dùng metadata cần thiết. CCCD, tài khoản ngân hàng, địa chỉ nhà và nội dung tài liệu riêng tư không được truy vấn hoặc trả về. Số điện thoại nhân viên chỉ tham gia tìm kiếm khi có permission nhạy cảm và không hiển thị trong kết quả.

Ranking deterministic, bỏ dấu khi so khớp, ưu tiên mã/reference khớp chính xác, prefix, tên/tiêu đề, chuỗi chứa và entity vừa truy cập. Mỗi provider có timeout 1,5 giây; một provider lỗi hoặc chậm không chặn kết quả còn lại. Migration bổ sung functional prefix indexes cho các trường metadata được tìm kiếm.

Search Center ở `/search` giữ query, tab và cursor trên URL, có lọc theo nhóm, phân trang, recent items và trạng thái không có kết quả. Request cũ bị hủy bằng `AbortController`.

Recent entity được upsert theo user/entity. Khi đọc, backend kiểm tra lại permission, scope và sự tồn tại của entity nên item đã xóa hoặc user bị thu hồi quyền sẽ không còn xuất hiện.

## Command Palette

Palette mở bằng nút ở header, `Ctrl/Cmd+K`, hoặc phím `/` khi focus không nằm trong ô nhập liệu. Hỗ trợ focus trap, phím mũi tên, Enter và Escape; trên mobile chuyển thành giao diện tìm kiếm toàn màn hình.

Command registry chỉ cho phép `NAVIGATE`, `CREATE_ROUTE` và `OPEN_SEARCH`, có lọc permission. Không có lệnh POST, approve, reverse hoặc delete trực tiếp. Kết quả entity luôn deep link về route nghiệp vụ.

## Cấu hình admin

Route `/system-admin/dashboard` quản lý preset Employee, Supervisor, HR, Warehouse, Import Export và Management; cho phép chọn landing page, bật/tắt và sắp thứ tự widget trong giới hạn registry. Cấu hình navigation cũ được tự nâng cấp khi có route mới, vẫn giữ thứ tự và mục ẩn hợp lệ đã lưu.

## Hiệu năng và cache

Dashboard dùng aggregate endpoint và truy vấn song song, chỉ đọc trường/count cần cho widget. Response hiện đặt `no-store` để attendance, approval và notification luôn mới. Search giới hạn số kết quả, có pagination, hủy request cũ và timeout từng provider. V1 dùng DB query với index metadata, chưa cần external search engine hoặc AI ranking.

## Kiểm thử

Test tự động bao phủ registry/profile permission, landing fallback, attention sort/dedup, widget failure isolation, exact match/ranking, permission-filtered provider orchestration, provider partial failure, schema preset/widget và nâng cấp navigation settings. Bộ kiểm tra hoàn tất với lint, typecheck, unit test và production build.

## Giới hạn hiện tại

- Cần chạy migration `202609140001_dashboard_search_center.sql` trước khi dùng dashboard settings và recent items trên môi trường đã triển khai.
- V1 chưa có fuzzy typo search chuyên sâu, full-text nội dung tài liệu, search analytics hoặc user-pinned shortcut.
- Summary chưa dùng cache chia theo widget; ưu tiên dữ liệu vận hành mới và tính đúng permission ở giai đoạn này.

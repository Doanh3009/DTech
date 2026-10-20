# Giao diện chung, Nhân sự và gửi phiếu lương — 19/10/2026

## Thiết kế chung

- Token chung: control 12px, card 18px, overlay 22px; giữ màu hiện tại.
- Thanh tìm kiếm/lọc desktop cao 36px, chữ 13px; ô tìm kiếm 280px, bộ lọc 184px, xuống hàng khi thiếu chỗ.
- Điện thoại và thiết bị chạm giữ control 44px, input 16px; nút cùng nhóm có chiều cao bằng nhau.
- `src/styles/ui-dna.css` nạp cuối; `FilterBar`, `SearchInput`, `data-ui="filter-controls"` và `data-ui="actions"` là hợp đồng chung.
- Áp dụng vào lương/phiếu lương/hồ sơ lương, chấm công, bảng công, phép, BHXH, kho, điểm danh, tài liệu và nhật ký. Thanh cấu hình có bo góc, liên kết theo quyền.
- Giao diện không thêm các đoạn mô tả nghiệp vụ dưới chức năng hoặc nút.

## Nhân sự và duyệt nghỉ

- Nguyên nhân 403: menu chấp nhận `leave.approve`, API inbox chỉ chấp nhận quyền phê duyệt chung. Catalog quyền được dùng chung cho điều hướng, route và repository.
- Nhân sự có quyền duyệt nghỉ xem và quyết định đơn LEAVE ở bước hiện tại được giao; không được duyệt thay người khác hoặc các nghiệp vụ kho/XNK.
- Server trả `availableActions` để giao diện chỉ hiện nút được phép.
- Cấu hình chấm công thuộc ứng dụng Nhân sự. Các liên kết cấu hình quản trị kiểm tra quyền tương ứng.
- TEST: thu hồi đúng `account.assign_role`, `role.view`, `permission.view`, `audit.view` của role `hr`. Giữ quyền tạo/xem/khóa tài khoản phục vụ vòng đời nhân viên.
- Không đổi người duyệt của các đơn cũ. Inbox rỗng nếu không có đơn ở bước đang giao cho tài khoản đó.
- Repair: [SQL](../scripts/testing/repairs/20261019_hr_role_access.sql), [biên nhận](operations/hr-role-access-repair-20261019.json).

## Gói và công trường

- `Tạo gói` ở đầu danh sách, có guard server `project.create` tại `/projects/new`.
- Trong gói: hiển thị mã gói, nhãn Công trường; bộ chọn chỉ hiện khi có nhiều công trường, `Toàn bộ gói` xem dữ liệu tất cả địa điểm thuộc gói đó.
- `Thêm công trường` ở đầu gói, cần `worksite.manage`; gói đã đóng không có thao tác thêm.
- Người có quyền xem gói vào được Thông tin; quyền tài liệu kiểm tra riêng. Không mở rộng quyền tạo cho Nhân sự hoặc tài khoản chỉ xem.
- TEST: `admin.test` có quyền tạo; `hr.test` và `manager.test` hiện không có `project.create`/`worksite.manage`. Không tự cấp thêm.
- Shell, đầu gói, tab và nội dung dùng cùng bo góc; bỏ khung trắng lồng và góc vuông.

## Lương và người nhận phiếu

1. Nhân sự chốt bảng công, hệ thống cập nhật kỳ lương.
2. Kế toán rà soát/chỉnh sửa, duyệt lương và xuất Excel.
3. `Gửi phiếu lương` mở bộ chọn tài khoản hoặc tất cả nhân viên; xem người nhận và số tiền trước khi gửi.

- Dùng `PayslipSendDrawer` chung từ danh sách kỳ lương, chi tiết bảng lương và chi tiết nhân viên. Kỳ đã duyệt mở phần gửi ngay từ danh sách.
- API detail trả tài khoản hoạt động gắn với chính nhân viên: id, username, displayName, chỉ khi có `payslip.publish`.
- Không chọn tài khoản không thuộc nhân viên; không gửi nhầm sang tài khoản của đồng nghiệp. Tài khoản nhận thực tế do giao dịch DB xác định lại từ liên kết nhân viên đang hoạt động.
- Trạng thái phát hành tách với biên nhận: Đã phát hành, Chờ gửi, Gửi lỗi, Đã gửi, Đã xem, Đã xác nhận.
- Không tự gửi lại phiếu đã giao thành công. Gửi lại dùng outbox có sẵn, không tạo phiên bản phiếu mới.
- Nếu còn nhân viên thiếu tài khoản, gửi tất cả bị chặn; chọn cá nhân có tài khoản để gửi riêng. Hiển thị nhân viên thiếu tài khoản trong danh sách.
- Kênh nhận là thông báo và tin nhắn nội bộ, không phải email. Bộ chọn tải lại dữ liệu khi mở, chặn bấm lặp và đóng trong lúc gửi; khi mất phản hồi phải đọc lại tình trạng trước khi thao tác tiếp.
- Không có migration mới; giữ 54 migration TEST. Không gửi phiếu thật trong lượt triển khai này.

## Kiểm tra và giới hạn

- TypeScript và ESLint phạm vi thay đổi đạt. Build và kiểm tra HTTP của bản deploy ghi trong biên nhận triển khai.
- Rà soát source cho quyền, liên kết nhân viên/tài khoản, chống gửi lặp, bo góc, cascade CSS và responsive.
- Không chạy bộ test tự động hoặc browser trong lượt này; chưa xác nhận trực quan từng trang trên điện thoại thật.
- Không ghi đơn nghỉ, bảng lương, tin nhắn hoặc phiếu kho thử. Không thay production.

# Phân quyền Nhân sự và lỗi tải dữ liệu — 05/10/2026

## Phạm vi truy cập

- Quyền `timesheet.view` cũ và `timesheet.self.view` chỉ phục vụ bảng công cá nhân; chúng không mở ứng dụng Nhân sự, menu Kỳ công/Bảng công quản trị hoặc các route quản trị.
- Nhân viên vẫn dùng Chấm công, Lịch công của tôi, đơn cá nhân và phiếu lương cá nhân. Vị trí công việc hoặc phòng ban Nhân sự không tự cấp quyền HR.
- Hồ sơ nhân viên, hợp đồng, bảo hiểm và các dữ liệu quản trị được kiểm tra bằng quyền riêng tại API. Route Nhân sự, Kỳ công, Chấm công hôm nay và Nhật ký công cũng có kiểm tra truy cập phía server.

## Dữ liệu vai trò đang lưu

Audit Supabase read-only xác nhận role `employee` không có quyền đọc hồ sơ nhân sự. Lỗi hiển thị ứng dụng HR cho nhân viên bắt nguồn từ `timesheet.view` nằm trong điều kiện mở ứng dụng và đã sửa trong code.

Role `supervisor` trên cơ sở dữ liệu hiện vẫn được gán quyền `employee.view` cũ. Migration `supabase/migrations/202610050001_separate_employee_self_service_from_hr.sql` chuẩn hóa vai trò giám sát về phạm vi dự án và giữ bảng công cá nhân. Migration này **chưa chạy trên Supabase đang kết nối**; quyền cũ của giám sát ở cơ sở dữ liệu giữ nguyên cho tới khi triển khai migration. Smoke test theo chính sách mới cho giám sát cần cơ sở dữ liệu đã chạy migration.

Có một tài khoản không có role, nhưng tài khoản này không hoạt động và không liên kết hồ sơ nhân viên. Không thay đổi dữ liệu tài khoản này. Không có tài khoản test HR/admin sẵn có nên audit GET trực tiếp mock phiên admin và đọc qua service client; đây không phải kiểm thử đăng nhập admin hoặc RLS với JWT nhân viên.

## Lỗi truy vấn đã sửa

GET `/api/v1/hr/contracts` từng trả 500 với lỗi PostgREST `PGRST201`: bảng `employees` và `departments` có cả quan hệ phòng ban của nhân viên và quan hệ trưởng phòng. Truy vấn đã chỉ rõ `departments!employees_department_id_fkey` tại danh sách hợp đồng, chọn nhân viên cho hợp đồng, hồ sơ tạo hợp đồng Word và tìm kiếm nhân viên.

Dashboard xuất nhập khẩu tải danh sách và cấu hình cùng lúc, rồi đọc chi tiết từng nhóm tối đa bốn lô hàng cùng lúc. Thứ tự cảnh báo và phạm vi quyền truy cập được giữ nguyên.

## Kiểm tra

- Test phân quyền API xác nhận nhân viên bị trả 403 trước khi đọc hoặc tạo hồ sơ; người chưa đăng nhập nhận 401; tài khoản HR hoạt động có quyền đọc được dữ liệu; tài khoản bị khóa bị từ chối.
- Test điều hướng và route xác nhận quyền bảng công cá nhân không mở chức năng quản trị HR.
- Regression test hợp đồng mô phỏng thêm quan hệ trưởng phòng và xác nhận vẫn đọc đúng phòng ban của nhân viên.
- `node scripts/run-live-read-audit.mjs` chạy các GET API bằng dữ liệu Supabase thật. Có thể truyền các path API cần kiểm tra sau tên script. Kết quả trạng thái và thời gian nằm trong `docs/live-read-audit-2026-10-05.json`, không chứa bản ghi nhân sự hoặc thông tin đăng nhập.

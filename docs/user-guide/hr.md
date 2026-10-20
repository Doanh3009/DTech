# Hướng dẫn HR — release 0.1.0

Tạo/cập nhật employee theo mã duy nhất; sensitive profile chỉ dùng khi có quyền. Provision account bằng invite, gán role tối thiểu và disable ngay khi offboard. Xử lý attendance exception/leave approval/timesheet adjustment bằng action nghiệp vụ, không sửa DB. Trước khóa kỳ, đối chiếu attendance + leave + calendar; sau export kiểm tra Excel và số tổng.

Trước go-live HR ký employee count, leave opening balance, approver resolution và danh sách người có sensitive export.

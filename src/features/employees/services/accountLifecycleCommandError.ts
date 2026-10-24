import { AppError } from "@/lib/api/errors";

export function accountLifecycleCommandError(error: { message?: string; code?: string }): AppError {
  switch (error.message) {
    case "LAST_ACTIVE_ADMIN": return new AppError("CONFLICT", "Cần giữ ít nhất một quản trị viên hoạt động.");
    case "ACCOUNT_EMPLOYEE_INACTIVE": return new AppError("CONFLICT", "Không thể kích hoạt tài khoản của nhân sự đã nghỉ việc hoặc lưu trữ.");
    case "ACCOUNT_ACTOR_FORBIDDEN": return new AppError("PERMISSION_DENIED");
    case "ACCOUNT_NOT_FOUND": return new AppError("NOT_FOUND", "Không tìm thấy tài khoản.");
    case "EMPLOYEE_NOT_FOUND": return new AppError("NOT_FOUND", "Không tìm thấy nhân sự.");
    case "ACCOUNT_OPERATION_NOT_FOUND": return new AppError("NOT_FOUND", "Không tìm thấy yêu cầu xử lý tài khoản.");
    case "ACCOUNT_OPERATION_CONFLICT": return new AppError("CONFLICT", "Yêu cầu đã được dùng với dữ liệu khác. Kiểm tra yêu cầu đang xử lý.");
    case "ACCOUNT_OPERATION_PENDING": return new AppError("CONFLICT", "Có yêu cầu tài khoản đang xử lý. Tiếp tục yêu cầu đó trong trang Người dùng.");
    case "ACCOUNT_IDENTITY_EXISTS":
    case "EMPLOYEE_ACCOUNT_EXISTS": return new AppError("CONFLICT", "Nhân sự hoặc tên đăng nhập đã có tài khoản.");
    case "ACCOUNT_DELETED": return new AppError("CONFLICT", "Tài khoản đã bị thu hồi. Vui lòng tải lại.");
    case "ACCOUNT_SELF_DELETE": return new AppError("CONFLICT", "Không thể xóa tài khoản đang đăng nhập.");
    case "ACCOUNT_AUTH_IDENTITY_MISMATCH": return new AppError("CONFLICT", "Danh tính đăng nhập chưa khớp với yêu cầu. Kiểm tra yêu cầu đang xử lý.");
    case "ACCOUNT_AUTH_CLEANUP_REQUIRED": return new AppError("CONFLICT", "Yêu cầu đang thu hồi danh tính đăng nhập. Tiếp tục xử lý trong trang Người dùng.");
    case "ACCOUNT_INVALID_INPUT": return new AppError("VALIDATION_ERROR", "Thông tin yêu cầu tài khoản không hợp lệ.");
    case "INVALID_STATUS": return new AppError("VALIDATION_ERROR", "Trạng thái tài khoản không hợp lệ.");
    case "ROLE_REQUIRED": return new AppError("VALIDATION_ERROR", "Cần chọn ít nhất một vai trò.");
    case "ROLE_NOT_FOUND": return new AppError("VALIDATION_ERROR", "Vai trò đã thay đổi. Vui lòng tải lại trang.");
    default: return new AppError("NETWORK_ERROR", "Chưa thể xác nhận thay đổi tài khoản. Vui lòng tải lại để kiểm tra.");
  }
}

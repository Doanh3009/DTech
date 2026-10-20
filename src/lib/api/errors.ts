import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export type AppErrorCode =
  | "VALIDATION_ERROR" | "AUTHENTICATION_REQUIRED" | "PERMISSION_DENIED" | "NOT_FOUND"
  | "CONFLICT" | "DUPLICATE" | "LOCATION_UNAVAILABLE" | "LOCATION_OUTSIDE_GEOFENCE"
  | "LOCATION_ACCURACY_LOW" | "PHOTO_UPLOAD" | "SESSION_EXPIRED" | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED" | "ACCOUNT_NOT_PROVISIONED" | "RATE_LIMITED" | "NETWORK_ERROR" | "SERVER_ERROR";

const statusByCode: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400, AUTHENTICATION_REQUIRED: 401, PERMISSION_DENIED: 403, NOT_FOUND: 404,
  CONFLICT: 409, DUPLICATE: 409, LOCATION_UNAVAILABLE: 422, LOCATION_OUTSIDE_GEOFENCE: 422,
  LOCATION_ACCURACY_LOW: 422, PHOTO_UPLOAD: 422, SESSION_EXPIRED: 401, INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403, ACCOUNT_NOT_PROVISIONED: 403, RATE_LIMITED: 429, NETWORK_ERROR: 503, SERVER_ERROR: 500
};

const defaultMessageByCode: Record<AppErrorCode, string> = {
  VALIDATION_ERROR: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
  AUTHENTICATION_REQUIRED: "Bạn cần đăng nhập để tiếp tục.",
  PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  CONFLICT: "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
  DUPLICATE: "Dữ liệu tương ứng đã tồn tại.",
  LOCATION_UNAVAILABLE: "Không thể xác định vị trí. Hãy bật quyền vị trí và thử lại.",
  LOCATION_OUTSIDE_GEOFENCE: "Bạn đang ở ngoài phạm vi chấm công cho phép.",
  LOCATION_ACCURACY_LOW: "Vị trí chưa đủ chính xác. Hãy đứng ở khu vực thoáng và thử lại.",
  PHOTO_UPLOAD: "Ảnh chưa thể đồng bộ. Dữ liệu vẫn được giữ trên thiết bị.",
  SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  ACCOUNT_DISABLED: "Tài khoản chưa hoạt động hoặc đã bị khóa.",
  ACCOUNT_NOT_PROVISIONED: "Tài khoản chưa được cấp quyền sử dụng hệ thống.",
  RATE_LIMITED: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
  NETWORK_ERROR: "Kết nối mạng không ổn định. Vui lòng thử lại.",
  SERVER_ERROR: "Hệ thống đang gặp lỗi. Vui lòng thử lại sau."
};

export class AppError extends Error {
  readonly code: AppErrorCode; readonly status: number; readonly details?: unknown;
  constructor(code: AppErrorCode, message = defaultMessageByCode[code], details?: unknown) {
    super(message); this.name = "AppError"; this.code = code; this.status = statusByCode[code]; this.details = details;
  }
}

export interface ApiErrorBody { ok: false; error: { code: AppErrorCode; message: string; requestId: string } }
export function toApiError(error: unknown): AppError { return error instanceof AppError ? error : new AppError("SERVER_ERROR"); }
export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  const apiError = toApiError(error); const requestId = crypto.randomUUID();
  if (apiError.status >= 500) logger.error("api.request_failed", { requestId, errorCode: apiError.code, metadata: { errorName: error instanceof Error ? error.name : "unknown" } });
  return NextResponse.json({ ok: false, error: { code: apiError.code, message: apiError.message, requestId } }, { status: apiError.status, headers: { "cache-control": "no-store", "x-request-id": requestId } });
}

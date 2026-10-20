# Chấm công cá nhân — Prompt 5

## Data model

- `attendance_policies`: bật/tắt chấm công, ảnh, GPS, offline, độ chính xác, ca và ngưỡng đi trễ.
- `attendance_locations`: tọa độ và bán kính theo từng địa điểm.
- `employee_attendance_locations`: địa điểm được phép theo nhân viên.
- `attendance_events`: event check-in/check-out, thời gian client/server, geofence, trạng thái nghiệp vụ, ảnh và đồng bộ.
- `attendance_photos`: liên kết file full/thumbnail với đúng một event.
- `attendance_sync_events`: lịch sử đồng bộ/retry.
- `client_event_id` là unique idempotency key; `(employee_id, attendance_date, event_type)` chặn chấm trùng theo ngày.
- Ảnh nằm trong private bucket `attendance-photos`; database không lưu signed URL.

## Offline và đồng bộ

Ảnh JPEG đã nén, thumbnail và payload được ghi vào IndexedDB trước khi gọi server. Queue được phân vùng bằng `ownerAccountId`, không lưu access token. Khi có mạng hoặc mở lại ứng dụng, client:

1. POST event với cùng `client_event_id`.
2. Ghi lại `serverEventId` vào IndexedDB.
3. Upload ảnh và thumbnail vào event đó.
4. Chỉ xóa queue khi cả hai bước thành công.

Retry dùng exponential backoff từ 2 giây tới tối đa 60 giây. Event đã tạo không bị xóa nếu ảnh lỗi; lần sau server trả lại event cũ theo idempotency key.

## Camera và GPS

- Camera ưu tiên `facingMode=user`, có nút đổi camera và không hard-fail khi chỉ có một camera.
- GPS được yêu cầu song song với camera bằng high accuracy.
- Ảnh được render qua canvas để chuẩn hóa hướng, cạnh dài tối đa 1600 px, JPEG quality 0.82.
- Thumbnail cạnh dài tối đa 320 px, JPEG quality 0.76.
- Client hiển thị kết quả dễ hiểu; server tính lại khoảng cách Haversine và xác thực accuracy/geofence.
- Server dùng giờ nhận làm thời gian online; offline dùng giờ chụp và gắn anomaly khi đồng bộ trễ bất thường.

## API

- `GET /api/v1/attendance/dashboard`
- `POST /api/v1/attendance/events`
- `POST /api/v1/attendance/events/:id/photo`
- `GET /api/v1/attendance/history`
- `GET /api/v1/attendance/records`
- `GET /api/v1/attendance/records/:id`
- `GET /api/v1/attendance/photos/:photoId`
- `GET/PATCH /api/v1/attendance/settings`
- `POST /api/v1/attendance/locations`

## Routes

- Nhân viên: `/attendance`, `/attendance/history`, `/attendance/history/:date`.
- HR: `/attendance/records`, `/attendance/records/:id`.
- Ảnh ổn định: `/attendance/photos/:photoId`.
- Cấu hình: `/settings/attendance`, `/settings/attendance/locations`.

## Bảo mật

- Mọi truy cập ảnh đi qua permission check rồi mới cấp signed URL 5 phút.
- Upload kiểm tra MIME, file signature, giới hạn 2 MB và kích thước khai báo.
- Bucket không public, RLS bật và client không được ghi trực tiếp vào các bảng nghiệp vụ.
- Không ghi tọa độ hoặc binary image vào audit log.

## Kiểm thử

`npm run lint`, `npm run typecheck`, `npm test` và `npm run build` đều pass. Unit test bao phủ geofence, accuracy threshold, state check-in/check-out và retry backoff. Camera permission và hành vi đóng/mở app cần kiểm tra thêm trên thiết bị thật vì jsdom không cung cấp camera/GPS.

## Giới hạn hiện tại

- Background Sync không phải điều kiện bắt buộc; queue tự chạy khi trang mở lại/nhận sự kiện online để tương thích iOS Safari.
- Toàn ứng dụng vẫn dùng tài khoản demo ở foundation. Migration tạo mapping demo có kiểm soát để phát triển; trước production phải nối `auth_user_id` với Supabase Auth và bỏ fallback demo.
- `.env.local` phải có publishable key và secret key thì runtime mới gọi được Supabase Data API/Storage.

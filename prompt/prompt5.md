# PROMPT 05 — CHẤM CÔNG NHÂN VIÊN CÁ NHÂN: CAMERA, GPS, OFFLINE, ĐỒNG BỘ VÀ CHỐNG MẤT DỮ LIỆU

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- module Nhân sự
- User Account tách Employee Record
- Role / Permission
- Admin Console / Branding
- configuration over hard-code
- API-first
- audit foundation
- private file storage

Prompt này triển khai **chấm công cá nhân dành cho nhân viên/kỹ sư có tài khoản và tự sử dụng điện thoại để chấm công**.

Rất quan trọng:

```text
CHẤM CÔNG NHÂN VIÊN CÁ NHÂN
≠
ĐIỂM DANH CÔNG NHÂN THEO CÔNG TRƯỜNG
```

Không được gộp hai nghiệp vụ thành một.

Điểm danh công nhân theo giám sát sẽ có prompt riêng.

---

# 1. MỤC TIÊU

Xây một hệ thống chấm công cá nhân:

- cực kỳ rõ với người dùng
- mobile-first
- camera mượt
- GPS rõ ràng
- xử lý mạng yếu
- hỗ trợ offline
- không mất lượt chấm
- không mất ảnh
- không tạo bản ghi trùng
- không để nhân viên không biết đã chấm thành công hay chưa
- backend có trạng thái rõ
- HR có thể kiểm tra đầy đủ
- ảnh lưu an toàn
- có audit
- có nền tảng để bảng công dùng ở prompt sau

---

# 2. NGƯỜI DÙNG

Dành cho:

```text
Nhân viên văn phòng
Kỹ sư
Giám sát có tự chấm công cá nhân
Nhân viên khác có tài khoản
```

Không dành cho công nhân được giám sát điểm danh tập thể.

---

# 3. UX PRINCIPLE

Người dùng không cần hiểu:

- latitude
- longitude
- accuracy raw
- queue
- signed URL
- request id
- retry count
- server status

Người dùng chỉ cần hiểu:

```text
GPS đã sẵn sàng
Đúng địa điểm
Có mạng / Không có mạng
Đã chấm công
Chờ đồng bộ
Đã đồng bộ
```

---

# 4. MOBILE-FIRST ATTENDANCE HOME

Route chính:

```text
/attendance
```

Màn hình mobile phải ưu tiên:

```text
Ngày hiện tại
Giờ hiện tại
Ca làm hôm nay
Địa điểm được phép
GPS status
Network status
Trạng thái chấm công hiện tại
Primary CTA
Lần chấm gần nhất
```

Ví dụ:

```text
Thứ Tư, 09/09/2026

08:01:24

Ca hành chính
08:00 - 17:00

Công trường ABC
✓ GPS hợp lệ
✓ Đã kết nối

[ CHẤM VÀO ]

Lần gần nhất
Hôm qua 17:08 — Chấm ra
```

---

# 5. PRIMARY ACTION

Primary CTA:

```text
CHẤM VÀO
```

hoặc:

```text
CHẤM RA
```

Yêu cầu:

- full-width hoặc visual priority cao
- height khoảng 52–56px
- touch-friendly
- không có action cạnh tranh trực tiếp
- sau khi bấm phải disable tạm thời
- không cho spam tap

---

# 6. CAMERA EXPERIENCE

Không thiết kế như file upload thông thường.

Ưu tiên camera trực tiếp trên mobile browser nếu browser hỗ trợ phù hợp.

Flow:

```text
Chấm vào
  ↓
Mở camera
  ↓
Lấy GPS song song
  ↓
Chụp ảnh
  ↓
Preview
  ↓
Chụp lại / Sử dụng ảnh
  ↓
Lưu local trước
  ↓
Ghi nhận attendance event
  ↓
Upload + sync
```

---

# 7. CAMERA UI

Màn hình camera:

```text
Camera preview

GPS:
Đang xác định...
hoặc
✓ Đã xác định vị trí

Network:
Đã kết nối / Không có mạng

[ NÚT CHỤP LỚN ]
```

Không có:

- filter
- beauty mode
- AR
- sticker
- hiệu ứng
- UI trang trí thừa

---

# 8. CAMERA PERMISSION

Xử lý rõ các trường hợp:

```text
Permission chưa cấp
Permission bị từ chối
Camera không khả dụng
Không có camera trước
Browser không hỗ trợ flow hiện tại
```

Thông báo tiếng Việt dễ hiểu.

Ví dụ:

```text
Không thể truy cập camera

Hãy cho phép trình duyệt sử dụng camera để chấm công.

[Thử lại]
```

Không show raw DOMException.

---

# 9. CAMERA FRONT-FACING

Ưu tiên camera trước cho selfie chấm công cá nhân.

Nếu browser/device không chọn đúng camera:

- cho phép đổi camera
- nhưng không làm UI phức tạp

Không hard fail nếu thiết bị chỉ có một camera hợp lệ.

---

# 10. PREVIEW ẢNH

Sau khi chụp:

```text
Ảnh vừa chụp

[ Chụp lại ]
[ Sử dụng ảnh ]
```

Không tự submit ngay khi chưa cho người dùng xem.

Mục tiêu:

- tránh ảnh đen
- tránh che camera
- tránh rung
- tránh sai hướng
- tránh chụp nhầm

---

# 11. IMAGE PROCESSING TRÊN CLIENT

Trước upload:

- normalize orientation
- resize
- compress hợp lý

Không upload ảnh gốc 5–12MB nếu không cần.

Gợi ý:

```text
long edge khoảng 1280–1600px
JPEG/WebP quality hợp lý
target size thường vài trăm KB
```

Không làm ảnh quá nát.

Giữ đủ chất lượng để HR kiểm tra khuôn mặt và bối cảnh cơ bản.

---

# 12. EXIF / ORIENTATION

Ảnh khi hiển thị phải đúng chiều.

Không phụ thuộc browser tự xử lý EXIF một cách may rủi.

Nếu cần:

- normalize ảnh
- strip metadata không cần thiết

Không giữ GPS EXIF như nguồn nghiệp vụ chính.

GPS nghiệp vụ lưu riêng.

---

# 13. GPS FLOW

GPS phải được request sớm, song song với camera khi có thể.

Không đợi chụp ảnh xong mới bắt đầu lấy GPS.

Status:

```text
Đang xác định vị trí
Đã xác định vị trí
GPS không chính xác
Không có quyền vị trí
Không thể xác định vị trí
```

---

# 14. GEOLOCATION DATA

Backend có thể lưu:

```text
latitude
longitude
accuracy
captured_at_client
received_at_server
location_id
distance_from_allowed_location
geofence_result
```

Nhưng UI nhân viên không hiển thị dãy tọa độ.

UI chỉ nên hiển thị:

```text
Công trường ABC
✓ Vị trí hợp lệ
```

hoặc:

```text
Ngoài phạm vi cho phép
Cách địa điểm khoảng 320 m
```

nếu policy cho phép show khoảng cách.

---

# 15. GEOLOCATION ACCURACY

Không xem một GPS reading có accuracy quá kém là tuyệt đối chính xác.

Cần có threshold/config.

Ví dụ conceptual:

```text
accuracy <= allowed_accuracy_threshold
```

Nếu accuracy không đạt:

```text
Vị trí chưa đủ chính xác.
Hãy đứng ở khu vực thoáng và thử lại.
```

Không tự tạo công nếu policy yêu cầu GPS hợp lệ.

---

# 16. GEOFENCE

Địa điểm chấm công đến từ configuration/database.

Ví dụ:

```text
Attendance Location
- name
- latitude
- longitude
- radius
- active
```

Không hard-code bán kính.

Admin về sau có thể cấu hình:

```text
100m
150m
200m
```

theo location.

---

# 17. NHIỀU ĐỊA ĐIỂM

Một nhân viên có thể được phép chấm ở:

```text
Văn phòng
Công trường A
Công trường B
```

theo assignment/policy.

Không yêu cầu employee tự chọn location nếu hệ thống có thể tự match bằng GPS.

Nếu có nhiều location overlap:

- chọn location hợp lệ gần nhất
- hoặc cho user xác nhận nếu ambiguity thực sự tồn tại

---

# 18. THỜI GIAN

Không dùng client time làm nguồn duy nhất.

Lưu:

```text
captured_at_client
received_at_server
effective_attendance_time
```

Server time là nguồn tin cậy chính cho online event.

Offline event cần giữ thời gian capture từ device nhưng phải có:

- device metadata hợp lý
- sync timestamp
- anomaly detection nếu clock lệch bất thường

Không silently trust clock bị chỉnh.

---

# 19. ONLINE ATTENDANCE FLOW

Happy path:

```text
User bấm Chấm vào
↓
Camera
↓
GPS
↓
Preview
↓
Sử dụng ảnh
↓
Persist local draft
↓
Create attendance request with idempotency key
↓
Server validate
↓
Attendance recorded
↓
Photo upload
↓
Photo linked
↓
Synced
↓
Success UI
```

---

# 20. LOCAL-FIRST SAFETY

Ngay sau khi user chọn `Sử dụng ảnh`:

- lưu pending attendance payload vào persistent local storage trước
- không chỉ giữ trong React state
- ưu tiên IndexedDB hoặc storage phù hợp cho binary data

Nếu browser tab crash hoặc đóng:

```text
mở lại
↓
pending item vẫn còn
↓
resume sync
```

---

# 21. KHÔNG DÙNG LOCALSTORAGE CHO ẢNH LỚN

Không lưu binary photo lớn bằng localStorage.

Dùng IndexedDB hoặc browser storage phù hợp.

Metadata nhỏ có thể lưu riêng.

---

# 22. OFFLINE MODE

Offline là first-class state.

Flow:

```text
No Internet
↓
Camera vẫn hoạt động
↓
GPS vẫn cố lấy
↓
Ảnh được lưu local
↓
Attendance event pending được lưu local
↓
User nhận xác nhận rõ
↓
Khi online → tự sync
```

UI:

```text
✓ Đã ghi nhận lúc 08:01

Không có Internet.
Ảnh và dữ liệu đã được lưu trên thiết bị.

Chờ đồng bộ
```

---

# 23. TRẠNG THÁI ĐỒNG BỘ

Backend/client model phải phân biệt ít nhất:

```text
LOCAL_PENDING
SYNCING
SYNCED
SYNC_FAILED
```

Business event có thể phân biệt:

```text
RECORDED
REJECTED
NEEDS_REVIEW
```

Photo:

```text
PENDING_UPLOAD
UPLOADING
UPLOADED
UPLOAD_FAILED
```

Không collapse tất cả thành một boolean `isSynced`.

---

# 24. KHÔNG ĐỂ ẢNH FAIL = MẤT CHẤM CÔNG

Nếu attendance event đã hợp lệ nhưng upload ảnh tạm fail:

```text
attendance_status = recorded
photo_status = pending_upload
sync_status = pending
```

Không biến toàn bộ thành:

```text
Chấm công thất bại
```

nếu business policy cho phép retry ảnh.

Phải có retry mechanism.

---

# 25. BUSINESS POLICY VỀ ẢNH

Cấu hình:

```text
attendance.photo_required
```

Nếu bắt buộc ảnh:

- event có thể được `recorded_pending_photo`
- HR thấy rõ chưa hoàn tất chứng cứ
- hệ thống retry upload

Không tạo duplicate attendance chỉ vì retry photo.

---

# 26. IDEMPOTENCY

Mỗi attendance intent phải có idempotency key ổn định.

Ví dụ:

```text
client_event_id UUID
```

Nếu client retry request 5 lần:

```text
server chỉ tạo 1 attendance event
```

Đây là bắt buộc.

---

# 27. DOUBLE TAP PROTECTION

Sau khi bấm submit:

- disable button
- show processing state
- không cho tạo một intent mới ngay

Nhưng frontend protection không đủ.

Backend vẫn phải idempotent.

---

# 28. RETRY STRATEGY

Retry:

- network error
- timeout
- temporary 5xx
- photo upload fail

Không auto retry vô hạn.

Dùng backoff hợp lý.

Khi browser trở online:

```text
process pending queue
```

Nếu fail nhiều lần:

```text
Chưa thể đồng bộ.
Dữ liệu vẫn được lưu trên thiết bị.

[Thử lại]
```

---

# 29. PENDING QUEUE

Mỗi pending item lưu:

```text
client_event_id
employee_id/account context
attendance_type
capture time
location data
photo local reference
created_at
retry count
last error category
sync state
```

Không lưu token auth lâu dài trong queue.

Auth lấy từ current secure session khi sync.

---

# 30. USER LOGOUT KHI CÒN PENDING

Nếu còn pending attendance:

Hiển thị cảnh báo:

```text
Còn dữ liệu chấm công chưa đồng bộ.
Dữ liệu vẫn được lưu trên thiết bị và sẽ tiếp tục đồng bộ khi bạn đăng nhập lại trên thiết bị này.
```

Nếu policy yêu cầu, cố sync trước khi logout.

Không silently delete queue.

---

# 31. ACCOUNT SWITCH

Rất quan trọng nếu một thiết bị có thể đăng nhập tài khoản khác.

Pending queue phải gắn với account/user context.

Không cho pending item của user A sync dưới user B.

Nếu user khác login:

- queue A giữ riêng
- không hiển thị dữ liệu nhạy cảm của A cho B
- xử lý storage partition/logical ownership an toàn

---

# 32. SERVICE WORKER / PWA

Nếu project phù hợp, có thể dùng PWA/service worker cho:

- app shell caching
- offline support
- background-like sync khi browser cho phép

Nhưng không phụ thuộc hoàn toàn vào background sync vì browser support khác nhau.

Core retry phải hoạt động khi app mở lại.

Không assume iOS Safari support mọi Background Sync API.

---

# 33. ONLINE/OFFLINE DETECTION

Không chỉ tin `navigator.onLine`.

Có thể dùng nó làm hint.

Server request thực tế mới xác nhận connectivity.

UI không đổi trạng thái quá giật.

---

# 34. CHẤM VÀO / CHẤM RA

State machine:

```text
NOT_CHECKED_IN
→ CHECKED_IN
→ CHECKED_OUT
```

Không chỉ dựa vào text button.

Business service phải quyết định action hợp lệ.

Không cho client tự gửi arbitrary type nếu state không cho phép.

---

# 35. NHIỀU CA / BREAK

Prompt này ưu tiên flow:

```text
Check-in
Check-out
```

Nếu project hiện có ca nghỉ trưa hoặc nhiều lần ra/vào, architecture phải không khóa khả năng mở rộng.

Không tự xây break-tracking phức tạp nếu chưa được yêu cầu.

---

# 36. DUPLICATE CHECK-IN POLICY

Nếu user đã check-in mà bấm lại:

Server trả conflict/business response:

```text
Bạn đã chấm vào lúc 07:58.
```

Không tạo record mới.

UI có thể cung cấp:

```text
Xem lần chấm công
```

Không auto overwrite.

---

# 37. MISSING CHECK-OUT

Nếu hôm trước thiếu check-out:

Không tự giả định thời gian.

UI hôm sau có thể hiển thị notice:

```text
Bạn đang có một lần chấm công chưa hoàn tất.
```

Việc xử lý bổ sung công sẽ có prompt bảng công/điều chỉnh.

Không tự sửa lịch sử.

---

# 38. LOCATION PERMISSION DENIED

Nếu policy yêu cầu GPS:

```text
Không thể chấm công vì chưa có quyền vị trí.
```

Có hướng dẫn ngắn:

```text
Hãy bật quyền vị trí cho trình duyệt và thử lại.
```

Không đưa hướng dẫn dài phụ thuộc từng model máy ngay trong UI.

Có thể có help link.

---

# 39. CAMERA PERMISSION DENIED

Nếu ảnh bắt buộc:

```text
Không thể chấm công vì chưa có quyền camera.
```

Không fallback sang chọn ảnh trong gallery nếu policy muốn ảnh chụp realtime.

Nếu product quyết định cho gallery fallback, phải là config explicit, không tự mở.

---

# 40. PHOTO CAPTURE INTEGRITY

Không cần face recognition ở V1.

Không cần AI face verification.

Không cần liveness detection ở V1 trừ khi có prompt riêng.

Chỉ cần:

- capture realtime
- timestamp
- location
- attendance event link
- private storage
- audit

---

# 41. PHOTO STORAGE

Lưu:

```text
attendance_photo record
file_id
attendance_event_id
captured_at
uploaded_at
metadata
```

Storage private.

Không public bucket.

Không lưu signed URL dài hạn trong DB.

---

# 42. STABLE INTERNAL PHOTO ROUTE

Chuẩn bị route:

```text
/attendance/photos/:photoId
```

hoặc endpoint/resource tương đương.

Flow:

```text
Authenticated user
↓
Permission check
↓
Generate temporary storage access
↓
Render image
```

Mục tiêu sau này Excel có thể link ổn định đến route này.

---

# 43. HR PHOTO VIEWER

Desktop HR attendance view phải hỗ trợ:

- thumbnail lazy load
- click mở lightbox
- full image chỉ load khi cần
- next/previous
- keyboard arrows
- ESC close
- metadata

Metadata:

```text
Nhân viên
Ngày
Giờ
Check-in / Check-out
Địa điểm
Vị trí hợp lệ
Sync state
```

Không show raw GPS mặc định.

---

# 44. PHOTO LOAD FAILURE

Không hiển thị broken image.

State:

```text
Ảnh chưa đồng bộ
Không tải được ảnh
Không có ảnh
```

Có:

```text
[Thử lại]
```

nếu phù hợp.

---

# 45. THUMBNAIL

Tạo thumbnail derivative hoặc image transformation strategy.

Không tải full 1600px image trong table.

Có thể:

```text
thumbnail 160–320px
full 1280–1600px
```

tùy stack.

---

# 46. PREFETCH VIEWER

Khi HR mở một ảnh:

- có thể prefetch ảnh kế tiếp nhẹ
- không preload hàng chục ảnh

Mục tiêu:

```text
click → viewer → ảnh nhanh
```

---

# 47. HR ATTENDANCE LIST

Route quản lý:

```text
/attendance/records
```

hoặc convention phù hợp.

Filter:

```text
Ngày
Khoảng ngày
Nhân viên
Phòng ban
Địa điểm
Trạng thái
Đi trễ
Thiếu ảnh
Chờ đồng bộ / có vấn đề
```

Prompt này chỉ cần record inspection cơ bản.

Tính công chi tiết ở prompt bảng công.

---

# 48. ATTENDANCE RECORD DETAIL

Có thể dùng drawer hoặc route tùy complexity.

Thông tin:

```text
Employee
Attendance type
Effective time
Server received time
Location name
Distance
GPS accuracy
Photo
Sync history
Status
Audit
```

Raw lat/lng chỉ show cho permission/advanced view nếu cần.

---

# 49. DEVICE METADATA

Có thể lưu metadata tối thiểu để debug:

```text
platform/browser family
app version
client_event_id
```

Không fingerprint user quá mức.

Không thu dữ liệu thiết bị không cần thiết.

---

# 50. PRIVACY

Ảnh selfie là dữ liệu nhạy cảm.

Yêu cầu:

- private storage
- access permission
- không public URL
- không expose qua logs
- không cache public
- có retention policy extension point
- download nếu cần phải có permission

---

# 51. AUDIT

Audit:

```text
attendance created
attendance rejected
attendance retried
photo linked
photo upload failed/recovered
manual admin intervention
record invalidated
```

Không log binary image.

---

# 52. PERMISSIONS

Gợi ý:

```text
attendance.self.view
attendance.self.create

attendance.view_team
attendance.view_all
attendance.view_photo

attendance.review
attendance.adjust

attendance.config.view
attendance.config.manage
```

Không hard-code role.

---

# 53. CONFIGURATION

Admin-configurable:

```text
photo_required
gps_required
allowed_accuracy_threshold
location radius
early_checkin_window
late_threshold
attendance enabled
offline enabled
```

Nhưng prompt này không triển khai full shift/policy engine.

Chỉ dùng config foundation.

---

# 54. EARLY/LATE DISPLAY

Có thể hiển thị basic:

```text
Đúng giờ
Đi trễ
```

nếu shift data đã có.

Nhưng không tính final timesheet/payroll ở prompt này.

---

# 55. ATTENDANCE HISTORY — EMPLOYEE

Route:

```text
/attendance/history
```

Mobile list:

```text
09/09/2026
07:58 → 17:05
Đủ lượt chấm

08/09/2026
08:13 → 17:02
Đi trễ
```

Không shrink desktop table.

---

# 56. EMPLOYEE ATTENDANCE DETAIL

Route:

```text
/attendance/history/:date
```

hoặc equivalent.

Hiển thị:

```text
Check-in
time
location
photo

Check-out
time
location
photo

sync status
```

Không show debug metadata cho employee bình thường.

---

# 57. ROUTING

Bắt buộc route thật.

Ví dụ:

```text
/attendance
/attendance/history
/attendance/history/:date

/attendance/records
/attendance/records/:id nếu cần

/settings/attendance
/settings/attendance/locations
```

Không giant page state-only.

---

# 58. MOBILE NETWORK FEEDBACK

Không spam toast khi mạng chập chờn.

Dùng persistent status nhỏ:

```text
Không có mạng
```

khi offline.

Attendance success state quan trọng hơn network toast.

---

# 59. SUCCESS SCREEN

Sau chấm thành công:

```text
✓ Chấm công thành công

07:58
Công trường ABC

Đã đồng bộ
```

Hoặc offline:

```text
✓ Đã ghi nhận

07:58
Công trường ABC

Chờ đồng bộ
```

Phải cực kỳ rõ.

---

# 60. PROCESSING STATE

Trong lúc xử lý:

```text
Đang ghi nhận...
```

Không để spinner không text.

Nếu > vài giây:

```text
Đang lưu dữ liệu, vui lòng không đóng trang.
```

Nhưng local-first nên giảm thời gian phải chờ.

---

# 61. ERROR CATEGORIES

UI mapping:

```text
CAMERA_PERMISSION
LOCATION_PERMISSION
LOCATION_UNAVAILABLE
LOCATION_OUTSIDE_GEOFENCE
LOCATION_ACCURACY_LOW
NETWORK
PHOTO_UPLOAD
DUPLICATE
SESSION_EXPIRED
SERVER
```

Không show raw error.

---

# 62. SESSION EXPIRED

Nếu session hết hạn trong lúc pending:

- giữ queue local
- yêu cầu login lại
- sau login đúng user → resume sync

Không xóa pending attendance.

---

# 63. DATA CONFLICT

Nếu offline event sync lên nhưng server thấy employee đã có attendance tương ứng từ nguồn khác:

Không duplicate.

Mark:

```text
NEEDS_REVIEW
```

hoặc resolve theo deterministic policy.

HR thấy conflict.

Không silently overwrite.

---

# 64. SERVER VALIDATION

Server phải validate:

- authenticated user
- employee mapping
- account active
- action allowed
- attendance state
- timestamp sanity
- location policy
- assignment/location permission
- idempotency
- photo requirement state
- config state

Client validation chỉ để UX.

---

# 65. SECURITY — UPLOAD

Validate:

```text
MIME
extension
file signature nếu stack hỗ trợ
max size
dimensions
```

Không tin `Content-Type` từ client duy nhất.

Không cho SVG trong attendance photo.

---

# 66. IMAGE NAMING

Không dùng user file name.

Dùng storage key controlled:

```text
attendance/{year}/{month}/{employee_id}/{photo_id}.jpg
```

hoặc convention an toàn.

Business link dùng ID, không path trực tiếp.

---

# 67. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
attendance_events
attendance_photos
attendance_sync_events hoặc metadata
attendance_locations
attendance_policies
```

Possible attendance event fields:

```text
id
client_event_id
employee_id
type
effective_at
captured_at_client
received_at_server
location_id
latitude
longitude
accuracy
distance_meters
geofence_status
attendance_status
photo_status
sync_source
created_at
```

Không nhét mọi thứ vào JSON duy nhất.

---

# 68. SOURCE

Lưu nguồn:

```text
SELF_MOBILE_WEB
```

Sau này worker attendance sẽ có source khác.

Không dùng cùng một source cho mọi nghiệp vụ.

---

# 69. TIMESHEET INTEGRATION HOOK

Prompt này chưa tính bảng công.

Nhưng attendance event phải đủ dữ liệu để prompt Timesheet sau này tính:

```text
check-in
check-out
late
early leave
location
source
manual adjustment
```

Không tính payroll ở đây.

---

# 70. EXCEL INTEGRATION HOOK

Prompt này chưa export Excel.

Nhưng photo route phải ổn định để report engine sau này tạo hyperlink:

```text
Xem ảnh
```

Không lưu expiring signed URL vào report data.

---

# 71. TEST CASES BẮT BUỘC

## Online happy path

- camera OK
- GPS OK
- check-in
- photo upload
- synced
- UI success

## Offline

- offline before capture
- capture
- local persist
- close app
- reopen
- login same user
- sync
- no duplicate

## Network drop

- online capture
- network drops during photo upload
- attendance remains recorded/pending
- retry photo
- final synced

## Double tap

- rapid button tap
- 1 client event
- 1 server event

## Duplicate request

- same idempotency key repeated
- one record

## Permission

- camera denied
- GPS denied
- location outside geofence

## Account/session

- session expires with pending
- re-auth
- queue resumes
- other user cannot sync first user queue

## Image

- oversized image compressed
- orientation correct
- invalid MIME rejected
- thumbnail loads
- full image viewer works

## HR

- permission denied photo
- permission allowed photo
- lazy load
- broken photo state

## Routing

- refresh attendance history route
- browser back
- deep link

---

# 72. ACCEPTANCE CRITERIA

## Employee UX

- [ ] 1 primary action.
- [ ] Camera mở mượt.
- [ ] GPS status rõ.
- [ ] Preview trước submit.
- [ ] Success rõ.
- [ ] Offline rõ.
- [ ] Pending sync rõ.
- [ ] Không raw technical error.

## Reliability

- [ ] Local persistence.
- [ ] IndexedDB hoặc equivalent cho photo queue.
- [ ] Retry.
- [ ] Idempotency.
- [ ] Double tap safe.
- [ ] Tab close không mất pending data.
- [ ] Session expiry không mất pending data.
- [ ] Account switch không trộn queue.

## GPS

- [ ] Geofence.
- [ ] Accuracy handling.
- [ ] Không show raw coordinate mặc định.
- [ ] Radius/config không hard-code.

## Photos

- [ ] Compress/resize.
- [ ] Correct orientation.
- [ ] Private storage.
- [ ] Stable internal route.
- [ ] Lazy thumbnail.
- [ ] Lightbox.
- [ ] Upload fail không tạo duplicate.

## Backend

- [ ] Server-side validation.
- [ ] Client/server timestamps tách rõ.
- [ ] Event state rõ.
- [ ] Photo state rõ.
- [ ] Sync state rõ.

## Architecture

- [ ] Không gộp worker attendance.
- [ ] Source = self mobile attendance.
- [ ] Timesheet integration-ready.
- [ ] Excel hyperlink-ready.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.
- [ ] Mobile responsive review pass.

---

# 73. THỨ TỰ TRIỂN KHAI

1. Inspect auth/employee mapping.
2. Inspect existing attendance code nếu có.
3. Không reuse code lỗi nếu architecture cũ không an toàn.
4. Thiết kế attendance state machine.
5. Thiết kế idempotency.
6. Thiết kế local queue.
7. Thiết kế DB/migrations.
8. Thiết kế attendance location/config.
9. API.
10. Camera UI.
11. GPS flow.
12. Image processing.
13. Online flow.
14. Offline flow.
15. Retry/sync.
16. Success/error states.
17. Employee history.
18. HR record viewer.
19. Photo lightbox.
20. Audit.
21. Tests.
22. Mobile/device review.
23. Lint/typecheck/build.
24. Báo cáo.

---

# 74. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Data model

- tables
- states
- indexes
- unique/idempotency constraints

## Offline

- local storage mechanism
- sync algorithm
- retry behavior

## Camera/GPS

- implementation
- permission behavior
- fallbacks

## Photo

- compression
- private storage
- stable internal viewer
- thumbnail strategy

## API

- endpoints
- validation
- permissions

## Routes/UI

- employee routes
- HR routes

## Tests

- cases đã chạy
- kết quả

## Known limitations

Chỉ ghi limitation thật theo browser/platform nếu có.

---

# 75. QUY TẮC CUỐI

Đây là module có độ ưu tiên reliability rất cao.

Không được đánh đổi tính ổn định để lấy code ngắn.

Không để user không biết đã chấm thành công hay chưa.

Không để upload ảnh thất bại làm sinh duplicate attendance.

Không lưu pending data chỉ trong memory.

Không public ảnh.

Không hard-code GPS radius.

Không dùng client clock làm nguồn duy nhất.

Không gộp với điểm danh công nhân.

Không implement face recognition ngoài yêu cầu.

**Dừng sau khi chấm công cá nhân online/offline, camera, GPS, ảnh, retry, sync và HR inspection hoàn chỉnh, test/build pass và báo cáo kết quả.**

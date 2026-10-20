# PROMPT 06 — DỰ ÁN/CÔNG TRƯỜNG, PHÂN CÔNG NHÂN SỰ, LỊCH NHÂN CÔNG VÀ ĐIỂM DANH CÔNG NHÂN TẬP THỂ

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- module Nhân sự
- Employee Record tách User Account
- Role / Permission
- Admin Console / Branding
- chấm công cá nhân bằng camera + GPS + offline sync
- API-first
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai:

1. Dự án.
2. Công trường / worksite.
3. Phân công giám sát.
4. Phân công kỹ sư/nhân viên.
5. Phân công công nhân.
6. Lịch nhân sự theo ngày.
7. Daily roster.
8. Điểm danh công nhân tập thể.
9. Ảnh điểm danh toàn cảnh.
10. Ngoại lệ trong ngày.
11. Chốt ngày.
12. Liên kết với bảng công tương lai.
13. Mobile UX dành cho giám sát.

Rất quan trọng:

```text
CHẤM CÔNG CÁ NHÂN
≠
ĐIỂM DANH CÔNG NHÂN TẬP THỂ
```

Không được gộp hai nghiệp vụ này vào cùng một flow hoặc cùng một state machine.

---

# 1. MỤC TIÊU NGHIỆP VỤ

Quy trình thực tế hiện tại:

```text
Giám sát công trường
↓
Buổi sáng chụp ảnh toàn cảnh nhân sự
↓
Nhắn danh sách nhân sự / nội dung công việc qua Zalo
```

Hệ thống mới phải số hóa quy trình đó theo hướng:

```text
Dự án / Công trường
↓
Phân công nhân sự
↓
Lịch làm việc theo ngày
↓
Giám sát mở danh sách có sẵn
↓
Điểm danh
↓
Chụp 1 hoặc nhiều ảnh tập thể
↓
Ghi nội dung công việc nếu cần
↓
Xác nhận
↓
Dữ liệu cấu trúc
↓
Bảng công
```

Không yêu cầu từng công nhân có điện thoại hoặc tài khoản.

---

# 2. NGUYÊN TẮC NHẬN DIỆN CÔNG NHÂN

Không lưu tên công nhân trực tiếp như string trong project.

Bắt buộc dùng:

```text
worker_id / employee_id
```

Ví dụ:

```text
project_assignment
- project_id
- worker_id
```

Tên hiển thị lấy từ hồ sơ nhân sự.

Không dùng tên làm khóa.

---

# 3. CÔNG NHÂN KHÔNG BẮT BUỘC CÓ USER ACCOUNT

Một công nhân có thể:

```text
Có hồ sơ nhân sự
Có mã nhân sự
Có phân công dự án
Có điểm danh
Có bảng công
Không có tài khoản đăng nhập
```

Giám sát là người điểm danh thay.

Không tự tạo account cho toàn bộ công nhân.

---

# 4. PROJECT VÀ WORKSITE PHẢI TÁCH KHÁI NIỆM

Mô hình khuyến nghị:

```text
PROJECT
Dự án / công việc / gói triển khai

WORKSITE
Địa điểm thi công thực tế
```

Một project có thể có một hoặc nhiều worksite.

Ví dụ:

```text
Project: Bảo trì hệ thống ray Cảng ABC

Worksites:
- Khu QC03
- Khu QC04
- Kho tập kết
```

V1 UI có thể đơn giản nếu một project chỉ có một worksite, nhưng database không được khóa khả năng mở rộng.

---

# 5. PROJECT DATA

Mỗi project cần tối thiểu:

```text
Mã dự án *
Tên dự án *
Khách hàng nếu cần
Mô tả ngắn
Ngày bắt đầu
Ngày dự kiến kết thúc
Ngày kết thúc thực tế
Trạng thái
Project Manager / người phụ trách
Ghi chú
```

Trạng thái gợi ý:

```text
Chuẩn bị
Đang thực hiện
Tạm dừng
Hoàn thành
Đã đóng
```

Không hard-code nếu domain config đã hỗ trợ enum/config an toàn.

---

# 6. WORKSITE DATA

Mỗi worksite:

```text
Tên địa điểm *
Project *
Địa chỉ
Latitude
Longitude
Bán kính GPS nếu dùng
Trạng thái
Ngày hoạt động
Ghi chú
```

GPS dùng cho:

- xác minh giám sát đang ở khu vực phù hợp khi điểm danh
- chấm công cá nhân nếu nhân viên được phép chấm tại worksite

Không xuất raw lat/lng cho user thông thường.

---

# 7. PROJECT TEAM

Một project có thể có:

```text
Project Manager
Kỹ sư
Giám sát
Công nhân
Nhân sự hỗ trợ
```

Không lưu một field `supervisor_id` cố định duy nhất nếu thực tế có thể thay đổi theo thời gian.

Dùng assignment có hiệu lực theo thời gian.

---

# 8. PROJECT ASSIGNMENT

Mỗi assignment cần:

```text
project_id
worksite_id nếu áp dụng
person_id / worker_id
assignment_role
start_date
end_date
shift_id nếu có
status
assigned_by
note
```

Assignment role ví dụ:

```text
Project Manager
Kỹ sư
Giám sát chính
Giám sát thay thế
Công nhân
Hỗ trợ
```

Không hard-code role nghiệp vụ vào authentication role.

**Project role ≠ System role.**

Ví dụ một người có system role `Nhân viên` nhưng project role `Giám sát`.

---

# 9. GIÁM SÁT THEO THỜI GIAN

Ví dụ:

```text
Nguyễn Văn Minh
Giám sát chính
01/09 → 30/09

Trần Văn B
Giám sát thay thế
10/09 → 12/09
```

Khi đăng nhập ngày 11/09, hệ thống phải xác định đúng người được phép điểm danh.

Không hard-code một supervisor vĩnh viễn.

---

# 10. PHÂN CÔNG CÔNG NHÂN

HR / người quản lý có quyền có thể phân công:

```text
CN001 Nguyễn Văn A
CN002 Trần Văn B
CN003 Phạm Văn C
```

vào:

```text
Project
Worksite
Date range
Shift
```

Một công nhân có thể:

- chuyển project
- chuyển worksite
- hỗ trợ ngắn hạn
- làm theo ngày

Model phải hỗ trợ điều này.

---

# 11. DAILY ROSTER

Từ assignment, hệ thống sinh danh sách nhân sự dự kiến theo ngày.

Concept:

```text
Project Assignment
↓
Date
↓
Daily Roster
```

Daily roster không nhất thiết phải pre-create tất cả ngày từ đầu nếu có thể generate on demand.

Nhưng khi một ngày đã bắt đầu điểm danh, cần snapshot roster của ngày đó.

---

# 12. ROSTER SNAPSHOT

Khi tạo attendance session cho ngày:

Lưu snapshot tối thiểu:

```text
worker_id
employee_code_snapshot
display_name_snapshot
assignment_role_snapshot
project_id
project_name_snapshot
worksite_id
worksite_name_snapshot
date
```

Mục tiêu:

Nếu sau này:

- đổi tên project
- đổi tên công nhân
- chuyển phòng ban
- thay role

thì báo cáo lịch sử của ngày đó vẫn có context chính xác.

Không duplicate toàn bộ PII.

---

# 13. ROUTING DỰ ÁN

Bắt buộc route thật.

Ví dụ:

```text
/projects
/projects/new

/projects/:id/overview
/projects/:id/team
/projects/:id/schedule
/projects/:id/worker-attendance
/projects/:id/documents
/projects/:id/history
```

Prompt cập nhật tiến độ dự án sau có thể thêm:

```text
/projects/:id/updates
```

Không giant project page.

---

# 14. PROJECT LIST

Desktop table:

```text
Mã dự án
Tên dự án
Khách hàng
Người phụ trách
Ngày bắt đầu
Ngày dự kiến kết thúc
Trạng thái
Nhân sự hiện tại
```

Filter:

```text
Trạng thái
Người phụ trách
Thời gian
Khách hàng nếu có
```

Không nhét toàn bộ project data lên card.

---

# 15. PROJECT DETAIL HEADER

Ví dụ:

```text
CT-2026-015
Bảo trì hệ thống ray Cảng ABC

Đang thực hiện
01/09/2026 → 30/09/2026
```

Tabs route-backed:

```text
Tổng quan
Nhân sự
Lịch
Điểm danh
Tài liệu
Lịch sử
```

---

# 16. PROJECT TEAM UI

Trang:

```text
/projects/:id/team
```

Hiển thị theo nhóm:

```text
Quản lý dự án
Kỹ sư
Giám sát
Công nhân
Hỗ trợ
```

Có:

```text
+ Phân công nhân sự
```

Form:

```text
Nhân sự
Vai trò trong dự án
Worksite
Từ ngày
Đến ngày
Ca
Ghi chú
```

---

# 17. EMPLOYEE / WORKER SELECTOR

Bắt buộc reuse component đã tạo ở Prompt 03.

Không tạo selector mới riêng.

Filter:

```text
Loại nhân sự
Trạng thái
Phòng ban
Đơn vị / nhà thầu
```

---

# 18. PHÂN CÔNG TRÙNG

Không cấm một person có nhiều assignment hợp lệ nếu nghiệp vụ cho phép.

Nhưng phải detect:

```text
cùng người
cùng ngày
hai worksite cách xa
hai ca trùng thời gian
```

Nếu nghi xung đột:

```text
Nhân sự này đã có phân công trùng thời gian.
```

Không silently accept.

Có permission override nếu cần, kèm reason + audit.

---

# 19. SCHEDULE PAGE

Trang lịch:

```text
/projects/:id/schedule
```

Cho phép xem:

- ngày
- tuần
- tháng

Nhưng V1 ưu tiên:

```text
Ngày / Tuần
```

Không cần calendar quá phức tạp.

Mục tiêu:

- biết ngày nào có bao nhiêu nhân sự
- ai là giám sát
- worksite nào
- ca nào

---

# 20. TODAY WORK FOR SUPERVISOR

Mobile home của giám sát phải cực đơn giản.

Ví dụ:

```text
Hôm nay — 09/09/2026

Cảng ABC
Worksite: QC03
18 công nhân dự kiến

[ ĐIỂM DANH BUỔI SÁNG ]
```

Nếu có nhiều worksite:

```text
QC03 — 18 người
[Điểm danh]

QC04 — 12 người
[Điểm danh]
```

Không bắt giám sát tự tìm project trong menu dài nếu assignment đã xác định được.

---

# 21. WORKER ATTENDANCE ROUTES

Ví dụ:

```text
/worker-attendance
/worker-attendance/today
/worker-attendance/sessions/:id/roster
/worker-attendance/sessions/:id/photos
/worker-attendance/sessions/:id/review
/worker-attendance/sessions/:id
```

Đây là wizard có routing thật.

Không dùng một giant page với `currentStep` duy nhất mà refresh mất dữ liệu.

---

# 22. WORKER ATTENDANCE SESSION

Một phiên điểm danh đại diện cho:

```text
Project
Worksite
Ngày
Ca
Giám sát
Buổi / session type
```

Ví dụ:

```text
Morning Attendance
09/09/2026
Cảng ABC — QC03
Supervisor: Nguyễn Văn Minh
```

---

# 23. SESSION STATE

Trạng thái:

```text
DRAFT
IN_PROGRESS
SUBMITTED
LOCKED
NEEDS_REVIEW
```

Có thể thêm:

```text
SYNC_PENDING
```

ở client side.

Không cho submitted session bị sửa vô điều kiện.

---

# 24. BƯỚC 1 — ROSTER

Khi giám sát bắt đầu:

Hệ thống tự tải roster theo assignment.

Ví dụ:

```text
Điểm danh buổi sáng

18 người dự kiến

[ Chọn tất cả có mặt ]

Nguyễn Văn A
Trần Văn B
Phạm Văn C
...
```

Không nhập lại tên.

---

# 25. SELECT ALL PRESENT

Có action:

```text
[ Chọn tất cả có mặt ]
```

Nhưng:

Không mặc định tất cả là có mặt ngay khi mở trang.

Giám sát phải chủ động xác nhận.

Sau đó chỉ sửa ngoại lệ.

---

# 26. ATTENDANCE STATUS CÔNG NHÂN

Status tối thiểu:

```text
Có mặt
Vắng
Nghỉ phép
Đi trễ
Điều chuyển
Chưa xác nhận
```

Có thể cấu hình thêm sau.

Không dùng trạng thái chấm công cá nhân như `CHECKED_IN/CHECKED_OUT` cho worker attendance.

---

# 27. EXCEPTION REASON

Nếu chọn:

```text
Vắng
```

có thể chọn:

```text
Có phép
Không phép
Chưa rõ lý do
Đi công trường khác
Khác
```

Nếu hệ thống nghỉ phép sau này đã có đơn được duyệt:

- auto suggest `Nghỉ phép`
- không buộc giám sát xử lý lại

Integration sẽ hoàn thiện ở prompt Leave/Timesheet.

---

# 28. WORKER PHÁT SINH

Có:

```text
+ Thêm nhân sự phát sinh
```

Hai trường hợp.

## 28.1 Đã có hồ sơ

Search worker.

Chọn.

Ghi:

```text
Điều động
Hỗ trợ
Thay thế
Khác
```

## 28.2 Chưa có hồ sơ

Cho phép:

```text
+ Thêm công nhân tạm
```

Tối thiểu:

```text
Họ tên *
Số điện thoại nếu có
Đơn vị / nhà thầu
Ghi chú
```

Tạo:

```text
Temporary worker
Status: Chờ HR hoàn thiện hồ sơ
```

Không bắt giám sát nhập CCCD/hợp đồng ngoài công trường.

---

# 29. CHỐNG TRÙNG WORKER TẠM

Khi nhập worker tạm:

Search fuzzy/basic theo:

- tên
- phone

Nếu có hồ sơ gần giống:

```text
Có thể người này đã tồn tại.
```

Cho giám sát chọn existing nếu đúng.

Không auto merge theo tên.

---

# 30. BƯỚC 2 — ẢNH ĐIỂM DANH

Sau roster:

```text
Ảnh điểm danh
[ + Chụp ảnh ]
```

Cho phép nhiều ảnh.

Không giới hạn 1 ảnh.

Ví dụ:

```text
Ảnh 1
Ảnh 2
Ảnh 3
```

Mục tiêu:

- đội đông
- nhiều góc
- nhân sự không đứng hết một khung

---

# 31. ẢNH THUỘC SESSION, KHÔNG THUỘC TỪNG WORKER

Đây là bắt buộc.

Không copy cùng ảnh vào 20 worker records.

Model:

```text
WorkerAttendanceSession
  ├── Photo 1
  ├── Photo 2
  └── Photo 3

WorkerAttendanceEntries
  ├── Worker A
  ├── Worker B
  └── Worker C
```

Entry reference session.

---

# 32. CAMERA WORKER ATTENDANCE

Khác selfie cá nhân:

- ưu tiên camera sau hoặc cho đổi camera
- mục tiêu chụp toàn cảnh
- nhiều người
- nhiều ảnh

UI:

```text
Camera preview
GPS status
Photo count
Capture
Done
```

Không filter/beauty.

---

# 33. PHOTO PREVIEW

Sau mỗi ảnh:

- thumbnail
- xem lớn
- xóa
- chụp lại
- thêm ảnh

Không upload ảnh 10MB nguyên bản.

Reuse image compression foundation Prompt 05.

---

# 34. GPS GIÁM SÁT

Khi điểm danh, ghi vị trí thiết bị của giám sát.

Lưu:

```text
latitude
longitude
accuracy
distance
geofence result
```

UI:

```text
Cảng ABC — QC03
✓ Vị trí hợp lệ
```

Không show raw coordinates mặc định.

---

# 35. GPS POLICY

Admin/config có thể quyết định:

```text
GPS required
GPS optional
Radius
Accuracy threshold
```

Không hard-code.

Nếu GPS fail mà policy bắt buộc:

- không submit final
- nhưng giữ draft local
- cho retry

---

# 36. BƯỚC 3 — NỘI DUNG CÔNG VIỆC

Có field optional:

```text
Nội dung công việc hôm nay
```

Ví dụ:

```text
Vệ sinh và kiểm tra khu vực QC03.
```

Có:

```text
Ghi chú
```

Không biến thành report form phức tạp.

Project Update prompt sau sẽ mở rộng.

---

# 37. REVIEW SCREEN

Trước submit:

```text
ĐIỂM DANH CÔNG TRƯỜNG

09/09/2026
07:27

Project: Cảng ABC
Worksite: QC03
Giám sát: Nguyễn Văn Minh

Có mặt: 24
Vắng: 2
Nghỉ phép: 1
Đi trễ: 1
Phát sinh: 2

Ảnh: 4
GPS: Hợp lệ

Nội dung công việc:
...

[ XÁC NHẬN ĐIỂM DANH ]
```

---

# 38. SUBMIT

Sau submit:

```text
✓ Đã ghi nhận điểm danh

24 công nhân có mặt
07:27
Cảng ABC — QC03

Ảnh đã đồng bộ
```

Nếu offline:

```text
✓ Đã lưu trên thiết bị

Dữ liệu và ảnh sẽ tự đồng bộ khi có mạng.

Chờ đồng bộ
```

---

# 39. OFFLINE MODE

Reuse nền tảng Prompt 05.

Điểm danh phải có thể:

```text
Load roster đã cache/prepared
↓
Mark attendance
↓
Capture photos
↓
Save draft local
↓
Submit local pending
↓
Sync khi online
```

---

# 40. OFFLINE ROSTER

Để hỗ trợ điểm danh nơi mạng yếu:

Khi supervisor có lịch hôm nay và app có mạng trước đó:

- preload/cached roster của ngày
- preload project/worksite basic info
- không preload sensitive unnecessary data

Nếu user chưa từng tải roster và hoàn toàn offline:

```text
Không có dữ liệu lịch làm đã lưu trên thiết bị.
Hãy kết nối Internet để tải lịch lần đầu.
```

Không tạo roster giả.

---

# 41. LOCAL PERSISTENCE

Dùng IndexedDB hoặc storage phù hợp.

Lưu:

```text
session draft
entries
photos
GPS
work note
client_session_id
sync state
```

Không chỉ React state.

Refresh không mất draft.

---

# 42. IDEMPOTENCY

Mỗi session có:

```text
client_session_id UUID
```

Mỗi submit/retry cùng ID không tạo session duplicate.

Server enforce unique constraint.

---

# 43. SESSION UNIQUENESS

Business uniqueness có thể là:

```text
project
worksite
date
shift/session type
```

Không để hai supervisor vô tình submit hai morning sessions giống nhau mà không phát hiện.

Nếu conflict:

```text
Phiên điểm danh này đã được ghi nhận.
```

Cho xem session hiện có.

Nếu cần supervisor thay thế bổ sung, phải theo edit/adjustment flow có audit.

---

# 44. TWO SUPERVISORS

Nếu hai người cùng được quyền điểm danh:

Khi một người đang submit:

- optimistic concurrency
- server conflict detection

Không silently merge.

Nếu session đã submitted:

```text
Phiên điểm danh đã được Nguyễn Văn A xác nhận lúc 07:25.
```

---

# 45. EDIT AFTER SUBMIT

Không cho sửa âm thầm.

Flow:

```text
Submitted session
↓
Edit / Điều chỉnh
↓
Reason required
↓
Before / After
↓
Audit
```

Có thể cần permission:

```text
worker_attendance.adjust
```

Giám sát có thể chỉ được chỉnh trong window nếu business config cho phép.

HR/Admin có quyền cao hơn.

---

# 46. LỊCH SỬ SỬA

Ví dụ:

```text
10:03

Nguyễn Văn C
Vắng → Có mặt

Người sửa:
Nguyễn Văn Minh

Lý do:
Điểm danh thiếu
```

Hiển thị lịch sử rõ.

Không raw JSON diff.

---

# 47. CHỐT NGÀY

Ngoài buổi sáng, có optional workflow:

```text
[ CHỐT NGÀY ]
```

Mục tiêu:

Không bắt điểm danh lại toàn bộ cuối ngày.

Mặc định các worker `Có mặt` buổi sáng được xem là full-day candidate.

Giám sát chỉ nhập ngoại lệ:

```text
Về sớm
Điều chuyển
Làm nửa ngày
Làm thêm
Rời công trường
```

Không tính lương ở đây.

---

# 48. END-OF-DAY EXCEPTION

Ví dụ:

```text
Nguyễn Văn A
Về sớm
15:00

Trần Văn B
Điều chuyển QC03 → QC04
13:00

Phạm Văn C
Làm nửa ngày
```

Dữ liệu này sẽ giúp Timesheet prompt sau tính công.

---

# 49. KHÔNG BẮT BUỘC CHỐT NGÀY Ở V1 NẾU POLICY KHÔNG DÙNG

Feature có thể config:

```text
worker_attendance.end_of_day_required
```

Nếu false:

- chỉ morning attendance đủ cho hiện tại

Nhưng architecture phải support mở rộng.

---

# 50. WORK CREDIT KHÔNG TÍNH CỨNG Ở MODULE NÀY

Không tự tính:

```text
1.0 công
0.5 công
```

một cách cứng ngay trong attendance session.

Module này ghi fact:

```text
Có mặt
Nửa ngày
Về sớm
Điều chuyển
```

Timesheet service sau sẽ tính work credit theo policy.

Có thể lưu suggested_work_fraction nếu cần nhưng không coi là final payroll truth.

---

# 51. SOURCE

Điểm danh worker phải có source riêng:

```text
SUPERVISOR_ROSTER
```

Không dùng:

```text
SELF_MOBILE_WEB
```

của chấm công cá nhân.

---

# 52. WORKER ATTENDANCE ENTRY

Concept fields:

```text
id
session_id
worker_id
worker_name_snapshot
employee_code_snapshot
status
exception_reason
arrival_note nếu cần
end_of_day_status nếu có
note
source
created_at
updated_at
```

Không cần lat/lng trên từng worker entry nếu tất cả thuộc session GPS chung.

---

# 53. SESSION DATA

Concept fields:

```text
id
client_session_id
project_id
project_name_snapshot
worksite_id
worksite_name_snapshot
date
shift_id
session_type
supervisor_id
supervisor_name_snapshot
started_at
submitted_at
captured_at_client
received_at_server
latitude
longitude
accuracy
distance
geofence_status
work_note
status
sync_state
version
```

---

# 54. SESSION PHOTOS

Concept:

```text
worker_attendance_photos
- id
- session_id
- file_id
- captured_at
- uploaded_at
- sort_order
```

Storage private.

---

# 55. PHOTO VIEWER HR

HR mở session:

```text
Cảng ABC
09/09/2026
07:27
Giám sát: Nguyễn Văn Minh

24 Có mặt
2 Vắng
1 Nghỉ phép

[ảnh] [ảnh] [ảnh]
```

Click:

- lightbox
- next/previous
- thumbnail
- lazy load

Reuse foundation Prompt 05.

---

# 56. EXCEL PHOTO LINK FOUNDATION

Sau này export worker attendance:

Cell:

```text
Xem ảnh điểm danh
```

Link đến stable internal route của session/gallery.

Không signed URL hết hạn nằm trực tiếp trong Excel.

Ví dụ stable route:

```text
/worker-attendance/sessions/:sessionId/photos
```

Permission check tự động.

---

# 57. HR SESSION LIST

Desktop route:

```text
/worker-attendance
```

Table:

```text
Ngày
Project
Worksite
Giám sát
Dự kiến
Có mặt
Vắng
Nghỉ
Phát sinh
Ảnh
Trạng thái
```

Filter:

```text
Ngày
Project
Worksite
Giám sát
Trạng thái
Có ngoại lệ
```

---

# 58. SESSION DETAIL

Route:

```text
/worker-attendance/sessions/:id
```

Tabs hoặc sections:

```text
Tổng quan
Danh sách
Ảnh
Lịch sử điều chỉnh
```

Có thể dùng route-backed subtabs nếu complexity tăng.

---

# 59. SUPERVISOR MOBILE LIST UX

Worker list mobile:

```text
Nguyễn Văn A
CN001
[ Có mặt ▼ ]

Trần Văn B
CN002
[ Có mặt ▼ ]
```

Không cần table.

Có sticky summary:

```text
Có mặt 16
Vắng 1
Chưa xác nhận 1
```

Primary CTA:

```text
Tiếp tục
```

---

# 60. SEARCH TRONG ROSTER

Nếu roster > 30 người:

- search tên
- search mã

Không để filter làm mất trạng thái đã chọn.

---

# 61. BULK ACTION

Support:

```text
Chọn tất cả có mặt
Đặt những người đã chọn → Có mặt
```

Nhưng destructive bulk change phải rõ.

Không đặt tất cả vắng bằng một click dễ nhầm nếu không confirm.

---

# 62. UNSAVED DRAFT

Nếu supervisor rời wizard:

```text
Điểm danh chưa hoàn tất.
Dữ liệu đã được lưu nháp trên thiết bị.
```

Có:

```text
Tiếp tục
Bỏ bản nháp
```

Bỏ draft phải confirm.

---

# 63. SESSION RESUME

Trang `/worker-attendance/today` phải hiện:

```text
QC03
Điểm danh đang làm dở
[Tiếp tục]
```

Không tạo session mới.

---

# 64. WORKSITE ACCESS

Supervisor chỉ thấy:

- project/worksite được phân công
- ngày nằm trong assignment

Không thể đổi URL để điểm danh project khác nếu không có permission.

Server check.

---

# 65. PROJECT MANAGER ACCESS

Project Manager có thể:

- xem roster
- xem attendance
- xem photos
- xem exceptions

Tùy permission có thể điều chỉnh.

Không hard-code role string.

---

# 66. PERMISSIONS

Gợi ý:

```text
project.view
project.create
project.edit
project.manage_team
project.manage_schedule

worker_attendance.self_scope
worker_attendance.create
worker_attendance.view_project
worker_attendance.view_all
worker_attendance.view_photo
worker_attendance.adjust
worker_attendance.lock

worksite.view
worksite.manage
```

Tên có thể theo convention nhưng phải rõ.

---

# 67. PROJECT ROLE VS SYSTEM PERMISSION

Ví dụ supervisor:

```text
System permission:
worker_attendance.create
```

+

```text
Project assignment:
Supervisor at Project A
```

Cả hai mới cho phép điểm danh Project A.

Không chỉ dựa vào role global.

---

# 68. PROJECT ACCESS CONTROL

Authorization scope:

```text
Permission
+
Project membership/assignment
+
Date validity
```

Admin hoặc HR có permission all-scope có thể xem rộng hơn.

---

# 69. TEMP WORKER COMPLETION

HR có page/filter:

```text
Hồ sơ chờ hoàn thiện
```

Temporary worker:

```text
Nguyễn Văn Hùng
Tạo từ điểm danh CT ABC
09/09/2026
```

HR:

```text
Hoàn thiện hồ sơ
```

và giữ nguyên worker_id/history nếu có thể.

Không tạo duplicate mới.

---

# 70. PROJECT HISTORY

Audit / history:

```text
Project created
Supervisor assigned
Worker assigned
Worker removed
Worksite changed
Schedule changed
Attendance submitted
Attendance adjusted
```

Không xóa lịch sử assignment.

---

# 71. REMOVE ASSIGNMENT

Không hard delete record đã có lịch sử attendance.

Dùng:

```text
end_date
inactive
cancelled
```

và audit.

Nếu assignment chưa từng active/có dependency có thể delete theo policy.

---

# 72. RETROACTIVE ASSIGNMENT CHANGE

Nếu HR thay assignment quá khứ sau khi đã có attendance:

Không tự rewrite attendance snapshot.

Warning:

```text
Khoảng thời gian này đã có dữ liệu điểm danh.
Thay đổi phân công sẽ không tự thay đổi lịch sử đã ghi nhận.
```

Nếu cần chỉnh attendance, dùng adjustment flow riêng.

---

# 73. PROJECT CLOSURE

Khi project đóng:

- không xóa team
- không xóa attendance
- không xóa photos
- không cho tạo session mới sau close date nếu không có override
- history vẫn xem được

---

# 74. WORKSITE CLOSURE

Worksite inactive:

- không xuất hiện cho assignment mới
- historical attendance vẫn giữ

---

# 75. PROJECT UPDATE INTEGRATION HOOK

Prompt này chỉ có:

```text
work_note
```

ở attendance session.

Không xây full Project Updates.

Nhưng data model/API nên cho Project Update prompt sau có thể:

- reference project
- reference worksite
- reference worker attendance session
- reuse attendance photos nếu policy cho phép hoặc link reference

Không duplicate ảnh vô lý.

---

# 76. LEAVE INTEGRATION HOOK

Prompt nghỉ phép sau sẽ cung cấp:

```text
approved leave
```

Roster UI sau này phải có khả năng hiển thị:

```text
Nguyễn Văn A
Nghỉ phép đã duyệt
```

Không implement leave rules ở đây.

---

# 77. TIMESHEET INTEGRATION HOOK

Worker attendance phải đủ fact để Timesheet sau biết:

```text
date
worker
project
worksite
present/absent/leave
late
half-day
early leave
transfer
source
adjustment
```

Không tự tính payroll.

---

# 78. API GỢI Ý

Có thể:

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id

GET    /api/v1/projects/:id/team
POST   /api/v1/projects/:id/assignments
PATCH  /api/v1/project-assignments/:id

GET    /api/v1/projects/:id/roster?date=YYYY-MM-DD

GET    /api/v1/worker-attendance/sessions
POST   /api/v1/worker-attendance/sessions

GET    /api/v1/worker-attendance/sessions/:id
PATCH  /api/v1/worker-attendance/sessions/:id/draft
POST   /api/v1/worker-attendance/sessions/:id/submit
POST   /api/v1/worker-attendance/sessions/:id/adjustments
```

Không bắt buộc REST nếu project convention khác.

---

# 79. CONCURRENCY

Session cần:

```text
version
updated_at
```

Nếu hai device sửa cùng session:

```text
Dữ liệu đã được cập nhật từ thiết bị khác.
```

Không silent overwrite.

---

# 80. INDEXES

Thiết kế indexes phù hợp:

```text
project_id
worksite_id
worker_id
date
supervisor_id
status
```

Unique/idempotency constraint cho session.

Không để query roster/ngày scan toàn bảng.

---

# 81. OFFLINE PHOTO RETRY

Reuse Prompt 05:

```text
photo_status
sync_status
retry
```

Một ảnh fail không làm mất toàn bộ session.

Nếu final policy yêu cầu ít nhất 1 ảnh:

Session có thể:

```text
SUBMITTED_PENDING_PHOTO
```

hoặc equivalent.

Không duplicate session khi retry.

---

# 82. PHOTO MINIMUM

Admin config có thể:

```text
worker_attendance.minimum_photos = 1
```

hoặc:

```text
0
```

Không hard-code.

Nếu minimum = 1, review screen không submit final nếu không có ảnh hoặc policy offline cho phép pending photo.

---

# 83. WORK NOTE REQUIRED

Có config:

```text
worker_attendance.work_note_required
```

Default có thể false.

Không hard-code bắt giám sát viết báo cáo nếu công ty chưa yêu cầu.

---

# 84. SESSION DEADLINE

Có thể prepare config:

```text
morning_attendance_window
```

Ví dụ:

```text
06:00–09:00
```

Nhưng V1 không cần block cứng nếu policy chưa chốt.

Nếu outside window:

```text
Bạn đang điểm danh ngoài khung giờ thông thường.
```

Có thể vẫn cho submit + audit.

---

# 85. HUMAN-FRIENDLY ERRORS

Không show:

```text
409 UNIQUE CONSTRAINT
```

Show:

```text
Phiên điểm danh buổi sáng của công trường này đã được ghi nhận.
```

Không show raw GPS error.

---

# 86. ACCESSIBILITY

Mobile:

- touch target >=44px
- status không chỉ bằng màu
- row action dễ bấm
- photo capture button lớn
- summary đọc được
- keyboard support ở desktop
- screen reader labels

---

# 87. RESPONSIVE

Supervisor mobile là priority.

Desktop HR/PM:

- tables
- filters
- detail

Tablet:

- simplified tables/list
- roster vẫn thao tác tốt

Không horizontal overflow.

---

# 88. PERFORMANCE

Roster:

- không fetch toàn employee database
- chỉ fetch assigned roster

Photos:

- thumbnails
- lazy load
- full image on demand

Project list:

- pagination

Attendance list:

- date indexed
- pagination

---

# 89. SECURITY

Bắt buộc:

- project access server-side
- photo private
- no public storage
- no arbitrary project id access
- temporary worker input validated
- upload validated
- no raw PII leak
- no service-role client-side
- no trusting frontend roster status blindly

---

# 90. TEST CASES BẮT BUỘC

## Project

- create project
- create worksite
- assign supervisor
- assign worker
- date-range assignment
- inactive worksite
- closed project

## Roster

- correct workers for date
- assignment starts later
- assignment ended
- temporary support assignment
- overlapping assignment warning
- snapshot created

## Supervisor access

- assigned supervisor can access
- unassigned user cannot
- replacement supervisor works only date range
- direct URL unauthorized denied

## Worker attendance

- select all present
- mark exceptions
- add existing worker
- add temporary worker
- multiple photos
- review
- submit

## Offline

- roster cached
- lose network
- mark attendance
- capture photos
- close/reopen
- resume
- sync
- no duplicate

## Concurrency

- two supervisors same session
- conflict handled
- submitted session cannot overwrite

## Adjustment

- edit after submit requires reason
- history shows before/after

## Photo

- one session with many photos
- 20 workers do not create 20 duplicated photos
- private access
- viewer

## Routing

- wizard route refresh
- Back/Forward
- draft persists

---

# 91. ACCEPTANCE CRITERIA

## Project

- [ ] Project và Worksite tách concept.
- [ ] Assignment effective-dated.
- [ ] Supervisor không hard-code.
- [ ] Project role tách system role.
- [ ] Closed project giữ history.

## Worker identity

- [ ] Worker dùng ID, không dùng tên làm identity.
- [ ] Worker không cần account.
- [ ] Temporary worker supported.
- [ ] HR có thể hoàn thiện temporary profile.

## Roster

- [ ] Tự sinh từ assignment.
- [ ] Có daily snapshot.
- [ ] Không nhập lại tên.
- [ ] Có phát sinh ngoài lịch.
- [ ] Có conflict detection.

## Attendance

- [ ] Chấm tập thể theo session.
- [ ] Select all present.
- [ ] Exception status.
- [ ] Multiple photos.
- [ ] Photo thuộc session, không duplicate theo worker.
- [ ] Review trước submit.
- [ ] Edit after submit có reason/audit.

## Offline

- [ ] Draft persistent.
- [ ] Roster cached hợp lý.
- [ ] Photo local persistence.
- [ ] Retry.
- [ ] Idempotency.
- [ ] Resume after reload.

## UX

- [ ] Supervisor mobile cực đơn giản.
- [ ] 1 flow rõ.
- [ ] Không giant page.
- [ ] Routing thật.
- [ ] Touch-friendly.

## Integration

- [ ] Timesheet-ready.
- [ ] Leave-ready.
- [ ] Project update-ready.
- [ ] Excel stable photo link-ready.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.
- [ ] Mobile review pass.

---

# 92. THỨ TỰ TRIỂN KHAI

1. Inspect project/employee schema hiện tại.
2. Thiết kế Project.
3. Thiết kế Worksite.
4. Thiết kế Project Assignment.
5. Thiết kế roster generation.
6. Thiết kế roster snapshot.
7. Thiết kế worker attendance session.
8. Thiết kế attendance entries.
9. Thiết kế session photos.
10. Migrations/indexes.
11. Project APIs.
12. Assignment APIs.
13. Roster API.
14. Attendance session APIs.
15. Project desktop UI.
16. Team/schedule UI.
17. Supervisor mobile Today page.
18. Roster step.
19. Photo step.
20. Review step.
21. Offline/local persistence.
22. Sync/idempotency.
23. HR session viewer.
24. Adjustment/audit.
25. Tests.
26. Responsive/accessibility.
27. Lint/typecheck/build.
28. Báo cáo.

---

# 93. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Data model

- project
- worksite
- assignment
- roster
- session
- entries
- photos

## Authorization

- project scope
- supervisor scope
- permissions

## Offline

- cached roster
- local draft
- sync behavior

## UI routes

- project pages
- supervisor pages
- HR worker attendance pages

## Photo handling

- storage
- session linkage
- viewer
- stable route

## Integration readiness

- leave
- timesheet
- project update
- Excel

## Tests

- cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 94. QUY TẮC CUỐI

Không ép từng công nhân có điện thoại.

Không ép từng công nhân có tài khoản.

Không nhập lại tên công nhân mỗi ngày.

Không lưu tên thay cho worker ID.

Không duplicate ảnh tập thể cho từng worker.

Không gộp worker attendance với self attendance.

Không để supervisor point danh project không được phân công.

Không để refresh làm mất draft.

Không để retry tạo session duplicate.

Không sửa attendance đã submit mà không có audit.

Không tự tính lương trong module này.

Không tự xây full Project Update ở prompt này.

**Dừng sau khi Project/Worksite + Assignment + Daily Roster + Worker Attendance collective hoàn chỉnh, offline-safe, test/build pass và báo cáo kết quả.**

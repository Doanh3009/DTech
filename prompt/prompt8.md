# PROMPT 08 — CA LÀM, BẢNG CÔNG, ĐIỀU CHỈNH CÔNG, KHÓA KỲ VÀ EXPORT EXCEL NHIỀU SHEET TÙY CHỈNH

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
- chấm công cá nhân bằng camera + GPS + offline sync
- Project / Worksite
- phân công giám sát và công nhân
- điểm danh công nhân tập thể
- Nghỉ phép / Approval / Leave Ledger / PDF
- API-first
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai:

1. Ca làm việc.
2. Lịch làm việc.
3. Timesheet / bảng công.
4. Tổng hợp dữ liệu từ nhiều nguồn.
5. Đi trễ / về sớm / thiếu lượt chấm.
6. Nghỉ phép.
7. Điểm danh công nhân.
8. Công tác / trạng thái khác có thể mở rộng.
9. Điều chỉnh công của HR.
10. Lịch sử điều chỉnh.
11. Khóa kỳ công.
12. Mở khóa có kiểm soát.
13. Snapshot dữ liệu kỳ công.
14. Export Excel nhiều sheet.
15. Custom Excel Template.
16. Hyperlink ảnh chấm công ổn định.
17. Sheet đơn nghỉ.
18. Sheet phép năm.
19. Sheet lịch sử chấm công.
20. Export nhân sự / hồ sơ nhân viên theo cùng nền tảng report.
21. Permission đối với dữ liệu nhạy cảm.
22. Nền tảng Report & Export Engine dùng lại cho các module sau.

Không triển khai payroll/tính lương chi tiết trong prompt này.

---

# 1. NGUYÊN TẮC CỐT LÕI

Bảng công không phải là một table ghi tay.

Phải được tổng hợp từ các nguồn dữ liệu có cấu trúc:

```text
Self Attendance
+
Worker Attendance
+
Approved Leave
+
Shift / Work Schedule
+
Holiday / Non-working Days
+
Manual Adjustment
+
Project / Worksite Context
↓
TIMESHEET
```

Không được lấy Excel làm source of truth.

Source of truth là dữ liệu trong hệ thống.

Excel chỉ là:

```text
Snapshot / Report / Export
```

---

# 2. PHÂN BIỆT 3 LỚP DỮ LIỆU

Bắt buộc tách:

```text
RAW ATTENDANCE EVENTS
↓
DAILY TIMESHEET
↓
PERIOD SUMMARY
```

## Raw Attendance Events

Dữ liệu gốc:

```text
check-in
check-out
worker attendance session
leave
manual adjustment
```

## Daily Timesheet

Một nhân viên + một ngày.

## Period Summary

Một nhân viên + một kỳ công.

Không trộn tất cả vào một table duy nhất.

---

# 3. TIMESHEET SOURCE

Mỗi daily timesheet phải biết nguồn.

Ví dụ:

```text
SELF_ATTENDANCE
SUPERVISOR_ROSTER
APPROVED_LEAVE
MANUAL_ADJUSTMENT
SYSTEM_CALENDAR
```

Có thể có nhiều source cùng ngày.

Không ghi đè raw source khi HR chỉnh.

---

# 4. CA LÀM VIỆC

Tạo module/config:

```text
/settings/attendance/shifts
```

Mỗi shift:

```text
Mã ca *
Tên ca *
Giờ bắt đầu *
Giờ kết thúc *
Thời gian nghỉ nếu áp dụng
Grace period đi trễ
Grace period về sớm nếu dùng
Check-in earliest time
Check-in latest time nếu cần
Check-out earliest/latest nếu cần
Cross-midnight flag
Active
```

Không hard-code 08:00–17:00.

---

# 5. CROSS-MIDNIGHT SHIFT

Architecture phải hỗ trợ ca:

```text
22:00 → 06:00 hôm sau
```

Không assume shift start/end cùng ngày.

V1 có thể chưa dùng nhưng logic không được khóa.

---

# 6. LỊCH LÀM VIỆC

Cần có work calendar.

Concept:

```text
Employee / Department / Project
↓
Date
↓
Shift
```

Có thể assign shift theo:

- employee
- department
- project
- default company calendar

Cần precedence rõ.

Ví dụ:

```text
Employee override
> Project assignment
> Department schedule
> Company default
```

Nếu architecture khác hợp lý thì dùng, nhưng phải deterministic.

---

# 7. NGÀY NGHỈ / NGÀY LỄ

Admin có thể quản lý:

```text
Ngày lễ
Ngày nghỉ công ty
Ngày làm bù
```

Không hard-code danh sách năm.

Route:

```text
/settings/attendance/calendar
```

Mỗi holiday:

```text
Date
Name
Type
Applicable scope
Working / Non-working
```

---

# 8. DAILY TIMESHEET

Một record đại diện:

```text
employee
date
scheduled shift
actual attendance
leave
worker attendance
adjustment
computed status
work duration
late duration
early leave duration
exception flags
```

Không lưu chỉ một số `work_days`.

---

# 9. DAILY STATUS

Status có thể gồm:

```text
Đủ công
Đi trễ
Về sớm
Thiếu check-in
Thiếu check-out
Nghỉ phép
Nghỉ không lương
Vắng không phép
Công tác
Ngày nghỉ
Ngày lễ
Điểm danh công trường
Cần HR xử lý
```

Không hard-code UI dựa trên text.

Dùng stable code + localized label.

---

# 10. CHẤM CÔNG CÁ NHÂN

Timesheet phải đọc từ Prompt 05:

```text
attendance_events
```

Ví dụ:

```text
07:58 Check-in
17:05 Check-out
```

Không sửa raw event để làm đẹp bảng công.

Daily timesheet derive từ raw events + policy.

---

# 11. NHIỀU LẦN CHẤM TRONG NGÀY

Nếu một ngày có:

```text
07:58 IN
12:01 OUT
13:02 IN
17:05 OUT
```

Timesheet phải có logic pairing rõ.

Không lấy đơn giản:

```text
first check-in
last check-out
```

nếu policy thực tế cần break handling.

V1 có thể support:

- first IN
- last OUT
- lưu raw events đầy đủ

nhưng architecture phải không mất các event giữa ngày.

---

# 12. WORKER ATTENDANCE

Timesheet đọc từ Prompt 06:

```text
Worker Attendance Session
Worker Attendance Entry
```

Ví dụ:

```text
Present
Half-day
Absent
Leave
Early departure
Transfer
```

Nguồn phải là:

```text
SUPERVISOR_ROSTER
```

Không biến thành fake self check-in/out.

---

# 13. LEAVE INTEGRATION

Timesheet đọc Approved Leave từ Prompt 07.

Nếu:

```text
No attendance
+
Approved annual leave
```

thì status:

```text
Nghỉ phép
```

không phải:

```text
Vắng không phép
```

---

# 14. ATTENDANCE + LEAVE CONFLICT

Nếu có:

```text
Approved leave
+
Attendance event
```

tạo exception:

```text
ATTENDANCE_LEAVE_CONFLICT
```

Không silently discard attendance.

HR có thể review.

---

# 15. HALF-DAY LEAVE

Nếu:

```text
0.5 leave
+
0.5 attendance
```

daily timesheet phải support:

```text
work_fraction = 0.5
leave_fraction = 0.5
```

Không ép một day chỉ có một status duy nhất.

Có primary status + components nếu cần.

---

# 16. ĐI TRỄ

Late calculation phải dựa trên:

```text
shift start
+
grace period
+
effective check-in
```

Không hard-code 08:00.

Ví dụ:

```text
Shift start: 08:00
Grace: 5 phút
Check-in: 08:07

Late = 2 phút
```

Nếu policy khác, config.

---

# 17. VỀ SỚM

Tương tự:

```text
shift end
effective check-out
early-leave grace
```

Không hard-code.

---

# 18. MISSING CHECK-IN / CHECK-OUT

Không tự bịa giờ.

Nếu thiếu:

```text
Thiếu check-in
```

hoặc:

```text
Thiếu check-out
```

HR cần review.

Không dùng scheduled time tự động làm actual time nếu không có rule explicit.

---

# 19. MANUAL ADJUSTMENT

HR có thể điều chỉnh bảng công.

Nhưng không sửa raw attendance event gốc.

Phải tạo:

```text
Attendance Adjustment
```

Ví dụ:

```text
Original:
08:13

Adjusted effective:
08:01

Reason:
Nhân viên báo lỗi GPS
```

Raw event vẫn tồn tại.

---

# 20. ADJUSTMENT TYPES

Gợi ý:

```text
ADD_MISSING_CHECK_IN
ADD_MISSING_CHECK_OUT
ADJUST_EFFECTIVE_TIME
MARK_LEAVE
MARK_BUSINESS_TRIP
CORRECT_STATUS
CORRECT_WORK_FRACTION
OTHER
```

Không cho nhập arbitrary JSON.

---

# 21. ADJUSTMENT REQUEST VS HR DIRECT ADJUSTMENT

Có thể hỗ trợ hai nguồn:

```text
Employee request
HR direct adjustment
```

Prompt này tập trung HR adjustment + foundation.

Nếu employee request có workflow, có thể reuse Approval primitives từ Prompt 07.

Không cần xây quá sâu nếu chưa yêu cầu.

---

# 22. REASON BẮT BUỘC

Mọi adjustment ảnh hưởng công:

```text
reason *
```

Audit bắt buộc.

Không cho sửa mà không trace.

---

# 23. ADJUSTMENT HISTORY

Hiển thị:

```text
09/09/2026 10:03

Giờ vào
08:13 → 08:01

Người chỉnh:
HR A

Lý do:
Lỗi GPS
```

Không raw diff.

---

# 24. RECOMPUTE

Sau adjustment:

```text
recompute daily timesheet
```

Nếu kỳ chưa khóa.

Nếu kỳ đã khóa:

- không tự recompute
- yêu cầu unlock / controlled correction

---

# 25. TIMESHEET PERIOD

Tạo khái niệm:

```text
Timesheet Period
```

Ví dụ:

```text
Tháng 09/2026
01/09 → 30/09
```

Status:

```text
OPEN
REVIEWING
LOCKED
REOPENED
```

---

# 26. KHÓA KỲ CÔNG

HR có action:

```text
[ Khóa bảng công ]
```

Trước khi khóa, hệ thống kiểm tra:

```text
Thiếu check-in/out
Conflict leave
Pending adjustments
Pending offline sync
Worker attendance unresolved
```

Hiển thị summary.

Không cần block mọi warning nếu policy cho phép, nhưng high-severity conflict phải rõ.

---

# 27. SNAPSHOT KHI KHÓA

Khi period LOCKED:

Lưu snapshot hoặc immutable calculation version đủ để:

- export lại sau này
- không bị thay đổi nếu employee đổi department
- không bị thay đổi nếu shift policy đổi
- không bị thay đổi nếu project đổi tên

Snapshot nên gồm dữ liệu cần thiết, không duplicate PII quá mức.

---

# 28. KHÔNG TỰ THAY ĐỔI KỲ ĐÃ KHÓA

Nếu tháng 08 đã khóa, tháng 10 HR đổi:

```text
shift start
employee department
project name
```

thì bảng công tháng 08 không được đổi âm thầm.

---

# 29. MỞ KHÓA

Action:

```text
[ Mở khóa kỳ ]
```

Yêu cầu:

```text
Reason *
Permission cao
Audit
```

Sau unlock:

- cho phép adjustments
- recompute
- lock lại tạo version mới

---

# 30. VERSION KỲ CÔNG

Có thể lưu:

```text
version 1
version 2
```

Mỗi lần unlock + relock.

Report export phải biết version.

Không overwrite historical export context.

---

# 31. PERIOD SUMMARY

Một employee trong period:

```text
Scheduled workdays
Actual workdays
Worked hours
Late days
Late minutes
Early leave days
Early leave minutes
Annual leave days
Unpaid leave days
Absent days
Business trip days
Overtime hours nếu future
Exceptions
```

Không tính payroll amount.

---

# 32. ROUTING

Employee/HR:

```text
/timesheets
/timesheets/periods/:periodId
/timesheets/periods/:periodId/employees/:employeeId
/timesheets/exceptions
/timesheets/adjustments
```

Admin:

```text
/settings/attendance/shifts
/settings/attendance/calendar
/settings/attendance/policies
/settings/export-templates
```

Không giant page.

---

# 33. TIMESHEET LIST PAGE

Desktop:

```text
Bảng công tháng 09/2026

[Tháng] [Phòng ban] [Trạng thái] [Xuất Excel]

--------------------------------------------------
Mã NV | Họ tên | Công | Trễ | Nghỉ phép | Vắng | ...
--------------------------------------------------
```

Có filter.

Có status kỳ:

```text
Đang mở
Đang rà soát
Đã khóa
```

---

# 34. EMPLOYEE PERIOD DETAIL

Route:

```text
/timesheets/periods/:periodId/employees/:employeeId
```

Hiển thị từng ngày:

```text
09/09
Shift 08:00–17:00
Check-in 07:58
Check-out 17:05
Đủ công
```

Có:

- raw attendance
- leave
- project/worksite
- adjustment
- photo links
- history

---

# 35. EXCEPTION CENTER

Route:

```text
/timesheets/exceptions
```

Các loại:

```text
Thiếu check-in
Thiếu check-out
Attendance/leave conflict
GPS issue
Photo pending
Offline sync pending
Worker roster conflict
Duplicate source conflict
```

HR lọc và xử lý.

Đây là page rất quan trọng.

Không bắt HR tìm từng nhân viên.

---

# 36. REPORT & EXPORT ENGINE

Không hard-code mỗi report thành một file riêng không cấu hình.

Xây **Report / Export Template Engine**.

Admin route:

```text
/settings/export-templates
```

Mỗi template:

```text
Tên template
Loại report
Sheets
Columns
Column order
Column labels
Filters/defaults
Formatting options
Branding options
Active
```

---

# 37. REPORT TYPES

Ít nhất chuẩn bị:

```text
TIMESHEET
EMPLOYEE_LIST
EMPLOYEE_PROFILE
```

Tương lai:

```text
WAREHOUSE
SHIPMENT
PROJECT
```

Không hard-code engine chỉ cho bảng công.

---

# 38. CUSTOM TEMPLATE — PHẠM VI V1

Admin có thể chỉnh:

- tên template
- tên sheet
- sheet bật/tắt
- cột bật/tắt
- thứ tự cột
- tên header cột
- freeze header
- auto filter
- date format
- time format
- page orientation nếu export print settings
- logo/header có hoặc không
- default filters nếu cần

Không cho raw Excel formula tùy ý ở V1.

Không cho arbitrary macro/VBA.

---

# 39. TEMPLATE VERSIONING

Nếu admin sửa template:

- report mới dùng version mới
- report cũ đã export không thay đổi
- config history audit

Có thể store template version.

---

# 40. BẢNG CÔNG EXCEL — WORKBOOK MẶC ĐỊNH

Default template:

```text
01_Tong_hop_cong
02_Chi_tiet_cong
03_Lich_su_cham_cong
04_Don_nghi
05_Phep_nam
06_Lich_su_phep
```

Sheet 06 có thể optional.

Admin có thể bật/tắt.

---

# 41. SHEET 01 — TỔNG HỢP CÔNG

Các cột mặc định:

```text
Mã NV
Họ tên
Phòng ban
Chức vụ
Loại nhân sự

Công chuẩn
Công thực tế
Tổng giờ làm

Số ngày đi trễ
Tổng phút đi trễ

Số ngày về sớm
Tổng phút về sớm

Nghỉ phép
Nghỉ không lương
Vắng không phép

Công tác nếu có
Ngày lễ nếu có

Số ngày thiếu check-in
Số ngày thiếu check-out

Số ngoại lệ cần xử lý
```

Không nhét ảnh/GPS chi tiết vào sheet này.

---

# 42. SHEET 02 — CHI TIẾT CÔNG

Một dòng:

```text
1 employee + 1 date
```

Cột mặc định:

```text
Mã nhân viên
Họ tên
Phòng ban
Chức vụ
Loại nhân sự

Ngày
Thứ

Ca làm
Giờ ca bắt đầu
Giờ ca kết thúc

Nguồn ghi nhận

Giờ chấm vào
Địa điểm chấm vào
Trạng thái vị trí vào
Ảnh chấm vào

Giờ chấm ra
Địa điểm chấm ra
Trạng thái vị trí ra
Ảnh chấm ra

Điểm danh công trường
Ảnh điểm danh nếu áp dụng

Tổng giờ làm
Công thực tế

Đi trễ
Số phút trễ

Về sớm
Số phút về sớm

Loại nghỉ
Số ngày/giờ nghỉ

Trạng thái công
Ngoại lệ
Ghi chú HR
```

Admin có thể ẩn/đổi thứ tự cột.

---

# 43. ĐỊA ĐIỂM TRONG EXCEL

Không xuất mặc định:

```text
10.812345698343, 106.6523849234
```

HR cần:

```text
Công trường ABC
```

hoặc:

```text
Văn phòng Châu Tuấn
```

và:

```text
Hợp lệ
Ngoài phạm vi
```

Có thể có cột:

```text
Khoảng cách (m)
```

nếu template bật.

Raw coordinates chỉ trong advanced/internal export permission cao nếu thật sự cần.

Không mặc định.

---

# 44. SHEET 03 — LỊCH SỬ CHẤM CÔNG

Một dòng = một raw attendance event.

Ví dụ cột:

```text
Ngày giờ
Mã NV
Họ tên
Loại event
Nguồn
Project/Worksite nếu có
Địa điểm
Trạng thái GPS
Ảnh
Sync status
Client event ID nếu advanced template
Ghi chú
```

Không chỉ first IN / last OUT.

Giữ tất cả sự kiện.

---

# 45. SHEET 04 — ĐƠN NGHỈ

Một dòng = một leave request.

Cột:

```text
Mã đơn
Mã NV
Họ tên
Phòng ban

Ngày gửi
Giờ gửi

Loại nghỉ
Từ ngày
Đến ngày
Hình thức
Số ngày

Lý do
Trạng thái

Người duyệt
Ngày duyệt
Giờ duyệt
Ghi chú người duyệt
```

Lý do phải là nội dung request snapshot đã gửi.

---

# 46. SHEET 05 — PHÉP NĂM

Cột:

```text
Mã NV
Họ tên
Phòng ban

Năm
Phép được cấp
Phép chuyển kỳ
Điều chỉnh tăng
Điều chỉnh giảm
Đã sử dụng
Đang chờ duyệt
Còn lại chính thức
Khả dụng dự kiến
```

Không lấy số phép từ Excel.

Excel chỉ đọc Leave Ledger.

---

# 47. SHEET 06 — LỊCH SỬ PHÉP

Optional.

Một dòng = ledger transaction.

Cột:

```text
Ngày
Mã NV
Họ tên
Loại giao dịch
Tăng
Giảm
Tham chiếu
Lý do
Người thực hiện
```

---

# 48. ẢNH TRONG EXCEL

Không embed hàng nghìn ảnh vào workbook.

Dùng hyperlink.

Cell hiển thị:

```text
Xem ảnh
```

hoặc:

```text
Xem ảnh vào
Xem ảnh ra
Xem ảnh điểm danh
```

Không để raw URL dài hiển thị.

---

# 49. STABLE PHOTO LINK

Không ghi signed URL 30 ngày vào Excel.

Excel phải chứa URL ổn định của internal app.

Ví dụ:

```text
https://internal.example/attendance/photos/PHOTO_ID
```

hoặc route nội bộ tương đương.

Khi HR click:

```text
Browser
↓
Session auth
↓
Permission check
↓
Generate temporary storage access
↓
Render image
```

Không popup confirm.

Nếu HR đã login:

```text
1 click → ảnh
```

---

# 50. WORKER ATTENDANCE PHOTO LINK

Nếu worker thuộc một session có nhiều ảnh:

Cell:

```text
Xem ảnh điểm danh
```

mở:

```text
session gallery
```

Không duplicate 4 photo links vào 20 worker row nếu không cần.

Có thể cùng stable gallery route.

---

# 51. SESSION AUTH KHI CLICK EXCEL

Nếu chưa login:

```text
Excel click
↓
Login
↓
redirect back to requested image/gallery
```

Sau khi login, ảnh mở.

Không bắt confirm xem ảnh.

---

# 52. EXCEL STYLE

Workbook phải chuyên nghiệp nhưng nhẹ.

Yêu cầu:

- header rõ
- freeze top row
- auto filter
- reasonable column widths
- wrap text cho reason/note
- date stored as date cells nếu thư viện hỗ trợ
- time stored đúng
- number stored as number
- hyperlinks style rõ
- no merged cells tràn lan
- no decorative colors quá nhiều
- no massive logo
- no macros

---

# 53. FILTER CÓ SẴN

Mỗi data sheet nên:

- freeze header
- autofilter
- optional Excel table structure nếu library support ổn

HR mở file là lọc được ngay.

---

# 54. MULTI-SHEET DATA CONSISTENCY

Workbook phải dùng cùng snapshot/version của kỳ.

Không để:

```text
Sheet Tổng hợp = version 2
Sheet Chi tiết = version 1
```

Một export job phải pin:

```text
period version
template version
generated_at
```

---

# 55. EXPORT JOB

Nếu data lớn, không bắt request web chờ quá lâu.

Có thể xây:

```text
Export Job
```

Status:

```text
QUEUED
PROCESSING
COMPLETED
FAILED
```

V1 nếu dataset nhỏ có thể synchronous.

Architecture phải support async sau này.

---

# 56. EXPORT METADATA

Lưu:

```text
report_type
template_id
template_version
period_id
period_version
filters
requested_by
requested_at
completed_at
file_id
status
```

Không cần lưu file mãi mãi nếu retention policy khác, nhưng metadata nên có.

---

# 57. DOWNLOAD PERMISSION

Permission tách:

```text
timesheet.export
timesheet.export_detail
attendance.photo.view

employee.export_basic
employee.export_sensitive

leave.export
```

Không vì xem table mà được export tất cả dữ liệu.

---

# 58. EXPORT NHÂN SỰ

Report Engine phải support:

```text
EMPLOYEE_LIST
```

Template mặc định:

```text
NHÂN SỰ CƠ BẢN
```

Cột:

```text
Mã NV
Họ tên
Số điện thoại
Email
Phòng ban
Chức vụ
Ngày vào làm
Trạng thái
```

---

# 59. EXPORT NHÂN SỰ NHẠY CẢM

Template:

```text
NHÂN SỰ ĐẦY ĐỦ
```

có thể gồm:

```text
CCCD
Ngày cấp
Địa chỉ
BHXH
MST
Ngân hàng
Hợp đồng
```

Chỉ user có:

```text
employee.export_sensitive
```

Không gửi field nhạy cảm xuống client nếu không có quyền.

---

# 60. EXPORT HỒ SƠ MỘT NHÂN VIÊN

Report type:

```text
EMPLOYEE_PROFILE
```

Workbook có thể:

```text
01_Ho_so
02_Hop_dong
03_Qua_trinh_cong_tac
04_Cham_cong
05_Nghi_phep
06_Phep_nam
07_Tai_lieu
08_Lich_su_thay_doi
```

Không bắt buộc tất cả sheet nếu template khác.

---

# 61. QUÁ TRÌNH CÔNG TÁC

Sheet đọc từ Employment History Prompt 03.

Không chỉ lấy current department/position.

Ví dụ:

```text
01/05/2023
Gia nhập công ty

01/01/2024
Thay đổi chức vụ

01/06/2025
Điều chuyển phòng ban
```

---

# 62. DOCUMENT LINK TRONG EMPLOYEE EXPORT

Nếu export tài liệu:

Cell:

```text
Xem tài liệu
```

stable internal route.

Không public storage URL.

Permission check.

---

# 63. CUSTOM SHEET

V1 cho admin:

- bật/tắt sheet có sẵn
- đổi tên sheet
- đổi thứ tự

Không cho tự tạo arbitrary SQL query sheet.

Custom report builder nâng cao để V2.

---

# 64. CUSTOM COLUMN

Admin chọn từ whitelist field registry.

Ví dụ Timesheet Detail registry:

```text
employee.code
employee.name
employee.department
date
shift.name
attendance.check_in
attendance.check_out
attendance.photo_in_link
leave.type
timesheet.status
```

Không cho nhập raw DB column/SQL.

---

# 65. FIELD REGISTRY

Tạo typed report field registry:

Mỗi field có:

```text
key
label
data_type
permission
formatter
report_types
```

Ví dụ:

```text
employee.cccd
permission = employee.export_sensitive
```

Nếu user template có field sensitive nhưng người export không có quyền:

- không export field
- hoặc block export với message rõ

Ưu tiên không leak.

---

# 66. CUSTOM HEADER LABEL

Admin có thể đổi:

```text
"Giờ chấm vào"
→
"Giờ vào"
```

Không thay field meaning.

---

# 67. TEMPLATE PREVIEW

Admin có:

```text
[ Xem trước ]
```

Preview:

- sheet names
- columns
- first few sample rows / mock safe data
- formatting

Không cần generate full workbook mỗi lần nếu nặng.

---

# 68. TEMPLATE DUPLICATE

Cho:

```text
Nhân bản template
```

Ví dụ:

```text
Bảng công - HR
Bảng công - Kế toán
```

Không sửa default template duy nhất nếu muốn giữ baseline.

---

# 69. DEFAULT TEMPLATES

Seed:

```text
Bảng công - HR
Bảng công - Kế toán
Nhân sự cơ bản
Hồ sơ nhân viên
```

Có thể chỉnh.

Không hard-code IDs.

---

# 70. REPORT FILE NAME

Ví dụ:

```text
Bang_cong_2026_09.xlsx
Bang_cong_HR_2026_09.xlsx
Danh_sach_nhan_su_2026_09_09.xlsx
Ho_so_NV001_Nguyen_Van_A.xlsx
```

Sanitize.

---

# 71. EXCEL GENERATION SERVER-SIDE

Ưu tiên server-side generation.

Không phụ thuộc browser memory cho workbook lớn.

Không expose sensitive dataset toàn bộ cho frontend chỉ để generate file.

---

# 72. MEMORY / PERFORMANCE

Nếu nhiều records:

- stream/write row-by-row nếu library hỗ trợ
- pagination/chunk query
- không load hàng trăm MB vào memory
- image không embed nên file nhẹ hơn

---

# 73. TIMEZONE / FORMAT

Excel ngày giờ dùng Organization Settings:

```text
Asia/Ho_Chi_Minh
DD/MM/YYYY
HH:mm
```

Nhưng cell nên giữ date/time semantics nếu thư viện hỗ trợ, không chỉ string.

---

# 74. EMPTY VALUES

Không ghi:

```text
null
undefined
NaN
```

Dùng:

```text
trống
```

hoặc label phù hợp.

Không làm Excel bẩn.

---

# 75. BOOLEAN / STATUS

Không export raw:

```text
true
false
```

nếu user-facing.

Dùng:

```text
Có
Không
Hợp lệ
Không hợp lệ
```

---

# 76. RAW TECHNICAL COLUMNS

Không mặc định export:

```text
UUID
lat
lng
client_event_id
storage_path
sync retry count
```

Chỉ advanced diagnostic template nếu có permission.

HR report mặc định phải human-readable.

---

# 77. LOCKED PERIOD EXPORT

Nếu kỳ LOCKED:

Export dùng locked snapshot.

Nếu period OPEN:

File phải ghi metadata:

```text
Trạng thái kỳ: Chưa khóa
```

hoặc có sheet metadata/notice nhẹ.

Không làm HR tưởng là bản cuối.

---

# 78. EXPORT AUDIT

Audit:

```text
Ai export
Report type
Template
Period/filter
Time
Sensitive fields included?
```

Không log raw file content.

---

# 79. RE-EXPORT

Cho phép re-export kỳ cũ.

Nếu locked:

- cùng period version + template version có thể deterministic

Nếu template hiện tại khác:

User chọn:

```text
Template hiện tại
```

hoặc nếu lưu template version của lần trước thì có thể tái tạo lịch sử khi phù hợp.

---

# 80. CORRECTION AFTER LOCK

Flow:

```text
Unlock
↓
Reason
↓
Adjust
↓
Recompute
↓
Review
↓
Lock version 2
```

Không sửa directly locked rows bằng UI hack.

---

# 81. HR NOTE

Daily timesheet có thể có:

```text
HR note
```

Nhưng chỉnh note không nhất thiết thay work calculation.

Phân biệt:

```text
note-only
```

và:

```text
calculation adjustment
```

Audit khác nhau.

---

# 82. APPROVAL FOR ADJUSTMENT — FOUNDATION

Có thể config:

```text
attendance.adjustment_requires_approval
```

Nếu false:

HR có permission chỉnh trực tiếp.

Nếu true:

reuse Approval Workflow.

V1 có thể default false nếu chưa có policy.

Architecture phải support.

---

# 83. MOBILE EMPLOYEE TIMESHEET

Nhân viên xem:

```text
Bảng công tháng 09

09/09
07:58 → 17:05
Đủ công

08/09
08:13 → 17:02
Đi trễ 13 phút
```

Không desktop table.

Có detail ngày.

---

# 84. EMPLOYEE DISPUTE HOOK

Có thể chuẩn bị action:

```text
Báo sai công
```

Không bắt buộc implement workflow đầy đủ trong prompt này nếu scope quá lớn.

Nếu implement:

- tạo attendance adjustment request
- reason
- attachment optional
- reuse approvals

Không cho employee sửa timesheet trực tiếp.

---

# 85. PERMISSIONS

Gợi ý:

```text
shift.view
shift.manage

timesheet.self.view
timesheet.view_team
timesheet.view_all

timesheet.adjust
timesheet.lock
timesheet.unlock

timesheet.export
timesheet.export_detail

attendance.raw.view
attendance.photo.view

export_template.view
export_template.manage

report.employee_basic
report.employee_sensitive
```

Không hard-code role.

---

# 86. DATA MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
shifts
work_calendars
work_calendar_days
employee_shift_assignments

daily_timesheets
timesheet_periods
timesheet_period_versions
timesheet_adjustments
timesheet_exceptions

report_templates
report_template_versions
report_template_sheets
report_template_columns
report_exports
```

Nếu schema khác gọn hơn nhưng vẫn typed và maintainable thì dùng.

---

# 87. COMPUTATION VERSION

Timesheet calculation nên có:

```text
calculation_version
```

để sau này policy engine thay đổi không làm lịch sử khó giải thích.

Không cần full rules engine phức tạp.

---

# 88. RECOMPUTE JOB

Có service:

```text
recomputeTimesheet(employee, date)
recomputePeriod(period)
```

Không scatter calculation ở UI/API handlers.

Business logic tập trung.

---

# 89. TRANSACTIONAL CONSISTENCY

Lock period:

```text
validate
snapshot
version
status=LOCKED
```

phải transaction-safe.

Adjustment/recompute cũng cần consistency.

---

# 90. CONCURRENCY

Nếu HR A và HR B cùng chỉnh:

- optimistic version
- conflict message
- không overwrite silent

Nếu period đang lock:

- block concurrent edits

---

# 91. API GỢI Ý

Shifts:

```text
GET/POST/PATCH /api/v1/shifts
```

Timesheet:

```text
GET  /api/v1/timesheet-periods
POST /api/v1/timesheet-periods

GET  /api/v1/timesheet-periods/:id
GET  /api/v1/timesheet-periods/:id/entries

GET  /api/v1/timesheet-periods/:id/employees/:employeeId

POST /api/v1/timesheet-adjustments
POST /api/v1/timesheet-periods/:id/recompute
POST /api/v1/timesheet-periods/:id/lock
POST /api/v1/timesheet-periods/:id/unlock
```

Reports:

```text
GET/POST/PATCH /api/v1/report-templates
POST /api/v1/reports/export
GET  /api/v1/report-exports/:id
GET  /api/v1/report-exports/:id/download
```

---

# 92. SERVER-SIDE AUTHORIZATION

Server check:

- period scope
- employee scope
- adjustment permission
- lock/unlock permission
- report permission
- sensitive field permission
- photo permission

Không tin frontend.

---

# 93. TEST CASES — TIMESHEET

## Shift

- standard shift
- grace period
- cross-midnight
- holiday
- employee override

## Self attendance

- normal IN/OUT
- late
- early leave
- missing IN
- missing OUT
- multiple events

## Worker attendance

- present
- absent
- half-day
- transfer
- supervisor source

## Leave

- approved full day
- approved half-day
- pending leave
- leave + attendance conflict

## Adjustment

- add missing check-in
- edit effective time
- reason required
- raw event unchanged
- audit history

## Lock

- open → locked
- locked blocks edit
- unlock with reason
- relock version 2
- old version preserved

---

# 94. TEST CASES — EXCEL

## Workbook

- all default sheets
- optional sheet disabled
- custom column order
- custom column labels
- filters enabled
- freeze header
- Vietnamese text
- large reason wrap

## Photo links

- self attendance photo
- worker session gallery
- stable URL
- no signed URL expiry in workbook
- unauthorized user denied
- logged-in HR opens one-click

## Leave

- request reason exact snapshot
- approval timestamps
- balance sheet correct

## Sensitive export

- basic permission excludes CCCD/bank
- sensitive permission includes selected field
- API does not leak unauthorized field

## Locked period

- export pinned to correct version
- re-export stable
- template version recorded

## Performance

- large employee count
- no embedded photos
- file remains reasonable

---

# 95. ACCEPTANCE CRITERIA

## Shift / Calendar

- [ ] Ca configurable.
- [ ] Không hard-code giờ làm.
- [ ] Holiday/calendar configurable.
- [ ] Cross-midnight architecture ready.

## Timesheet

- [ ] Raw events tách daily timesheet.
- [ ] Daily timesheet tách period summary.
- [ ] Nguồn dữ liệu được giữ.
- [ ] Self attendance integrated.
- [ ] Worker attendance integrated.
- [ ] Leave integrated.
- [ ] Half-day supported.
- [ ] Conflict flagged.

## Adjustment

- [ ] Raw data không bị overwrite.
- [ ] Reason required.
- [ ] Audit.
- [ ] Recompute.
- [ ] Concurrency safe.

## Period Lock

- [ ] Open/review/lock.
- [ ] Locked period immutable.
- [ ] Unlock permission + reason.
- [ ] Versioning.
- [ ] Historical snapshot stable.

## Excel

- [ ] Multi-sheet workbook.
- [ ] Template configurable.
- [ ] Sheet toggle/reorder.
- [ ] Column toggle/reorder/rename.
- [ ] Freeze header.
- [ ] Auto filter.
- [ ] Human-readable data.
- [ ] No raw lat/lng by default.
- [ ] No embedded attendance images.
- [ ] Stable internal photo links.
- [ ] Leave sheets.
- [ ] Leave balance sheet.
- [ ] Export metadata/version.

## Employee Reports

- [ ] Basic employee export.
- [ ] Sensitive employee export permission.
- [ ] Employee profile workbook.
- [ ] Employment history.

## Security

- [ ] Server-side report permission.
- [ ] Sensitive fields filtered before frontend/export.
- [ ] Private document/photo links.
- [ ] Export audit.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Excel generation tests pass.
- [ ] Production build pass.
- [ ] Large export performance reviewed.

---

# 96. THỨ TỰ TRIỂN KHAI

1. Inspect attendance/leave/project data hiện tại.
2. Thiết kế Shift.
3. Thiết kế Work Calendar.
4. Thiết kế Daily Timesheet.
5. Thiết kế Period Summary.
6. Thiết kế calculation service.
7. Self attendance integration.
8. Worker attendance integration.
9. Leave integration.
10. Exception engine.
11. Adjustment model.
12. Period lock/version.
13. Migrations/indexes.
14. APIs.
15. HR timesheet UI.
16. Employee mobile timesheet.
17. Exception Center.
18. Adjustment UI.
19. Lock/unlock UI.
20. Report Template Engine.
21. Default Timesheet template.
22. Employee reports.
23. Stable photo/document hyperlinks.
24. Excel generator.
25. Export audit.
26. Tests.
27. Large-data review.
28. Lint/typecheck/build.
29. Báo cáo.

---

# 97. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Timesheet model

- raw source integration
- daily calculation
- period summary

## Shift / Calendar

- config
- precedence

## Adjustments

- model
- audit
- recompute behavior

## Period Lock

- lifecycle
- version strategy
- snapshot strategy

## Report Engine

- template model
- field registry
- permissions
- default templates

## Excel

- sheets
- hyperlinks
- formatting
- performance

## Employee exports

- basic
- sensitive
- employee profile

## Tests

- test cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 98. QUY TẮC CUỐI

Không dùng Excel làm source of truth.

Không hard-code ca 08:00–17:00.

Không overwrite raw attendance khi HR chỉnh công.

Không bịa check-in/check-out khi thiếu dữ liệu.

Không để leave conflict bị ghi đè âm thầm.

Không để kỳ đã khóa thay đổi theo config hiện tại.

Không embed hàng nghìn ảnh vào Excel.

Không đưa signed URL hết hạn trực tiếp vào Excel.

Không export raw GPS mặc định.

Không cho custom template chạy raw SQL/VBA.

Không leak CCCD/ngân hàng vì user có quyền xem bảng công.

Không triển khai payroll trong prompt này.

**Dừng sau khi Shift + Timesheet + Adjustment + Period Lock + Report/Excel Engine hoàn chỉnh, test/build pass và báo cáo kết quả.**

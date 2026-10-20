# PROMPT 07 — NGHỈ PHÉP, ĐƠN TỪ, PHÊ DUYỆT, SỐ DƯ PHÉP NĂM VÀ XUẤT PDF CHUẨN VĂN BẢN

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
- Admin Console / Branding / Organization Settings
- chấm công cá nhân
- Project / Worksite
- phân công giám sát và công nhân
- điểm danh công nhân tập thể
- API-first
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai:

1. Đơn xin nghỉ.
2. Loại nghỉ.
3. Quy trình phê duyệt.
4. Số dư phép năm.
5. Lịch sử phép.
6. Nghỉ nửa ngày.
7. Nghỉ nhiều ngày.
8. Hủy / thu hồi đơn.
9. Điều chỉnh phép của HR.
10. Liên kết dữ liệu nghỉ với chấm công và bảng công tương lai.
11. Xuất PDF chuẩn văn bản.
12. Lưu snapshot của đơn và quyết định phê duyệt.
13. Mobile self-service cho nhân viên.
14. Desktop management cho HR / quản lý.

Không triển khai sâu:

- bảng công tổng hợp cuối tháng
- tính lương
- Report Engine Excel đầy đủ
- project update
- kho / XNK

Các phần đó có prompt riêng.

---

# 1. MỤC TIÊU NGHIỆP VỤ

Thay vì nhân viên:

```text
nhắn Zalo / viết giấy / báo miệng
```

hệ thống phải cho:

```text
Nhân viên
↓
Tạo đơn nghỉ
↓
Hệ thống kiểm tra lịch + số dư phép
↓
Gửi duyệt
↓
Người có trách nhiệm duyệt
↓
HR / hệ thống ghi nhận
↓
Số dư phép cập nhật
↓
Chấm công / bảng công nhận biết ngày nghỉ
↓
Có thể xuất PDF chuẩn văn bản
```

Dữ liệu trong hệ thống là **nguồn dữ liệu chuẩn**.

PDF là **bản biểu diễn / lưu trữ / in ấn**, không phải nguồn dữ liệu chính.

---

# 2. ĐƠN NGHỈ KHÔNG CHỈ LÀ MỘT FORM

Không làm một table đơn giản:

```text
employee_id
from_date
to_date
reason
```

Phải có đầy đủ lifecycle:

```text
Draft
Submitted
Pending Approval
Approved
Rejected
Cancelled
Withdrawn
```

Có lịch sử thay đổi và phê duyệt.

---

# 3. ROUTING

Bắt buộc route thật.

Employee:

```text
/leave
/leave/new
/leave/my-requests
/leave/requests/:id
/leave/balance
```

Manager / HR:

```text
/approvals/leave
/leave/manage
/leave/manage/:id
/leave/balances
/leave/adjustments
```

Admin configuration:

```text
/settings/leave
/settings/leave/types
/settings/leave/workflows
/settings/leave/policies
```

Không giant page state-only.

---

# 4. LOẠI NGHỈ

Admin có thể cấu hình các loại nghỉ.

Ví dụ:

```text
Nghỉ phép năm
Nghỉ không lương
Nghỉ bệnh
Nghỉ thai sản
Nghỉ bù
Công tác
Nghỉ khác
```

Không hard-code chỉ một loại nghỉ.

Mỗi loại cần config:

```text
Tên *
Mã *
Màu semantic nhẹ nếu cần
Có trừ phép năm hay không
Có yêu cầu lý do hay không
Có yêu cầu tài liệu hay không
Cho phép nửa ngày hay không
Cho phép nhiều ngày hay không
Workflow áp dụng
Active / Inactive
```

Không cho admin cấu hình arbitrary business code.

---

# 5. PHÂN BIỆT "NGHỈ" VÀ "CÔNG TÁC"

Có thể dùng cùng Request Engine nếu hợp lý, nhưng domain status phải rõ.

Ví dụ:

```text
Leave Request
Business Trip Request
Attendance Adjustment Request
```

Prompt này tập trung Leave.

Không ép tất cả loại đơn vào cùng một table nếu làm domain khó hiểu.

Có thể dùng base request + typed request nếu architecture hợp lý.

---

# 6. FORM TẠO ĐƠN NGHỈ

Route:

```text
/leave/new
```

Field tối thiểu:

```text
Loại nghỉ *
Từ ngày *
Đến ngày *
Hình thức nghỉ *
Lý do *
Tài liệu đính kèm nếu loại nghỉ yêu cầu
```

Hình thức:

```text
Cả ngày
Buổi sáng
Buổi chiều
```

Nếu nhiều ngày:

- chỉ cho half-day ở ngày đầu/cuối nếu policy hỗ trợ
- hoặc đơn giản hóa V1 theo rule rõ

Không cho chọn range vô lý.

---

# 7. HIỂN THỊ THÔNG TIN NGAY TRÊN FORM

Trước khi gửi, nhân viên phải thấy:

```text
Số ngày dự kiến: 2 ngày

Phép năm hiện tại: 10 ngày
Đang chờ duyệt: 1 ngày
Khả dụng: 9 ngày

Sau khi đơn này được duyệt:
Còn lại dự kiến: 7 ngày
```

Chỉ hiển thị dữ liệu phù hợp loại nghỉ có trừ phép.

Không gây hiểu nhầm rằng pending đã trừ chính thức.

---

# 8. TÍNH SỐ NGÀY NGHỈ

Không tính đơn giản:

```text
to_date - from_date + 1
```

Phải xét:

- lịch làm việc
- ngày nghỉ tuần
- ngày lễ
- ca làm nếu có
- nửa ngày
- ngày không làm

Tận dụng work calendar/config foundation.

Nếu chưa có full calendar engine, xây abstraction rõ để bổ sung.

---

# 9. HALF-DAY

Hỗ trợ:

```text
Buổi sáng = 0.5
Buổi chiều = 0.5
```

Timesheet sau này phải hiểu:

```text
0.5 nghỉ
0.5 làm
```

Không lưu half-day chỉ bằng text không cấu trúc.

---

# 10. LEAVE BALANCE — NGUYÊN TẮC

Không cho HR chỉ nhập:

```text
Số ngày phép còn lại = 7
```

làm source of truth.

Số dư phải được tính từ ledger.

Concept:

```text
Opening / Granted
+ Carryover
+ Positive adjustments
- Negative adjustments
- Approved leave used
= Remaining
```

Pending được theo dõi riêng.

---

# 11. LEAVE BALANCE VIEW

Ví dụ:

```text
Năm 2026

Phép được cấp:         12
Chuyển từ năm trước:   +2
Điều chỉnh:            +1
Đã sử dụng:            -5
Đang chờ duyệt:         2

Còn lại chính thức:    10
Khả dụng nếu pending được duyệt: 8
```

Tên field/công thức phải rõ.

Không dùng một số `remaining_leave` mutable duy nhất nếu không có ledger.

---

# 12. LEAVE LEDGER

Mỗi biến động phép phải là một transaction/event.

Ví dụ:

```text
01/01/2026
Cấp phép năm
+12

01/01/2026
Chuyển từ 2025
+2

15/03/2026
Đơn nghỉ LV-0012
-1

22/04/2026
HR điều chỉnh
+1

09/09/2026
Đơn nghỉ LV-0037
-2
```

Mỗi entry:

```text
employee_id
leave_year
leave_type / balance_bucket
transaction_type
amount
reference_type
reference_id
effective_date
reason
created_by
created_at
```

---

# 13. TRANSACTION TYPE

Gợi ý:

```text
GRANT
CARRYOVER
ADJUSTMENT_ADD
ADJUSTMENT_SUBTRACT
LEAVE_USAGE
LEAVE_REVERSAL
EXPIRY
```

Không hard-code logic dựa trên description text.

---

# 14. PHÉP NĂM THEO NĂM

Balance phải gắn:

```text
employee
year
leave bucket/type
```

Không dùng một số phép cho toàn bộ lịch sử.

Năm 2026 và 2027 phải tách.

---

# 15. CẤP PHÉP ĐẦU KỲ

HR/Admin có thể:

- cấp hàng loạt
- cấp theo nhân viên
- import sau này nếu Report/Import Engine hỗ trợ

Prompt này có thể xây action:

```text
Cấp phép năm
```

với preview trước khi post.

Không auto tạo nhiều ledger entry trùng nếu action chạy lại.

Idempotency nếu batch.

---

# 16. CARRYOVER

Có config/policy:

```text
Cho chuyển phép năm trước
Số ngày tối đa
Ngày hết hạn phép chuyển
```

Nếu công ty chưa chốt policy:

- không hard-code
- để config
- default đơn giản/an toàn

---

# 17. ADJUSTMENT CỦA HR

HR có thể:

```text
+ Điều chỉnh phép
```

Field:

```text
Nhân viên
Năm
Loại phép
Tăng / Giảm
Số ngày
Lý do *
Ngày hiệu lực
```

Audit bắt buộc.

Không sửa trực tiếp balance number.

---

# 18. SỐ DƯ ÂM

Policy config:

```text
allow_negative_balance
```

Nếu false:

- không cho submit hoặc không cho approve tùy policy

Nếu true:

- warning rõ

Không hard-code.

---

# 19. PENDING LEAVE

Pending không trừ official ledger usage.

Có thể tính:

```text
pending_reserved_days
```

ở query/derived view.

Nếu đơn bị rejected/withdrawn:

- pending biến mất
- không cần reversal ledger nếu chưa post usage

Nếu approved:

- post `LEAVE_USAGE`

---

# 20. APPROVAL WORKFLOW

Không hard-code:

```text
Employee → Manager → HR
```

Admin có thể cấu hình workflow.

Ví dụ:

```text
Nhân viên
↓
Quản lý trực tiếp
↓
HR
```

Hoặc:

```text
Nhân viên
↓
Trưởng phòng
```

Hoặc theo loại nghỉ.

---

# 21. WORKFLOW DEFINITION

Workflow cần support step:

```text
Step order
Approver source
Required / Optional
Approval mode
```

Approver source có thể là:

```text
Direct Manager
Department Manager
Specific Role
Specific User
HR Role
Project Manager nếu future cần
```

Không dùng tên người hard-code vào source code.

---

# 22. WORKFLOW SNAPSHOT

Khi đơn được submit:

Phải snapshot workflow áp dụng.

Ví dụ hôm nay:

```text
Manager → HR
```

Tuần sau admin đổi thành:

```text
Manager only
```

Đơn cũ vẫn phải tiếp tục theo workflow đã snapshot.

Không thay đổi lịch sử pending request âm thầm.

---

# 23. APPROVAL STATE

Mỗi step:

```text
PENDING
APPROVED
REJECTED
SKIPPED
CANCELLED
```

Request overall:

```text
DRAFT
SUBMITTED
PENDING_APPROVAL
APPROVED
REJECTED
WITHDRAWN
CANCELLED
```

Không chỉ một field `approved: boolean`.

---

# 24. REQUEST NUMBER

Mỗi đơn có mã ổn định.

Ví dụ:

```text
LV-2026-000123
```

Không dùng database UUID làm mã hiển thị chính.

Mã đơn unique.

Format có thể config sau, nhưng không làm admin chỉnh tùy ý quá mức ở V1.

---

# 25. SUBMIT FLOW

```text
Draft
↓
Validate
↓
Calculate leave days
↓
Check balance/policy
↓
Snapshot employee basic info cần thiết
↓
Snapshot workflow
↓
Create approval steps
↓
Submitted
↓
Notify approver
```

Không tạo ledger `LEAVE_USAGE` ở bước submit.

---

# 26. APPROVE FLOW

Khi step approve:

```text
actor
timestamp
comment
step
```

Nếu còn step:

```text
Pending next step
```

Nếu final approve:

```text
Request = APPROVED
↓
Post leave usage ledger nếu có trừ phép
↓
Emit integration event
```

Phải transactional/idempotent.

Không để approve double-click trừ phép hai lần.

---

# 27. REJECT FLOW

Reject:

- yêu cầu lý do nếu policy
- request = REJECTED
- không trừ phép
- notify requester
- audit

Không xóa đơn.

---

# 28. WITHDRAW TRƯỚC KHI DUYỆT

Nhân viên có thể:

```text
Thu hồi đơn
```

nếu workflow/policy cho phép.

Request:

```text
WITHDRAWN
```

Giữ lịch sử.

Không hard delete.

---

# 29. CANCEL SAU KHI ĐÃ DUYỆT

Đây là nghiệp vụ khác withdrawal.

Ví dụ đơn đã approved nhưng kế hoạch thay đổi.

Flow:

```text
Request cancellation
↓
Approval nếu policy yêu cầu
↓
Original request remains Approved/Cancelled status context
↓
Post LEAVE_REVERSAL
↓
Restore balance
```

Không chỉ sửa approved → draft.

Phải audit.

---

# 30. EDIT ĐƠN

Draft:

- edit tự do theo validation

Submitted/Pending:

Ưu tiên:

```text
Withdraw
→ Edit/Create revised request
```

hoặc controlled revision.

Không cho sửa ngày/lý do sau khi approver đã duyệt step mà không reset workflow.

Nếu implement revision:

- version
- reason
- approval reset policy rõ

Đừng làm overly complex nếu V1 chưa cần.

---

# 31. FILE ATTACHMENT

Một số leave type có thể cần:

- giấy xác nhận
- chứng từ
- file ảnh/PDF

Storage private.

Validate:

- MIME
- file size
- extension
- no executable

Permissions phù hợp.

---

# 32. NOTIFICATION HOOK

Emit event:

```text
leave.submitted
leave.approval_required
leave.approved
leave.rejected
leave.withdrawn
leave.cancelled
```

Prompt này không cần xây full notification engine nếu chưa có.

Nhưng UI notification có thể dùng existing foundation.

---

# 33. MOBILE — NHÂN VIÊN

Mobile `Đơn từ` cần cực đơn giản.

List:

```text
Đơn của tôi

09/09
Nghỉ phép năm
1 ngày
Chờ duyệt

15/08
Nghỉ phép năm
0.5 ngày
Đã duyệt
```

CTA:

```text
+ Tạo đơn
```

---

# 34. MOBILE FORM

Một cột.

Field lớn, touch-friendly.

Hiển thị summary cuối form:

```text
Nghỉ: 2 ngày
Loại: Nghỉ phép năm
Số dư hiện tại: 10
Dự kiến còn lại sau duyệt: 8

[ GỬI ĐƠN ]
```

Không nhét approval technical detail.

---

# 35. REQUEST DETAIL — EMPLOYEE

Hiển thị:

```text
Mã đơn
Trạng thái
Loại nghỉ
Thời gian nghỉ
Số ngày
Lý do
Tài liệu
Ngày gửi
Quy trình duyệt
```

Timeline:

```text
09:12
Đã gửi đơn

10:03
Trưởng phòng đã duyệt

11:20
HR đã duyệt
```

---

# 36. APPROVER MOBILE UX

Manager xem:

```text
Nguyễn Văn A
Nghỉ phép năm

Từ 10/09 → 11/09
2 ngày

Lý do:
...

Phép còn lại:
10 ngày

[ TỪ CHỐI ] [ DUYỆT ]
```

Không duyệt trực tiếp từ dense list nếu chưa thấy context đủ.

---

# 37. DESKTOP APPROVAL LIST

Route:

```text
/approvals/leave
```

Table:

```text
Mã đơn
Nhân viên
Phòng ban
Loại nghỉ
Từ ngày
Đến ngày
Số ngày
Ngày gửi
Trạng thái
```

Filter:

```text
Chờ tôi duyệt
Trạng thái
Phòng ban
Loại nghỉ
Ngày nghỉ
Ngày gửi
```

---

# 38. BULK APPROVAL

V1 không cần bulk approve nếu dễ gây sai.

Nếu implement:

- chỉ cùng loại/context đơn giản
- require review
- audit từng request

Mặc định ưu tiên approve từng đơn.

---

# 39. HR LEAVE MANAGEMENT

Route:

```text
/leave/manage
```

HR xem:

- tất cả đơn
- balance
- adjustments
- conflicts
- approved leave calendar

Không cần calendar phức tạp nếu list đủ.

---

# 40. LEAVE BALANCE PAGE

Route:

```text
/leave/balances
```

Table:

```text
Mã NV
Họ tên
Phòng ban
Phép được cấp
Chuyển kỳ
Điều chỉnh
Đã sử dụng
Đang chờ
Còn lại
```

Filter:

```text
Năm
Phòng ban
Nhân viên
```

Không cho edit `Còn lại` trực tiếp trong table.

---

# 41. LEAVE HISTORY / LEDGER UI

Employee detail:

```text
/employees/:id/leave
```

hoặc integration route existing.

Hiển thị:

```text
Số dư
Đơn nghỉ
Lịch sử biến động phép
```

Ledger:

```text
Ngày
Nội dung
Tăng
Giảm
Tham chiếu
```

---

# 42. LIÊN KẾT VỚI CHẤM CÔNG CÁ NHÂN

Nếu ngày 09/09:

```text
No check-in
```

nhưng có:

```text
Approved Leave
```

Timesheet sau này phải hiểu:

```text
Nghỉ phép
```

không phải:

```text
Vắng không phép
```

Prompt này phải expose query/service:

```text
getApprovedLeaveForEmployeeDate(...)
```

hoặc domain interface tương đương.

---

# 43. LIÊN KẾT VỚI WORKER ATTENDANCE

Khi tạo roster ngày:

Nếu worker có approved leave:

UI có thể hiển thị:

```text
Nguyễn Văn A
Nghỉ phép đã duyệt
```

Giám sát không cần tự ghi lại.

Prompt 06 integration hook phải được nối.

---

# 44. CONFLICT VỚI ATTENDANCE

Nếu đã có attendance event và sau đó có approved leave cùng thời gian:

Không silently overwrite.

Tạo conflict/flag:

```text
Có dữ liệu chấm công trùng thời gian nghỉ.
```

HR review hoặc policy xử lý.

Không xóa attendance gốc.

---

# 45. CONFLICT VỚI PROJECT ASSIGNMENT

Nếu employee xin nghỉ nhưng đang có project assignment:

Không cấm submit.

Có thể warning:

```text
Bạn đang được phân công tại Cảng ABC trong thời gian này.
```

Approver thấy context.

Không tự xóa assignment.

---

# 46. CONFLICT NHIỀU ĐƠN NGHỈ

Không cho hai approved/pending request overlap bất hợp lý.

Khi create:

- check overlap
- warning hoặc block

Ví dụ:

```text
Bạn đã có đơn nghỉ trong khoảng thời gian này.
```

---

# 47. PDF — MỤC TIÊU

Mỗi đơn phải có action:

```text
[ Xuất PDF ]
```

Nhân viên có thể lưu/in/gửi khi cần.

HR/Approver cũng có thể xuất nếu có permission.

PDF phải là **văn bản doanh nghiệp chuẩn, sạch, dễ in A4**, không phải screenshot web.

---

# 48. PDF KHÔNG PHẢI ẢNH SCREENSHOT

Không dùng:

```text
html screenshot → image → PDF
```

nếu làm text mờ/khó chọn.

Ưu tiên generate PDF text/vector chuẩn bằng server-side PDF renderer hoặc HTML-to-PDF có layout kiểm soát.

Text phải selectable/searchable nếu công nghệ cho phép.

---

# 49. PDF A4

Format:

```text
A4 portrait
Margins hợp lý
Font hỗ trợ tiếng Việt
Không lỗi dấu
Không cắt nội dung
```

Nếu lý do dài:

- wrap
- paginate
- giữ header/footer hợp lý

---

# 50. PDF BRANDING

Lấy từ Admin Console:

```text
Logo
Tên công ty
Địa chỉ
Điện thoại
Email
Mã số thuế nếu cần
```

Không hard-code Châu Tuấn trong PDF generator.

---

# 51. PDF TITLE

Ví dụ:

```text
ĐƠN XIN NGHỈ PHÉP
```

Nếu loại nghỉ khác, title có thể:

```text
ĐƠN XIN NGHỈ
```

hoặc template phù hợp.

Không cố tạo ngôn ngữ pháp lý mà business chưa xác nhận.

---

# 52. PDF NỘI DUNG

PDF nên có:

```text
Mã đơn

Họ và tên
Mã nhân viên
Phòng ban
Chức vụ

Loại nghỉ
Thời gian nghỉ
Số ngày nghỉ

Lý do
Nội dung nguyên văn của người gửi

Ngày giờ gửi đơn

Trạng thái hiện tại

Thông tin phê duyệt
- Người duyệt
- Chức danh/vai trò
- Trạng thái
- Ngày giờ duyệt
- Ghi chú nếu có

Ngày xuất PDF
```

Không đưa dữ liệu nhạy cảm không cần như CCCD/ngân hàng.

---

# 53. NỘI DUNG LÝ DO PHẢI SNAPSHOT

PDF và lịch sử phải dùng nội dung request version đã submit/approved.

Không lấy một field mutable hiện tại nếu request từng bị revision.

Nội dung lý do phải giữ nguyên.

---

# 54. PDF DRAFT / PENDING / APPROVED

PDF phản ánh trạng thái.

Ví dụ:

```text
TRẠNG THÁI: CHỜ DUYỆT
```

hoặc:

```text
TRẠNG THÁI: ĐÃ DUYỆT
```

Nếu rejected:

```text
TRẠNG THÁI: TỪ CHỐI
```

Có reason nếu policy.

---

# 55. PDF KHÔNG GIẢ MẠO CHỮ KÝ

Không render chữ ký tay giả.

Nếu approver đã duyệt trên hệ thống, có thể hiển thị:

```text
Đã phê duyệt trên hệ thống
Nguyễn Văn B
10/09/2026 09:30
```

Đây là approval record, không tuyên bố là chữ ký số pháp lý.

Nếu tương lai có e-signature, sẽ có module riêng.

---

# 56. VERIFICATION

Có thể thêm:

```text
Mã đơn
Mã xác minh / QR
```

trỏ đến route nội bộ:

```text
/leave/requests/:id
```

Nhưng chỉ nếu permission/login phù hợp.

Không tạo public endpoint lộ thông tin nhân sự.

V1 có thể chỉ dùng mã đơn.

---

# 57. PDF SNAPSHOT

Khi request approved, cân nhắc lưu:

```text
approved_snapshot
```

bao gồm:

- employee name
- department
- position
- leave dates
- reason
- approval chain
- organization branding version

Mục tiêu:

PDF xuất sau 2 năm vẫn có dữ liệu lịch sử phù hợp.

Không cần lưu PDF binary mới mỗi lần nếu có thể generate deterministic từ snapshot.

---

# 58. PDF VERSION

Nếu request thay đổi hợp lệ:

```text
Version 1
Version 2
```

PDF phải chỉ rõ version nếu cần.

Không để cùng mã đơn nhưng nội dung thay đổi mà không trace.

---

# 59. PDF FILE NAME

Gợi ý:

```text
Don_xin_nghi_LV-2026-000123_Nguyen_Van_A.pdf
```

Sanitize filename.

Không nhét CCCD.

---

# 60. PDF ACCESS

Endpoint:

```text
GET /api/v1/leave-requests/:id/pdf
```

hoặc server action tương đương.

Check permission:

- requester xem đơn mình
- approver có scope
- HR
- admin permission

Không public PDF URL.

---

# 61. PDF CACHE

Có thể cache approved PDF nếu immutable snapshot.

Nếu request pending và thay đổi:

- invalidate.

Không cache private PDF public/CDN vô kiểm soát.

---

# 62. PDF TEMPLATE CONFIG — FOUNDATION

Admin có thể chỉnh sau:

- logo
- company info
- footer
- template name

Nhưng không cho raw HTML template tùy ý ở V1.

Report/PDF template builder nếu cần sẽ có prompt riêng.

---

# 63. APPROVAL COMMENT

Approver có:

```text
Ghi chú
```

Reject reason có thể bắt buộc.

Approval comment optional.

Không overwrite comment.

---

# 64. DELEGATED APPROVAL — PREPARE

Tương lai có thể:

- người duyệt nghỉ phép
- ủy quyền khi vắng

Prompt này chỉ chuẩn bị approver resolver abstraction.

Không cần full delegation UI nếu chưa yêu cầu.

---

# 65. APPROVER MISSING

Nếu employee không có direct manager mà workflow yêu cầu manager:

Không fail bí ẩn.

Show:

```text
Chưa xác định người duyệt cho đơn này.
Vui lòng liên hệ HR.
```

HR/Admin có queue:

```text
Đơn chưa xác định người duyệt
```

Không auto approve.

---

# 66. USER OFFBOARDING

Nếu approver nghỉ việc giữa workflow:

Resolver không được tự thay đổi snapshot tùy tiện.

HR/Admin có action:

```text
Chuyển người duyệt
```

Reason + audit.

---

# 67. PERMISSIONS

Gợi ý:

```text
leave.self.view
leave.self.create
leave.self.withdraw

leave.approve
leave.view_team
leave.view_all

leave.balance.view_self
leave.balance.view_all
leave.balance.adjust

leave.type.manage
leave.workflow.manage
leave.policy.manage

leave.pdf.export_self
leave.pdf.export_all
```

Không hard-code role.

---

# 68. AUTHORIZATION SCOPE

Approver phải có:

```text
permission
+
request assigned to them / scope
```

Không chỉ `leave.approve` là được duyệt mọi đơn nếu permission semantics không phải all-scope.

Có thể tách:

```text
leave.approve_assigned
leave.approve_all
```

---

# 69. AUDIT

Audit bắt buộc:

```text
create draft
submit
edit draft
withdraw
approve
reject
cancel
reassign approver
balance grant
carryover
balance adjustment
usage posted
usage reversed
PDF export nếu cần audit download
```

Sensitive fields không cần full payload nếu không cần.

---

# 70. CONCURRENCY / IDEMPOTENCY

Approve double-click:

- chỉ một transition
- một ledger usage

Cancel double-click:

- chỉ một reversal

Balance batch:

- idempotent batch reference

Dùng DB transaction.

---

# 71. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
leave_types
leave_requests
leave_request_versions nếu cần
leave_request_approval_steps
leave_workflows
leave_workflow_steps
leave_balances hoặc derived yearly summary
leave_ledger
leave_adjustments nếu tách
leave_request_attachments
```

Có thể derive balance từ ledger + materialized summary.

Không lưu chỉ mỗi `remaining_days`.

---

# 72. LEAVE REQUEST FIELDS

Concept:

```text
id
request_number
employee_id
leave_type_id
start_date
end_date
start_day_part
end_day_part
calculated_days
reason
status
submitted_at
approved_at
rejected_at
cancelled_at
workflow_snapshot
employee_snapshot
version
created_at
updated_at
```

Không nhét toàn bộ domain vào JSON.

---

# 73. APPROVAL STEP FIELDS

Concept:

```text
request_id
step_order
approver_type
resolved_approver_user_id
status
acted_at
comment
snapshot
```

---

# 74. API GỢI Ý

Employee:

```text
GET  /api/v1/leave-requests
POST /api/v1/leave-requests
GET  /api/v1/leave-requests/:id
PATCH /api/v1/leave-requests/:id
POST /api/v1/leave-requests/:id/submit
POST /api/v1/leave-requests/:id/withdraw
POST /api/v1/leave-requests/:id/cancel
GET  /api/v1/leave-requests/:id/pdf
```

Approval:

```text
GET  /api/v1/approvals/leave
POST /api/v1/leave-requests/:id/approve
POST /api/v1/leave-requests/:id/reject
```

Balance:

```text
GET  /api/v1/leave-balances
GET  /api/v1/employees/:id/leave-balance
POST /api/v1/leave-balances/grants
POST /api/v1/leave-balances/adjustments
GET  /api/v1/employees/:id/leave-ledger
```

Admin:

```text
GET/POST/PATCH /api/v1/leave-types
GET/POST/PATCH /api/v1/leave-workflows
```

---

# 75. INDEX / CONSTRAINT

Cần index:

```text
employee_id
status
start_date
end_date
request_number
approver_user_id
leave_year
```

Unique:

```text
request_number
ledger reference uniqueness khi usage/reversal
```

Overlap check dùng query phù hợp.

---

# 76. SERVER-SIDE VALIDATION

Server phải validate:

- authenticated employee
- leave type active
- dates
- workday calculation
- overlap
- balance
- policy
- workflow resolution
- permissions
- request current state
- approver assignment
- idempotency

Frontend chỉ là UX.

---

# 77. ERROR UX

Ví dụ:

```text
Số ngày phép không đủ.
```

```text
Bạn đã có đơn nghỉ trong thời gian này.
```

```text
Đơn đã được người khác xử lý.
```

```text
Không tìm thấy người duyệt.
```

Không raw SQL/HTTP error.

---

# 78. APPROVAL TIMELINE

Reusable component:

```text
ApprovalTimeline
```

Dùng cho future:

- nghỉ phép
- attendance adjustment
- đề nghị mua hàng
- thanh toán

Không hard-code component chỉ cho leave nếu abstraction hợp lý.

Nhưng không over-generalize backend nếu làm chậm implementation.

---

# 79. REQUEST ENGINE FOUNDATION

Có thể tạo reusable approval primitives:

```text
ApprovalWorkflow
ApprovalStep
ApprovalAction
```

để các module sau dùng.

Nhưng Leave Request vẫn có domain table/business logic riêng.

Không tạo một "generic JSON request engine" khó maintain.

---

# 80. NOTIFICATION BADGE

Header/mobile notification có thể show:

```text
2 đơn cần duyệt
```

Không cần realtime websocket nếu chưa cần.

Refresh/polling phù hợp đủ.

---

# 81. MANAGER DASHBOARD HOOK

Dashboard sau có thể query:

```text
Pending approvals count
```

Không hard-code dashboard trong module này.

---

# 82. EMPLOYEE PROFILE INTEGRATION

Employee detail thêm route-backed tab:

```text
/employees/:id/leave
```

Nếu current user có permission.

Hiển thị:

- số dư
- đơn nghỉ
- ledger

Không giant profile page.

---

# 83. REPORT ENGINE HOOK

Sau này Excel bảng công cần:

- approved leave list
- request submitted_at
- request reason
- approval status
- leave days
- balance summary

Expose service/DTO rõ.

Không generate Excel ở prompt này.

---

# 84. PDF TEST CASES

Bắt buộc test:

- pending PDF
- approved PDF
- rejected PDF
- long reason
- Vietnamese accents
- multiple approvers
- attachment không làm PDF fail
- logo missing fallback
- company info missing optional
- user without permission denied
- old approved request vẫn render stable sau khi employee đổi department
- PDF A4 không cắt nội dung

---

# 85. LEAVE TEST CASES

## Create

- full day
- half day morning
- half day afternoon
- multi-day
- weekend/holiday exclusion
- inactive leave type
- overlapping request

## Balance

- grant
- carryover
- adjustment
- pending not deducted officially
- final approval deducts once
- rejection no deduction
- cancellation reverses once
- negative balance policy

## Workflow

- manager → HR
- manager only
- missing manager
- workflow config changed after submit does not mutate request
- approver leaves and HR reassigns

## Concurrency

- approve twice
- two approvers act concurrently
- cancel twice

## Integration

- approved leave visible to worker roster
- approved leave queryable by attendance/timesheet
- attendance conflict flagged

## Routing

- deep link request detail
- back/forward
- refresh
- mobile routes

---

# 86. ACCEPTANCE CRITERIA

## Leave Request

- [ ] Full lifecycle.
- [ ] Draft.
- [ ] Submit.
- [ ] Approve.
- [ ] Reject.
- [ ] Withdraw.
- [ ] Cancel/reverse.
- [ ] No hard delete of processed request.
- [ ] Half-day.
- [ ] Multi-day.

## Balance

- [ ] Ledger-based.
- [ ] Không edit remaining trực tiếp.
- [ ] Grant.
- [ ] Carryover.
- [ ] Adjustment.
- [ ] Usage.
- [ ] Reversal.
- [ ] Pending shown separately.
- [ ] Year-based.

## Workflow

- [ ] Configurable.
- [ ] Snapshot at submit.
- [ ] No role-name hard-code.
- [ ] Missing approver handled.
- [ ] Audit actions.

## PDF

- [ ] Nút Xuất PDF.
- [ ] A4.
- [ ] Font tiếng Việt chuẩn.
- [ ] Branding từ Admin Console.
- [ ] Lý do nguyên văn.
- [ ] Approval timeline.
- [ ] Status rõ.
- [ ] Không fake handwritten signature.
- [ ] Access permission.
- [ ] Historical snapshot stable.

## Integration

- [ ] Attendance-ready.
- [ ] Worker roster-ready.
- [ ] Timesheet-ready.
- [ ] Excel Report Engine-ready.

## UI

- [ ] Mobile self-service đơn giản.
- [ ] Desktop HR list.
- [ ] Approval detail rõ.
- [ ] Route thật.
- [ ] Không giant page.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] PDF tests pass.
- [ ] Production build pass.
- [ ] Responsive review pass.

---

# 87. THỨ TỰ TRIỂN KHAI

1. Inspect employee/manager/role foundation.
2. Inspect work calendar/shift foundation.
3. Thiết kế Leave Type.
4. Thiết kế Leave Request lifecycle.
5. Thiết kế Leave Ledger.
6. Thiết kế yearly balance.
7. Thiết kế Approval Workflow primitives.
8. Workflow snapshot.
9. Migrations/indexes.
10. Leave APIs.
11. Approval APIs.
12. Balance/adjustment APIs.
13. Employee mobile UI.
14. Approver UI.
15. HR management UI.
16. Employee detail integration.
17. Attendance/roster integration hook.
18. PDF template.
19. PDF endpoint.
20. Audit.
21. Notifications hook.
22. Tests.
23. PDF rendering review.
24. Responsive/accessibility.
25. Lint/typecheck/build.
26. Báo cáo.

---

# 88. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Data model

- leave request
- workflow
- approval steps
- ledger
- balance

## Lifecycle

- state transitions
- cancellation/reversal

## Permission

- requester
- approver
- HR
- admin config

## PDF

- template structure
- branding source
- snapshot behavior
- permissions

## Integration

- attendance
- worker roster
- future timesheet/report

## Tests

- cases đã chạy
- kết quả

## Known limitations

Chỉ ghi limitation thật.

---

# 89. QUY TẮC CUỐI

Không dùng Excel làm nơi quản lý số dư phép.

Không để HR sửa trực tiếp "phép còn lại".

Không trừ phép khi đơn mới pending.

Không trừ phép hai lần vì double-click.

Không hard-code Manager → HR.

Không sửa workflow của đơn cũ khi admin đổi workflow mới.

Không xóa đơn đã xử lý để "làm sạch".

Không fake chữ ký người duyệt trong PDF.

Không đưa CCCD/ngân hàng vào PDF đơn nghỉ.

Không dùng PDF làm source of truth.

Không để approved leave và attendance conflict bị ghi đè âm thầm.

Không implement payroll trong prompt này.

**Dừng sau khi Leave + Approval + Leave Balance Ledger + PDF hoàn chỉnh, integration-ready, test/build pass và báo cáo kết quả.**
